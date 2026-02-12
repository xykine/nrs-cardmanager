
from __future__ import annotations

import html
import logging
import os
import shutil
import smtplib
import tempfile
import textwrap
import uuid
import secrets
import string
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Dict, Any, Iterable, List, Optional
from urllib.parse import urljoin
import time
import random
import copy
import cv2
import numpy as np
from typing import Dict, List

import csv
import io
import requests
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from sqlalchemy.orm import Session
from sqlalchemy import delete, not_
from sqlalchemy.exc import IntegrityError


from ..models import Employee

from dotenv import load_dotenv


from ..db import get_db
from ..models import Employee, Admin
from ..schemas import (
    BulkEmailRequest,
    EmployeeCreate,
    EmployeeListOut,
    EmployeeOut,
    EmployeePhotoStatusUpdate,
    EmployeeRoleUpdate,
    EmployeeUpdate,
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



def pull_all_departments() -> Dict[str, Optional[str]]:
    """
    Pull ALL EmpJob records (paged) and map:
      userId -> divisionNav.name   (your "department name")

    We keep only the row where effectiveLatestChange == true (preferred),
    otherwise we keep the first seen for that userId.

    NOTE: This assumes your tenant has one "latest" job row per user.
    """
    dept_by_user: Dict[str, Optional[str]] = {}

    params = {
        "$select": "userId,effectiveLatestChange,department,departmentNav/name",
        "$expand": "departmentNav",
        "$top": PAGE_SIZE,
        "$orderby": "userId asc",  # stable for $skip paging
    }

    for row in iter_sf_results("EmpJob", params):
        user_id = row.get("userId")
        if not user_id:
            continue

        department_nav = row.get("departmentNav") or {}
        dept_name = department_nav.get("name")

        # Prefer the "latest" row if SF provides it
        is_latest = bool(row.get("effectiveLatestChange"))

        if user_id not in dept_by_user:
            dept_by_user[user_id] = dept_name
        else:
            # overwrite only if this row is marked latest and existing was from non-latest
            if is_latest and not dept_by_user.get(user_id):
                dept_by_user[user_id] = dept_name
            elif is_latest:
                dept_by_user[user_id] = dept_name

    return dept_by_user



def build_employee_directory() -> List[Dict[str, Any]]:
    """
    Pull PerPersonal + PerEmail fully (paged) and merge by personIdExternal.

    Assumption in your tenant: personIdExternal == userId.
    """
    personal = pull_all_personals()
    emails = pull_all_primary_emails()
    departments = pull_all_departments()
    print("Dept sample for 21855:", departments.get("21855"))


    merged: List[Dict[str, Any]] = []
    for pid, name in personal.items():
        merged.append({
            "userId": pid,
            "employeeId": name.get("employeeId"),
            "firstName": name.get("firstName"),
            "lastName": name.get("lastName"),
            "email": emails.get(pid),
            "department": departments.get(pid),
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


def _get_base_ui_url() -> str:
    base_ui_url = (os.getenv("BASE_UI_URL") or os.getenv("APP_URL") or "").strip()
    base_ui_url = base_ui_url.rstrip("/")
    if not base_ui_url:
        raise HTTPException(status_code=500, detail="BASE_UI_URL is not configured")
    return base_ui_url


def _get_smtp_settings() -> Dict[str, Any]:
    host = os.getenv("SMTP_HOST", "").strip()
    if not host:
        raise HTTPException(status_code=500, detail="SMTP_HOST is not configured")

    port_raw = os.getenv("SMTP_PORT", "587").strip() or "587"
    try:
        port = int(port_raw)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail="SMTP_PORT must be an integer") from exc

    user = (os.getenv("SMTP_USER") or os.getenv("MAIL_USERNAME") or "").strip()
    password = os.getenv("SMTP_PASSWORD")
    if password is None:
        password = os.getenv("MAIL_PASSWORD", "")
    sender = (os.getenv("SMTP_FROM", "") or user).strip()
    if not sender:
        raise HTTPException(status_code=500, detail="SMTP_FROM is not configured")

    use_tls = os.getenv("SMTP_USE_TLS", "true").strip().lower() in ("1", "true", "yes", "y")
    use_ssl = os.getenv("SMTP_USE_SSL", "false").strip().lower() in ("1", "true", "yes", "y")

    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "sender": sender,
        "use_tls": use_tls,
        "use_ssl": use_ssl,
    }


def _get_mailgun_settings() -> Dict[str, Any]:
    api_key = os.getenv("MAILGUN_API_KEY", "").strip()
    domain = os.getenv("MAILGUN_DOMAIN", "").strip()
    sender = os.getenv("MAILGUN_FROM", "").strip()
    base_url = (os.getenv("MAILGUN_BASE_URL", "") or "https://api.mailgun.net/v3").strip()
    base_url = base_url.rstrip("/")

    if not api_key:
        raise HTTPException(status_code=500, detail="MAILGUN_API_KEY is not configured")
    if not domain:
        raise HTTPException(status_code=500, detail="MAILGUN_DOMAIN is not configured")
    if not sender:
        raise HTTPException(status_code=500, detail="MAILGUN_FROM is not configured")

    return {
        "api_key": api_key,
        "domain": domain,
        "sender": sender,
        "base_url": base_url,
    }


def _open_smtp_connection(settings: Dict[str, Any]) -> smtplib.SMTP:
    if settings["use_ssl"]:
        server = smtplib.SMTP_SSL(settings["host"], settings["port"], timeout=20)
    else:
        server = smtplib.SMTP(settings["host"], settings["port"], timeout=20)

    server.ehlo()
    if settings["use_tls"] and not settings["use_ssl"]:
        server.starttls()
        server.ehlo()
    if settings["user"] and settings["password"]:
        server.login(settings["user"], settings["password"])

    return server


def _send_mailgun_message(
    settings: Dict[str, Any],
    *,
    to_email: str,
    subject: str,
    text: str,
    html_body: Optional[str] = None,
) -> None:
    url = f"{settings['base_url']}/{settings['domain']}/messages"
    data: Dict[str, Any] = {
        "from": settings["sender"],
        "to": to_email,
        "subject": subject,
        "text": text,
    }
    if html_body:
        data["html"] = html_body
    response = requests.post(
        url,
        auth=("api", settings["api_key"]),
        data=data,
        timeout=20,
    )
    if not response.ok:
        raise RuntimeError(f"Mailgun error {response.status_code}: {response.text}")


def _build_photo_upload_message(
    name: Optional[str],
    link: str,
    login_code: Optional[object],
    extra_message: Optional[str],
) -> str:
    safe_name = (name or "").strip()
    greeting_name = safe_name if safe_name else "there"
    lines = [
        f"Hello {greeting_name},",
        "",
        "Please upload your photo using the link below:",
        link,
    ]
    safe_login = (str(login_code) if login_code is not None else "").strip()
    if safe_login:
        lines.extend(["", f"Login code: {safe_login}"])
    extra = (extra_message or "").strip()
    if extra:
        lines.extend(["", extra])
    lines.extend(["", "Thank you."])
    return "\n".join(lines)


def _build_photo_upload_html(
    name: Optional[str],
    link: str,
    login_code: Optional[object],
    extra_message: Optional[str],
    *,
    support_email: str,
    organization_name: str,
    hr_team: str,
    support_contact: str,
    sample_image_url: Optional[str],
) -> str:
    safe_name = html.escape((name or "").strip() or "there")
    safe_link = html.escape(link, quote=True)
    safe_login = html.escape((str(login_code) if login_code is not None else "").strip())
    safe_support_email = html.escape((support_email or "").strip() or "HR Department")
    safe_org = html.escape((organization_name or "").strip() or "NRS")
    safe_hr_team = html.escape((hr_team or "").strip() or "HR / Administration Team")
    safe_support_contact = html.escape((support_contact or "").strip())
    safe_extra = html.escape((extra_message or "").strip())
    if safe_extra:
        safe_extra = safe_extra.replace("\n", "<br>")

    current_year = datetime.now(timezone.utc).year

    extra_block = ""
    if safe_extra:
        extra_block = (
            f"<p style=\"margin:0 0 18px 0; font-size:14px; line-height:1.6;\">"
            f"{safe_extra}</p>"
        )

    login_block = ""
    if safe_login:
        login_block = (
            "<div>"
            "<strong>Login Code:</strong> "
            "<span style=\"font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, "
            "Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:13px; "
            "background-color:#111827; color:#ffffff; padding:3px 8px; "
            "border-radius:8px; display:inline-block;\">"
            f"{safe_login}</span>"
            "</div>"
        )

    sample_block = ""
    if sample_image_url:
        safe_sample = html.escape(sample_image_url, quote=True)
        sample_block = textwrap.dedent(
            f"""
            <h3 style="margin:18px 0 10px 0; font-size:15px; line-height:1.3; color:#111827;">
              Sample Photo (For Guidance)
            </h3>
            <p style="margin:0 0 12px 0; font-size:13px; line-height:1.6; color:#374151;">
              The image below is an example of an acceptable ID photo style
              (white background, centered head and shoulders).
            </p>
            <div style="border:1px solid #e5e7eb; border-radius:12px; padding:14px; background-color:#ffffff;">
              <img
                alt="Sample ID Photo Guidance"
                width="360"
                style="display:block; width:200px; max-width:100%; height:auto; border-radius:10px; margin:0 auto;"
                src="{safe_sample}"
              />
            </div>
            <p style="margin:12px 0 0 0; font-size:12px; line-height:1.6; color:#6b7280;">
              Note: This is a guide illustration. Your actual photo should closely match
              these framing and background rules.
            </p>
            """
        ).strip()

    support_contact_block = ""
    if safe_support_contact:
        support_contact_block = f"<br><span style=\"color:#6b7280\">{safe_support_contact}</span>"

    return textwrap.dedent(
        f"""\
        <!doctype html>
        <html>
          <body style="margin:0; padding:0; background-color:#f3f4f6; font-family:Arial, Helvetica, sans-serif;">
            <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
              Please upload a compliant ID photo (white or transparent background, centered face).
              Use your login code to access the portal.
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
              style="background-color:#f3f4f6; padding:24px 0; width:100%;">
              <tbody>
                <tr>
                  <td align="center">
                    <table role="presentation" width="640" cellpadding="0" cellspacing="0"
                      style="width:640px; max-width:95%; background-color:#ffffff; border-radius:14px;
                      overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,0.08);">
                      <tbody>
                        <tr>
                         <td style="background:linear-gradient(135deg,#063C2B,#0B4F3A); padding:22px 26px;">
                            <div style="color:#ffffff; font-size:18px; font-weight:700; line-height:1.2;">
                                Employee ID Card Photo Upload
                            </div>
                            <div style="color:#CFEDE3; font-size:13px; margin-top:6px; line-height:1.4;">
                                Action required to complete your ID card production.
                            </div>
                         </td>
                        </tr>
                        <tr>
                          <td style="padding:24px 26px 10px 26px; color:#111827;">
                            <p style="margin:0 0 14px 0; font-size:14px; line-height:1.6;">
                              Dear <strong>{safe_name}</strong>,
                            </p>
                            <p style="margin:0 0 18px 0; font-size:14px; line-height:1.6;">
                              Welcome to the NRS ID card self service. Please use the link below to
                              upload your passport photograph.
                            </p>
                            {extra_block}
                            
                            <h3 style="margin:22px 0 10px 0; font-size:15px; line-height:1.3; color:#111827;">
                              Photo Requirements (Important)
                            </h3>
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                              style="border-collapse:separate; border-spacing:0 10px;">
                              <tbody>
                                <tr>
                                  <td style="vertical-align:top; width:26px; font-size:14px;">1.</td>
                                  <td style="font-size:14px; line-height:1.6;">
                                    <strong>Dimensions:</strong> 35mm wide by 45mm high (3.5 cm x 4.5 cm).
                                  </td>
                                </tr>
                                <tr>
                                  <td style="vertical-align:top; width:26px; font-size:14px;">2.</td>
                                  <td style="font-size:14px; line-height:1.6;">
                                    <strong>Background:</strong> Plain white.
                                  </td>
                                </tr>
                                <tr>
                                  <td style="vertical-align:top; width:26px; font-size:14px;">3.</td>
                                  <td style="font-size:14px; line-height:1.6;">
                                    <strong>Resolution (Digital):</strong> 600 DPI is recommended for high quality.
                                  </td>
                                </tr>
                                <tr>
                                  <td style="vertical-align:top; width:26px; font-size:14px;">4.</td>
                                  <td style="font-size:14px; line-height:1.6;">
                                    <strong>Digital Pixel Size:</strong> 600x800 pixels or 700x900 pixels.
                                  </td>
                                </tr>
                                <tr>
                                  <td style="vertical-align:top; width:26px; font-size:14px;">5.</td>
                                  <td style="font-size:14px; line-height:1.6;">
                                    <strong>Face Coverage:</strong> The face should cover 70-80% of the photo.
                                  </td>
                                </tr>
                                <tr>
                                  <td style="vertical-align:top; width:26px; font-size:14px;">6.</td>
                                  <td style="font-size:14px; line-height:1.6;">
                                    <strong>Expression:</strong> Neutral expression, mouth closed, eyes open.
                                  </td>
                                </tr>
                                <tr>
                                  <td style="vertical-align:top; width:26px; font-size:14px;">7.</td>
                                  <td style="font-size:14px; line-height:1.6;">
                                    <strong>Quality:</strong> High-resolution, full color, no shadows.
                                  </td>
                                </tr>
                                <tr>
                                  <td style="vertical-align:top; width:26px; font-size:14px;">8.</td>
                                  <td style="font-size:14px; line-height:1.6;">
                                    <strong>Glasses:</strong> No glasses allowed (even clear ones).
                                  </td>
                                </tr>
                                <tr>
                                  <td style="vertical-align:top; width:26px; font-size:14px;">9.</td>
                                  <td style="font-size:14px; line-height:1.6;">
                                    <strong>Hijab:</strong> Should not cover both ears; ears must be visible.
                                  </td>
                                </tr>

                                <tr>
                                  <td style="vertical-align:top; width:26px; font-size:14px;">10.</td>
                                  <td style="font-size:14px; line-height:1.6;">
                                    <strong>Deadline:</strong> Submission of ID card is 30th of February 2026.
                                  </td>
                                </tr>

                                
                              </tbody>
                            </table>

                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                              style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:14px;">
                              <tbody>
                                <tr>
                                  <td style="font-size:13px; line-height:1.6; color:#111827; padding:6px;">
                                    <div style="margin-bottom:6px;">
                                      <strong>Upload Link:</strong>
                                      <a href="{safe_link}" style="color:#0B4F3A; text-decoration:underline;">
                                        Click here to upload your photo
                                      </a>
                                    </div>
                                    {login_block}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                            
                            {sample_block}
                            <div style="margin:18px 0 0 0; padding:12px 14px; background-color:#fffbeb;
                              border:1px solid #fde68a; border-radius:12px; color:#92400e;
                              font-size:13px; line-height:1.6;">
                              <strong>Automatic validation:</strong> Uploaded photos are automatically checked.
                              If your photo does not meet requirements, it may be rejected and you will be asked
                              to upload another.
                            </div>
                            <p style="margin:18px 0 0 0; font-size:13px; line-height:1.6; color:#374151;">
                              If you have questions or experience issues uploading, please contact
                              <strong>{safe_support_email}</strong>.
                            </p>
                            <p style="margin:18px 0 0 0; font-size:14px; line-height:1.6;">
                              Kind regards,<br>
                              <strong>{safe_org}</strong><br>
                              <span style="color:#6b7280">{safe_hr_team}</span>
                              {support_contact_block}
                            </p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:16px 26px 22px 26px; background-color:#f9fafb;
                            border-top:1px solid #e5e7eb; color:#6b7280; font-size:12px; line-height:1.6;">
                            This email was sent to you because you are scheduled for Employee ID Card issuance.
                            <br>Copyright {current_year} {safe_org}. All rights reserved.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div style="height:18px; line-height:18px;">&nbsp;</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
        """
    ).strip()


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

                "department": (e.get("department") or None),  


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


def upsert_employees_in_db(
    db: Session,
    sf_employees: List[Dict[str, Any]],
    *,
    batch_size: int = 1000,
    default_role: str = "staff",
) -> Dict[str, Any]:
    """
    Inserts new employees and updates existing ones without deleting rows.

    - Matches on employee_id
    - Updates name/email when provided
    - Preserves role/photo_present/invitation fields
    """
    inserted = 0
    updated = 0
    skipped = 0
    duplicate_employee_id_skipped = 0
    missing_email_filled = 0
    duplicate_email_fixed = 0
    missing_employee_id_fixed = 0
    email_conflicts_skipped = 0

    existing_employees = db.query(Employee).all()
    existing_by_employee_id = {
        e.employee_id: e for e in existing_employees if e.employee_id
    }
    seen_employee_ids: set[str] = set(existing_by_employee_id.keys())
    seen_emails: set[str] = set()

    for e in existing_employees:
        email_norm = _normalize_email(e.email)
        if email_norm:
            seen_emails.add(email_norm)

    processed_employee_ids: set[str] = set()
    buf: List[Dict[str, Any]] = []

    try:
        for e in sf_employees:
            emp_id = (e.get("employeeId") or e.get("userId") or "").strip()
            if not emp_id:
                emp_id = str(uuid.uuid4())
                missing_employee_id_fixed += 1

            if emp_id in processed_employee_ids:
                duplicate_employee_id_skipped += 1
                continue
            processed_employee_ids.add(emp_id)

            existing = existing_by_employee_id.get(emp_id)
            if existing:
                updated_this = False

                first = (e.get("firstName") or "").strip()
                last = (e.get("lastName") or "").strip()
                first = (e.get("firstName") or "").strip()
                last = (e.get("lastName") or "").strip()
                if first or last:
                    name = _full_name(first, last)
                    if name != existing.name:
                        existing.name = name
                        updated_this = True

                email_norm = _normalize_email(e.get("email"))
                if email_norm:
                    existing_email_norm = _normalize_email(existing.email)
                    if email_norm != existing_email_norm:
                        if email_norm in seen_emails:
                            email_conflicts_skipped += 1
                        else:
                            if existing_email_norm:
                                seen_emails.discard(existing_email_norm)
                            existing.email = email_norm
                            seen_emails.add(email_norm)
                            updated_this = True

                if updated_this:
                    updated += 1
                else:
                    skipped += 1
                continue

            if emp_id in seen_employee_ids:
                emp_id = f"{emp_id}-{uuid.uuid4().hex[:8]}"
                missing_employee_id_fixed += 1

            email_norm = _normalize_email(e.get("email"))
            if not email_norm:
                email_norm = _fallback_email(emp_id)
                missing_email_filled += 1

            if email_norm in seen_emails:
                email_norm = _fallback_email(emp_id)
                duplicate_email_fixed += 1

            if email_norm in seen_emails:
                email_norm = f"{emp_id}.{uuid.uuid4().hex[:8]}@noemail.local"
                duplicate_email_fixed += 1

            seen_employee_ids.add(emp_id)
            seen_emails.add(email_norm)

            buf.append({
                "id": str(uuid.uuid4()),
                "name": _full_name(e.get("firstName"), e.get("lastName")),
                "employee_id": emp_id,
                "email": email_norm,
                "department": (e.get("department") or None),
                "role": default_role,
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
            "deleted_all": False,
            "inserted": inserted,
            "updated": updated,
            "skipped_existing": skipped,
            "duplicate_employee_id_skipped": duplicate_employee_id_skipped,
            "batch_size": batch_size,
            "missing_email_filled": missing_email_filled,
            "duplicate_email_fixed": duplicate_email_fixed,
            "missing_employee_id_fixed": missing_employee_id_fixed,
            "email_conflicts_skipped": email_conflicts_skipped,
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
        summary = upsert_employees_in_db(db, employees, batch_size=1000)
        logger.info("Employee DB upsert summary: %s", summary)
    except Exception as exc:
        logger.exception("Unhandled error during SAP employee sync")
        raise HTTPException(status_code=500, detail="Employee sync failed") from exc

    return (
        db.query(Employee)
        .options(joinedload(Employee.card))
        .order_by(Employee.name.asc(), Employee.employee_id.asc())
        .all()
    )
"""





# ----------------------------
# Your existing DB helpers / routes (unchanged)
# ----------------------------
def get_employee_or_404(db: Session, employee_id: str) -> Employee:
    employee = (
        db.query(Employee)
        .options(joinedload(Employee.card))
        .filter(Employee.employee_id == employee_id)
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


def _apply_employee_filters(
    query,
    *,
    name: Optional[str],
    employee_id: Optional[str],
    photo_status: Optional[str],
    department: Optional[str],
):
    name = (name or "").strip()
    if name:
        query = query.filter(Employee.name.ilike(f"%{name}%"))

    employee_id = (employee_id or "").strip()
    if employee_id:
        query = query.filter(Employee.employee_id.ilike(f"{employee_id}%"))

    department = (department or "").strip()
    if department and department.lower() != "all":
        query = query.filter(Employee.department.ilike(department))

    photo_status = (photo_status or "").strip().lower()
    if photo_status and photo_status != "all":
        if photo_status in ("yes", "true", "1"):
            query = query.filter(Employee.photo_present.is_(True))
        elif photo_status in ("no", "false", "0"):
            query = query.filter(Employee.photo_present.is_(False))
        else:
            raise HTTPException(
                status_code=400,
                detail='photoStatus must be "yes" or "no"',
            )

    return query


def _filters_are_empty(filters: Any) -> bool:
    name = (getattr(filters, "name", "") or "").strip()
    employee_id = (getattr(filters, "employee_id", "") or "").strip()
    photo_status = (getattr(filters, "photo_status", "") or "").strip().lower()
    department = (getattr(filters, "department", "") or "").strip().lower()
    return (
        not name
        and not employee_id
        and photo_status in ("", "all")
        and department in ("", "all")
    )


@router.get("/sync-employee", response_model=list[EmployeeOut])
def sync_employees(db: Session = Depends(get_db)):
    try:
        employees = build_employee_directory()
        logger.info("Employees pulled from SF: %s", len(employees))

        summary = upsert_employees_in_db(
            db=db,
            sf_employees=employees,
            batch_size=1000,
            default_role="staff",
        )
        logger.info("Employee DB upsert summary: %s", summary)

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
    page_size: int = Query(20, ge=1, le=200),
    name: Optional[str] = Query(None),
    employee_id: Optional[str] = Query(None, alias="employeeId"),
    photo_status: Optional[str] = Query(None, alias="photoStatus"),
    department: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Employee)
    query = _apply_employee_filters(
        query,
        name=name,
        employee_id=employee_id,
        photo_status=photo_status,
        department=department,
    )
    query = query.filter(not_(Employee.employee_id.like("90%")))

    total = query.count()
    offset = (page - 1) * page_size
    employees = (
        query
        .order_by(Employee.name.asc(), Employee.employee_id.asc())
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


@router.get("/departments", response_model=list[str])
def list_departments(db: Session = Depends(get_db)):
    rows = (
        db.query(Employee.department)
        .filter(Employee.department.isnot(None))
        .distinct()
        .order_by(Employee.department.asc())
        .all()
    )
    departments = {(row[0] or "").strip() for row in rows}
    return sorted(d for d in departments if d)


@router.get("/code/{employee_id}", response_model=EmployeeOut)
def get_employee(employee_id: str, db: Session = Depends(get_db)):
    print("employee_code:", employee_id)
    return get_employee_or_404(db, employee_id)

@router.get("/{employee_id}", response_model=EmployeeOut)
def get_employee(employee_id: str, db: Session = Depends(get_db)):
    return get_employee_byid_or_404(db, employee_id)


@router.post("/", response_model=EmployeeOut, status_code=201)
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db)):
    # Pre-check for duplicates to give specific error messages
    if db.query(Employee).filter(Employee.employee_id == payload.employee_id).first():
        raise HTTPException(status_code=409, detail="Employee with this IR Number already exists")
    
    if db.query(Employee).filter(Employee.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Employee with this Email already exists")

    employee = Employee(
        name=f"{payload.first_name} {payload.last_name}".strip(),
        employee_id=payload.employee_id,
        email=payload.email,
        department=payload.department,
        photo_present=False,
    )
    db.add(employee)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning("Duplicate entry creation attempt: %s", exc)
        raise HTTPException(
            status_code=409, 
            detail="Employee with this Email or ID already exists"
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.error("Failed to create employee: %s", exc)
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


@router.post("/bulk-email")
def send_bulk_email(
    payload: BulkEmailRequest | None = None,
    db: Session = Depends(get_db),
):
    base_ui_url = _get_base_ui_url()
    subject = (os.getenv("PHOTO_UPLOAD_EMAIL_SUBJECT", "Upload your photo") or "").strip()
    if not subject:
        subject = "Upload your photo"

    query = db.query(Employee)
    employee_ids = payload.employee_ids if payload else None
    filters = payload.filters if payload else None
    is_all = payload.is_all if payload else False

    if employee_ids:
        employees = query.filter(Employee.id.in_(employee_ids)).all()
    elif is_all:
        if filters and not _filters_are_empty(filters):
            query = _apply_employee_filters(
                query,
                name=filters.name,
                employee_id=filters.employee_id,
                photo_status=filters.photo_status,
                department=filters.department,
            )
        employees = query.all()
    else:
        return {"success": 0, "failed": 0, "skipped": 0}

    if not employees:
        return {"success": 0, "failed": 0, "skipped": 0}

    invitation_sent_at = datetime.now(timezone.utc)
    for employee in employees:
        employee.invitation_sent_at = invitation_sent_at

    mailgun_configured = any(
        (os.getenv("MAILGUN_API_KEY"), os.getenv("MAILGUN_DOMAIN"), os.getenv("MAILGUN_FROM"))
    )
    smtp = None
    settings = None
    if mailgun_configured:
        settings = _get_mailgun_settings()
    else:
        settings = _get_smtp_settings()
        smtp = _open_smtp_connection(settings)

    success = 0
    failed = 0
    skipped = 0

    try:
        for employee in employees:
            to_email = _normalize_email(employee.email)
            if not to_email:
                skipped += 1
                continue

            upload_link = f"{base_ui_url}/card-upload/invitation"
            login_code = employee.employee_id
            extra_message = payload.message if payload else None
            text_body = _build_photo_upload_message(
                employee.name,
                upload_link,
                login_code,
                extra_message,
            )
            html_body = _build_photo_upload_html(
                employee.name,
                upload_link,
                login_code,
                extra_message,
                support_email=(os.getenv("PHOTO_UPLOAD_SUPPORT_EMAIL") or "HR Department").strip(),
                organization_name=(
                    os.getenv("PHOTO_UPLOAD_ORGANIZATION_NAME") or "Your Organization Name"
                ).strip(),
                hr_team=(os.getenv("PHOTO_UPLOAD_HR_TEAM") or "HR / Administration Team").strip(),
                support_contact=(os.getenv("PHOTO_UPLOAD_SUPPORT_CONTACT") or "").strip(),
                sample_image_url=(os.getenv("PHOTO_UPLOAD_SAMPLE_IMAGE_URL") or "").strip() or None,
            )

            try:
                if mailgun_configured:
                    _send_mailgun_message(
                        settings,
                        to_email=to_email,
                        subject=subject,
                        text=text_body,
                        html_body=html_body,
                    )
                else:
                    msg = EmailMessage()
                    msg["From"] = settings["sender"]
                    msg["To"] = to_email
                    msg["Subject"] = subject
                    msg.set_content(text_body)
                    msg.add_alternative(html_body, subtype="html")
                    smtp.send_message(msg)
                success += 1
            except Exception:
                failed += 1
                logger.exception("Failed to send upload email to %s", to_email)
    finally:
        if smtp:
            try:
                smtp.quit()
            except Exception:
                smtp.close()

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to update invitation timestamps",
        ) from exc

    return {"success": success, "failed": failed, "skipped": skipped}


def _generate_random_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _send_admin_credentials_email(employee: Employee, password: str):
    base_ui_url = _get_base_ui_url()
    subject = "NRS Card Management System - Admin Access"
    
    mailgun_configured = any(
        (os.getenv("MAILGUN_API_KEY"), os.getenv("MAILGUN_DOMAIN"), os.getenv("MAILGUN_FROM"))
    )
    
    text_body = textwrap.dedent(
        f"""
        Hello {employee.name},

        You have been granted Manager access to the NRS Card Management System.
        
        Please use the following credentials to access the administrative dashboards:
        IR Number: {employee.employee_id}
        Password: {password}
        
        You can log in here: {base_ui_url}/login
        
        Regards,
        System Administrator
        """
    ).strip()

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #2563eb;">Admin Access Granted</h2>
          <p>Hello <strong>{employee.name}</strong>,</p>
          <p>You have been granted <strong>Manager</strong> access to the NRS Card Management System.</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>IR Number:</strong> {employee.employee_id}</p>
            <p style="margin: 5px 0 0 0;"><strong>Password:</strong> <code style="background: #e2e8f0; padding: 2px 5px; border-radius: 4px;">{password}</code></p>
          </div>
          <p>You can access the administrative dashboards here:</p>
          <a href="{base_ui_url}/login" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">Login to Dashboard</a>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #666;">This is an automated message from the NRS Card Management System.</p>
        </div>
      </body>
    </html>
    """

    try:
        if mailgun_configured:
            settings = _get_mailgun_settings()
            _send_mailgun_message(
                settings,
                to_email=employee.email,
                subject=subject,
                text=text_body,
                html_body=html_body,
            )
        else:
            settings = _get_smtp_settings()
            with _open_smtp_connection(settings) as smtp:
                msg = EmailMessage()
                msg["From"] = settings["sender"]
                msg["To"] = employee.email
                msg["Subject"] = subject
                msg.set_content(text_body)
                msg.add_alternative(html_body, subtype="html")
                smtp.send_message(msg)
        logger.info("Admin credentials email sent to %s", employee.email)
    except Exception:
        logger.exception("Failed to send admin credentials email to %s", employee.email)


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
    employee = get_employee_byid_or_404(db, employee_id)

    if payload.role not in ("manager", "staff"):
        raise HTTPException(
            status_code=400, detail='Invalid role. Must be "manager" or "staff"'
        )

    old_role = employee.role
    employee.role = payload.role

    # Handle Admin table sync
    if old_role != "manager" and payload.role == "manager":
        # Create/Update Admin entry
        admin = db.query(Admin).filter(Admin.ir_number == employee.employee_id).first()
        password = _generate_random_password()
        
        if not admin:
            admin = Admin(
                ir_number=employee.employee_id,
                name=employee.name,
                password=password
            )
            db.add(admin)
        else:
            admin.password = password
            admin.name = employee.name
        
        # We commit before sending email to ensure DB is updated
        try:
            db.commit()
            _send_admin_credentials_email(employee, password)
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=500, detail="Failed to create admin entry") from exc
            
    elif old_role == "manager" and payload.role == "staff":
        # Remove Admin entry
        db.query(Admin).filter(Admin.ir_number == employee.employee_id).delete()
        try:
            db.commit()
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=500, detail="Failed to remove admin entry") from exc
    else:
        # No role change or non-manager related change
        try:
            db.commit()
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=500, detail="Failed to update role") from exc

    db.refresh(employee)
    return employee


