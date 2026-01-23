from typing import List, Optional
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from .models import JobStatus


class CreateJobsIn(BaseModel):
    tenantId: str = "nrs"
    printerId: str = "ZXP7_OFFICE_1"
    requestedBy: str = "system"
    templateId: str = "NRS_MINIMAL_V1"
    dpi: int = 300
    copies: int = 1
    employeeIds: List[str]


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
    name: str
    employee_id: str = Field(alias="employeeId")
    email: str


class EmployeeRoleUpdate(APIModel):
    role: str


class EmployeePhotoStatusUpdate(APIModel):
    photo_present: bool = Field(alias="photoPresent")


class EmployeeFilters(APIModel):
    name: str = ""
    employee_id: str = Field(default="", alias="employeeId")
    photo_status: str = Field(default="all", alias="photoStatus")
    department: str = "all"


class BulkEmailRequest(APIModel):
    employee_ids: Optional[list[str]] = Field(default=None, alias="employeeIds")
    filters: Optional[EmployeeFilters] = None
    is_all: bool = Field(default=False, alias="isAll")
    message: Optional[str] = None


class EmployeePublic(APIModel):
    id: str
    name: str
    employee_id: str = Field(alias="employeeId")
    email: str
    department: Optional[str] = None
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
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")


class EmployeeOut(EmployeePublic):
    card: Optional[CardPublic] = None


class EmployeeListOut(APIModel):
    items: list[EmployeeOut]
    total: int
    page: int
    page_size: int


class CardOut(CardPublic):
    employee: Optional[EmployeePublic] = None


class CardSave(APIModel):
    photo_data: Optional[str] = Field(default=None, alias="photoData")
