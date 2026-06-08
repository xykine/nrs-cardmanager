import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  Bookmark,
  CreditCard,
  Download,
  Eye,
  Mail,
  MoreVertical,
  Pencil,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  Employee,
  PrintUploadResult,
  PrintUploadRowResult,
} from "../types";
import { UPLOAD_PRINT_SUMMARY_STORAGE_KEY } from "./UploadToPrintModal";
import { employeeService, printingService } from "../services/api";
import { useNotification } from "../contexts/NotificationContext";
import EmailDialog from "./EmailDialog";
import EditEmployeeModal from "./EditEmployeeModal";
import CreateEmployeeModal from "./CreateEmployeeModal";
import PrintBatchReviewModal, { PrintReviewRow } from "./PrintBatchReviewModal";
import { EmployeeFilters } from "./FilterEmployee";

type SummaryFilter =
  | "all"
  | "ready"
  | "missing-photo"
  | "missing-information"
  | "not-found"
  | "duplicate";

const FILTER_LABELS: Record<SummaryFilter, string> = {
  all: "All Rows",
  ready: "Ready",
  "missing-photo": "Missing Photo",
  "missing-information": "Missing Information",
  "not-found": "Not Found",
  duplicate: "Duplicates",
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

export default function UploadPrintSummaryPage() {
  const navigate = useNavigate();
  const { addNotification, updateNotification } = useNotification();
  const [report, setReport] = useState<PrintUploadResult | null>(null);
  const [activeFilter, setActiveFilter] = useState<SummaryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [bulkEmailScope, setBulkEmailScope] = useState<
    "readyFilter" | "selectedRows"
  >("readyFilter");
  const [singleEmailDialog, setSingleEmailDialog] = useState<{
    isOpen: boolean;
    employeeId?: string;
    employeeName?: string;
  }>({ isOpen: false });
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    employee: Employee | null;
  }>({ isOpen: false, employee: null });
  const [createEmployeeModal, setCreateEmployeeModal] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
  const [bulkActionInFlight, setBulkActionInFlight] = useState<
    "print" | "bookmark" | null
  >(null);
  const [actionInFlight, setActionInFlight] = useState<{
    action: "print" | "bookmark" | "edit" | null;
    rowKey?: string;
  }>({ action: null });
  const [printReviewModal, setPrintReviewModal] = useState<{
    isOpen: boolean;
    rows: PrintReviewRow[];
  }>({ isOpen: false, rows: [] });
  const employeeCacheRef = useRef<Map<string, Employee | null>>(new Map());

  useEffect(() => {
    const stored = sessionStorage.getItem(UPLOAD_PRINT_SUMMARY_STORAGE_KEY);
    if (!stored) {
      setReport(null);
      return;
    }

    try {
      setReport(JSON.parse(stored));
    } catch (error) {
      console.error("Failed to parse print upload summary", error);
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
    const statusRows =
      activeFilter === "all"
        ? report.rows
        : report.rows.filter((row) => row.status === activeFilter);
    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (!normalizedSearch) return statusRows;

    return statusRows.filter((row) =>
      [row.employeeId, row.name, row.email].some((value) =>
        (value || "").toLowerCase().includes(normalizedSearch),
      ),
    );
  }, [activeFilter, report, searchQuery]);

  const getRowKey = (row: PrintUploadRowResult) =>
    `${row.rowNumber}-${row.employeeId || row.message}`;

  useEffect(() => {
    const visibleKeys = new Set(filteredRows.map((row) => getRowKey(row)));
    setSelectedRowKeys((prev) => {
      const next = new Set<string>();
      prev.forEach((key) => {
        if (visibleKeys.has(key)) next.add(key);
      });
      return next;
    });
  }, [filteredRows]);

  const selectedRows = useMemo(
    () => filteredRows.filter((row) => selectedRowKeys.has(getRowKey(row))),
    [filteredRows, selectedRowKeys],
  );

  const selectedRowsWithEmployeeCode = useMemo(
    () => selectedRows.filter((row) => Boolean((row.employeeId || "").trim())),
    [selectedRows],
  );

  const allRowsSelected =
    filteredRows.length > 0 &&
    filteredRows.every((row) => selectedRowKeys.has(getRowKey(row)));

  const readyRows = useMemo(
    () => filteredRows.filter((row) => row.status === "ready"),
    [filteredRows],
  );

  const toggleSelectAllRows = () => {
    if (allRowsSelected) {
      setSelectedRowKeys(new Set());
      return;
    }
    setSelectedRowKeys(new Set(filteredRows.map((row) => getRowKey(row))));
  };

  const toggleSelectRow = (row: PrintUploadRowResult) => {
    const key = getRowKey(row);
    setSelectedRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openEmployeeRouteInNewTab = async (
    row: PrintUploadRowResult,
    route: "detail" | "card",
  ) => {
    const newTab = window.open("about:blank", "_blank");
    if (newTab) newTab.opener = null;
    const employee = await resolveEmployeeByCode(row.employeeId);
    if (!employee?.id) {
      newTab?.close();
      return;
    }

    const targetUrl = `${window.location.origin}/${route}/${employee.id}`;
    if (newTab) {
      [
        "nrs_employee_id",
        "nrs_user_role",
        "nrs_user_name",
        "nrs_user_email",
        "nrs_admin_authenticated",
      ].forEach((key) => {
        const value = sessionStorage.getItem(key);
        if (value !== null) newTab.sessionStorage.setItem(key, value);
      });
      newTab.location.href = targetUrl;
      return;
    }

    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  const resolveEmployeeByCode = async (
    employeeCode?: string,
  ): Promise<Employee | null> => {
    const code = (employeeCode || "").trim();
    if (!code) return null;
    const cached = employeeCacheRef.current.get(code);
    if (cached !== undefined) return cached;
    try {
      const employee = await employeeService.getByCode(code);
      employeeCacheRef.current.set(code, employee);
      return employee;
    } catch {
      employeeCacheRef.current.set(code, null);
      return null;
    }
  };

  const resolveEmployeeIdsFromRows = async (
    rows: PrintUploadRowResult[],
  ): Promise<string[]> => {
    const ids = new Set<string>();
    for (const row of rows) {
      const employee = await resolveEmployeeByCode(row.employeeId);
      if (employee?.id) ids.add(employee.id);
    }
    return Array.from(ids);
  };

  const handleDownload = async () => {
    if (!report) return;
    setDownloading(true);
    try {
      const escapeCsv = (value: string | number | null | undefined) => {
        const text = value === null || value === undefined ? "" : String(value);
        if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
        return text;
      };

      const summaryRows = [
        ["Rows", report.summary.totalRows],
        ["Ready", report.summary.ready],
        ["Missing Photo", report.summary.missingPhoto],
        ["Missing Information", report.summary.missingInformation],
        ["Not Found", report.summary.notFound],
        ["Duplicates", report.summary.duplicates],
        ["Errors", report.summary.errors],
      ];

      const detailHeader = [
        "Row",
        "IR",
        "Name",
        "Position",
        "Status",
        "Message",
      ];
      const detailRows = report.rows.map((row) => [
        row.rowNumber,
        row.employeeId || "",
        row.name || "",
        row.position || "",
        row.status,
        row.message,
      ]);

      const lines: string[] = ["Upload Print Summary"];
      summaryRows.forEach(([label, value]) =>
        lines.push(`${escapeCsv(label)},${escapeCsv(value)}`),
      );
      lines.push("");
      lines.push(detailHeader.map(escapeCsv).join(","));
      detailRows.forEach((cells) =>
        lines.push(cells.map(escapeCsv).join(",")),
      );

      const blob = new Blob([lines.join("\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "upload-print-summary.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      addNotification({
        type: "error",
        title: "Download Failed",
        message: "Failed to download CSV report.",
        autoClose: true,
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleInitiatePrinting = async () => {
    if (!report || report.jobIds.length === 0) {
      return;
    }

    setPrinting(true);
    try {
      const localDate = new Date().toLocaleDateString("en-CA");
      const blob = await printingService.downloadBatchPdf(report.jobIds, localDate);
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (error) {
      console.error(error);
      alert("Failed to generate print PDF");
    } finally {
      setPrinting(false);
    }
  };

  const handleSendBulkEmail = async (message: string) => {
    const targetRows =
      bulkEmailScope === "selectedRows" ? selectedRowsWithEmployeeCode : readyRows;
    const idsToSend = await resolveEmployeeIdsFromRows(targetRows);
    if (idsToSend.length === 0) {
      addNotification({
        type: "error",
        title: "Email Failed",
        message: "No matching employees found for selected rows.",
        autoClose: true,
      });
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
    setBulkEmailScope("readyFilter");

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

  const handleOpenSingleEmail = async (row: PrintUploadRowResult) => {
    const employee = await resolveEmployeeByCode(row.employeeId);
    if (!employee?.id) {
      addNotification({
        type: "error",
        title: "Email Failed",
        message: "No matching employee was found for this row.",
        autoClose: true,
      });
      return;
    }
    setSingleEmailDialog({
      isOpen: true,
      employeeId: employee.id,
      employeeName: employee.name || row.name || row.employeeId || "Employee",
    });
  };

  const handleSendSingleEmail = async (message: string) => {
    if (!singleEmailDialog.employeeId) return;

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
        [singleEmailDialog.employeeId],
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

  const handlePrintRow = async (row: PrintUploadRowResult) => {
    if (row.status !== "ready") {
      addNotification({
        type: "error",
        title: "Print Failed",
        message: "Only rows with Ready status can be printed.",
        autoClose: true,
      });
      return;
    }
    const employee = await resolveEmployeeByCode(row.employeeId);
    if (!employee?.id) {
      addNotification({
        type: "error",
        title: "Print Failed",
        message: "No matching employee was found for this row.",
        autoClose: true,
      });
      return;
    }

    const rowKey = getRowKey(row);
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
        [employee.id],
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
      const blob = await printingService.downloadBatchPdf(jobIds, localDate);
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");

      updateNotification(notificationId, {
        type: "success",
        title: "PDF Generated",
        message: "Card PDF opened in a new tab.",
        autoClose: true,
      });
    } catch (error) {
      console.error(error);
      updateNotification(notificationId, {
        type: "error",
        title: "Print Failed",
        message: "Failed to generate print PDF.",
        autoClose: true,
      });
    } finally {
      setActionInFlight({ action: null });
    }
  };

  const handleOpenEdit = async (row: PrintUploadRowResult) => {
    const rowKey = getRowKey(row);
    setActionInFlight({ action: "edit", rowKey });
    try {
      const employee = await resolveEmployeeByCode(row.employeeId);
      if (!employee) {
        addNotification({
          type: "error",
          title: "Unable to Open Edit",
          message: "No matching employee was found for this row.",
          autoClose: true,
        });
        return;
      }
      setEditModal({ isOpen: true, employee });
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
      employeeCacheRef.current.clear();
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

  const handleBookmarkRow = async (row: PrintUploadRowResult) => {
    const employee = await resolveEmployeeByCode(row.employeeId);
    if (!employee?.id) {
      addNotification({
        type: "error",
        title: "Bookmark Failed",
        message: "No matching employee was found for this row.",
        autoClose: true,
      });
      return;
    }

    const rowKey = getRowKey(row);
    setActionInFlight({ action: "bookmark", rowKey });
    try {
      await employeeService.bookmarkEmployee(
        employee.id,
        "Bookmarked from upload print summary",
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
    if (selectedRowsWithEmployeeCode.length < 2) return;
    const employeeIds = await resolveEmployeeIdsFromRows(selectedRowsWithEmployeeCode);
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
            "Bulk bookmarked from upload print summary",
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
    } finally {
      setBulkActionInFlight(null);
    }
  };

  const handleBulkPrint = async () => {
    if (selectedRowsWithEmployeeCode.length < 2) return;

    const reviewRows: PrintReviewRow[] = [];
    for (const row of selectedRowsWithEmployeeCode) {
      const employee = await resolveEmployeeByCode(row.employeeId);
      const canPrint = row.status === "ready" && Boolean(employee?.id);
      reviewRows.push({
        employeeDbId: employee?.id,
        employeeId: row.employeeId,
        name: row.name || row.employeeId || "Employee",
        hasPhoto: row.status !== "missing-photo",
        wasPreviouslyPrinted: false,
        canPrint,
        baseSkipReason: canPrint
          ? undefined
          : !employee?.id
            ? "Employee record not found"
            : row.message || "Row is not ready for printing",
        skipReasonIfExcluded:
          "Previously printed (present in print history)",
      });
    }

    const resolvedIds = reviewRows
      .map((row) => row.employeeDbId)
      .filter((id): id is string => Boolean(id));
    if (resolvedIds.length > 0) {
      const history = await printingService.getPrintHistoryStatus(resolvedIds);
      const printedSet = new Set(history.items.map((item) => item.employeeId));
      reviewRows.forEach((row) => {
        if (row.employeeDbId && printedSet.has(row.employeeDbId)) {
          row.wasPreviouslyPrinted = true;
        }
      });
    }

    setPrintReviewModal({ isOpen: true, rows: reviewRows });
  };

  const handleConfirmPrintReview = async (includePreviouslyPrinted: boolean) => {
    const idsToPrint = printReviewModal.rows
      .filter(
        (row) =>
          row.employeeDbId &&
          (row.canPrint ?? row.hasPhoto) &&
          (includePreviouslyPrinted || !row.wasPreviouslyPrinted),
      )
      .map((row) => row.employeeDbId as string);

    setPrintReviewModal({ isOpen: false, rows: [] });
    if (idsToPrint.length === 0) {
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
      message: `Preparing PDF for ${idsToPrint.length} card(s)...`,
      progress: 50,
      autoClose: false,
    });
    try {
      const jobs = await printingService.createBatch(
        "PDF_GENERATION",
        idsToPrint,
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
      const blob = await printingService.downloadBatchPdf(jobIds, localDate);
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
      updateNotification(notificationId, {
        type: "success",
        title: "PDF Generated",
        message: "Bulk print PDF opened in a new tab.",
        autoClose: true,
      });
      setSelectedRowKeys(new Set());
    } catch (error) {
      console.error(error);
      updateNotification(notificationId, {
        type: "error",
        title: "Print Failed",
        message: "Failed to generate bulk print PDF.",
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
      employeeCacheRef.current.clear();
    } catch (error) {
      updateNotification(notificationId, {
        type: "error",
        title: "Creation Failed",
        message: "Failed to create employee. Please try again.",
        autoClose: true,
      });
      throw error;
    }
  };

  if (!report) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Upload Print Summary</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">No print upload summary is available yet.</p>
          <button
            type="button"
            onClick={() => navigate("/employees")}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            Back to Employees
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Upload Print Summary
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review which rows were printed successfully and which ones need attention.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
          >
            {downloading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download Report
          </button>
          <button
            type="button"
            onClick={() => navigate("/employees")}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
          >
            Back to Employees
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="font-semibold text-slate-800">Print Jobs Prepared</p>
        <p className="text-sm mt-1 text-slate-600">
          Review the upload result below. When you select `Ready`, you can initiate printing for the prepared rows.
        </p>
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
          label="Ready"
          value={report.summary.ready}
          tone="green"
          isActive={activeFilter === "ready"}
          onClick={() => setActiveFilter("ready")}
        />
        <SummaryCard
          label="Missing Photo"
          value={report.summary.missingPhoto}
          tone="amber"
          isActive={activeFilter === "missing-photo"}
          onClick={() => setActiveFilter("missing-photo")}
        />
        <SummaryCard
          label="Missing Info"
          value={report.summary.missingInformation}
          tone="red"
          isActive={activeFilter === "missing-information"}
          onClick={() => setActiveFilter("missing-information")}
        />
        <SummaryCard
          label="Not Found"
          value={report.summary.notFound}
          tone="red"
          isActive={activeFilter === "not-found"}
          onClick={() => setActiveFilter("not-found")}
        />
        <SummaryCard
          label="Duplicates"
          value={report.summary.duplicates}
          tone="slate"
          isActive={activeFilter === "duplicate"}
          onClick={() => setActiveFilter("duplicate")}
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
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search IR, name, or email"
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
              />
            </div>
            {selectedRowKeys.size > 1 && (
              <>
                <button
                  type="button"
                  onClick={handleBulkPrint}
                  disabled={bulkActionInFlight !== null}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
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
                  disabled={
                    bulkActionInFlight !== null || selectedRowsWithEmployeeCode.length < 2
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" />
                  Bulk Email
                </button>
              </>
            )}
            {activeFilter === "ready" && report.jobIds.length > 0 && (
              <button
                type="button"
                onClick={handleInitiatePrinting}
                disabled={printing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
              >
                {printing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                {printing ? "Generating PDF..." : "Initiate Printing"}
              </button>
            )}
            {readyRows.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setBulkEmailScope("readyFilter");
                  setEmailDialogOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Mail className="w-4 h-4" />
                Send Bulk Email
              </button>
            )}
            <div className="inline-flex items-center gap-2 text-sm text-slate-500">
              <Printer className="w-4 h-4" />
              Print processing results
            </div>
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
                    className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold">IR</th>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">Position</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Message</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No rows match this filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <SummaryRow
                    key={getRowKey(row)}
                    row={row}
                    rowSelected={selectedRowKeys.has(getRowKey(row))}
                    onToggleSelected={toggleSelectRow}
                    onPrint={handlePrintRow}
                    onEdit={handleOpenEdit}
                    onBookmark={handleBookmarkRow}
                    onSendEmail={handleOpenSingleEmail}
                    onView={async (r) => {
                      await openEmployeeRouteInNewTab(r, "detail");
                    }}
                    onViewCard={async (r) => {
                      await openEmployeeRouteInNewTab(r, "card");
                    }}
                    onCreateEmployee={() => setCreateEmployeeModal(true)}
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
          setBulkEmailScope("readyFilter");
        }}
        onSend={handleSendBulkEmail}
        isBulk
        recipientCount={
          bulkEmailScope === "selectedRows"
            ? selectedRowsWithEmployeeCode.length
            : readyRows.length
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
        title="Review Upload Print Bulk Action"
      />
    </div>
  );
}

function SummaryRow({
  row,
  rowSelected,
  onToggleSelected,
  onPrint,
  onEdit,
  onBookmark,
  onSendEmail,
  onView,
  onViewCard,
  onCreateEmployee,
  actionInFlight,
}: {
  row: PrintUploadRowResult;
  rowSelected: boolean;
  onToggleSelected: (row: PrintUploadRowResult) => void;
  onPrint: (row: PrintUploadRowResult) => Promise<void>;
  onEdit: (row: PrintUploadRowResult) => Promise<void>;
  onBookmark: (row: PrintUploadRowResult) => Promise<void>;
  onSendEmail: (row: PrintUploadRowResult) => Promise<void>;
  onView: (row: PrintUploadRowResult) => Promise<void>;
  onViewCard: (row: PrintUploadRowResult) => Promise<void>;
  onCreateEmployee: () => void;
  actionInFlight: { action: "print" | "bookmark" | "edit" | null; rowKey?: string };
}) {
  const rowKey = `${row.rowNumber}-${row.employeeId || row.message}`;
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
          className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
        />
      </td>
      <td className="px-4 py-3 text-slate-700">{row.employeeId || "-"}</td>
      <td className="px-4 py-3 text-slate-700">{row.name || "-"}</td>
      <td className="px-4 py-3 text-slate-700">{row.email || "-"}</td>
      <td className="px-4 py-3 text-slate-700">{row.position || "-"}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(row.status)}`}>
          {row.status}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-700">{row.message}</td>
      <td className="px-4 py-3">
        <div className="relative">
          <button
            type="button"
            ref={menuOpen ? menuTriggerRef : null}
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
                onClick={async () => {
                  setMenuOpen(false);
                  await onPrint(row);
                }}
                disabled={row.status !== "ready" || isPrinting}
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
                onClick={async () => {
                  setMenuOpen(false);
                  await onEdit(row);
                }}
                disabled={isEditing}
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
                onClick={async () => {
                  setMenuOpen(false);
                  await onBookmark(row);
                }}
                disabled={isBookmarking}
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
                onClick={async () => {
                  setMenuOpen(false);
                  await onSendEmail(row);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50"
              >
                <Mail className="w-4 h-4" />
                Send Email
              </button>

              {row.status === "not-found" && (
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
                onClick={async () => {
                  setMenuOpen(false);
                  await onView(row);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                <Eye className="w-4 h-4" />
                View Details
              </button>
              <button
                type="button"
                onClick={async () => {
                  setMenuOpen(false);
                  await onViewCard(row);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-amber-50"
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
  tone?: "slate" | "green" | "red" | "amber";
  isActive?: boolean;
  onClick?: () => void;
}) {
  const toneClass =
    tone === "green"
      ? "bg-green-50 text-green-700 border-green-100"
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

function statusClass(status: PrintUploadRowResult["status"]) {
  switch (status) {
    case "ready":
      return "bg-green-100 text-green-700";
    case "missing-photo":
      return "bg-amber-100 text-amber-700";
    case "missing-information":
      return "bg-red-100 text-red-700";
    case "not-found":
      return "bg-red-100 text-red-700";
    case "duplicate":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-red-100 text-red-700";
  }
}