@router.patch("/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: str,
    payload: EmployeeUpdate,
    db: Session = Depends(get_db),
):
    employee = get_employee_byid_or_404(db, employee_id)

    if payload.name is not None:
        employee.name = payload.name

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update employee") from exc

    db.refresh(employee)
    return employee


def _top_corner_pixels_bgr(bgr: np.ndarray, patch_px: int) -> np.ndarray:
    """Pixels from top-left + top-right corner patches only."""
    h, w = bgr.shape[:2]
    p = max(10, min(patch_px, h // 2, w // 2))

    tl = bgr[:p, :p, :].reshape(-1, 3)
    tr = bgr[:p, w - p :, :].reshape(-1, 3)

    return np.concatenate([tl, tr], axis=0)


def _lab_distance_to_white(pixels_bgr: np.ndarray) -> np.ndarray:
    """Per-pixel LAB distance to pure white."""
    pixels_bgr = pixels_bgr.astype(np.uint8)
    lab = cv2.cvtColor(pixels_bgr.reshape(-1, 1, 3), cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)

    white_lab = cv2.cvtColor(
        np.array([[[255, 255, 255]]], dtype=np.uint8),
        cv2.COLOR_BGR2LAB
    ).reshape(3).astype(np.float32)

    return np.linalg.norm(lab - white_lab, axis=1)


def validate_id_photo(image_path: str) -> Dict:
    """
    Validates:
    1. Background is white / close-to-white (stricter than before).
    2. Person is NOT wearing glasses.
    """
    errors: List[str] = []

    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        return {"status": "error", "errors": ["Invalid or unreadable image file."]}

    h, w = img.shape[:2]

    # --- 1. Background Validation (Stricter) ---
    # Sample ONLY top corners (simple + robust for portraits)
    patch_px = max(30, int(min(h, w) * 0.12))  # ~12% of image
    sample = _top_corner_pixels_bgr(img, patch_px=patch_px)

    dist = _lab_distance_to_white(sample)

    # Tuning knobs: 
    # threshold 35.0 is a bit more tolerant than 30.0 but still rejects gray.
    threshold = 35.0        
    ratio_required = 0.90   # 90% of corners must be white-ish

    white_ratio = float(np.mean(dist <= threshold))

    if white_ratio < ratio_required:
        errors.append("Background is not white enough (gray or off-white backgrounds are not allowed).")

    # --- 2. Glasses Detection ---
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray) # Improve contrast for better detection
    
    # Load cascades from cv2 data
    face_cascade_path = os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml")
    eye_with_glasses_cascade_path = os.path.join(cv2.data.haarcascades, "haarcascade_eye_tree_eyeglasses.xml")
    
    face_cascade = cv2.CascadeClassifier(face_cascade_path)
    eye_glasses_cascade = cv2.CascadeClassifier(eye_with_glasses_cascade_path)

    # Detect faces
    faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(100, 100))
    
    glasses_detected = False
    for (x, y, w_face, h_face) in faces:
        # Eye region is typically in the upper half of the face
        roi_gray = gray[y + int(h_face * 0.2) : y + int(h_face * 0.5), x : x + w_face]
        
        # Detect eyes specifically for eyeglasses
        # minNeighbors=12 is much more conservative than 5 to reduce false positives
        eyes = eye_glasses_cascade.detectMultiScale(
            roi_gray, 
            scaleFactor=1.1, 
            minNeighbors=5, 
            minSize=(20, 20)
        )
        
        if len(eyes) > 0:
            glasses_detected = True
            break
            
    if glasses_detected:
        errors.append("Photos with glasses are not allowed. Please take a photo without glasses.")

    if errors:
        return {"status": "error", "errors": errors}

    return {"status": "success"}


