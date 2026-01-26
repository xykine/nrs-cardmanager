import base64
import io
import shutil
from typing import Dict
from datetime import datetime, timedelta
from typing import List, Optional

from PIL import Image
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import Employee, PrintJob, JobStatus
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
from .employees import _apply_employee_filters, _filters_are_empty
from ..pdf_generator import create_id_card_pdf

import subprocess
import shutil

router = APIRouter(prefix="/api")
PRINT_JOBS_API_BASE = "/api/print-jobs"


def _now() -> datetime:
    return datetime.utcnow()


def _new_job_id(i: int) -> str:
    return f"JOB_{_now().strftime('%Y%m%d_%H%M%S')}_{i:06d}"


def _decode_photo_data(photo_data: str) -> Image.Image:
    if not photo_data:
        raise HTTPException(400, "Missing photo data")
    if photo_data.startswith("data:"):
        _, encoded = photo_data.split(",", 1)
    else:
        encoded = photo_data
    try:
        raw = base64.b64decode(encoded.strip())
    except ValueError as exc:
        raise HTTPException(400, "Invalid photo data") from exc
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except Exception as exc:
        raise HTTPException(400, "Photo data is not a valid image") from exc
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    return img


def _get_available_printers() -> List[str]:
    """List printers using lpstat -p -d | awk '{print $2}' logic."""
    try:
        # Mac/Linux: lpstat -p -d
        # Output example:
        # printer Canon_LBP6200 is idle.  enabled since ...
        # printer Canon_LBP6200 generic_driver...
        res = subprocess.run(["lpstat", "-p"], capture_output=True, text=True)
        if res.returncode != 0:
            return []
        
        printers = []
        for line in res.stdout.splitlines():
            # line: "printer <name> is idle. ..." => split by space, index 1
            parts = line.strip().split()
            if len(parts) >= 2 and parts[0] == "printer":
                printers.append(parts[1])
        
        # Unique and sorted
        return sorted(list(set(printers)))
    except Exception:
        return []


@router.get("/printers", response_model=List[str])
def list_printers():
    return _get_available_printers()


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

    employee_ids = payload.employeeIds or []
    
    if payload.is_all:
         query = db.query(Employee).options(joinedload(Employee.card))
         if payload.filters and not _filters_are_empty(payload.filters):
             query = _apply_employee_filters(
                query,
                name=payload.filters.name,
                employee_id=payload.filters.employee_id,
                photo_status=payload.filters.photo_status,
                department=payload.filters.department,
            )
         employees = query.all()
         employee_ids = [e.id for e in employees]
    elif employee_ids:
        employees = (
            db.query(Employee)
            .options(joinedload(Employee.card))
            .filter(Employee.id.in_(employee_ids))
            .all()
        )
    else:
        # No IDs and not is_all => empty
        employees = []

    employees_by_id = {employee.id: employee for employee in employees}
    # missing = [employee_id for employee_id in employee_ids if employee_id not in employees_by_id]
    # if missing:
    #     raise HTTPException(404, f"Employees not found: {', '.join(missing)}")

    out: List[JobOut] = []

    for idx, employee_id in enumerate(employee_ids, start=1):
        employee = employees_by_id[employee_id]
        if not employee.card or not employee.card.photo_data:
            raise HTTPException(400, f"Missing card photo data for employeeId: {employee_id}")

        job_id = _new_job_id(idx)

        # Create DB record
        full_name = employee.name or employee.employee_id
        empp_ID = employee.employee_id or "N/A"
        photo_img = _decode_photo_data(employee.card.photo_data)
        d = job_dir(job_id)
        photo_path = d / "photo.png"
        photo_img.save(photo_path, "PNG")

        job = PrintJob(
            job_id=job_id,
            tenant_id=payload.tenantId,
            printer_id=payload.printerId,
            employee_id=empp_ID,
            full_name=full_name,
            photo_url=str(photo_path),
            photo_x=employee.card.photo_x or 0,
            photo_y=employee.card.photo_y or 0,
            photo_scale=employee.card.photo_scale or "1.0",
            template_id=payload.templateId,
            dpi=payload.dpi,
            status=JobStatus.PENDING,
            attempts=0,
            max_attempts=3,
            created_at=_now(),
            updated_at=_now(),
        )

        # Optimization: Do NOT render front/back images to disk here.
        # We will render them on-the-fly when PDF is requested.
        # This saves disk space and inodes.
        job.front_png_path = None
        job.back_png_path = None

        db.add(job)
        out.append(JobOut(
            jobId=job_id,
            printerId=payload.printerId,
            status=job.status.value,
            attempts=0,
            # These URLs might 404 if accessed directly now, but frontend only needs jobId for PDF
            frontPngUrl=f"{PRINT_JOBS_API_BASE}/{job_id}/front.png",
            backPngUrl=f"{PRINT_JOBS_API_BASE}/{job_id}/back.png",
        ))

    db.commit()
    return out


