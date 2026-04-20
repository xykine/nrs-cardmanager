import base64
import io
import shutil
import csv
from typing import Dict, Any
from datetime import datetime, timedelta, date
from typing import List, Optional

from PIL import Image
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..db import get_db
from ..models import Employee, PrintJob, JobStatus, Card, PrintReport, PrintingAnalytic
from ..renderer import render_front, render_back, render_front_landscape, render_back_landscape
from ..schemas import (
    ClaimIn,
    ClaimedJob,
    ClaimOut,
    CreateJobsIn,
    JobOut,
    ReportIn,
    PrintReportOut,
    PrintReportListOut,
    DashboardStatsOut,
    DailyPrintStatsOut,
    SummaryReportIn,
    PrintUploadResult,
)
from ..storage import ASSETS_DIR, job_dir
from .employees import (
    _apply_employee_filters,
    _filters_are_empty,
    _normalize_employee_id_for_upload,
    _normalize_template_header,
    _read_xlsx_rows,
)
from ..pdf_generator import create_id_card_pdf

import subprocess
import shutil

router = APIRouter(prefix="/api")
PRINT_JOBS_API_BASE = "/api/print-jobs"
PRINT_UPLOAD_TEMPLATE_HEADERS = ["IR"]


def _now() -> datetime:
    return datetime.utcnow()


def _new_job_id(i: int) -> str:
    return f"JOB_{_now().strftime('%Y%m%d_%H%M%S')}_{i:06d}"


def _get_background_assets_by_position(position: str) -> tuple:
    """Mirror frontend card preview logic for landscape card backgrounds."""
    pos = (position or "").strip().lower()
    if pos in {"contractor", "contract staff"}:
        return "ContractorFrontPageImage.jpg", "ContractorBackPageImage.jpg"
    if pos == "consultant":
        return "ConsultantFrontPage.jpg", "ConsultantBackPage.jpg"
    if pos == "transport assistant":
        return "TransportAssistantFrontPage.jpg", "TransportAssistantBackPage.jpg"
    return "ContractorFrontPageImage.jpg", "ContractorBackPageImage.jpg"


def _create_print_job_record(
    employee: Employee,
    idx: int,
    printer_id: str,
    tenant_id: str = "nrs",
    template_id: str = "NRS_MINIMAL_V1",
    dpi: int = 300,
) -> PrintJob:
    return PrintJob(
        job_id=_new_job_id(idx),
        tenant_id=tenant_id,
        printer_id=printer_id,
        employee_id=employee.employee_id or "N/A",
        full_name=employee.name or employee.employee_id,
        photo_url="MEMORY",
        photo_x=employee.card.photo_x if employee.card else 0,
        photo_y=employee.card.photo_y if employee.card else 0,
        photo_scale=(employee.card.photo_scale if employee.card else "1.0") or "1.0",
        template_id=template_id,
        dpi=dpi,
        status=JobStatus.PENDING,
        attempts=0,
        max_attempts=3,
        created_at=_now(),
        updated_at=_now(),
        front_png_path=None,
        back_png_path=None,
    )