@router.post("/validate-photo")
def validate(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required.")

    temp_path: Optional[str] = None
    try:
        _, suffix = os.path.splitext(file.filename)
        with tempfile.NamedTemporaryFile(prefix="id-photo-", suffix=suffix, delete=False) as tmp:
            shutil.copyfileobj(file.file, tmp)
            temp_path = tmp.name
        return validate_id_photo(temp_path)
    finally:
        try:
            file.file.close()
        except Exception:
            pass
        if temp_path:
            try:
                os.remove(temp_path)
            except OSError:
                pass

@router.delete("/{id}", response_model=Dict[str, Any])
def delete_employee(id: str, db: Session = Depends(get_db)):
    employee = db.get(Employee, id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    db.delete(employee)
    db.commit()
    return {"ok": True, "message": "Employee deleted"}


@router.post("/bulk-delete", response_model=Dict[str, Any])
def delete_bulk_employees(
    payload: Dict[str, List[str]], 
    db: Session = Depends(get_db)
):
    ids = payload.get("employeeIds", [])
    if not ids:
        return {"ok": True, "deleted": 0}

    # Verify employees exist (optional, but good for reporting)
    # We can just issue a delete statement for efficiency
    
    stmt = delete(Employee).where(Employee.id.in_(ids))
    result = db.execute(stmt)
    db.commit()
    
    return {"ok": True, "deleted": result.rowcount}


@router.post("/export-csv")
def export_employees_csv(
    payload: BulkEmailRequest | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Employee)
    employee_ids = payload.employee_ids if payload else None
    filters = payload.filters if payload else None
    is_all = payload.is_all if payload else False

    if employee_ids:
        employees = query.filter(Employee.id.in_(employee_ids)).all()
    elif is_all:
        if filters and not _filters_are_empty(filters):
            query = _apply_employee_filters(
                query,
                name=filters.name,
                employee_id=filters.employee_id,
                photo_status=filters.photo_status,
                department=filters.department,
            )
        employees = query.all()
    else:
        employees = []

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["S/N", "Employee Name", "Employee ID"])

    for i, emp in enumerate(employees, start=1):
        name = emp.name.title() if emp.name else ""
        writer.writerow([i, name, emp.employee_id])

    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=employees.csv"}
    )
