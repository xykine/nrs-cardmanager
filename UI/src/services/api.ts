import { EmployeeFilters } from "../components/FilterEmployee";
import {
  Employee,
  EmployeeUploadResult,
  Card,
  PrintingStation,
  PrintBatch,
  JobStatus,
  PrintUploadResult,
  EmployeeNotification,
  EmployeeNotificationListResponse,
  PrintingJobSummary,
  BatchPrintJob,
} from "../types";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export const resolvePdfUrl = (pdfUrl?: string): string => {
  if (!pdfUrl) return "";
  if (pdfUrl.startsWith("http")) return pdfUrl;
  
  // Strip trailing /api and / to avoid double slashes or double api prefixes
  const baseUrl = (import.meta.env.VITE_API_URL || "http://localhost:8000/api")
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");
  
  return `${baseUrl}${pdfUrl.startsWith("/") ? "" : "/"}${pdfUrl}`;
};

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface BulkActionPayload {
  employeeIds?: string[];
  filters?: EmployeeFilters;
  isAll?: boolean;
  message?: string;
}

export const employeeService = {

  async getDepartments(): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/employees/departments`);
    if (!response.ok) throw new Error("Failed to fetch departments");
    return response.json();
  },

  async getAll(
    page: number = 1,
    pageSize: number = 200,
    filters?: Record<string, any>,
  ): Promise<PaginatedResponse<Employee>> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== "all" && value !== "") {
          // Format dates as ISO strings if they are date objects or strings that can be converted
          if ((key === "startDate" || key === "endDate") && value) {
            const dateStr = value instanceof Date ? value.toISOString() : new Date(value).toISOString();
            params.append(key, dateStr);
          } else {
            params.append(key, value.toString());
          }
        }
      });
    }

    const response = await fetch(
      `${API_BASE_URL}/employees?${params.toString()}`,
    );
    if (!response.ok) throw new Error("Failed to fetch employees");
    return response.json();
  },

  async getByCode(id: string): Promise<Employee> {
    console.log("Fetching employee by code:", id);
    const response = await fetch(`${API_BASE_URL}/employees/code/${id}`);
    if (!response.ok) throw new Error("Failed to fetch employee");
    return response.json();
  },

  async getById(id: string): Promise<Employee> {
    const response = await fetch(`${API_BASE_URL}/employees/${id}`);
    if (!response.ok) throw new Error("Failed to fetch employee");
    return response.json();
  },

  async create(data: {
    firstName: string;
    lastName: string;
    employeeId: string;
    email: string;
    department?: string;
    position?: string;
    consultantPrefix?: string;
    employmentStartDate?: string;
    employmentEndDate?: string;
  }): Promise<Employee> {
    const response = await fetch(`${API_BASE_URL}/employees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to create employee");
    }
    return response.json();
  },

  async sendInvitation(
    id: string,
  ): Promise<{ message: string; invitationLink: string }> {
    const response = await fetch(`${API_BASE_URL}/employees/${id}/invitation`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to send invitation");
    return response.json();
  },

  async updateRole(id: string, role: "manager" | "staff"): Promise<Employee> {
    const response = await fetch(`${API_BASE_URL}/employees/${id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!response.ok) throw new Error("Failed to update role");
    return response.json();
  },

  async update(id: string, data: {
    name?: string;
    email?: string;
    employeeId?: string;
    position?: string;
    idPrefix?: string;
    consultantPrefix?: string;
    employmentStartDate?: string;
    employmentEndDate?: string;
    department?: string;
  }): Promise<Employee> {
    const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to update employee");
    }
    return response.json();
  },


  async syncData(): Promise<Employee[]> {
    const response = await fetch(`${API_BASE_URL}/employees/sync-employee`);
    if (!response.ok) throw new Error("Failed to sync data");
    return response.json();
  },

  async sendEmail(
    id: string,
    message: string,
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/employees/${id}/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) throw new Error("Failed to send email");
    return response.json();
  },

  async bookmarkEmployee(
    id: string,
    reason: string = "Manually bookmarked from upload summary",
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/employees/${id}/bookmark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) throw new Error("Failed to bookmark employee");
    return response.json();
  },

  async unbookmarkEmployee(
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/employees/${id}/bookmark`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to remove employee bookmark");
    return response.json();
  },

  async sendBulkEmail(
    ids: string[],
    message: string,
    filter: EmployeeFilters,
    isAll: boolean,
  ): Promise<{ success: number; failed: number }> {
    const response = await fetch(`${API_BASE_URL}/employees/bulk-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeIds: ids, message, filter, isAll }),
    });
    if (!response.ok) throw new Error("Failed to send bulk emails");
    return response.json();
  },

  async exportCsv(payload: BulkActionPayload): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/employees/export-csv`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Failed to export CSV");
    return response.blob();
  },

  async printCard(id: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/employees/${id}/ `, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to print card");
    return response.json();
  },

  async printBulkCards(
    ids: string[],
  ): Promise<{ success: number; failed: number }> {
    const response = await fetch(`${API_BASE_URL}/employees/bulk-print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeIds: ids }),
    });
    if (!response.ok) throw new Error("Failed to print bulk cards");
    return response.json();
  },

  async delete(id: string): Promise<{ ok: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete employee");
    return response.json();
  },

  async deleteBulk(ids: string[]): Promise<{ ok: boolean; deleted: number }> {
    const response = await fetch(`${API_BASE_URL}/employees/bulk-delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeIds: ids }),
    });
    if (!response.ok) throw new Error("Failed to delete employees");
    return response.json();
  },

  async createEmployeeRequest(
    id: string,
    message: string,
  ): Promise<{ id: string; status: string }> {
    const response = await fetch(`${API_BASE_URL}/employees/${id}/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) throw new Error("Failed to create employee request");
    return response.json();
  },

  async uploadCreateFile(file: File): Promise<EmployeeUploadResult> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/employees/upload-create`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to process upload file");
    }

    return response.json();
  },

  async downloadUploadCreateReport(report: EmployeeUploadResult): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/employees/upload-create/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    });

    if (!response.ok) {
      throw new Error("Failed to download upload report");
    }

    return response.blob();
  },
};

export const cardService = {
  async saveCard(
    employeeId: string,
    photoData: string,
    photoX: number = 0,
    photoY: number = 0,
    photoScale: number = 1.0,
  ): Promise<Card> {
    const response = await fetch(
      `${API_BASE_URL}/cards/employee/${employeeId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoData,
          photoX,
          photoY,
          photoScale,
        }),
      },
    );
    if (!response.ok) throw new Error("Failed to save card");
    return response.json();
  },

  async validatePhoto(
    formData: FormData,
  ): Promise<{ valid: boolean; issues?: string[]; message?: string }> {
    const response = await fetch(`${API_BASE_URL}/employees/validate-photo`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error("Failed to validate photo");
    const data = await response.json();
    if (typeof data?.valid === "boolean") {
      return data;
    }
    const issues = Array.isArray(data?.errors) ? data.errors : undefined;
    return {
      valid: data?.status === "success",
      issues,
      message: issues?.[0],
    };
  },

  async getForPrint(cardId: string): Promise<Card> {
    const response = await fetch(`${API_BASE_URL}/cards/${cardId}/print`);
    if (!response.ok) throw new Error("Failed to fetch card for print");
    return response.json();
  },
};

