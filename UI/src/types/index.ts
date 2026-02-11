export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  email: string;
  department?: string;
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
