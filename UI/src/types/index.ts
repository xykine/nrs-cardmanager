export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  name?: string;
  employeeId: string;
  idPrefix?: string;
  email: string;
  department?: string;
  position?: string;
  consultantPrefix?: string;
  employmentStartDate?: string;
  employmentEndDate?: string;
  role: 'manager' | 'staff';
  photoPresent: boolean;
  invitationToken?: string;
  invitationSentAt?: string;
  createdAt: string;
  updatedAt: string;
  card?: Card;
}

export interface Card {
  id: string;
  employeeId: string;
  photoUrl?: string;
  photoData?: string;
  photoX?: number;
  photoY?: number;
  photoScale?: number;
  createdAt: string;
  updatedAt: string;
  employee?: Employee;
}

export type JobStatus = 'PENDING' | 'PRINTING' | 'PRINTED' | 'RETRY' | 'FAILED';

export interface PrintingStation {
  id: string;
  name: string;
  status: 'online' | 'offline';
  last_seen: string;
  created_at: string;
  updated_at: string;
}

export interface PrintBatch {
  id: string;
  created_by?: string;
  station_id: string;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  status: string;
  created_at: string;
  updated_at: string;
  printing_stations?: PrintingStation;
  jobs?: PrintJob[];
}

export interface PrintJob {
  id: string;
  batch_id: string;
  employee_id: string;
  status: JobStatus;
  retry_count: number;
  max_retries: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  employees?: Employee;
}
export interface PrintReport {
  id: string;
  employeeId: string;
  cardCount: number;
  printDate: string;
  employee?: Employee;
}

export interface PrintReportResponse {
  items: PrintReport[];
  total: number;
  page: number;
  page_size: number;
}

export interface EmployeeUploadRowResult {
  rowNumber: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  employeeId?: string;
  employeeDbId?: string;
  action: "created" | "updated" | "skipped" | "error";
  message: string;
  photoPresent: boolean;
}

export interface EmployeeUploadSummary {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  missingPhoto: number;
}

export interface EmployeeUploadResult {
  summary: EmployeeUploadSummary;
  rows: EmployeeUploadRowResult[];
}

export interface PrintUploadRowResult {
  rowNumber: number;
  employeeId?: string;
  name?: string;
  position?: string;
  status: "ready" | "missing-photo" | "missing-information" | "not-found" | "duplicate" | "error";
  message: string;
}

export interface PrintUploadSummary {
  totalRows: number;
  ready: number;
  missingPhoto: number;
  missingInformation: number;
  notFound: number;
  duplicates: number;
  errors: number;
}

export interface PrintUploadResult {
  summary: PrintUploadSummary;
  rows: PrintUploadRowResult[];
  jobIds: string[];
  pdfGenerated?: boolean;
  pdfMessage?: string;
}
