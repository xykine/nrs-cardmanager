import { useState, useEffect } from "react";
import { Employee } from "../types";
import { employeeService, printingService } from "../services/api";
import {
  Mail,
  Printer,
  RefreshCw,
  Plus,
  Trash,
  Download,
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
import { useLocation } from "react-router-dom";

interface EmployeeListProps {
  userRole: "manager" | "staff";
}

export default function EmployeeList({
  userRole,
}: EmployeeListProps) {
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
  const [createEmployeeModal, setCreateEmployeeModal] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [shouldRestoreScroll, setShouldRestoreScroll] = useState(true);

  const [isInitialLoad, setIsInitialLoad] = useState(employees.length === 0);
  const [selectAllPages, setSelectAllPages] = useState(false);

  const [debouncedFilters, setDebouncedFilters] =
    useState<EmployeeFilters>(filters);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (JSON.stringify(filters) !== JSON.stringify(debouncedFilters)) {
        setDebouncedFilters(filters);
        setSelectAllPages(false);
        clearCache();
        setIsInitialLoad(true);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [filters, debouncedFilters, clearCache]);

  useEffect(() => {
    if (userRole === "manager") loadEmployees();
  }, [currentPage, pageSize, userRole, debouncedFilters]);

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
        sessionStorage.setItem("employee_list_scroll", window.scrollY.toString());
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
        debouncedFilters,
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

  const handleRoleChange = async (
    employeeId: string,
    newRole: "manager" | "staff",
  ) => {
    try {
      await employeeService.updateRole(employeeId, newRole);
      await loadEmployees();
    } catch (err) {
      alert("Failed to update role");
      console.error(err);
    }
  };

  const handleDownloadSubmit = async (option: "all" | "filtered" | "selected") => {
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
      payloadFilters = debouncedFilters;
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
    email: string;
    department?: string;
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

  const handleBulkSendInvitation = () => {
    setEmailDialog({
      isOpen: true,
      isBulk: true,
    });
  };

  const handleSendBulkEmail = async (message: string) => {
    let ids: string[];

    if (selectAllPages) {
      ids = []
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
      const result = await employeeService.sendBulkEmail(ids, message, filters, selectAllPages);

      updateNotification(notificationId, {
        type: "success",
        title: "Emails Sent",
        message: `Successfully sent ${result.success} email(s). ${result.failed > 0 ? `${result.failed} failed.` : ""
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
    let ids: string[];
    let employeeCount: number;

    if (selectAllPages) {
      console.log("-----------ALL + FILTER ---------");
      // Fetch all IDs if selecting all pages
      try {
        setLoading(true);
        const response = await employeeService.getAll(
          1,
          totalRecords,
          debouncedFilters,
        );
        ids = response.items
          .filter((e) => e.photoPresent)
          .map((e) => e.id);
        employeeCount = response.items.length; // Total attempt

        if (ids.length === 0) {
          addNotification({
            type: "error",
            title: "Print Failed",
            message: "None of the selected employees have photos uploaded",
            autoClose: true,
          });
          setLoading(false);
          return;
        }

        if (ids.length < employeeCount) {
          const withoutPhoto = employeeCount - ids.length;
          if (!confirm(`${withoutPhoto} employee(s) don't have photos - they will be skipped. Continue printing for the ${ids.length} valid employee(s)?`)) {
            setLoading(false);
            return;
          }
        }
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch all IDs for print", err);
        addNotification({
          type: "error",
          title: "Print Failed",
          message: "Failed to prepare print job. Please try again.",
          autoClose: true,
        });
        setLoading(false);
        return;
      }
    } else {
      const selectedEmployees = employees.filter((e) => selectedIds.has(e.id));
      const employeesWithPhoto = selectedEmployees.filter((e) => e.photoPresent);
      ids = employeesWithPhoto.map((e) => e.id);
      employeeCount = selectedEmployees.length;

      if (ids.length === 0) {
        addNotification({
          type: "error",
          title: "Print Failed",
          message: "None of the selected employees have photos uploaded",
          autoClose: true,
        });
        return;
      }

      if (ids.length < employeeCount) {
        const withoutPhoto = employeeCount - ids.length;
        if (!confirm(`${withoutPhoto} employee(s) don't have photos. Continue printing for the rest?`)) {
          return;
        }
      }
    }

    setPrintingModal({ isOpen: true, employeeIds: ids });
  };

  const handleBulkDelete = async () => {
    let ids: string[];
    let count: number;

    if (selectAllPages) {
      // Fetch all IDs if selecting all pages (potentially huge, but for MVP reasonable)
      // Alternatively, api supports just sending filters? No, api currently takes IDs.
      // We'll fetch all IDs for now as in bulk print/email.
      const response = await employeeService.getAll(1, totalRecords, debouncedFilters);
      ids = response.items.map(e => e.id);
      count = response.total;
    } else {
      ids = Array.from(selectedIds);
      count = ids.length;
    }

    if (!confirm(`Are you sure you want to delete ${count} employee(s)? This action cannot be undone.`)) {
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
        setCurrentPage(prev => prev - 1);
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
      await employeeService.sendBulkEmail([employeeId], message, filters, selectAllPages);

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

  const handlePrintingSubmit = async (/* stationId ignored */) => {
    // We now always have explicit IDs in printingModal.employeeIds
    const employeeCount = printingModal.employeeIds.length;

    // Copy locally to avoid state closure issues if needed, though state is fine here
    const idsToPrint = [...printingModal.employeeIds];

    setPrintingModal({ isOpen: false, employeeIds: [] });

    const notificationId = addNotification({
      type: "progress",
      title: "Generating Print PDF",
      message: `Preparing PDF for ${employeeCount} card(s)...`,
      progress: 50,
      autoClose: false,
    });

    try {
      // 1. Create Jobs (Backend will generate images)
      // Pass "PDF_GENERATION" as stationId since backend expects a string.
      // We pass explicit IDs, so isAll is false.
      const jobs = await printingService.createBatch(
        "PDF_GENERATION",
        idsToPrint,
        filters,
        false
      );

      // 2. Get Job IDs
      const jobIds = jobs.map((j: any) => j.jobId);

      // 3. Download PDF
      const localDate = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
      const blob = await printingService.downloadBatchPdf(jobIds, localDate);
      const url = window.URL.createObjectURL(blob);

      // 4. Open PDF
      window.open(url, '_blank');

      updateNotification(notificationId, {
        type: "success",
        title: "PDF Generated",
        message: `PDF opened in new tab`,
        autoClose: true,
      });

      setSelectedIds(new Set());
    } catch (err) {
      updateNotification(notificationId, {
        type: "error",
        title: "Print Failed",
        message: "Failed to generate print PDF. Please try again.",
        autoClose: true,
      });
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this employee? This will also remove their card data.")) {
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
        setCurrentPage(prev => prev - 1);
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

  const clearFilters = () => {
    setFilters({
      name: "",
      employeeId: "",
      photoStatus: "all",
      department: "all",
    });
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
            <p className="text-slate-600">Manage employee cards and photo uploads</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setCreateEmployeeModal(true)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Create Employee
            </button>
            <button
              onClick={() => setDownloadModalOpen(true)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={handleSyncData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Sync Data
            </button>

          </div>
        </div>

        {(selectAllPages || selectedIds.size > 0) && userRole === "manager" && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-blue-800 font-medium">
                {selectAllPages ? totalRecords : selectedIds.size} employee{(selectAllPages ? totalRecords : selectedIds.size) > 1 ? "s" : ""}{" "}
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
          // hasActiveFilters={hasActiveFilters}
          />

          <EmployeeTable
            employees={employees}
            userRole={userRole}
            selectedIds={selectedIds}
            isAllSelected={selectAllPages}
            onToggleSelection={handleSelectRow}
            onToggleSelectAll={handleSelectAll}
            onSendInvitation={handleSendInvitation}
            onPrintCard={handlePrintCard}
            onRoleChange={handleRoleChange}
            onDelete={handleDelete}
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

      <CreateEmployeeModal
        isOpen={createEmployeeModal}
        onClose={() => setCreateEmployeeModal(false)}
        onSubmit={handleCreateEmployee}
        departments={departments}
      />

      <DownloadEmployeeModal
        isOpen={downloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
        onSubmit={handleDownloadSubmit}
        hasSelection={selectedIds.size > 0}
        hasFilters={!!(debouncedFilters.name || debouncedFilters.employeeId || debouncedFilters.department !== "all" || debouncedFilters.photoStatus !== "all")}
      />
    </div >
  );
}
