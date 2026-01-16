# from __future__ import annotations

# import logging
# import os
# import uuid
# from datetime import datetime, timezone

# import httpx
# from fastapi import APIRouter, Depends, HTTPException, Query
# from sqlalchemy.orm import Session, joinedload


# from typing import Dict, Any, Iterable, List, Optional
# from urllib.parse import urljoin
# import time
# import random
# import requests

# from typing import Dict, List, Any, Iterable
# from urllib.parse import urljoin

# from ..db import get_db
# from ..models import Employee
# from ..schemas import (
#     EmployeeCreate,
#     EmployeeListOut,
#     EmployeeOut,
#     EmployeePhotoStatusUpdate,
#     EmployeeRoleUpdate,
# )

# router = APIRouter(prefix="/employees", tags=["employees"])
# logger = logging.getLogger(__name__)


# BASE = "https://api55.sapsf.eu/odata/v2/"
# AUTH = ("IDCARD_ADMIN@federalinl", "JCp^p3j3BfFm\"SX")  # or use OAuth token header

# SESSION = requests.Session()
# SESSION.auth = AUTH
# SESSION.headers.update({
#     "Accept": "application/json"
# })
# DEFAULT_TIMEOUT_SEC = 20
# PAGE_SIZE = 1000




# # ----------------------------
# # Core OData helpers (with retry)
# # ----------------------------
# def sf_get(entity: str, params: Dict[str, Any]) -> Dict[str, Any]:
#     """
#     GET helper with small retry policy for transient SF errors.
#     Retries on 429/502/503/504 with exponential backoff + jitter.
#     """
#     url = urljoin(BASE, entity)
#     max_attempts = 5
#     backoff = 1.0

#     for attempt in range(1, max_attempts + 1):
#         r = SESSION.get(url, params=params, timeout=DEFAULT_TIMEOUT_SEC)

#         if r.ok:
#             return r.json()

#         # Retry only transient errors
#         if r.status_code in (429, 502, 503, 504):
#             if attempt == max_attempts:
#                 break
#             sleep_s = backoff + random.uniform(0, 0.3)
#             time.sleep(sleep_s)
#             backoff *= 2
#             continue

#         # Non-retryable
#         raise RuntimeError(f"SF OData error {r.status_code}: {r.text}")

#     raise RuntimeError(f"SF OData error {r.status_code}: {r.text}")


# def iter_sf_results(entity: str, params: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
#     """
#     Iterate through SF OData v2 results using d.__next paging.
#     """
#     data = sf_get(entity, params)
#     d = data.get("d", {})

#     results = d.get("results", [])
#     print("PAGE 1 rows:", len(results))
#     print("PAGE 1 next:", d.get("__next"))

#     for row in results:
#         yield row

#     next_url = d.get("__next")
#     print("next_url:", next_url)

#     while next_url:
#         # next_url already contains full query and $skiptoken
#         max_attempts = 5
#         backoff = 1.0

#         for attempt in range(1, max_attempts + 1):
#             r = SESSION.get(next_url, headers={"Accept": "application/json"}, timeout=DEFAULT_TIMEOUT_SEC)

#             if r.ok:
#                 break

#             if r.status_code in (429, 502, 503, 504):
#                 if attempt == max_attempts:
#                     raise RuntimeError(f"SF OData paging error {r.status_code}: {r.text}")
#                 sleep_s = backoff + random.uniform(0, 0.3)
#                 time.sleep(sleep_s)
#                 backoff *= 2
#                 continue

#             raise RuntimeError(f"SF OData paging error {r.status_code}: {r.text}")

#         data = r.json()
#         d = data.get("d", {})
#         for row in d.get("results", []):
#             yield row
#         next_url = d.get("__next")



# # ----------------------------
# # Efficient full pulls (recommended)
# # ----------------------------
# def pull_all_personals() -> Dict[str, Dict[str, Optional[str]]]:
#     """
#     Pull ALL PerPersonal records (paged) and map:
#       personIdExternal -> {firstName, lastName}