def _required_print_information(employee: Employee) -> list[str]:
    missing: list[str] = []
    if not (employee.name or "").strip():
        missing.append("name")

    employee_code = (employee.employee_id or "").strip()
    if len(employee_code) == 5:
        return missing

    position = (employee.position or "").strip()
    if position in {"Transport Assistant", "Consultant"}:
        if not position:
            missing.append("position")
        if employee.employment_start_date is None:
            missing.append("start date")
        if employee.employment_end_date is None:
            missing.append("end date")

    return missing


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
    middle = ASSETS_DIR / "MiddleImage.png"
    bottom = ASSETS_DIR / "ButtomImage.png"
    back = ASSETS_DIR / "BackPageImage.png"
    
    required_assets = [logo, middle, bottom, back]
    for asset in required_assets:
        if not asset.exists():
            raise HTTPException(400, f"Missing asset: {asset.name}")

    employee_ids = payload.employeeIds or []
    
    if payload.is_all:
         query = db.query(Employee).options(joinedload(Employee.card))
         if payload.filters and not _filters_are_empty(payload.filters):
             query = _apply_employee_filters(
                query,
                name=payload.filters.name,
                employee_id=payload.filters.employee_id,
                email=payload.filters.email,
                is_bookmarked=payload.filters.is_bookmarked,
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
            print(f"Skipping employee {employee_id} ({employee.name}): Missing card or photo data")
            continue
            # raise HTTPException(400, f"Missing card photo data for employeeId: {employee_id}")

        job = _create_print_job_record(
            employee,
            idx=idx,
            printer_id=payload.printerId,
            tenant_id=payload.tenantId,
            template_id=payload.templateId,
            dpi=payload.dpi,
        )

        db.add(job)
        out.append(JobOut(
            jobId=job.job_id,
            printerId=payload.printerId,
            status=job.status.value,
            attempts=0,
            # These URLs might 404 if accessed directly now, but frontend only needs jobId for PDF
            frontPngUrl=f"{PRINT_JOBS_API_BASE}/{job.job_id}/front.png",
            backPngUrl=f"{PRINT_JOBS_API_BASE}/{job.job_id}/back.png",
        ))

    db.commit()
    return out


@router.post("/print-jobs/upload-print", response_model=PrintUploadResult)
async def upload_print_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    filename = (file.filename or "").strip()
    if not filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Please upload the provided .xlsx template")

    file_bytes = await file.read()
    workbook_rows = _read_xlsx_rows(file_bytes)
    non_empty_rows = [row for row in workbook_rows if any((cell or "").strip() for cell in row)]

    if not non_empty_rows:
        raise HTTPException(status_code=400, detail="The uploaded workbook is empty")

    headers = non_empty_rows[0][: len(PRINT_UPLOAD_TEMPLATE_HEADERS)]
    normalized_headers = [_normalize_template_header(value) for value in headers]
    expected_headers = [_normalize_template_header(value) for value in PRINT_UPLOAD_TEMPLATE_HEADERS]
    if normalized_headers != expected_headers:
        raise HTTPException(
            status_code=400,
            detail="The file does not conform with the expected template",
        )

    summary = {
        "totalRows": 0,
        "ready": 0,
        "missingPhoto": 0,
        "missingInformation": 0,
        "notFound": 0,
        "duplicates": 0,
        "errors": 0,
    }
    results: list[dict[str, Any]] = []
    seen_employee_ids: set[str] = set()
    job_ids: list[str] = []

    for row_number, row in enumerate(non_empty_rows[1:], start=2):
        values = row[: len(PRINT_UPLOAD_TEMPLATE_HEADERS)] + [""] * max(
            0, len(PRINT_UPLOAD_TEMPLATE_HEADERS) - len(row)
        )
        raw_ir = (values[0] or "").strip()
        if not raw_ir:
            continue

        summary["totalRows"] += 1
        result: dict[str, Any] = {
            "rowNumber": row_number,
            "employeeId": None,
            "name": None,
            "position": None,
            "status": "error",
            "message": "",
        }

        try:
            employee_code = _normalize_employee_id_for_upload(raw_ir)
            result["employeeId"] = employee_code

            if not employee_code:
                raise ValueError("IR is required")

            if employee_code in seen_employee_ids:
                summary["duplicates"] += 1
                result["status"] = "duplicate"
                result["message"] = "Duplicate IR in upload file"
                results.append(result)
                continue

            seen_employee_ids.add(employee_code)

            employee = (
                db.query(Employee)
                .options(joinedload(Employee.card))
                .filter(Employee.employee_id == employee_code)
                .first()
            )
            if not employee:
                summary["notFound"] += 1
                result["status"] = "not-found"
                result["message"] = "Employee not found"
                results.append(result)
                continue

            result["name"] = employee.name
            result["position"] = employee.position

            if not employee.card or not employee.card.photo_data:
                summary["missingPhoto"] += 1
                result["status"] = "missing-photo"
                result["message"] = "Missing photo"
                results.append(result)
                continue

            missing_fields = _required_print_information(employee)
            if missing_fields:
                summary["missingInformation"] += 1
                result["status"] = "missing-information"
                result["message"] = f"Missing required information: {', '.join(missing_fields)}"
                results.append(result)
                continue

            job = _create_print_job_record(
                employee,
                idx=len(job_ids) + 1,
                printer_id="PDF_GENERATION",
            )
            db.add(job)
            job_ids.append(job.job_id)
            summary["ready"] += 1
            result["status"] = "ready"
            result["message"] = "Included for PDF generation"
        except ValueError as exc:
            summary["errors"] += 1
            result["message"] = str(exc)
        except Exception as exc:
            summary["errors"] += 1
            result["message"] = "Unexpected processing error"
            print(f"Upload print failed on row {row_number}: {exc}")

        results.append(result)

    if job_ids:
        db.commit()
    else:
        db.rollback()

    return {"summary": summary, "rows": results, "jobIds": job_ids}


@router.post("/print-jobs/batch-pdf")
def get_batch_pdf(payload: Dict[str, Any], db: Session = Depends(get_db)):
    job_ids = payload.get("jobIds", [])
    if not job_ids:
        raise HTTPException(400, "No jobIds provided")

    jobs = db.query(PrintJob).filter(PrintJob.job_id.in_(job_ids)).all()
    if not jobs:
        raise HTTPException(404, "No jobs found")

    # Validate assets exist once
    logo = ASSETS_DIR / "nrs_logo.png"
    bottom = ASSETS_DIR / "bottom_icon.png"
    back = ASSETS_DIR / "BackPageImage.png"
    contractor_front = ASSETS_DIR / "ContractorFrontPageImage.jpg"
    contractor_back = ASSETS_DIR / "ContractorBackPageImage.jpg"
    
    if not all(a.exists() for a in [logo, bottom, back]):
        raise HTTPException(500, "Server assets missing (logo/accent/back template)")

    emp_ids_needed = [job.employee_id for job in jobs]
    employees = db.query(Employee).filter(Employee.employee_id.in_(emp_ids_needed)).all()
    employees_map = {e.employee_id: e for e in employees}

    card_images = []
    
    for job in jobs:
        try:
            # We need to render on the fly.
            # 1. Load photo
            if not job.photo_url:
                print(f"Skipping job {job.job_id}: No photo_url")
                continue
            
            photo_url_to_use = job.photo_url

            if job.photo_url == "MEMORY":
                # Fetch dynamically from Card via Employee
                # We join Employee and Card to get the photo data
                stmt = (
                    select(Card)
                    .join(Employee, Card.employee_id == Employee.id)
                    .where(Employee.employee_id == job.employee_id)
                )
                card = db.execute(stmt).scalars().first()
                if card and card.photo_data:
                    original_data = card.photo_data.strip()
                    if original_data.startswith("data:"):
                        photo_url_to_use = original_data
                    else:
                        photo_url_to_use = f"data:image/png;base64,{original_data}"
                else:
                    print(f"Skipping job {job.job_id}: Card or photo data not found for employee {job.employee_id}")
                    continue

            employee = employees_map.get(job.employee_id)
            
            # Layout detection should match the frontend preview:
            # employee IDs with length <= 5 use portrait, otherwise landscape.
            use_landscape = bool(employee and len((employee.employee_id or "").strip()) > 5)
            
            if use_landscape:
                # Dynamic Asset Mapping
                front_asset, back_asset = _get_background_assets_by_position(employee.position)
                front_path = ASSETS_DIR / front_asset
                back_path = ASSETS_DIR / back_asset
                
                if not front_path.exists() or not back_path.exists():
                    print(f"Missing position assets for {employee.position}: {front_asset}/{back_asset}")
                    # Fallback to defaults or skip
                    front_path = ASSETS_DIR / "ContractorFrontPageImage.jpg"
                    back_path = ASSETS_DIR / "ContractorBackPageImage.jpg"

                front_img = render_front_landscape(
                    job.full_name,
                    job.employee_id,
                    employee.position, # use position as the role display
                    photo_url_to_use,
                    front_path,
                    id_prefix=employee.id_prefix,
                    consultant_prefix=employee.consultant_prefix,
                    photo_x=job.photo_x,
                    photo_y=job.photo_y,
                    photo_scale=float(job.photo_scale or 1.0)
                )
                back_img = render_back_landscape(
                    job.employee_id, 
                    back_path,
                    employment_start_date=employee.employment_start_date,
                    employment_end_date=employee.employment_end_date
                )
                card_images.append((front_img, back_img, "L"))
            else:
                # Render Front (Portrait)
                front_img = render_front(
                    job.full_name, 
                    job.employee_id, 
                    photo_url_to_use,
                    logo,
                    bottom,
                    photo_x=job.photo_x,
                    photo_y=job.photo_y,
                    photo_scale=float(job.photo_scale or 1.0)
                )
                
                # Render Back (Portrait)
                back_img = render_back(job.employee_id, back)
                card_images.append((front_img, back_img, "P"))
            
        except Exception as e:
            print(f"Failed to render job {job.job_id}: {e}")
            continue
    
    if not card_images:
         raise HTTPException(400, "No valid images could be generated for provided jobs")

    # Generate PDF bytes in memory
    pdf_bytes = create_id_card_pdf(card_images)
    
    # Record PrintReport for each job (Upsert logic)
    employee_db_ids = [e.id for e in employees]
    
    # Fetch existing reports for these employees
    existing_reports = {
        r.employee_id: r 
        for r in db.query(PrintReport).filter(PrintReport.employee_id.in_(employee_db_ids)).all()
    }

    now = _now()
    # Try to get local date from client, fallback to UTC date
    local_date_str = payload.get("localDate")
    if local_date_str:
        try:
            today = date.fromisoformat(local_date_str)
        except ValueError:
            today = now.date()
    else:
        today = now.date()
    
    # Update PrintingAnalytic for today
    analytic = db.query(PrintingAnalytic).filter(PrintingAnalytic.print_date == today).first()
    if not analytic:
        analytic = PrintingAnalytic(print_date=today, total_prints=0)
        db.add(analytic)
    
    for job in jobs:
        employee = employees_map.get(job.employee_id)
        eid = employee.id if employee else None
        if eid:
            # Increment daily analytic
            analytic.total_prints += 1
            
            if eid in existing_reports:
                report = existing_reports[eid]
                report.card_count += 1
                report.print_date = now
            else:
                report = PrintReport(
                    employee_id=eid,
                    card_count=1,
                    print_date=now
                )
                db.add(report)
                # Cache the new report object in case the same employee is in the batch multiple times
                existing_reports[eid] = report
    db.commit()

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=batch_{_now().strftime('%Y%m%d%H%M%S')}.pdf"}
    )
 
    # Old logic removed:
    # pdf_filename = f"batch_{_now().strftime('%Y%m%d%H%M%S')}.pdf"
    # output_path = job_dir(jobs[0].job_id).parent / pdf_filename 
    # pdf_path = create_id_card_pdf(card_images, str(output_path))
    # return FileResponse(
    #     pdf_path, 
    #     media_type="application/pdf", 
    #     filename="print_batch.pdf"
    # )



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
    # (Since we removed photo saving, this dir might not exist or be empty)
    try:
        d = job_dir(job.job_id)
        if d.exists():
            shutil.rmtree(d)
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
             d = job_dir(job.job_id)
             if d.exists():
                 shutil.rmtree(d)
        except Exception:
            pass
        db.delete(job)
        
    db.commit()
    return {"ok": True, "deleted": len(jobs)}
