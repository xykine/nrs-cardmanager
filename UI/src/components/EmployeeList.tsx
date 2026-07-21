import { useState, useEffect, useRef } from "react";
import { Employee } from "../types";
import { employeeService, printingService, resolvePdfUrl } from "../services/api";
import {
  Mail,
  Printer,
  RefreshCw,
  Plus,
  Trash,
  Download,
  Upload,
  ChevronDown,
} from "lucide-react";
import { useNotification } from "../contexts/NotificationContext";
import { useEmployees } from "../contexts/EmployeeContext";
import EmailDialog from "./EmailDialog";
import PrintingStationModal from "./PrintingStationModal";
import CreateEmployeeModal from "./CreateEmployeeModal";
import EmployeeTable from "./EmployeeTable";
import EmployeeFilterPanel, { EmployeeFilters } from "./FilterEmployee";
import Pagination from "./Pagination";
import DownloadEmployeeModal from "./DownloadEmployeeModal";
import EditEmployeeModal from "./EditEmployeeModal";
import UploadToCreateModal from "./UploadToCreateModal";
import UploadToPrintModal from "./UploadToPrintModal";
import PrintBatchReviewModal, { PrintReviewRow } from "./PrintBatchReviewModal";
import ConfirmRoleModal from "./ConfirmRoleModal";

interface EmployeeListProps {
  userRole: "manager" | "staff";
}