#     If PerPersonal is time-sliced in your tenant, you may receive multiple rows per person.
#     This implementation keeps the last seen row; if you need "latest only", we can add a filter.
#     """
#     personal: Dict[str, Dict[str, Optional[str]]] = {}

#     params = {
#         "$select": "personIdExternal,firstName,lastName",
#         "$top": PAGE_SIZE,
#     }

#     for row in iter_sf_results("PerPersonal", params):
#         pid = row.get("personIdExternal")
#         if not pid:
#             continue
#         personal[pid] = {
#             "firstName": row.get("firstName"),
#             "lastName": row.get("lastName"),
#             "employeeId": row.get("personIdExternal"),
#         }

#     return personal


# def pull_all_primary_emails() -> Dict[str, str]:
#     """
#     Pull ALL primary emails (paged) and map:
#       personIdExternal -> emailAddress
#     """
#     emails: Dict[str, str] = {}

#     params = {
#         "$select": "personIdExternal,emailAddress,isPrimary",
#         "$filter": "isPrimary eq true",
#         "$top": PAGE_SIZE,
#     }

#     for row in iter_sf_results("PerEmail", params):
#         pid = row.get("personIdExternal")
#         email = row.get("emailAddress")
#         if pid and email:
#             emails[pid] = email

#     return emails


# # ----------------------------
# # Optional: Active-only filtering via EmpJob
# # ----------------------------
# def pull_active_user_ids_from_empjob(
#     *,
#     effective_latest_only: bool = True,
#     active_empl_status_values: Optional[List[str]] = None,
# ) -> List[str]:
#     """
#     Pull userIds from EmpJob (paged). If you want only ACTIVE employees,
#     supply active_empl_status_values (strings), e.g. ["1286"] depending on your tenant.

#     NOTE: You must confirm which emplStatus values represent ACTIVE in your tenant.
#     """
#     select_fields = ["userId"]
#     filters = []

#     if effective_latest_only:
#         filters.append("effectiveLatestChange eq true")

#     if active_empl_status_values:
#         # Build: (emplStatus eq 'A' or emplStatus eq 'B')
#         parts = [f"emplStatus eq '{v}'" for v in active_empl_status_values]
#         filters.append("(" + " or ".join(parts) + ")")

#     params: Dict[str, Any] = {
#         "$select": ",".join(select_fields),
#         "$top": PAGE_SIZE,
#     }
#     if filters:
#         params["$filter"] = " and ".join(filters)

#     user_ids = set()
#     for row in iter_sf_results("EmpJob", params):
#         uid = row.get("userId")
#         if uid:
#             user_ids.add(uid)

#     return sorted(user_ids)


# # ----------------------------
# # Build directory (recommended)
# # ----------------------------
# def build_employee_directory() -> List[Dict[str, Any]]:
#     """
#     Best for 13K: pull PerPersonal + PerEmail fully (paged) and merge.
#     Assumption in your tenant: personIdExternal == userId.
#     """
#     personal = pull_all_personals()
#     emails = pull_all_primary_emails()

#     merged: List[Dict[str, Any]] = []
#     for pid, name in personal.items():
#         merged.append({
#             "userId": pid,          # because personIdExternal == userId in your tenant
#             "employeeId": name.get("employeeId"),      # until you locate a distinct employee number field
#             "firstName": name.get("firstName"),
#             "lastName": name.get("lastName"),
#             "email": emails.get(pid),
#         })

#     return merged


# def build_employee_directory_active_only(active_status_codes: List[str]) -> List[Dict[str, Any]]:
#     """
#     If you need ACTIVE employees only:
#       1) Pull active userIds from EmpJob (paged)
#       2) Pull all PerPersonal + primary emails (paged)
#       3) Keep only those active IDs
#     """
#     active_user_ids = set(pull_active_user_ids_from_empjob(
#         effective_latest_only=True,
#         active_empl_status_values=active_status_codes
#     ))

#     personal = pull_all_personals()
#     emails = pull_all_primary_emails()

