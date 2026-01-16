from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import PrintJob, JobStatus
from ..renderer import render_front, render_back
from ..schemas import (
    ClaimIn,
    ClaimedJob,
    ClaimOut,
    CreateJobsIn,
    JobOut,
    ReportIn,
)
from ..storage import ASSETS_DIR, job_dir


router = APIRouter()


def _now() -> datetime:
    return datetime.utcnow()


def _new_job_id(i: int) -> str:
    return f"JOB_{_now().strftime('%Y%m%d_%H%M%S')}_{i:06d}"


# @router.get("/health")
# def health():
#     return {"ok": True}


@router.post("/print-jobs", response_model=List[JobOut])
def create_print_jobs(payload: CreateJobsIn, db: Session = Depends(get_db)):
    # Validate assets exist
    logo = ASSETS_DIR / "nrs_logo.png"
    icon = ASSETS_DIR / "bottom_icon.png"
    if not logo.exists():
        raise HTTPException(400, f"Missing asset: {logo}")
    if not icon.exists():
        raise HTTPException(400, f"Missing asset: {icon}")

    out: List[JobOut] = []

    for idx, emp in enumerate(payload.employees, start=1):
        job_id = _new_job_id(idx)

        # Create DB record
        job = PrintJob(
            job_id=job_id,
            tenant_id=payload.tenantId,
            printer_id=payload.printerId,
            employee_id=emp.employeeId,
            full_name=emp.fullName,
            photo_url=str(emp.photoUrl),
            template_id=payload.templateId,
            dpi=payload.dpi,
            status=JobStatus.PENDING,
            attempts=0,
            max_attempts=3,
            created_at=_now(),
            updated_at=_now(),
        )

        # Render image immediately (MVP)
        d = job_dir(job_id)
        front_path = d / "front.png"
        img = render_front(emp.fullName, emp.employeeId, emp.photoUrl, logo, icon)
        img.save(front_path, "PNG")
        job.front_png_path = str(front_path)

        # Render + save BACK
        back_path = d / "back.png"
        back_img = render_back(logo_path=logo)   # you can pass dept/phones/email too
        back_img.save(back_path, "PNG")
        job.back_png_path = str(back_path)

        db.add(job)
        out.append(JobOut(
            jobId=job_id,
            printerId=payload.printerId,
            status=job.status.value,
            attempts=0,
            frontPngUrl=f"/print-jobs/{job_id}/front.png",
            backPngUrl=f"/print-jobs/{job_id}/back.png",
        ))

    db.commit()
    return out


@router.get("/print-jobs", response_model=List[JobOut])
def list_jobs(
    status: Optional[JobStatus] = None,
    printerId: Optional[str] = None,
    db: Session = Depends(get_db),
):
    stmt = select(PrintJob)
    if status:
        stmt = stmt.where(PrintJob.status == status)
    if printerId:
        stmt = stmt.where(PrintJob.printer_id == printerId)

    jobs = db.execute(stmt).scalars().all()
    return [
        JobOut(
            jobId=j.job_id,
            printerId=j.printer_id,
            status=j.status.value,
            attempts=j.attempts,
            frontPngUrl=f"/print-jobs/{j.job_id}/front.png",
            backPngUrl=f"/print-jobs/{j.job_id}/back.png",
        )
        for j in jobs
    ]


@router.post("/agents/claim", response_model=ClaimOut)
def claim_jobs(payload: ClaimIn, db: Session = Depends(get_db)):
    # Claim PENDING/RETRY jobs (ignore those with next_run_at in future)
    now = _now()

    stmt = (
        select(PrintJob)
        .where(PrintJob.tenant_id == payload.tenantId)
        .where(PrintJob.printer_id == payload.printerId)
        .where(PrintJob.status.in_([JobStatus.PENDING, JobStatus.RETRY]))
        .order_by(PrintJob.created_at.asc())
        .limit(payload.limit)
    )

    jobs = db.execute(stmt).scalars().all()
    claimed: List[ClaimedJob] = []

    print("Claiming jobs payload:", payload)

    for j in jobs:
        if j.next_run_at and j.next_run_at > now:
            continue

        j.status = JobStatus.PRINTING
        j.claimed_by = payload.agentId
        j.claimed_at = now
        j.updated_at = now

        claimed.append(ClaimedJob(
            jobId=j.job_id,
            employeeId=j.employee_id,
            fullName=j.full_name,
            frontPngUrl=f"/print-jobs/{j.job_id}/front.png",
            backPngUrl=f"/print-jobs/{j.job_id}/back.png",
            attempts=j.attempts,
            maxAttempts=j.max_attempts,
        ))

    db.commit()
    return ClaimOut(jobs=claimed)


@router.post("/print-jobs/{jobId}/report")
def report_job(jobId: str, payload: ReportIn, db: Session = Depends(get_db)):
    job = db.get(PrintJob, jobId)
    if not job:
        raise HTTPException(404, "Job not found")

    if job.claimed_by != payload.agentId:
        raise HTTPException(409, "Job not claimed by this agent")

    if payload.status == JobStatus.PRINTED:
        job.status = JobStatus.PRINTED
        job.error_code = None
        job.error_message = None
        job.error_raw = None
        job.updated_at = _now()

    elif payload.status in [JobStatus.FAILED, JobStatus.RETRY]:
        job.attempts += 1
        job.error_code = payload.errorCode
        job.error_message = payload.errorMessage
        job.error_raw = payload.errorRaw

        if job.attempts >= job.max_attempts:
            job.status = JobStatus.FAILED
        else:
            job.status = JobStatus.RETRY
            delay = [10, 30, 120][min(job.attempts - 1, 2)]
            job.next_run_at = _now() + timedelta(seconds=delay)

        job.updated_at = _now()

    db.commit()
    return {"ok": True, "status": job.status.value, "attempts": job.attempts}


@router.get("/print-jobs/{jobId}/front.png")
def get_front_png(jobId: str, db: Session = Depends(get_db)):
    job = db.get(PrintJob, jobId)
    if not job or not job.front_png_path:
        raise HTTPException(404, "Front image not found")
    return FileResponse(job.front_png_path, media_type="image/png")


@router.get("/print-jobs/{jobId}/back.png")
def get_back_png(jobId: str, db: Session = Depends(get_db)):
    job = db.get(PrintJob, jobId)
    if not job or not job.back_png_path:
        raise HTTPException(404, "Back image not found")
    return FileResponse(job.back_png_path, media_type="image/png")
