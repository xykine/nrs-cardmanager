from typing import List, Optional
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import JobStatus


class CreateJobsIn(BaseModel):
    tenantId: str = "nrs"
    printerId: str = Field(default="ZXP7_OFFICE_1", alias="stationId")
    requestedBy: str = "system"
    templateId: str = "NRS_MINIMAL_V1"
    dpi: int = 300
    copies: int = 1
    employeeIds: Optional[List[str]] = None
    filters: Optional["EmployeeFilters"] = None
    is_all: bool = Field(default=False, alias="isAll")


class JobOut(BaseModel):
    jobId: str
    printerId: str
    status: str
    attempts: int
    frontPngUrl: str
    backPngUrl: str


class ClaimIn(BaseModel):
    tenantId: str
    printerId: str
    agentId: str
    limit: int = 10


class ClaimedJob(BaseModel):
    jobId: str
    employeeId: str
    fullName: str
    frontPngUrl: str
    backPngUrl: str
    attempts: int
    maxAttempts: int


class ClaimOut(BaseModel):
    jobs: List[ClaimedJob]


class ReportIn(BaseModel):
    agentId: str
    status: JobStatus  # PRINTED / RETRY / FAILED
    errorCode: Optional[str] = None
    errorMessage: Optional[str] = None
    errorRaw: Optional[dict] = None


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class EmployeeCreate(APIModel):
    first_name: str = Field(alias="firstName")
    last_name: str = Field(alias="lastName")
    employee_id: str = Field(alias="employeeId")
    email: str
    department: Optional[str] = None
    position: Optional[str] = None
    consultant_prefix: Optional[str] = Field(default=None, alias="consultantPrefix")
    id_prefix: Optional[str] = Field(default="IR", alias="idPrefix")
    employment_start_date: Optional[datetime] = Field(default=None, alias="employmentStartDate")
    employment_end_date: Optional[datetime] = Field(default=None, alias="employmentEndDate")

    @field_validator("employment_start_date", "employment_end_date", mode="before")
    @classmethod
    def parse_empty_date(cls, v):
        if v == "":
            return None
        return v


class EmployeeUpdate(APIModel):
    name: Optional[str] = None
    employee_id: Optional[str] = Field(default=None, alias="employeeId")
    email: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    consultant_prefix: Optional[str] = Field(default=None, alias="consultantPrefix")
    id_prefix: Optional[str] = Field(default="IR", alias="idPrefix")
    employment_start_date: Optional[datetime] = Field(default=None, alias="employmentStartDate")
    employment_end_date: Optional[datetime] = Field(default=None, alias="employmentEndDate")

    @field_validator("employment_start_date", "employment_end_date", mode="before")
    @classmethod
    def parse_empty_date(cls, v):
        if v == "":
            return None
        return v


class EmployeeRoleUpdate(APIModel):
    role: str


class EmployeePhotoStatusUpdate(APIModel):
    photo_present: bool = Field(alias="photoPresent")


class EmployeeFilters(APIModel):
    name: str = ""
    employee_id: str = Field(default="", alias="employeeId")
    email: str = ""
    is_bookmarked: bool = Field(default=False, alias="isBookmarked")
    photo_status: str = Field(default="all", alias="photoStatus")
    department: str = "all"
    employee_type: str = Field(default="all", alias="employeeType")
    position: Optional[str] = None
    consultant_prefix: Optional[str] = Field(default=None, alias="consultantPrefix")
    role: Optional[str] = None
    start_date: Optional[datetime] = Field(default=None, alias="startDate")
    end_date: Optional[datetime] = Field(default=None, alias="endDate")
    request_status: Optional[str] = Field(default=None, alias="requestStatus")

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def parse_empty_date(cls, v):
        if v == "":
            return None
        return v


class BulkEmailRequest(APIModel):
    employee_ids: Optional[list[str]] = Field(default=None, alias="employeeIds")
    filters: Optional[EmployeeFilters] = None
    is_all: bool = Field(default=False, alias="isAll")
    message: Optional[str] = None


class SingleEmailRequest(APIModel):
    message: str