export const printingService = {
  async getStations(): Promise<PrintingStation[]> {
    const response = await fetch(`${API_BASE_URL}/printers`);
    if (!response.ok) throw new Error("Failed to fetch printing stations");
    const names: string[] = await response.json();
    return names.map(name => ({
      id: name,
      name: name,
      status: "online",
      location: "Office",
      last_seen: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
  },

  async createBatch(
    stationId: string,
    employeeIds: string[],
    filters: EmployeeFilters,
    isAll: boolean,
  ): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/print-jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stationId, employeeIds, filters, isAll }),
    });
    if (!response.ok) throw new Error("Failed to create print batch");
    return response.json();
  },

  async getBatches(): Promise<PrintBatch[]> {
    const response = await fetch(`${API_BASE_URL}/printing/batches`);
    if (!response.ok) throw new Error("Failed to fetch print batches");
    return response.json();
  },

  async getPrintReports(page: number = 1, pageSize: number = 20, startDate?: string, endDate?: string): Promise<{ items: any[], total: number, page: number, page_size: number }> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    const response = await fetch(`${API_BASE_URL}/print-reports?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch print reports");
    return response.json();
  },

  async getPrintingJobsSummary(): Promise<PrintingJobSummary[]> {
    const response = await fetch(`${API_BASE_URL}/printing/jobs-summary`);
    if (!response.ok) throw new Error("Failed to fetch printing jobs summary");
    return response.json();
  },

  async getPrintHistoryStatus(employeeIds: string[]): Promise<{
    items: { employeeId: string; cardCount: number; lastPrintDate: string }[];
  }> {
    const response = await fetch(`${API_BASE_URL}/print-reports/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeIds }),
    });
    if (!response.ok) throw new Error("Failed to fetch print history status");
    return response.json();
  },

  async exportPrintReports(startDate?: string, endDate?: string): Promise<Blob> {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    const response = await fetch(`${API_BASE_URL}/print-reports/export?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to export print reports");
    return response.blob();
  },

  async getDashboardStats(): Promise<{ totalPrints: number, totalEmployees: number, employeesWithPhotos: number }> {
    const response = await fetch(`${API_BASE_URL}/dashboard/stats`);
    if (!response.ok) throw new Error("Failed to fetch dashboard stats");
    return response.json();
  },

  async getDailyAnalytics(days: number = 30, localDate?: string): Promise<{ date: string, count: number }[]> {
    const params = new URLSearchParams({ days: days.toString() });
    if (localDate) params.append("localDate", localDate);
    const response = await fetch(`${API_BASE_URL}/dashboard/analytics?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch daily analytics");
    return response.json();
  },

  async generateSummaryReport(startDate: string, endDate: string): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/dashboard/summary-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate })
    });
    if (!response.ok) throw new Error("Failed to generate summary report");
    return response.blob();
  },

  async getBatchDetails(id: string): Promise<PrintBatch> {
    const response = await fetch(`${API_BASE_URL}/printing/batches/${id}`);
    if (!response.ok) throw new Error("Failed to fetch batch details");
    return response.json();
  },

  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    errorMessage?: string,
  ): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/printing/jobs/${jobId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, errorMessage }),
      },
    );
    if (!response.ok) throw new Error("Failed to update job status");
  },

  async deleteBatch(id: string): Promise<{ ok: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/printing/batches/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete batch");
    return response.json();
  },

  async deleteBatchesBulk(ids: string[]): Promise<{ ok: boolean; deleted: number }> {
    const response = await fetch(`${API_BASE_URL}/printing/batches/bulk-delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchIds: ids }),
    });
    if (!response.ok) throw new Error("Failed to delete batches");
    return response.json();
  },

  async downloadBatchPdf(jobIds: string[], localDate?: string): Promise<BatchPrintJob> {
    const recipientEmail = (sessionStorage.getItem("nrs_user_email") || "").trim();
    const shouldEmailPdf = jobIds.length >= 4 && recipientEmail.length > 0;
    const response = await fetch(`${API_BASE_URL}/print-jobs/batch-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobIds,
        localDate,
        emailPdf: shouldEmailPdf,
        recipientEmail: shouldEmailPdf ? recipientEmail : undefined,
      }),
    });
    if (!response.ok) throw new Error("Failed to start PDF generation");
    return response.json();
  },

  async getBatchStatus(batchId: string): Promise<BatchPrintJob> {
    const response = await fetch(`${API_BASE_URL}/print-jobs/batch-pdf/${batchId}`);
    if (!response.ok) throw new Error("Failed to fetch batch status");
    return response.json();
  },

  async uploadPrintFile(file: File): Promise<PrintUploadResult> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/print-jobs/upload-print`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to process print upload file");
    }

    return response.json();
  },
};

export const notificationService = {
  async list(limit: number = 30, unreadOnly: boolean = false): Promise<EmployeeNotificationListResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      unreadOnly: unreadOnly ? "true" : "false",
    });
    const response = await fetch(`${API_BASE_URL}/notifications?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch notifications");
    return response.json();
  },

  async getCount(): Promise<{ unread: number; total: number }> {
    const response = await fetch(`${API_BASE_URL}/notifications/count`);
    if (!response.ok) throw new Error("Failed to fetch notification count");
    return response.json();
  },

  async markRead(id: string): Promise<EmployeeNotification> {
    const response = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: "PATCH",
    });
    if (!response.ok) throw new Error("Failed to mark notification as read");
    return response.json();
  },

  async markAllRead(): Promise<{ ok: boolean; updated: number }> {
    const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: "PATCH",
    });
    if (!response.ok) throw new Error("Failed to mark all notifications as read");
    return response.json();
  },

  async delete(id: string): Promise<{ ok: boolean }> {
    const response = await fetch(`${API_BASE_URL}/notifications/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete notification");
    return response.json();
  },
};
