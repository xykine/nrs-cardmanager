import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Bookmark, CreditCard, Download, Eye, Mail, MoreVertical, Pencil, Printer, RefreshCw } from "lucide-react";
import EmailDialog from "./EmailDialog";
import {
  Employee,
  EmployeeUploadResult,
  EmployeeUploadRowResult,
} from "../types";
import { employeeService, printingService, resolvePdfUrl } from "../services/api";
import { useNotification } from "../contexts/NotificationContext";
import { UPLOAD_CREATE_SUMMARY_STORAGE_KEY } from "./UploadToCreateModal";
import EditEmployeeModal from "./EditEmployeeModal";
import CreateEmployeeModal from "./CreateEmployeeModal";
import { EmployeeFilters } from "./FilterEmployee";
import PrintBatchReviewModal, { PrintReviewRow } from "./PrintBatchReviewModal";

type SummaryFilter = "all" | "created" | "updated" | "skipped" | "error" | "missingPhoto";

const FILTER_LABELS: Record<SummaryFilter, string> = {
  all: "All Rows",
  created: "Created",
  updated: "Updated",
  skipped: "Skipped",
  error: "Errors",
  missingPhoto: "Missing Photo",
};

const EMPTY_FILTERS: EmployeeFilters = {
  name: "",
  employeeId: "",
  email: "",
  isBookmarked: false,
  department: "all",
  photoStatus: "all",
  employeeType: "all",
  position: "all",
  consultantPrefix: "",
  role: "all",
  startDate: "",
  endDate: "",
  requestStatus: "all",
};