@router.get("/print-reports", response_model=PrintReportListOut)
def list_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    start_date: Optional[datetime] = Query(None, alias="startDate"),
    end_date: Optional[datetime] = Query(None, alias="endDate"),
    db: Session = Depends(get_db),
):
    query = db.query(PrintReport).options(joinedload(PrintReport.employee))
    
    if start_date:
        query = query.filter(PrintReport.print_date >= start_date)
    if end_date:
        query = query.filter(PrintReport.print_date <= end_date)

    total = query.count()
    offset = (page - 1) * page_size
    reports = (
        query
        .order_by(PrintReport.print_date.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )
    
    return PrintReportListOut(
        items=reports,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/print-reports/export")
def export_reports(
    start_date: Optional[datetime] = Query(None, alias="startDate"),
    end_date: Optional[datetime] = Query(None, alias="endDate"),
    db: Session = Depends(get_db),
):
    query = db.query(PrintReport).options(joinedload(PrintReport.employee))
    
    if start_date:
        query = query.filter(PrintReport.print_date >= start_date)
    if end_date:
        query = query.filter(PrintReport.print_date <= end_date)

    reports = query.order_by(PrintReport.print_date.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(["Employee Name", "Employee ID", "Department", "Email", "Card Count", "Print Date"])
    
    for r in reports:
        writer.writerow([
            r.employee.name if r.employee else "N/A",
            r.employee.employee_id if r.employee else "N/A",
            r.employee.department if r.employee else "N/A",
            r.employee.email if r.employee else "N/A",
            r.card_count,
            r.print_date.strftime("%Y-%m-%d %H:%M:%S")
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=print_report_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"}
    )


@router.get("/dashboard/stats", response_model=DashboardStatsOut)
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_prints = db.query(func.sum(PrintingAnalytic.total_prints)).scalar() or 0
    total_employees = db.query(Employee).count()
    employees_with_photos = db.query(Employee).filter(Employee.photo_present == True).count()
    
    return DashboardStatsOut(
        totalPrints=total_prints,
        totalEmployees=total_employees,
        employeesWithPhotos=employees_with_photos
    )


@router.get("/dashboard/analytics", response_model=List[DailyPrintStatsOut])
def get_daily_analytics(
    days: int = Query(30, ge=1, le=365),
    localDate: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    if localDate:
        try:
            today_ref = date.fromisoformat(localDate)
        except ValueError:
            today_ref = date.today()
    else:
        today_ref = date.today()
        
    start_date = today_ref - timedelta(days=days-1)
    
    analytics = (
        db.query(PrintingAnalytic)
        .filter(PrintingAnalytic.print_date >= start_date)
        .order_by(PrintingAnalytic.print_date.asc())
        .all()
    )
    
    # Fill in gaps with zero prints
    analytics_map = {a.print_date: a.total_prints for a in analytics}
    result = []
    for i in range(days):
        d = start_date + timedelta(days=i)
        result.append(DailyPrintStatsOut(
            date=d.strftime("%Y-%m-%d"),
            count=analytics_map.get(d, 0)
        ))
    
    return result


@router.post("/dashboard/summary-report")
def generate_summary_report(
    payload: SummaryReportIn,
    db: Session = Depends(get_db)
):
    from fpdf import FPDF
    
    start_date = payload.start_date.date()
    end_date = payload.end_date.date()
    
    analytics = (
        db.query(PrintingAnalytic)
        .filter(PrintingAnalytic.print_date >= start_date)
        .filter(PrintingAnalytic.print_date <= end_date)
        .order_by(PrintingAnalytic.print_date.asc())
        .all()
    )
    
    total_all = sum(a.total_prints for a in analytics)
    
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", "B", 16)
    pdf.cell(0, 10, "Printing Activity Summary Report", ln=True, align="C")
    pdf.set_font("Arial", "", 12)
    pdf.cell(0, 10, f"Range: {start_date.strftime('%d/%m/%Y')} to {end_date.strftime('%d/%m/%Y')}", ln=True, align="C")
    pdf.ln(10)
    
    # Table Header
    pdf.set_font("Arial", "B", 12)
    pdf.cell(100, 10, "Date", border=1)
    pdf.cell(90, 10, "Cards Printed", border=1, ln=True)
    
    # Table Body
    pdf.set_font("Arial", "", 12)
    for a in analytics:
        d_str = a.print_date.strftime("%d/%m/%Y")
        pdf.cell(100, 10, d_str, border=1)
        pdf.cell(90, 10, str(a.total_prints), border=1, ln=True)
    
    # Total
    pdf.set_font("Arial", "B", 12)
    pdf.cell(100, 10, "TOTAL", border=1)
    pdf.cell(90, 10, str(total_all), border=1, ln=True)
    
    pdf_output = pdf.output()
    return StreamingResponse(
        io.BytesIO(pdf_output),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=summary_report_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"}
    )
