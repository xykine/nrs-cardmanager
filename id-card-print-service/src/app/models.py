import enum, uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Enum, Text, JSON, Date
from sqlalchemy.orm import declarative_base, DeclarativeBase
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

class Base(DeclarativeBase):
    pass

class JobStatus(str, enum.Enum):
    PENDING = "PENDING"
    PRINTING = "PRINTING"
    PRINTED = "PRINTED"
    FAILED = "FAILED"
    RETRY = "RETRY"

class PrintJob(Base):
    __tablename__ = "print_jobs"

    job_id = Column(String, primary_key=True)

    tenant_id = Column(String, nullable=False, default="nrs")
    printer_id = Column(String, nullable=False, default="ZXP7_OFFICE_1")

    employee_id = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    photo_url = Column(String, nullable=False)
    photo_x = Column(Integer, nullable=False, default=0)
    photo_y = Column(Integer, nullable=False, default=0)
    photo_scale = Column(String, nullable=False, default="1.0")

    template_id = Column(String, nullable=False, default="NRS_MINIMAL_V1")
    dpi = Column(Integer, nullable=False, default=300)

    front_png_path = Column(String, nullable=True)  # local file path
    back_png_path = Column(String, nullable=True)

    status = Column(Enum(JobStatus), nullable=False, default=JobStatus.PENDING)
    attempts = Column(Integer, nullable=False, default=0)
    max_attempts = Column(Integer, nullable=False, default=3)

    claimed_by = Column(String, nullable=True)
    claimed_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=True)

    error_code = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    error_raw = Column(JSON, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class Employee(Base):
    __tablename__ = "employees"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    employee_id = Column("employeeId", String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    department = Column(String, nullable=True)
    position = Column(String, nullable=True)
    consultant_prefix = Column(String, nullable=True)
    id_prefix = Column(String, nullable=False, default="IR")
    employment_start_date = Column(Date, nullable=True)
    employment_end_date = Column(Date, nullable=True)
    role = Column(String, default="staff", nullable=False)
    photo_present = Column("photoPresent", Boolean, default=False, nullable=False)
    invitation_token = Column("invitationToken", String, nullable=True)
    invitation_sent_at = Column("invitationSentAt", DateTime(timezone=True), nullable=True)
    created_at = Column("createdAt", DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        "updatedAt",
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    card = relationship("Card", back_populates="employee", uselist=False, cascade="all, delete-orphan")
    requests = relationship("EmployeeRequest", back_populates="employee", cascade="all, delete-orphan")
    bookmark = relationship("BookmarkedEmployee", back_populates="employee", uselist=False, cascade="all, delete-orphan")

    @property
    def is_bookmarked(self) -> bool:
        return bool(self.bookmark and self.bookmark.status == "active")


class BookmarkedEmployee(Base):
    __tablename__ = "bookmarked_employees"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column("employeeId", String, ForeignKey("employees.employeeId"), unique=True, nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="active")
    created_at = Column("createdAt", DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        "updatedAt",
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    employee = relationship("Employee", back_populates="bookmark")


class Card(Base):
    __tablename__ = "cards"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column("employeeId", String, ForeignKey("employees.id"), unique=True, nullable=False)
    photo_url = Column("photoUrl", Text, nullable=True)
    photo_data = Column("photoData", Text, nullable=True)
    photo_x = Column("photoX", Integer, nullable=False, default=0)
    photo_y = Column("photoY", Integer, nullable=False, default=0)
    photo_scale = Column("photoScale", String, nullable=False, default="1.0")
    created_at = Column("createdAt", DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        "updatedAt",
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    employee = relationship("Employee", back_populates="card")


class Admin(Base):
    __tablename__ = "admins"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    ir_number = Column("irNumber", String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    password = Column(String, nullable=False)
    created_at = Column("createdAt", DateTime(timezone=True), server_default=func.now(), nullable=False)


class PrintReport(Base):
    __tablename__ = "print_reports"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column("employeeId", String, ForeignKey("employees.id"), nullable=False)
    card_count = Column("cardCount", Integer, nullable=False, default=1)
    print_date = Column("printDate", DateTime(timezone=True), server_default=func.now(), nullable=False)

    employee = relationship("Employee")


class PrintingAnalytic(Base):
    __tablename__ = "printing_analytics"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    print_date = Column("printDate", Date, unique=True, nullable=False, index=True)
    total_prints = Column("totalPrints", Integer, nullable=False, default=0)
    updated_at = Column("updatedAt", DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class RequestStatus(str, enum.Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"


class EmployeeRequest(Base):
    __tablename__ = "employee_requests"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column("employeeId", String, ForeignKey("employees.id"), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(Enum(RequestStatus), nullable=False, default=RequestStatus.PENDING)
    created_at = Column("createdAt", DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        "updatedAt",
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    employee = relationship("Employee", back_populates="requests")