#     merged: List[Dict[str, Any]] = []
#     for pid, name in personal.items():
#         if pid not in active_user_ids:
#             continue
#         merged.append({
#             "userId": pid,
#             "employeeId": name.get("employeeId"),
#             "firstName": name.get("firstName"),
#             "lastName": name.get("lastName"),
#             "email": emails.get(pid),
#         })

#     return merged


# def get_employee_or_404(db: Session, employee_id: str) -> Employee:
#     employee = (
#         db.query(Employee)
#         .options(joinedload(Employee.card))
#         .filter(Employee.id == employee_id)
#         .first()
#     )
#     if not employee:
#         raise HTTPException(status_code=404, detail="Employee not found")
#     return employee


# @router.get("/sync-employee", response_model=list[EmployeeOut])
# def sync_employees(db: Session = Depends(get_db)):
#     try:
#         # _sync_employees_from_sap(db)
#         employees = build_employee_directory()
#         print(f"Employees: {len(employees)}")
#         print(employees[:3])
#     except HTTPException:
#         raise
#     except Exception as exc:
#         logger.exception("Unhandled error during SAP employee sync")
#         raise HTTPException(status_code=500, detail="Employee sync failed") from exc
#     return (
#         db.query(Employee)
#         .options(joinedload(Employee.card))
#         .order_by(Employee.created_at.desc())
#         .all()
#     )







from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Iterable, List, Optional
from urllib.parse import urljoin
import time
import random
import copy

import requests
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from sqlalchemy.orm import Session
from sqlalchemy import delete


from ..models import Employee

from dotenv import load_dotenv


from ..db import get_db
from ..models import Employee
from ..schemas import (
    EmployeeCreate,
    EmployeeListOut,
    EmployeeOut,
    EmployeePhotoStatusUpdate,
    EmployeeRoleUpdate,
)

router = APIRouter(prefix="/employees", tags=["employees"])
logger = logging.getLogger(__name__)
load_dotenv()


# ----------------------------
# SuccessFactors config
# ----------------------------
BASE = "https://api55.sapsf.eu/odata/v2/"

# ✅ Do NOT hardcode credentials. Put them in env vars.
SF_USERNAME = os.getenv("SAP_SF_USERNAME", "")
SF_PASSWORD = os.getenv("SAP_SF_PASSWORD", "")
if not SF_USERNAME or not SF_PASSWORD:
    logger.warning("SAP_SF_USERNAME / SAP_SF_PASSWORD not set. SAP SF calls will fail.")

AUTH = (SF_USERNAME, SF_PASSWORD)

SESSION = requests.Session()
SESSION.auth = AUTH
SESSION.headers.update({"Accept": "application/json"})

DEFAULT_TIMEOUT_SEC = 20
PAGE_SIZE = 1000  # records per page