class EmployeePublic(APIModel):
    id: str
    name: str
    employee_id: str = Field(alias="employeeId")
    email: str
    department: Optional[str] = None
    position: Optional[str] = None
    consultant_prefix: Optional[str] = Field(default=None, alias="consultantPrefix")
    id_prefix: Optional[str] = Field(default="IR", alias="idPrefix")
    employment_start_date: Optional[datetime] = Field(default=None, alias="employmentStartDate")
    employment_end_date: Optional[datetime] = Field(default=None, alias="employmentEndDate")
    role: str
    photo_present: bool = Field(alias="photoPresent")
    invitation_token: Optional[str] = Field(default=None, alias="invitationToken")
    invitation_sent_at: Optional[datetime] = Field(default=None, alias="invitationSentAt")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")


class CardPublic(APIModel):
    id: str
    employee_id: str = Field(alias="employeeId")
    photo_url: Optional[str] = Field(default=None, alias="photoUrl")
    photo_data: Optional[str] = Field(default=None, alias="photoData")
    photo_x: int = Field(default=0, alias="photoX")
    photo_y: int = Field(default=0, alias="photoY")
    photo_scale: float = Field(default=1.0, alias="photoScale")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")


class EmployeeOut(EmployeePublic):
    card: Optional[CardPublic] = None


class EmployeeListOut(APIModel):
    items: list[EmployeePublic]
    total: int
    page: int
    page_size: int


class CardOut(CardPublic):
    employee: Optional[EmployeePublic] = None


class CardSave(APIModel):
    photo_data: Optional[str] = Field(default=None, alias="photoData")
    photo_x: int = Field(default=0, alias="photoX")
    photo_y: int = Field(default=0, alias="photoY")
    photo_scale: float = Field(default=1.0, alias="photoScale")


class AdminLogin(APIModel):
    ir_number: Optional[str] = Field(default=None, alias="irNumber")
    password: str


class AdminOut(APIModel):
    id: str
    ir_number: str = Field(alias="irNumber")
    name: str
    created_at: datetime = Field(alias="createdAt")


class PrintReportOut(APIModel):
    id: str
    employee_id: str = Field(alias="employeeId")
    card_count: int = Field(alias="cardCount")
    print_date: datetime = Field(alias="printDate")
    employee: Optional[EmployeePublic] = None


class PrintReportListOut(APIModel):
    items: list[PrintReportOut]
    total: int
    page: int
    page_size: int


class DashboardStatsOut(APIModel):
    total_prints: int = Field(alias="totalPrints")
    total_employees: int = Field(alias="totalEmployees")
    employees_with_photos: int = Field(alias="employeesWithPhotos")


class DailyPrintStatsOut(APIModel):
    date: str
    count: int


class SummaryReportIn(APIModel):
    start_date: datetime = Field(alias="startDate")
    end_date: datetime = Field(alias="endDate")


class PrintUploadRowResult(APIModel):
    row_number: int = Field(alias="rowNumber")
    employee_id: Optional[str] = Field(default=None, alias="employeeId")
    name: Optional[str] = None
    position: Optional[str] = None
    status: str
    message: str


class PrintUploadSummary(APIModel):
    total_rows: int = Field(alias="totalRows")
    ready: int
    missing_photo: int = Field(alias="missingPhoto")
    missing_information: int = Field(alias="missingInformation")
    not_found: int = Field(alias="notFound")
    duplicates: int
    errors: int


class PrintUploadResult(APIModel):
    summary: PrintUploadSummary
    rows: list[PrintUploadRowResult]
    job_ids: list[str] = Field(alias="jobIds")


class EmployeeUploadRowResult(APIModel):
    row_number: int = Field(alias="rowNumber")
    first_name: Optional[str] = Field(default=None, alias="firstName")
    last_name: Optional[str] = Field(default=None, alias="lastName")
    email: Optional[str] = None
    employee_id: Optional[str] = Field(default=None, alias="employeeId")
    employee_db_id: Optional[str] = Field(default=None, alias="employeeDbId")
    action: str
    message: str
    photo_present: bool = Field(alias="photoPresent")


class EmployeeUploadSummary(APIModel):
    total_rows: int = Field(alias="totalRows")
    created: int
    updated: int
    skipped: int
    errors: int
    missing_photo: int = Field(alias="missingPhoto")


class EmployeeUploadResult(APIModel):
    summary: EmployeeUploadSummary
    rows: list[EmployeeUploadRowResult]


class EmployeeRequestCreate(APIModel):
    message: str


class EmployeeRequestPublic(APIModel):
    id: str
    employee_id: str = Field(alias="employeeId")
    message: str
    status: str
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