export default function EmployeeList({ userRole }: EmployeeListProps) {
  const {
    employees,
    setEmployees,
    totalRecords,
    setTotalRecords,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    filters,
    setFilters,
    clearCache,
  } = useEmployees();

  const { addNotification, updateNotification } = useNotification();
  const [departments, setDepartments] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailDialog, setEmailDialog] = useState<{
    isOpen: boolean;
    employeeId?: string;
    employeeName?: string;
    isBulk: boolean;
  }>({ isOpen: false, isBulk: false });
  const [printingModal, setPrintingModal] = useState<{
    isOpen: boolean;
    employeeIds: string[];
  }>({ isOpen: false, employeeIds: [] });
  const [printReviewModal, setPrintReviewModal] = useState<{
    isOpen: boolean;
    rows: PrintReviewRow[];
  }>({ isOpen: false, rows: [] });
  const [createEmployeeModal, setCreateEmployeeModal] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    employee: Employee | null;
  }>({ isOpen: false, employee: null });
  const [roleConfirmModal, setRoleConfirmModal] = useState<{
    isOpen: boolean;
    employeeId: string;
    employeeName: string;
    newRole: "manager" | "staff";
  }>({ isOpen: false, employeeId: "", employeeName: "", newRole: "staff" });
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [uploadToCreateOpen, setUploadToCreateOpen] = useState(false);
  const [uploadToPrintOpen, setUploadToPrintOpen] = useState(false);
  const [uploadDropdownOpen, setUploadDropdownOpen] = useState(false);
  const uploadDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [shouldRestoreScroll, setShouldRestoreScroll] = useState(true);

  const [isInitialLoad, setIsInitialLoad] = useState(employees.length === 0);
  const [selectAllPages, setSelectAllPages] = useState(false);

  const [activeFilters, setActiveFilters] = useState<EmployeeFilters>(filters);

  useEffect(() => {
    if (userRole === "manager") loadEmployees();
  }, [currentPage, pageSize, userRole, activeFilters]);

  // Close upload dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        uploadDropdownRef.current &&
        !uploadDropdownRef.current.contains(event.target as Node)
      ) {
        setUploadDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadDepartments = async () => {
    const response = await employeeService.getDepartments();
    setDepartments(response);
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      if (!loading && employees.length > 0) {
        sessionStorage.setItem(
          "employee_list_scroll",
          window.scrollY.toString(),
        );
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loading, employees.length]);

  // Restore scroll position
  useEffect(() => {
    if (!loading && employees.length > 0 && shouldRestoreScroll) {
      const savedScroll = sessionStorage.getItem("employee_list_scroll");
      if (savedScroll) {
        window.scrollTo(0, parseInt(savedScroll));
      }
      setShouldRestoreScroll(false);
    }
  }, [loading, employees.length, shouldRestoreScroll]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const response = await employeeService.getAll(
        currentPage,
        pageSize,
        activeFilters,
      );

      setEmployees(response.items);
      setTotalRecords(response.total);
      setError(null);
    } catch (err) {
      setError("Failed to load employees");
      console.error(err);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleSearch = () => {
    setActiveFilters(filters);
    setCurrentPage(1);
    setSelectAllPages(false);
    clearCache();
    setIsInitialLoad(true);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedIds(new Set());
    sessionStorage.removeItem("employee_list_scroll");
    window.scrollTo(0, 0);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
    setSelectedIds(new Set());
    sessionStorage.removeItem("employee_list_scroll");
    window.scrollTo(0, 0);
  };

  const handleSyncData = async () => {
    try {
      setLoading(true);
      await employeeService.syncData();
      setCurrentPage(1);
      await loadEmployees();
      setError(null);
      alert("Data synced successfully!");
    } catch (err) {
      setError("Failed to sync data");
      alert("Failed to sync data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectAllPages || selectedIds.size > 0) {
      setSelectedIds(new Set());
      setSelectAllPages(false);
    } else {
      setSelectAllPages(true);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectAllPages(false); // If they unselect one, we revert to individual selection
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleRoleChange = (
    employeeId: string,
    newRole: "manager" | "staff",
  ) => {
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee || employee.role === newRole) return;

    setRoleConfirmModal({
      isOpen: true,
      employeeId,
      employeeName: employee.name || "this employee",
      newRole,
    });
  };

  const handleConfirmRoleChange = async () => {
    const { employeeId, employeeName, newRole } = roleConfirmModal;
    const roleLabel = newRole === "manager" ? "Manager" : "Staff";

    setUpdatingRoleId(employeeId);

    const notificationId = addNotification({
      type: "progress",
      title: "Updating Role",
      message: `Updating role for ${employeeName}...`,
      autoClose: false,
    });

    try {
      await employeeService.updateRole(employeeId, newRole);
      setRoleConfirmModal({
        isOpen: false,
        employeeId: "",
        employeeName: "",
        newRole: "staff",
      });
      await loadEmployees();
      updateNotification(notificationId, {
        type: "success",
        title: "Role Updated",
        message: `Successfully updated ${employeeName}'s role to ${roleLabel}`,
        autoClose: true,
      });
    } catch (err) {
      updateNotification(notificationId, {
        type: "error",
        title: "Role Update Failed",
        message:
          err instanceof Error && err.message
            ? err.message
            : `Failed to update role for ${employeeName}`,
        autoClose: true,
      });
      console.error(err);
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleDownloadSubmit = async (
    option: "all" | "filtered" | "selected",
  ) => {
    let ids: string[] | undefined = undefined;
    let isAll = false;
    // We pass filters if "filtered" or default behavior for "all"
    // Wait, backend logic for "all" relies on `isAll=true` and NO filters/ids?
    // Actually `export_employees_csv`:
    // if ids -> use ids
    // elif isAll -> if filters -> apply filters, else -> all
    // else -> empty

    // So:
    // Option "selected": pass `employeeIds` = selectedIds
    // Option "filtered": pass `isAll=true`, `filters` = debouncedFilters
    // Option "all": pass `isAll=true`, `filters` = empty (or ignore filters in backend if we want pure all? but usually "all" implies "all currently visible/available" or "entire database"?
    // The requirement is "Download All Employee", "Download Filtered Employee".
    // "Download All" -> Entire DB.
    // "Download Filtered" -> Current filters.

    // So for "all": isAll=true, filters=undefined/empty
    // For "filtered": isAll=true, filters=debouncedFilters

    let payloadFilters: EmployeeFilters | undefined = undefined;

    if (option === "selected") {
      ids = Array.from(selectedIds);
      if (ids.length === 0) return; // Should be disabled anyway
    } else if (option === "filtered") {
      isAll = true;
      payloadFilters = activeFilters;
    } else if (option === "all") {
      isAll = true;
      payloadFilters = undefined; // Clear filters to get everyone
    }

    setDownloadModalOpen(false);

    const notificationId = addNotification({
      type: "progress",
      title: "Exporting CSV",
      message: "Generating CSV file...",
      progress: 0,
      autoClose: false,
    });

    try {
      const blob = await employeeService.exportCsv({
        employeeIds: ids,
        filters: payloadFilters,
        isAll: isAll,
      });

      // trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "employees.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      updateNotification(notificationId, {
        type: "success",
        title: "Export Complete",
        message: "CSV file downloaded successfully",
        autoClose: true,
      });
    } catch (err) {
      updateNotification(notificationId, {
        type: "error",
        title: "Export Failed",
        message: "Failed to download CSV",
        autoClose: true,
      });
      console.error(err);
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
        message: `Employee has been created successfully`,
        autoClose: true,
      });

      // Reset to first page to see the new employee
      setCurrentPage(1);
      await loadEmployees();
    } catch (err) {
      updateNotification(notificationId, {
        type: "error",
        title: "Creation Failed",
        message: "Failed to create employee. Please try again.",
        autoClose: true,
      });
      console.error(err);
      throw err;
    }
  };

  const handleOpenEdit = (employee: Employee) => {
    setEditModal({ isOpen: true, employee });
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
        message: "Changes saved successfully",
        autoClose: true,
      });

      await loadEmployees();
    } catch (err) {
      updateNotification(notificationId, {
        type: "error",
        title: "Update Failed",
        message: "Failed to save changes. Please try again.",
        autoClose: true,
      });
      console.error(err);
      throw err;
    }
  };

  const handleBulkSendInvitation = () => {
    setEmailDialog({
      isOpen: true,
      isBulk: true,
    });
  };

  const handleSendBulkEmail = async (message: string) => {
    let ids: string[];

    if (selectAllPages) {
      ids = [];
    } else {
      ids = Array.from(selectedIds);
    }

    const notificationId = addNotification({
      type: "progress",
      title: "Sending Emails",
      message: `Sending emails to ${ids.length} employee(s)...`,
      progress: 0,
      autoClose: false,
    });

    setEmailDialog({ isOpen: false, isBulk: false });

    try {
      const result = await employeeService.sendBulkEmail(
        ids,
        message,
        activeFilters,
        selectAllPages,
      );

      updateNotification(notificationId, {
        type: "success",
        title: "Emails Sent",
        message: `Successfully sent ${result.success} email(s). ${
          result.failed > 0 ? `${result.failed} failed.` : ""
        }`,
        autoClose: true,
      });

      await loadEmployees();
      setSelectedIds(new Set());
    } catch (err) {
      updateNotification(notificationId, {
        type: "error",
        title: "Email Failed",
        message: "Failed to send emails. Please try again.",
        autoClose: true,
      });
      console.error(err);
    }
  };

  const handleBulkPrintCard = async () => {
    let selectedEmployees: Employee[] = [];

    if (selectAllPages) {
      try {
        setLoading(true);
        const response = await employeeService.getAll(
          1,
          totalRecords,
          activeFilters,
        );
        selectedEmployees = response.items;
      } catch (err) {
        console.error("Failed to fetch all IDs for print", err);
        addNotification({
          type: "error",
          title: "Print Failed",
          message: "Failed to prepare print review. Please try again.",
          autoClose: true,
        });
        return;
      } finally {
        setLoading(false);
      }
    } else {
      selectedEmployees = employees.filter((e) => selectedIds.has(e.id));
    }

    if (selectedEmployees.length === 0) {
      addNotification({
        type: "error",
        title: "Print Failed",
        message: "No employees selected for printing.",
        autoClose: true,
      });
      return;
    }

    try {
      const history = await printingService.getPrintHistoryStatus(
        selectedEmployees.map((employee) => employee.id),
      );
      const printedMap = new Map(
        history.items.map((item) => [item.employeeId, item]),
      );

      const rows: PrintReviewRow[] = selectedEmployees.map((employee) => ({
        employeeDbId: employee.id,
        employeeId: employee.employeeId,
        name: employee.name || employee.email || employee.employeeId,
        hasPhoto: employee.photoPresent,
        wasPreviouslyPrinted: printedMap.has(employee.id),
        skipReasonIfExcluded:
          "Previously printed (present in print history)",
      }));

      setPrintReviewModal({ isOpen: true, rows });
    } catch (err) {
      console.error(err);
      addNotification({
        type: "error",
        title: "Print Review Failed",
        message: "Failed to load print history for selected employees.",
        autoClose: true,
      });
    }
  };

  const handleBulkDelete = async () => {
    let ids: string[];
    let count: number;

    if (selectAllPages) {
      // Fetch all IDs if selecting all pages (potentially huge, but for MVP reasonable)
      // Alternatively, api supports just sending filters? No, api currently takes IDs.
      // We'll fetch all IDs for now as in bulk print/email.
      const response = await employeeService.getAll(
        1,
        totalRecords,
        activeFilters,
      );
      ids = response.items.map((e) => e.id);
      count = response.total;
    } else {
      ids = Array.from(selectedIds);
      count = ids.length;
    }

    if (
      !confirm(
        `Are you sure you want to delete ${count} employee(s)? This action cannot be undone.`,
      )
    ) {
      return;
    }

    const notificationId = addNotification({
      type: "progress",
      title: "Deleting Employees",
      message: `Deleting ${count} employee(s)...`,
      progress: 0,
      autoClose: false,
    });

    try {
      await employeeService.deleteBulk(ids);

      updateNotification(notificationId, {
        type: "success",
        title: "Employees Deleted",
        message: `Successfully deleted ${count} employee(s)`,
        autoClose: true,
      });

      setSelectedIds(new Set());
      setSelectAllPages(false);
      // Determine if we need to go back a page
      if (employees.length === ids.length && currentPage > 1) {
        setCurrentPage((prev) => prev - 1);
      } else {
        await loadEmployees();
      }
    } catch (err) {
      updateNotification(notificationId, {
        type: "error",
        title: "Delete Failed",
        message: "Failed to delete employees",
        autoClose: true,
      });
      console.error(err);
    }
  };

  const handleSendInvitation = (id: string) => {
    const employee = employees.find((e) => e.id === id);
    setEmailDialog({
      isOpen: true,
      employeeId: id,
      employeeName: employee ? `${employee.name}` : undefined,
      isBulk: false,
    });
  };

  const handleSendSingleEmail = async (message: string) => {
    const { employeeId, employeeName } = emailDialog;
    if (!employeeId) return;

    const notificationId = addNotification({
      type: "progress",
      title: "Sending Email",
      message: `Sending email to ${employeeName}...`,
      progress: 0,
      autoClose: false,
    });

    setEmailDialog({ isOpen: false, isBulk: false });

    try {
      await employeeService.sendBulkEmail(
        [employeeId],
        message,
        activeFilters,
        selectAllPages,
      );

      updateNotification(notificationId, {
        type: "success",
        title: "Email Sent",
        message: `Email successfully sent to ${employeeName}`,
        autoClose: true,
      });

      await loadEmployees();
      setSelectedIds(new Set());
    } catch (err) {
      updateNotification(notificationId, {
        type: "error",
        title: "Email Failed",
        message: `Failed to send email to ${employeeName}. Please try again.`,
        autoClose: true,
      });
      console.error(err);
    }
  };

  const handlePrintCard = (employee: Employee) => {
    if (!employee.photoPresent) {
      addNotification({
        type: "error",
        title: "Print Failed",
        message: "No photo available for this employee",
        autoClose: true,
      });
      return;
    }

    setPrintingModal({ isOpen: true, employeeIds: [employee.id] });
  };

  const generatePrintPdf = async (idsToPrint: string[]) => {
    const employeeCount = idsToPrint.length;
    if (employeeCount === 0) {
      addNotification({
        type: "error",
        title: "Print Failed",
        message: "No valid employees available for printing.",
        autoClose: true,
      });
      return;
    }

    const notificationId = addNotification({
      type: "progress",
      title: "Generating Print PDF",
      message: `Starting PDF generation for ${employeeCount} card(s)...`,
      progress: 10,
      autoClose: false,
    });

    try {
      // 1. Create Jobs (Backend will generate images)
      const jobs = await printingService.createBatch(
        "PDF_GENERATION",
        idsToPrint,
        activeFilters,
        false,
      );

      // 2. Start PDF Batch
      const jobIds = jobs.map((j: any) => j.jobId);
      const localDate = new Date().toLocaleDateString("en-CA");
      let batch = await printingService.downloadBatchPdf(jobIds, localDate);

      // 3. Poll for Completion
      updateNotification(notificationId, {
        message: "Processing cards and generating PDF... This may take a moment for large batches.",
        progress: 40,
      });

      let attempts = 0;
      const maxAttempts = 150; // 5 minutes max (2s * 150)
      
      while (batch.status === "PENDING" || batch.status === "PROCESSING") {
        if (attempts >= maxAttempts) {
           throw new Error("PDF generation timed out. Please check back later in the Print History.");
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        batch = await printingService.getBatchStatus(batch.id);
        attempts++;
        
        // Dynamic progress update based on time
        const currentProgress = Math.min(40 + (attempts * 0.5), 95);
        updateNotification(notificationId, { progress: currentProgress });
      }

      if (batch.status === "FAILED") {
        throw new Error(batch.errorMessage || "PDF generation failed on the server.");
      }

      // 4. Download/Open PDF
      if (batch.pdfUrl) {
          const pdfUrl = resolvePdfUrl(batch.pdfUrl);
          window.open(pdfUrl, "_blank");

          updateNotification(notificationId, {
            type: "success",
            title: "PDF Generated",
            message: `PDF opened in new tab`,
            progress: 100,
            autoClose: true,
          });
      }

      setSelectedIds(new Set());
    } catch (err: any) {
      updateNotification(notificationId, {
        type: "error",
        title: "Print Failed",
        message: err.message || "Failed to generate print PDF. Please try again.",
        autoClose: true,
      });
      console.error(err);
    }
  };

  const handlePrintingSubmit = async (/* stationId ignored */) => {
    const idsToPrint = [...printingModal.employeeIds];
    setPrintingModal({ isOpen: false, employeeIds: [] });
    await generatePrintPdf(idsToPrint);
  };

  const handleConfirmPrintReview = async (includePreviouslyPrinted: boolean) => {
    const idsToPrint = printReviewModal.rows
      .filter(
        (row) =>
          row.hasPhoto &&
          (includePreviouslyPrinted || !row.wasPreviouslyPrinted),
      )
      .map((row) => row.employeeDbId);

    setPrintReviewModal({ isOpen: false, rows: [] });
    await generatePrintPdf(idsToPrint.filter((id): id is string => Boolean(id)));
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this employee? This will also remove their card data.",
      )
    ) {
      return;
    }

    const notificationId = addNotification({
      type: "progress",
      title: "Deleting Employee",
      message: "Deleting employee...",
      progress: 0,
      autoClose: false,
    });

    try {
      await employeeService.delete(id);

      updateNotification(notificationId, {
        type: "success",
        title: "Employee Deleted",
        message: "Employee deleted successfully",
        autoClose: true,
      });

      if (employees.length === 1 && currentPage > 1) {
        setCurrentPage((prev) => prev - 1);
      } else {
        await loadEmployees();
      }
    } catch (err) {
      updateNotification(notificationId, {
        type: "error",
        title: "Delete Failed",
        message: "Failed to delete employee",
        autoClose: true,
      });
      console.error(err);
    }
  };

  const handleBookmark = async (employee: Employee) => {
    const isBookmarked = Boolean(employee.isBookmarked);
    const notificationId = addNotification({
      type: "progress",
      title: isBookmarked ? "Removing Bookmark" : "Bookmarking Employee",
      message: isBookmarked
        ? `Removing bookmark for ${employee.name || "employee"}...`
        : `Bookmarking ${employee.name || "employee"}...`,
      progress: 0,
      autoClose: false,
    });

    try {
      if (isBookmarked) {
        await employeeService.unbookmarkEmployee(employee.id);
      } else {
        await employeeService.bookmarkEmployee(
          employee.id,
          "Bookmarked from employee list",
        );
      }

      updateNotification(notificationId, {
        type: "success",
        title: isBookmarked ? "Bookmark Removed" : "Employee Bookmarked",
        message: isBookmarked
          ? `${employee.name || "Employee"} was removed from bookmarks`
          : `${employee.name || "Employee"} has been bookmarked`,
        autoClose: true,
      });

      await loadEmployees();
    } catch (err) {
      updateNotification(notificationId, {
        type: "error",
        title: isBookmarked ? "Remove Bookmark Failed" : "Bookmark Failed",
        message: isBookmarked
          ? "Failed to remove bookmark"
          : "Failed to bookmark employee",
        autoClose: true,
      });
      console.error(err);
    }
  };

  const clearFilters = () => {
    const cleared = {
      name: "",
      employeeId: "",
      email: "",
      isBookmarked: false,
      photoStatus: "all" as const,
      department: "all",
      employeeType: "all" as const,
      position: "all",
      consultantPrefix: "",
      role: "all",
      startDate: "",
      endDate: "",
      requestStatus: "all",
    };
    setFilters(cleared);
    setActiveFilters(cleared);
    setCurrentPage(1);
    clearCache();
  };

  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading employees...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Employee List</h1>
            <p className="text-slate-600">
              Manage employee cards and photo uploads
            </p>
          </div>

          {/* Header actions */}
          <div className="flex gap-3 items-center">
            {/* Upload dropdown */}
            <div className="relative" ref={uploadDropdownRef}>
              <button
                onClick={() => setUploadDropdownOpen((o) => !o)}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                Actions
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${uploadDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {uploadDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 z-20 overflow-hidden">
                  <button
                    onClick={() => {
                      setCreateEmployeeModal(true);
                      setUploadDropdownOpen(false);
                    }}
                    disabled={loading}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-green-50 hover:text-green-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Employee
                  </button>

                  <button
                    onClick={() => setDownloadModalOpen(true)}
                    disabled={loading}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-green-50 hover:text-green-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button
                    onClick={handleSyncData}
                    disabled={loading}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-green-50 hover:text-green-700 transition-colors"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                    />
                    Sync Data
                  </button>

                  <button
                    onClick={() => {
                      setUploadToCreateOpen(true);
                      setUploadDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-green-50 hover:text-green-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 text-green-600" />
                    Upload To Create
                  </button>
                  <div className="border-t border-slate-100" />
                  <button
                    onClick={() => {
                      setUploadToPrintOpen(true);
                      setUploadDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                  >
                    <Printer className="w-4 h-4 text-purple-600" />
                    Upload To Print
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {(selectAllPages || selectedIds.size > 0) && userRole === "manager" && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-blue-800 font-medium">
                {selectAllPages ? totalRecords : selectedIds.size} employee
                {(selectAllPages ? totalRecords : selectedIds.size) > 1
                  ? "s"
                  : ""}{" "}
                selected
                {selectAllPages && " (all pages matching filters)"}
              </span>
              <button
                onClick={() => {
                  setSelectedIds(new Set());
                  setSelectAllPages(false);
                }}
                className="text-blue-600 hover:text-blue-800 text-sm underline"
              >
                Clear selection
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleBulkSendInvitation}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Mail className="w-4 h-4" />
                Send Link
              </button>
              <button
                onClick={handleBulkPrintCard}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <Printer className="w-4 h-4" />
                Print Cards
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                <Trash className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg overflow-hidden relative">
          {loading && !isInitialLoad && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          )}
          <EmployeeFilterPanel
            filters={filters}
            setFilters={setFilters}
            clearFilters={clearFilters}
            departments={departments}
            onSearch={handleSearch}
          />

          <EmployeeTable
            employees={employees}
            userRole={userRole}
            selectedIds={selectedIds}
            isAllSelected={selectAllPages}
            updatingRoleId={updatingRoleId}
            onToggleSelection={handleSelectRow}
            onToggleSelectAll={handleSelectAll}
            onSendInvitation={handleSendInvitation}
            onPrintCard={handlePrintCard}
            onRoleChange={handleRoleChange}
            onDelete={handleDelete}
            onEdit={handleOpenEdit}
            onBookmark={handleBookmark}
            routes={{
              card: (id: string) => `/card/${id}`,
              detail: (id: string) => `/detail/${id}`,
            }}
          />

          {totalRecords > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={totalRecords}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              itemName="employee"
            />
          )}
        </div>
      </div>

      <EmailDialog
        isOpen={emailDialog.isOpen}
        onClose={() => setEmailDialog({ isOpen: false, isBulk: false })}
        onSend={
          emailDialog.isBulk ? handleSendBulkEmail : handleSendSingleEmail
        }
        employeeName={emailDialog.employeeName}
        isBulk={emailDialog.isBulk}
        recipientCount={selectAllPages ? totalRecords : selectedIds.size}
      />

      <PrintingStationModal
        isOpen={printingModal.isOpen}
        onClose={() => setPrintingModal({ isOpen: false, employeeIds: [] })}
        onSubmit={handlePrintingSubmit}
        employeeCount={printingModal.employeeIds.length}
      />

      <PrintBatchReviewModal
        isOpen={printReviewModal.isOpen}
        onClose={() => setPrintReviewModal({ isOpen: false, rows: [] })}
        onConfirm={handleConfirmPrintReview}
        rows={printReviewModal.rows}
        title="Review Bulk Print Selection"
      />

      <CreateEmployeeModal
        isOpen={createEmployeeModal}
        onClose={() => setCreateEmployeeModal(false)}
        onSubmit={handleCreateEmployee}
        departments={departments}
      />

      <EditEmployeeModal
        isOpen={editModal.isOpen}
        employee={editModal.employee}
        onClose={() => setEditModal({ isOpen: false, employee: null })}
        onSubmit={handleEditEmployee}
        departments={departments}
      />

      <ConfirmRoleModal
        isOpen={roleConfirmModal.isOpen}
        employeeName={roleConfirmModal.employeeName}
        newRole={roleConfirmModal.newRole}
        isSubmitting={updatingRoleId === roleConfirmModal.employeeId}
        onClose={() => {
          if (updatingRoleId) return;
          setRoleConfirmModal({
            isOpen: false,
            employeeId: "",
            employeeName: "",
            newRole: "staff",
          });
        }}
        onConfirm={handleConfirmRoleChange}
      />

      <DownloadEmployeeModal
        isOpen={downloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
        onSubmit={handleDownloadSubmit}
        hasSelection={selectedIds.size > 0}
        hasFilters={
          !!(
            activeFilters.name ||
            activeFilters.employeeId ||
            activeFilters.email ||
            activeFilters.isBookmarked ||
            activeFilters.department !== "all" ||
            activeFilters.photoStatus !== "all" ||
            activeFilters.employeeType !== "all" ||
            activeFilters.position !== "all" ||
            activeFilters.requestStatus !== "all"
          )
        }
      />

      <UploadToCreateModal
        isOpen={uploadToCreateOpen}
        onClose={() => setUploadToCreateOpen(false)}
        onUploadComplete={loadEmployees}
      />

      <UploadToPrintModal
        isOpen={uploadToPrintOpen}
        onClose={() => setUploadToPrintOpen(false)}
      />
    </div>
  );
}