# ----------------------------
# Core OData helpers (with retry)
# ----------------------------
def sf_get(entity: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """
    GET helper with small retry policy for transient SF errors.
    Retries on 429/502/503/504 with exponential backoff + jitter.
    """
    url = urljoin(BASE, entity)
    max_attempts = 5
    backoff = 1.0

    for attempt in range(1, max_attempts + 1):
        r = SESSION.get(url, params=params, timeout=DEFAULT_TIMEOUT_SEC)

        if r.ok:
            return r.json()

        if r.status_code in (429, 502, 503, 504):
            if attempt == max_attempts:
                break
            time.sleep(backoff + random.uniform(0, 0.3))
            backoff *= 2
            continue

        raise RuntimeError(f"SF OData error {r.status_code}: {r.text}")

    raise RuntimeError(f"SF OData error {r.status_code}: {r.text}")


def iter_sf_results(entity: str, params: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    """
    Iterate through SF OData v2 results.

    Strategy:
      1) Use d.__next paging when SF provides it.
      2) If __next is missing but we received a full page (len == $top),
         fallback to $skip paging.

    IMPORTANT for $skip paging:
      - Use $orderby for stable ordering, otherwise you can get duplicates/missing rows.
    """
    p = copy.deepcopy(params)
    top = int(p.get("$top", 0) or 0)
    skip = int(p.get("$skip", 0) or 0)

    # ---- First page ----
    data = sf_get(entity, p)
    d = data.get("d", {})
    results = d.get("results", []) or []

    # Debug (optional)
    # print(f"[{entity}] rows={len(results)} next={d.get('__next')} skip={skip} top={top}")

    for row in results:
        yield row

    next_url = d.get("__next")

    # ---- 1) Prefer __next if present ----
    while next_url:
        max_attempts = 5
        backoff = 1.0

        for attempt in range(1, max_attempts + 1):
            r = SESSION.get(next_url, headers={"Accept": "application/json"}, timeout=DEFAULT_TIMEOUT_SEC)
            if r.ok:
                break

            if r.status_code in (429, 502, 503, 504):
                if attempt == max_attempts:
                    raise RuntimeError(f"SF OData paging error {r.status_code}: {r.text}")
                time.sleep(backoff + random.uniform(0, 0.3))
                backoff *= 2
                continue

            raise RuntimeError(f"SF OData paging error {r.status_code}: {r.text}")

        data = r.json()
        d = data.get("d", {})
        page_results = d.get("results", []) or []

        for row in page_results:
            yield row

        next_url = d.get("__next")

        # Keep last page results length for fallback check (rarely needed here)
        results = page_results

    # ---- 2) Fallback: $skip paging if __next missing but page was full ----
    if top > 0 and len(results) == top:
        while True:
            skip += top
            p["$skip"] = skip

            data = sf_get(entity, p)
            d = data.get("d", {})
            page_results = d.get("results", []) or []

            # Debug (optional)
            # print(f"[{entity}] skip={skip} rows={len(page_results)}")

            if not page_results:
                break

            for row in page_results:
                yield row

            if len(page_results) < top:
                break


# ----------------------------
# Efficient full pulls (13K-friendly)
# ----------------------------
def pull_all_personals() -> Dict[str, Dict[str, Optional[str]]]:
    """
    Pull ALL PerPersonal records (paged) and map:
      personIdExternal -> {firstName, lastName, employeeId}

    Uses $orderby for stable $skip paging.
    """
    personal: Dict[str, Dict[str, Optional[str]]] = {}

    params = {
        "$select": "personIdExternal,firstName,lastName",
        "$top": PAGE_SIZE,
        "$orderby": "personIdExternal asc",  # ✅ important for stable $skip paging
    }

    for row in iter_sf_results("PerPersonal", params):
        pid = row.get("personIdExternal")
        if not pid:
            continue
        personal[pid] = {
            "firstName": row.get("firstName"),
            "lastName": row.get("lastName"),
            "employeeId": pid,  # until you locate a distinct employee number field
        }

    return personal


def pull_all_primary_emails() -> Dict[str, str]:
    """
    Pull ALL primary emails (paged) and map:
      personIdExternal -> emailAddress

    Uses $orderby for stable $skip paging.
    """
    emails: Dict[str, str] = {}

    params = {
        "$select": "personIdExternal,emailAddress,isPrimary",
        "$filter": "isPrimary eq true",
        "$top": PAGE_SIZE,
        "$orderby": "personIdExternal asc",  # ✅ important for stable $skip paging
    }

    for row in iter_sf_results("PerEmail", params):
        pid = row.get("personIdExternal")
        email = row.get("emailAddress")
        if pid and email:
            emails[pid] = email

    return emails


def build_employee_directory() -> List[Dict[str, Any]]:
    """
    Pull PerPersonal + PerEmail fully (paged) and merge by personIdExternal.

    Assumption in your tenant: personIdExternal == userId.
    """
    personal = pull_all_personals()
    emails = pull_all_primary_emails()

    merged: List[Dict[str, Any]] = []
    for pid, name in personal.items():
        merged.append({
            "userId": pid,
            "employeeId": name.get("employeeId"),
            "firstName": name.get("firstName"),
            "lastName": name.get("lastName"),
            "email": emails.get(pid),
        })

    return merged








def _full_name(first: Optional[str], last: Optional[str]) -> str:
    first = (first or "").strip()
    last = (last or "").strip()
    name = (first + " " + last).strip()
    return name or "—"


def _normalize_email(email: Optional[str]) -> Optional[str]:
    e = (email or "").strip().lower()
    return e or None


def _fallback_email(employee_id: str) -> str:
    # unique + non-null placeholder; safe for your schema
    return f"{employee_id}@noemail.local"


def replace_all_employees_in_db(
    db: Session,
    sf_employees: List[Dict[str, Any]],
    *,
    batch_size: int = 1000,
    default_role: str = "staff",
) -> Dict[str, Any]:
    """
    Wipes employees table then bulk-inserts all SAP employees.

    Guarantees:
      - employee_id is unique + not null
      - email is unique + not null  (creates fallback for missing/duplicate)
      - uses ORM attribute keys: employee_id, photo_present (NOT camel-case db col names)
    """
    inserted = 0
    missing_email_filled = 0
    duplicate_email_fixed = 0
    missing_employee_id_fixed = 0

    seen_emails: set[str] = set()
    seen_employee_ids: set[str] = set()

    try:
        # 1) Delete all employees (Card rows cascade delete-orphan will work when deleting via ORM,
        # but bulk SQL delete won't trigger ORM cascades. If you have FK constraints, you may need to delete Card first.)
        # If you hit FK errors, see note below.
        db.execute(delete(Employee))

        buf: List[Dict[str, Any]] = []

        for e in sf_employees:
            # --- employee_id (NOT NULL + UNIQUE) ---
            emp_id = (e.get("employeeId") or e.get("userId") or "").strip()
            if not emp_id:
                emp_id = str(uuid.uuid4())
                missing_employee_id_fixed += 1

            # Ensure employee_id uniqueness (rare but safe)
            if emp_id in seen_employee_ids:
                emp_id = f"{emp_id}-{uuid.uuid4().hex[:8]}"
                missing_employee_id_fixed += 1
            seen_employee_ids.add(emp_id)

            # --- email (NOT NULL + UNIQUE) ---
            email_norm = _normalize_email(e.get("email"))

            if not email_norm:
                email_norm = _fallback_email(emp_id)
                missing_email_filled += 1

            if email_norm in seen_emails:
                email_norm = _fallback_email(emp_id)
                duplicate_email_fixed += 1

            # ultra-safety in case fallback collides
            if email_norm in seen_emails:
                email_norm = f"{emp_id}.{uuid.uuid4().hex[:8]}@noemail.local"
                duplicate_email_fixed += 1

            seen_emails.add(email_norm)

            buf.append({
                # id is generated by model default; but bulk operations may still invoke it.
                # Safer: provide it explicitly.
                "id": str(uuid.uuid4()),

                "name": _full_name(e.get("firstName"), e.get("lastName")),

                # ✅ ORM attribute name
                "employee_id": emp_id,

                "email": email_norm,

                "role": default_role,

                # ✅ ORM attribute name
                "photo_present": False,
            })

            if len(buf) >= batch_size:
                db.bulk_insert_mappings(Employee, buf)
                inserted += len(buf)
                buf.clear()

        if buf:
            db.bulk_insert_mappings(Employee, buf)
            inserted += len(buf)

        db.commit()
        return {
            "deleted_all": True,
            "inserted": inserted,
            "batch_size": batch_size,
            "missing_email_filled": missing_email_filled,
            "duplicate_email_fixed": duplicate_email_fixed,
            "missing_employee_id_fixed": missing_employee_id_fixed,
        }

    except Exception:
        db.rollback()
        raise



# ----------------------------
# OPTIONAL: If you have FK constraints (Employee -> Card) and deletes fail,
# you may need to delete dependent tables first.
#
# Example (only if you actually have a model like EmployeeCard):
#
# from ..models import EmployeeCard
# def replace_all_employees_in_db_with_cards(db, sf_employees, ...):
#     db.execute(delete(EmployeeCard))
#     db.execute(delete(Employee))
#     ...
# ----------------------------


# ----------------------------
# How to use it inside your sync endpoint
# ----------------------------
"""
@router.get("/sync-employee", response_model=list[EmployeeOut])
def sync_employees(db: Session = Depends(get_db)):
    try:
        employees = build_employee_directory()
        summary = replace_all_employees_in_db(db, employees, batch_size=1000)
        logger.info("SAP sync summary: %s", summary)
    except Exception as exc:
        logger.exception("Unhandled error during SAP employee sync")
        raise HTTPException(status_code=500, detail="Employee sync failed") from exc

    return (
        db.query(Employee)
        .options(joinedload(Employee.card))
        .order_by(Employee.created_at.desc())
        .all()
    )
"""





# ----------------------------
# Your existing DB helpers / routes (unchanged)
# ----------------------------
def get_employee_or_404(db: Session, employee_code: str) -> Employee:
    employee = (
        db.query(Employee)
        .options(joinedload(Employee.card))
        .filter(Employee.employee_code == employee_code)
        .first()
    )
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


# ----------------------------
def get_employee_byid_or_404(db: Session, employee_id: str) -> Employee:
    employee = (
        db.query(Employee)
        .options(joinedload(Employee.card))
        .filter(Employee.id == employee_id)
        .first()
    )
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


@router.get("/sync-employee", response_model=list[EmployeeOut])
def sync_employees(db: Session = Depends(get_db)):
    try:
        employees = build_employee_directory()
        logger.info("Employees pulled from SF: %s", len(employees))

        summary = replace_all_employees_in_db(
            db=db,
            sf_employees=employees,
            batch_size=1000,
            default_role="staff",
        )
        logger.info("Employee DB replace summary: %s", summary)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unhandled error during SAP employee sync")
        raise HTTPException(status_code=500, detail="Employee sync failed") from exc

    return (
        db.query(Employee)
        .options(joinedload(Employee.card))
        .order_by(Employee.created_at.desc())
        .all()
    )













@router.get("/", response_model=EmployeeListOut)
def list_employees(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    total = db.query(Employee).count()
    offset = (page - 1) * page_size
    employees = (
        db.query(Employee)
        .options(joinedload(Employee.card))
        .order_by(Employee.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )
    return EmployeeListOut(
        items=employees,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/code/{employee_code}", response_model=EmployeeOut)
def get_employee(employee_id: str, db: Session = Depends(get_db)):
    return get_employee_or_404(db, employee_id)

@router.get("/{employee_id}", response_model=EmployeeOut)
def get_employee(employee_id: str, db: Session = Depends(get_db)):
    return get_employee_byid_or_404(db, employee_id)


@router.post("/", response_model=EmployeeOut, status_code=201)
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db)):
    employee = Employee(
        name=payload.name,
        employee_id=payload.employee_id,
        email=payload.email,
        photo_present=False,
    )
    db.add(employee)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create employee") from exc
    db.refresh(employee)
    return employee


@router.post("/{employee_id}/invitation")
def send_invitation(employee_id: str, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    token = str(uuid.uuid4())
    employee.invitation_token = token
    employee.invitation_sent_at = datetime.now(timezone.utc)

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to send invitation") from exc

    app_url = os.getenv("APP_URL", "http://localhost:5173")
    invitation_link = f"{app_url}/card/{employee.id}?token={token}"

    return {
        "message": "Invitation sent successfully",
        "invitationLink": invitation_link,
    }


@router.patch("/{employee_id}/photo-status", response_model=EmployeeOut)
def update_photo_status(
    employee_id: str,
    payload: EmployeePhotoStatusUpdate,
    db: Session = Depends(get_db),
):
    employee = get_employee_or_404(db, employee_id)
    employee.photo_present = payload.photo_present

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update photo status") from exc

    db.refresh(employee)
    return employee


@router.patch("/{employee_id}/role", response_model=EmployeeOut)
def update_role(employee_id: str, payload: EmployeeRoleUpdate, db: Session = Depends(get_db)):
    employee = get_employee_or_404(db, employee_id)

    if payload.role not in ("manager", "staff"):
        raise HTTPException(
            status_code=400, detail='Invalid role. Must be "manager" or "staff"'
        )

    employee.role = payload.role

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update role") from exc

    db.refresh(employee)
    return employee