export default function UploadCreateSummaryPage() {
  const navigate = useNavigate();
  const { addNotification, updateNotification } = useNotification();
  const [report, setReport] = useState<EmployeeUploadResult | null>(null);
  const [activeFilter, setActiveFilter] = useState<SummaryFilter>("all");
  const [departments, setDepartments] = useState<string[]>([]);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [bulkEmailScope, setBulkEmailScope] = useState<
    "createdFilter" | "selectedRows"
  >("createdFilter");
  const [singleEmailDialog, setSingleEmailDialog] = useState<{
    isOpen: boolean;
    employeeId?: string;
    employeeName?: string;
    fallbackEmail?: string;
  }>({ isOpen: false });
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    employee: Employee | null;
  }>({ isOpen: false, employee: null });
  const [createEmployeeModal, setCreateEmployeeModal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [actionInFlight, setActionInFlight] = useState<{
    action: "print" | "bookmark" | "edit" | null;
    rowKey?: string;
  }>({ action: null });
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
  const [bulkActionInFlight, setBulkActionInFlight] = useState<
    "print" | "bookmark" | null
  >(null);
  const [printReviewModal, setPrintReviewModal] = useState<{
    isOpen: boolean;
    rows: PrintReviewRow[];
  }>({ isOpen: false, rows: [] });

  useEffect(() => {
    const stored = sessionStorage.getItem(UPLOAD_CREATE_SUMMARY_STORAGE_KEY);
    if (!stored) {
      setReport(null);
      return;
    }

    try {
      setReport(JSON.parse(stored));
    } catch (error) {
      console.error("Failed to parse upload summary", error);
      setReport(null);
    }
  }, []);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const response = await employeeService.getDepartments();
        setDepartments(response);
      } catch (error) {
        console.error("Failed to load departments", error);
      }
    };

    loadDepartments();
  }, []);

  const filteredRows = useMemo(() => {
    if (!report) return [];
    if (activeFilter === "all") return report.rows;
    if (activeFilter === "missingPhoto") {
      return report.rows.filter((row) => !row.photoPresent);
    }
    return report.rows.filter((row) => row.action === activeFilter);
  }, [activeFilter, report]);

  const createdEmployeeIds = useMemo(
    () =>
      report?.rows
        .filter((row) => row.action === "created" && row.employeeDbId)
        .map((row) => row.employeeDbId as string) ?? [],
    [report]
  );

  const filteredCreatedEmployeeIds = useMemo(
    () =>
      filteredRows
        .filter((row) => row.action === "created" && row.employeeDbId)
        .map((row) => row.employeeDbId as string),
    [filteredRows]
  );

  const getRowKey = (row: EmployeeUploadRowResult) =>
    `${row.rowNumber}-${row.email || row.employeeId || row.message}`;

  useEffect(() => {
    const visibleKeys = new Set(filteredRows.map((row) => getRowKey(row)));
    setSelectedRowKeys((prev) => {
      const next = new Set<string>();
      prev.forEach((key) => {
        if (visibleKeys.has(key)) {
          next.add(key);
        }
      });
      return next;
    });
  }, [filteredRows]);

  const selectedRows = useMemo(
    () => filteredRows.filter((row) => selectedRowKeys.has(getRowKey(row))),
    [filteredRows, selectedRowKeys],
  );

  const selectedRowsWithEmployee = useMemo(
    () => selectedRows.filter((row) => Boolean(row.employeeDbId)),
    [selectedRows],
  );
  const selectedRowsEmailEligible = useMemo(
    () =>
      selectedRows.filter(
        (row) => Boolean(row.employeeDbId) || Boolean((row.email || "").trim()),
      ),
    [selectedRows],
  );
  const resolveEmployeeIdByEmail = async (
    email: string,
  ): Promise<string | undefined> => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return undefined;
    const response = await employeeService.getAll(1, 50, { email: normalized });
    const matched = response.items.find(
      (employee) => (employee.email || "").trim().toLowerCase() === normalized,
    );
    return matched?.id || undefined;
  };

  const resolveEmployeeIdsFromRows = async (
    rows: EmployeeUploadRowResult[],
  ): Promise<string[]> => {
    const ids = new Set<string>();
    for (const row of rows) {
      if (row.employeeDbId) {
        ids.add(row.employeeDbId);
        continue;
      }
      const rowEmail = (row.email || "").trim();
      if (!rowEmail) continue;
      try {
        const resolvedId = await resolveEmployeeIdByEmail(rowEmail);
        if (resolvedId) {
          ids.add(resolvedId);
        }
      } catch (error) {
        console.error("Failed to resolve employee by email", rowEmail, error);
      }
    }
    return Array.from(ids);
  };

  const allRowsSelected =
    filteredRows.length > 0 &&
    filteredRows.every((row) => selectedRowKeys.has(getRowKey(row)));

  const toggleSelectRow = (row: EmployeeUploadRowResult) => {
    const key = getRowKey(row);
    setSelectedRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSelectAllRows = () => {
    if (allRowsSelected) {
      setSelectedRowKeys(new Set());
      return;
    }
    setSelectedRowKeys(new Set(filteredRows.map((row) => getRowKey(row))));
  };

  const handleDownload = async () => {
    if (!report) return;

    setDownloading(true);
    try {
      const escapeCsv = (value: string | number | boolean | null | undefined) => {
        const text = value === null || value === undefined ? "" : String(value);
        if (/[",\n]/.test(text)) {
          return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
      };

      const summaryRows = [
        ["Rows", report.summary.totalRows],
        ["Created", report.summary.created],
        ["Updated", report.summary.updated],
        ["Skipped", report.summary.skipped],
        ["Errors", report.summary.errors],
        ["Missing Photo", report.summary.missingPhoto],
      ];

      const detailHeader = [
        "Row",
        "First Name",
        "Last Name",
        "Email",
        "IR",
        "Action",
        "Message",
        "Photo Present",
      ];

      const detailRows = report.rows.map((row) => [
        row.rowNumber,
        row.firstName || "",
        row.lastName || "",
        row.email || "",
        row.employeeId || "",
        row.action,
        row.message,
        row.photoPresent ? "Yes" : "No",
      ]);

      const csvLines: string[] = [];
      csvLines.push("Upload Processing Summary");
      summaryRows.forEach(([label, value]) => {
        csvLines.push(`${escapeCsv(label)},${escapeCsv(value)}`);
      });
      csvLines.push("");
      csvLines.push(detailHeader.map(escapeCsv).join(","));
      detailRows.forEach((cells) => {
        csvLines.push(cells.map(escapeCsv).join(","));
      });

      const blob = new Blob([csvLines.join("\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "upload-create-report.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Failed to download upload report");
    } finally {
      setDownloading(false);
    }
  };

  const handleSendBulkEmail = async (message: string) => {
    const idsToSend =
      bulkEmailScope === "selectedRows"
        ? await resolveEmployeeIdsFromRows(selectedRowsEmailEligible)
        : activeFilter === "created"
          ? filteredCreatedEmployeeIds
          : createdEmployeeIds;

    if (idsToSend.length === 0) {
      return;
    }

    const notificationId = addNotification({
      type: "progress",
      title: "Sending Emails",
      message: `Sending emails to ${idsToSend.length} employee(s)...`,
      progress: 0,
      autoClose: false,
    });

    setEmailDialogOpen(false);
    setBulkEmailScope("createdFilter");

    try {
      const result = await employeeService.sendBulkEmail(
        idsToSend,
        message,
        EMPTY_FILTERS,
        false,
      );
      updateNotification(notificationId, {
        type: "success",
        title: "Emails Sent",
        message: `Successfully sent ${result.success} email(s).${result.failed > 0 ? ` ${result.failed} failed.` : ""}`,
        autoClose: true,
      });
    } catch (error) {
      console.error(error);
      updateNotification(notificationId, {
        type: "error",
        title: "Email Failed",
        message: "Failed to send emails. Please try again.",
        autoClose: true,
      });
    }
  };

  const handleOpenSingleEmail = (row: EmployeeUploadRowResult) => {
    if (!row.employeeDbId && !(row.email || "").trim()) return;
    const employeeName = [row.firstName, row.lastName].filter(Boolean).join(" ") || row.email || row.employeeId || "Employee";
    setSingleEmailDialog({
      isOpen: true,
      employeeId: row.employeeDbId,
      employeeName,
      fallbackEmail: row.email || undefined,
    });
  };

  const handleSendSingleEmail = async (message: string) => {
    let employeeId = singleEmailDialog.employeeId;
    if (!employeeId && singleEmailDialog.fallbackEmail) {
      employeeId = await resolveEmployeeIdByEmail(singleEmailDialog.fallbackEmail);
    }
    if (!employeeId) {
      addNotification({
        type: "error",
        title: "Email Failed",
        message: "No matching employee was found for this email address.",
        autoClose: true,
      });
      return;
    }

    const notificationId = addNotification({
      type: "progress",
      title: "Sending Email",
      message: `Sending email to ${singleEmailDialog.employeeName || "employee"}...`,
      progress: 0,
      autoClose: false,
    });

    setSingleEmailDialog({ isOpen: false });

    try {
      await employeeService.sendBulkEmail(
        [employeeId],
        message,
        EMPTY_FILTERS,
        false,
      );

      updateNotification(notificationId, {
        type: "success",
        title: "Email Sent",
        message: `Email sent to ${singleEmailDialog.employeeName || "employee"}.`,
        autoClose: true,
      });
    } catch (error) {
      console.error(error);
      updateNotification(notificationId, {
        type: "error",
        title: "Email Failed",
        message: "Failed to send email. Please try again.",
        autoClose: true,
      });
    }
  };

  const handlePrintRow = async (row: EmployeeUploadRowResult) => {
    if (!row.employeeDbId) return;
    if (!row.photoPresent) {
      addNotification({
        type: "error",
        title: "Print Failed",
        message: "Photo is required before printing this card.",
        autoClose: true,
      });
      return;
    }

    const rowKey = `${row.rowNumber}-${row.employeeDbId}`;
    setActionInFlight({ action: "print", rowKey });

    const notificationId = addNotification({
      type: "progress",
      title: "Generating Print PDF",
      message: "Preparing print file...",
      progress: 50,
      autoClose: false,
    });

    try {
      const jobs = await printingService.createBatch(
        "PDF_GENERATION",
        [row.employeeDbId],
        EMPTY_FILTERS,
        false,
      );
      const jobIds = jobs
        .map((job) =>
          typeof job === "object" &&
          job !== null &&
          "jobId" in job &&
          typeof (job as { jobId?: unknown }).jobId === "string"
            ? (job as { jobId: string }).jobId
            : null,
        )
        .filter((jobId): jobId is string => Boolean(jobId));
      
      const localDate = new Date().toLocaleDateString("en-CA");
      let batch = await printingService.downloadBatchPdf(jobIds, localDate);

      let attempts = 0;
      while (batch.status === "PENDING" || batch.status === "PROCESSING") {
        await new Promise(resolve => setTimeout(resolve, 2000));
        batch = await printingService.getBatchStatus(batch.id);
        attempts++;
        updateNotification(notificationId, { progress: Math.min(50 + (attempts * 2), 95) });
      }

      if (batch.status === "FAILED") throw new Error(batch.errorMessage || "Generation failed");

      if (batch.pdfUrl) {
          const pdfUrl = resolvePdfUrl(batch.pdfUrl);
          window.open(pdfUrl, "_blank");
          updateNotification(notificationId, {
            type: "success",
            title: "PDF Generated",
            message: "Card PDF opened in a new tab.",
            progress: 100,
            autoClose: true,
          });
      }
    } catch (error: any) {
      console.error(error);
      updateNotification(notificationId, {
        type: "error",
        title: "Print Failed",
        message: error.message || "Failed to generate print PDF.",
        autoClose: true,
      });
    } finally {
      setActionInFlight({ action: null });
    }
  };

  const handleOpenEdit = async (row: EmployeeUploadRowResult) => {
    if (!row.employeeDbId) return;
    const rowKey = `${row.rowNumber}-${row.employeeDbId}`;
    setActionInFlight({ action: "edit", rowKey });
    try {
      const employee = await employeeService.getById(row.employeeDbId);
      setEditModal({ isOpen: true, employee });
    } catch (error) {
      console.error(error);
      addNotification({
        type: "error",
        title: "Unable to Open Edit",
        message: "Failed to load employee details for editing.",
        autoClose: true,
      });
    } finally {
      setActionInFlight({ action: null });
    }
  };

  const handleEditEmployee = async (
    employeeId: string,
    data: {
      name?: string;
      email?: string;
      employeeId?: string;
      position?: string;
      idPrefix?: string;
      consultantPrefix?: string;
      employmentStartDate?: string;
      employmentEndDate?: string;
      department?: string;
    },
  ) => {
    const notificationId = addNotification({
      type: "progress",
      title: "Updating Employee",
      message: "Saving changes...",
      progress: 0,
      autoClose: false,
    });

    try {
      await employeeService.update(employeeId, data);
      updateNotification(notificationId, {
        type: "success",
        title: "Employee Updated",
        message: "Changes saved successfully.",
        autoClose: true,
      });
      setEditModal({ isOpen: false, employee: null });
    } catch (error) {
      console.error(error);
      updateNotification(notificationId, {
        type: "error",
        title: "Update Failed",
        message: "Failed to save changes. Please try again.",
        autoClose: true,
      });
      throw error;
    }
  };

  const handleBookmarkRow = async (row: EmployeeUploadRowResult) => {
    if (!row.employeeDbId) return;
    const rowKey = `${row.rowNumber}-${row.employeeDbId}`;
    setActionInFlight({ action: "bookmark", rowKey });
    try {
      await employeeService.bookmarkEmployee(
        row.employeeDbId,
        "Manually bookmarked from upload create summary",
      );
      addNotification({
        type: "success",
        title: "Bookmarked",
        message: "Employee has been bookmarked.",
        autoClose: true,
      });
    } catch (error) {
      console.error(error);
      addNotification({
        type: "error",
        title: "Bookmark Failed",
        message: "Could not bookmark this employee.",
        autoClose: true,
      });
    } finally {
      setActionInFlight({ action: null });
    }
  };

  const handleBulkBookmark = async () => {
    if (selectedRowsWithEmployee.length < 2) {
      return;
    }

    const employeeIds = Array.from(
      new Set(
        selectedRowsWithEmployee
          .map((row) => row.employeeDbId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    if (employeeIds.length === 0) {
      addNotification({
        type: "error",
        title: "Bookmark Failed",
        message: "No valid employees were selected.",
        autoClose: true,
      });
      return;
    }

    setBulkActionInFlight("bookmark");
    const notificationId = addNotification({
      type: "progress",
      title: "Bookmarking Employees",
      message: `Bookmarking ${employeeIds.length} employee(s)...`,
      progress: 0,
      autoClose: false,
    });

    try {
      const results = await Promise.allSettled(
        employeeIds.map((employeeId) =>
          employeeService.bookmarkEmployee(
            employeeId,
            "Bulk bookmarked from upload create summary",
          ),
        ),
      );
      const successCount = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failureCount = results.length - successCount;

      updateNotification(notificationId, {
        type: failureCount > 0 ? "error" : "success",
        title: failureCount > 0 ? "Bookmark Completed With Errors" : "Bookmarked",
        message:
          failureCount > 0
            ? `Bookmarked ${successCount} employee(s). ${failureCount} failed.`
            : `Bookmarked ${successCount} employee(s).`,
        autoClose: true,
      });
      setSelectedRowKeys(new Set());
    } catch (error) {
      console.error(error);
      updateNotification(notificationId, {
        type: "error",
        title: "Bookmark Failed",
        message: "Could not complete bulk bookmark.",
        autoClose: true,
      });
    } finally {
      setBulkActionInFlight(null);
    }
  };

  const handleBulkPrint = async () => {
    if (selectedRowsWithEmployee.length < 2) {
      return;
    }

    try {
      const candidateRows = selectedRowsWithEmployee.filter(
        (row): row is EmployeeUploadRowResult & { employeeDbId: string } =>
          Boolean(row.employeeDbId),
      );

      const history = await printingService.getPrintHistoryStatus(
        candidateRows.map((row) => row.employeeDbId),
      );
      const printedMap = new Map(
        history.items.map((item) => [item.employeeId, item]),
      );
      const reviewRows: PrintReviewRow[] = candidateRows.map((row) => ({
        employeeDbId: row.employeeDbId,
        employeeId: row.employeeId,
        name:
          [row.firstName, row.lastName].filter(Boolean).join(" ") ||
          row.email ||
          row.employeeId ||
          "Employee",
        hasPhoto: row.photoPresent,
        wasPreviouslyPrinted: printedMap.has(row.employeeDbId),
        skipReasonIfExcluded:
          "Previously printed (present in print history)",
      }));

      setPrintReviewModal({ isOpen: true, rows: reviewRows });
    } catch (error) {
      console.error(error);
      addNotification({
        type: "error",
        title: "Print Review Failed",
        message: "Failed to load print history for selected rows.",
        autoClose: true,
      });
    }
  };

  const handleConfirmPrintReview = async (includePreviouslyPrinted: boolean) => {
    const employeeIds = printReviewModal.rows
      .filter(
        (row) =>
          row.hasPhoto &&
          (includePreviouslyPrinted || !row.wasPreviouslyPrinted),
      )
      .map((row) => row.employeeDbId);

    setPrintReviewModal({ isOpen: false, rows: [] });
    if (employeeIds.length === 0) {
      addNotification({
        type: "error",
        title: "Print Failed",
        message: "No valid employees available for printing.",
        autoClose: true,
      });
      return;
    }

    setBulkActionInFlight("print");
    const notificationId = addNotification({
      type: "progress",
      title: "Generating Print PDF",
      message: `Preparing PDF for ${employeeIds.length} card(s)...`,
      progress: 50,
      autoClose: false,
    });

    try {
      const jobs = await printingService.createBatch(
        "PDF_GENERATION",
        employeeIds.filter((id): id is string => Boolean(id)),
        EMPTY_FILTERS,
        false,
      );
      const jobIds = jobs
        .map((job) =>
          typeof job === "object" &&
          job !== null &&
          "jobId" in job &&
          typeof (job as { jobId?: unknown }).jobId === "string"
            ? (job as { jobId: string }).jobId
            : null,
        )
        .filter((jobId): jobId is string => Boolean(jobId));

      const localDate = new Date().toLocaleDateString("en-CA");
      let batch = await printingService.downloadBatchPdf(jobIds, localDate);

      let attempts = 0;
      while (batch.status === "PENDING" || batch.status === "PROCESSING") {
        await new Promise(resolve => setTimeout(resolve, 2000));
        batch = await printingService.getBatchStatus(batch.id);
        attempts++;
        updateNotification(notificationId, { progress: Math.min(50 + (attempts * 0.5), 95) });
      }

      if (batch.status === "FAILED") throw new Error(batch.errorMessage || "Generation failed");

      if (batch.pdfUrl) {
          const pdfUrl = resolvePdfUrl(batch.pdfUrl);
          window.open(pdfUrl, "_blank");
          updateNotification(notificationId, {
            type: "success",
            title: "PDF Generated",
            message: "Bulk print PDF opened in a new tab.",
            progress: 100,
            autoClose: true,
          });
      }
      setSelectedRowKeys(new Set());
    } catch (error: any) {
      console.error(error);
      updateNotification(notificationId, {
        type: "error",
        title: "Print Failed",
        message: error.message || "Failed to generate bulk print PDF.",
        autoClose: true,
      });
    } finally {
      setBulkActionInFlight(null);
    }
  };

  const handleCreateEmployee = async (data: {
    firstName: string;
    lastName: string;
    employeeId: string;
    idPrefix?: string;
    email: string;
    department?: string;
    position?: string;
    consultantPrefix?: string;
    employmentStartDate?: string;
    employmentEndDate?: string;
  }) => {
    const notificationId = addNotification({
      type: "progress",
      title: "Creating Employee",
      message: "Creating new employee...",
      progress: 0,
      autoClose: false,
    });

    try {
      await employeeService.create({
        firstName: data.firstName,
        lastName: data.lastName,
        employeeId: data.employeeId,
        email: data.email,
        department: data.department,
        position: data.position,
        consultantPrefix: data.consultantPrefix,
        employmentStartDate: data.employmentStartDate,
        employmentEndDate: data.employmentEndDate,
      });

      updateNotification(notificationId, {
        type: "success",
        title: "Employee Created",
        message: "Employee has been created successfully",
        autoClose: true,
      });

      setCreateEmployeeModal(false);
    } catch (error) {
      updateNotification(notificationId, {
        type: "error",
        title: "Creation Failed",
        message: "Failed to create employee. Please try again.",
        autoClose: true,
      });
      console.error(error);
      throw error;
    }
  };

  if (!report) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Upload Processing Summary</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">No upload summary is available yet.</p>
          <button
            type="button"
            onClick={() => navigate("/employees")}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Back to Employees
          </button>
        </div>
      </div>
    );
  }

  const canSendBulkEmail =
    (activeFilter === "created" ? filteredCreatedEmployeeIds : createdEmployeeIds).length > 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Upload Processing Summary
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review the processed rows, filter by outcome, and export the report.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate("/employees")}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
          >
            Back to Employees
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
          >
            {downloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <SummaryCard
          label="Rows"
          value={report.summary.totalRows}
          tone="slate"
          isActive={activeFilter === "all"}
          onClick={() => setActiveFilter("all")}
        />
        <SummaryCard
          label="Created"
          value={report.summary.created}
          tone="green"
          isActive={activeFilter === "created"}
          onClick={() => setActiveFilter("created")}
        />
        <SummaryCard
          label="Updated"
          value={report.summary.updated}
          tone="blue"
          isActive={activeFilter === "updated"}
          onClick={() => setActiveFilter("updated")}
        />
        <SummaryCard
          label="Skipped"
          value={report.summary.skipped}
          tone="slate"
          isActive={activeFilter === "skipped"}
          onClick={() => setActiveFilter("skipped")}
        />
        <SummaryCard
          label="Errors"
          value={report.summary.errors}
          tone="red"
          isActive={activeFilter === "error"}
          onClick={() => setActiveFilter("error")}
        />
        <SummaryCard
          label="Missing Photo"
          value={report.summary.missingPhoto}
          tone="amber"
          isActive={activeFilter === "missingPhoto"}
          onClick={() => setActiveFilter("missingPhoto")}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {FILTER_LABELS[activeFilter]}
            </h2>
            <p className="text-sm text-slate-500">
              Showing {filteredRows.length} row(s).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedRowKeys.size > 1 && (
              <>
                <button
                  type="button"
                  onClick={handleBulkPrint}
                  disabled={bulkActionInFlight !== null}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                >
                  {bulkActionInFlight === "print" ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Printer className="w-4 h-4" />
                  )}
                  Bulk Print
                </button>

                <button
                  type="button"
                  onClick={handleBulkBookmark}
                  disabled={bulkActionInFlight !== null}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium disabled:opacity-50"
                >
                  {bulkActionInFlight === "bookmark" ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bookmark className="w-4 h-4" />
                  )}
                  Bulk Bookmark
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBulkEmailScope("selectedRows");
                    setEmailDialogOpen(true);
                  }}
                  disabled={bulkActionInFlight !== null || selectedRowsEmailEligible.length < 2}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" />
                  Bulk Email
                </button>
              </>
            )}

            {activeFilter === "created" && canSendBulkEmail && (
              <button
                type="button"
                onClick={() => {
                  setBulkEmailScope("createdFilter");
                  setEmailDialogOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Mail className="w-4 h-4" />
                Send Bulk Email
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">
                  <input
                    type="checkbox"
                    checked={allRowsSelected}
                    onChange={toggleSelectAllRows}
                    aria-label="Select all rows"
                    className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">ID</th>
                <th className="px-4 py-3 text-left font-semibold">Action</th>
                <th className="px-4 py-3 text-left font-semibold">Message</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No rows match this filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <SummaryRow
                    key={getRowKey(row)}
                    row={row}
                    onPrint={handlePrintRow}
                    onEdit={handleOpenEdit}
                    onBookmark={handleBookmarkRow}
                    onSendEmail={handleOpenSingleEmail}
                    onView={(employeeId: string) => navigate(`/detail/${employeeId}`)}
                    onViewCard={(employeeId: string) => navigate(`/card/${employeeId}`)}
                    onCreateEmployee={() => setCreateEmployeeModal(true)}
                    rowSelected={selectedRowKeys.has(getRowKey(row))}
                    onToggleSelected={toggleSelectRow}
                    actionInFlight={actionInFlight}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EmailDialog
        isOpen={emailDialogOpen}
        onClose={() => {
          setEmailDialogOpen(false);
          setBulkEmailScope("createdFilter");
        }}
        onSend={handleSendBulkEmail}
        isBulk
        recipientCount={
          bulkEmailScope === "selectedRows"
            ? selectedRowsEmailEligible.length
            : activeFilter === "created"
              ? filteredCreatedEmployeeIds.length
              : createdEmployeeIds.length
        }
      />

      <EmailDialog
        isOpen={singleEmailDialog.isOpen}
        onClose={() => setSingleEmailDialog({ isOpen: false })}
        onSend={handleSendSingleEmail}
        employeeName={singleEmailDialog.employeeName}
        isBulk={false}
      />

      <EditEmployeeModal
        isOpen={editModal.isOpen}
        employee={editModal.employee}
        onClose={() => setEditModal({ isOpen: false, employee: null })}
        onSubmit={handleEditEmployee}
        departments={departments}
      />

      <CreateEmployeeModal
        isOpen={createEmployeeModal}
        onClose={() => setCreateEmployeeModal(false)}
        onSubmit={handleCreateEmployee}
        departments={departments}
      />

      <PrintBatchReviewModal
        isOpen={printReviewModal.isOpen}
        onClose={() => setPrintReviewModal({ isOpen: false, rows: [] })}
        onConfirm={handleConfirmPrintReview}
        rows={printReviewModal.rows}
        title="Review Upload Summary Bulk Print"
      />
    </div>
  );
}

function SummaryRow({
  row,
  onPrint,
  onEdit,
  onBookmark,
  onSendEmail,
  onView,
  actionInFlight,
  onViewCard,
  onCreateEmployee,
  rowSelected,
  onToggleSelected,
}: {
  row: EmployeeUploadRowResult;
  onPrint: (row: EmployeeUploadRowResult) => void;
  onEdit: (row: EmployeeUploadRowResult) => void;
  onBookmark: (row: EmployeeUploadRowResult) => void;
  onSendEmail: (row: EmployeeUploadRowResult) => void;
  onView: (employeeId: string) => void;
  onViewCard: (employeeId: string) => void;
  onCreateEmployee: () => void;
  rowSelected: boolean;
  onToggleSelected: (row: EmployeeUploadRowResult) => void;
  actionInFlight: { action: "print" | "bookmark" | "edit" | null; rowKey?: string };
}) {

  const hasEmployee = Boolean(row.employeeDbId);
  const rowKey = `${row.rowNumber}-${row.employeeDbId}`;
  const isPrinting = actionInFlight.action === "print" && actionInFlight.rowKey === rowKey;
  const isBookmarking = actionInFlight.action === "bookmark" && actionInFlight.rowKey === rowKey;
  const isEditing = actionInFlight.action === "edit" && actionInFlight.rowKey === rowKey;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const updateMenuPosition = () => {
    if (!menuTriggerRef.current) return;
    const rect = menuTriggerRef.current.getBoundingClientRect();
    const menuWidth = 208;
    const menuHeight = menuRef.current?.offsetHeight ?? 360;
    const viewportPadding = 8;
    const gap = 4;

    let top = rect.bottom + gap;
    if (top + menuHeight > window.innerHeight - viewportPadding) {
      top = Math.max(viewportPadding, rect.top - menuHeight - gap);
    }

    const left = Math.min(
      Math.max(viewportPadding, rect.right - menuWidth),
      window.innerWidth - menuWidth - viewportPadding,
    );

    setMenuPosition({ top, left });
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideMenu = menuRef.current?.contains(target);
      const clickedTrigger = menuTriggerRef.current?.contains(target);
      if (!clickedInsideMenu && !clickedTrigger) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    updateMenuPosition();

    const onViewportChange = () => updateMenuPosition();
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [menuOpen]);

  return (
    <tr className="border-t border-slate-200 align-top">
      <td className="px-4 py-3 text-slate-700">
        <input
          type="checkbox"
          checked={rowSelected}
          onChange={() => onToggleSelected(row)}
          aria-label={`Select row ${row.rowNumber}`}
          className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
        />
      </td>
      <td className="px-4 py-3 text-slate-700">
        {[row.firstName, row.lastName].filter(Boolean).join(" ") || "-"}
      </td>
      <td className="px-4 py-3 text-slate-700">{row.email || "-"}</td>
      <td className="px-4 py-3 text-slate-700">{row.employeeId || "-"}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
            row.action === "created"
              ? "bg-green-100 text-green-700"
              : row.action === "updated"
                ? "bg-blue-100 text-blue-700"
                : row.action === "error"
                  ? "bg-red-100 text-red-700"
                  : "bg-slate-100 text-slate-700"
          }`}
        >
          {row.action}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-700">{row.message}</td>
      <td className="px-4 py-3">
        <div className="relative">
          <button
            ref={menuOpen ? menuTriggerRef : null}
            type="button"
            onClick={() =>
              setMenuOpen((prev) => {
                const next = !prev;
                if (next) {
                  requestAnimationFrame(() => updateMenuPosition());
                }
                return next;
              })
            }
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-slate-700 hover:bg-slate-50"
            aria-label={`Open actions for row ${row.rowNumber}`}
            aria-expanded={menuOpen}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
        {menuOpen &&
          createPortal(
            <div
              ref={menuRef}
              className="fixed z-[9999] w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
              style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onPrint(row);
                }}
                disabled={!hasEmployee || !row.photoPresent || isPrinting}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {isPrinting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                Print Card
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(row);
                }}
                disabled={!hasEmployee || isEditing}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {isEditing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Pencil className="w-4 h-4" />
                )}
                Edit Employee
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onBookmark(row);
                }}
                disabled={!hasEmployee || isBookmarking}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {isBookmarking ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
                Bookmark Employee
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onSendEmail(row);
                }}
                disabled={!hasEmployee && !(row.email || "").trim()}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                <Mail className="w-4 h-4" />
                Send Email
              </button>

              {row.action === "error" && !hasEmployee && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onCreateEmployee();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-emerald-50"
                >
                  <Pencil className="w-4 h-4" />
                  Create Employee
                </button>
              )}

              <div className="my-1 border-t border-slate-100" />

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  if (row.employeeDbId) {
                    onView(row.employeeDbId);
                  }
                }}
                disabled={!hasEmployee}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                <Eye className="w-4 h-4" />
                View Details
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  if (row.employeeDbId) {
                    onViewCard(row.employeeDbId);
                  }
                }}
                disabled={!hasEmployee}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                <CreditCard className="w-4 h-4" />
                View/Edit Card
              </button>
            </div>,
            document.body,
          )}
      </td>
    </tr>
  );
}

function SummaryCard({
  label,
  value,
  tone = "slate",
  isActive,
  onClick,
}: {
  label: string;
  value: number;
  tone?: "slate" | "green" | "blue" | "red" | "amber";
  isActive?: boolean;
  onClick?: () => void;
}) {
  const toneClass =
    tone === "green"
      ? "bg-green-50 text-green-700 border-green-100"
      : tone === "blue"
        ? "bg-blue-50 text-blue-700 border-blue-100"
        : tone === "red"
          ? "bg-red-50 text-red-700 border-red-100"
          : tone === "amber"
            ? "bg-amber-50 text-amber-700 border-amber-100"
            : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-all hover:shadow-sm ${toneClass} ${isActive ? "ring-2 ring-slate-300" : ""}`}
    >
      <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </button>
  );
}