@router.post("/print-jobs/batch-pdf")
def get_batch_pdf(payload: Dict[str, List[str]], db: Session = Depends(get_db)):
    job_ids = payload.get("jobIds", [])
    if not job_ids:
        raise HTTPException(400, "No jobIds provided")

    jobs = db.query(PrintJob).filter(PrintJob.job_id.in_(job_ids)).all()
    if not jobs:
        raise HTTPException(404, "No jobs found")

    # Validate assets exist once
    logo = ASSETS_DIR / "nrs_logo.png"
    icon = ASSETS_DIR / "bottom_icon.png"
    if not logo.exists() or not icon.exists():
        raise HTTPException(500, "Server assets missing (logo/icon)")

    card_images = []
    
    for job in jobs:
        try:
            # We need to render on the fly.
            # 1. Load photo
            if not job.photo_url:
                print(f"Skipping job {job.job_id}: No photo_url")
                continue
                
            # Render Front
            front_img = render_front(
                job.full_name, 
                job.employee_id, 
                job.photo_url, # render_front opens this path
                logo, 
                icon,
                photo_x=job.photo_x,
                photo_y=job.photo_y,
                photo_scale=float(job.photo_scale or 1.0)
            )
            
            # Render Back
            back_img = render_back(logo_path=logo)
            
            card_images.append((front_img, back_img))
            
        except Exception as e:
            print(f"Failed to render job {job.job_id}: {e}")
            continue
    
    if not card_images:
         raise HTTPException(400, "No valid images could be generated for provided jobs")

    # Create temporary PDF
    # We use the first job's directory to store the PDF momentarily
    # Or just a temp file. Let's stick to the pattern but maybe cleaner.
    pdf_filename = f"batch_{_now().strftime('%Y%m%d%H%M%S')}.pdf"
    output_path = job_dir(jobs[0].job_id).parent / pdf_filename 
    
    # Pass PIL images directly to generator
    pdf_path = create_id_card_pdf(card_images, str(output_path))
    
    return FileResponse(
        pdf_path, 
        media_type="application/pdf", 
        filename="print_batch.pdf"
    )


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
            frontPngUrl=f"{PRINT_JOBS_API_BASE}/{j.job_id}/front.png",
            backPngUrl=f"{PRINT_JOBS_API_BASE}/{j.job_id}/back.png",
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
            frontPngUrl=f"{PRINT_JOBS_API_BASE}/{j.job_id}/front.png",
            backPngUrl=f"{PRINT_JOBS_API_BASE}/{j.job_id}/back.png",
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


@router.delete("/printing/batches/{id}")
def delete_batch(id: str, db: Session = Depends(get_db)):
    # Treat 'batch' as a single PrintJob for now, 
    # since we don't have a separate Batch model.
    job = db.get(PrintJob, id)
    if not job:
        raise HTTPException(404, "Batch not found")
    
    # Optional: Delete files on disk
    try:
        shutil.rmtree(job_dir(job.job_id))
    except Exception:
        pass  # ignore file errors

    db.delete(job)
    db.commit()
    return {"ok": True, "message": "Batch deleted"}


@router.post("/printing/batches/bulk-delete")
def delete_bulk_batches(
    payload: Dict[str, List[str]], 
    db: Session = Depends(get_db)
):
    ids = payload.get("batchIds", [])
    if not ids:
        return {"ok": True, "deleted": 0}

    # For safety/files, we might want to iterate, but for speed:
    # We will just delete from DB. File cleanup might need a background job or iteration.
    stmt = select(PrintJob).where(PrintJob.job_id.in_(ids))
    jobs = db.execute(stmt).scalars().all()
    
    for job in jobs:
        # cleanup files
        try:
             shutil.rmtree(job_dir(job.job_id))
        except Exception:
            pass
        db.delete(job)
        
    db.commit()
    return {"ok": True, "deleted": len(jobs)}
