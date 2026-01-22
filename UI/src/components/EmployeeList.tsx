import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Employee } from "../types";
import { employeeService, printingService } from "../services/api";
import {
  Mail,
  Printer,
  LogOut,
  RefreshCw,
  List,
  Plus,
  Trash,
} from "lucide-react";
import { useNotification } from "../contexts/NotificationContext";
import EmailDialog from "./EmailDialog";
import PrintingStationModal from "./PrintingStationModal";
import CreateEmployeeModal from "./CreateEmployeeModal";
import EmployeeTable from "./EmployeeTable";
import EmployeeFilterPanel, { EmployeeFilters } from "./FilterEmployee";

interface EmployeeListProps {
  onLogout: () => void;
  userRole: "manager" | "staff";
}

export default function EmployeeList({
  onLogout,
  userRole,
}: EmployeeListProps) {
  const navigate = useNavigate();
  const { addNotification, updateNotification } = useNotification();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<EmployeeFilters>({
    name: "",
    employeeId: "",
    photoStatus: "all",
    department: "all",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [pageSize] = useState(20);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectAllPages, setSelectAllPages] = useState(false);

  const [debouncedFilters, setDebouncedFilters] =
    useState<EmployeeFilters>(filters);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
      setSelectAllPages(false); // Reset when filters change
    }, 500);

    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    if (userRole === "manager") loadEmployees();
  }, [currentPage, userRole, debouncedFilters]);

  const loadDepartments = async () => {
    const response = await employeeService.getDepartments();
    setDepartments(response);
  };

  useEffect(() => {
    loadDepartments();
  }, []);

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

  const handleNextPage = () => {
    const totalPages = Math.ceil(totalRecords / pageSize);
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      setSelectedIds(new Set());
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      setSelectedIds(new Set());
    }
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

  const handleCreateEmployee = async (data: {
    name: string;
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
        name: data.name,
        employeeId: data.employeeId,
        email: data.email,
      });

      updateNotification(notificationId, {
        type: "success",
        title: "Employee Created",
        message: `${data.name} has been created successfully`,
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
      const response = await employeeService.getAll(1, totalRecords, debouncedFilters);
      ids = response.items.map(e => e.id);
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
      const result = await employeeService.sendBulkEmail(ids, message);

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
      console.log("-----------ALL + FILTER ---------")
      ids = []
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
      employeeName: employee?.name,
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
      await employeeService.sendBulkEmail([employeeId], message);

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

  const handlePrintingSubmit = async (stationId: string) => {
    const employeeCount = selectAllPages ? "All pages" : printingModal.employeeIds.length;
    setPrintingModal({ isOpen: false, employeeIds: [] });

    const notificationId = addNotification({
      type: "progress",
      title: "Creating Print Batch",
      message: `Preparing ${employeeCount} card(s) for printing...`,
      progress: 50,
      autoClose: false,
    });

    try {
      await printingService.createBatch(
        stationId,
        printingModal.employeeIds,
        filters,
        selectAllPages
      );

      updateNotification(notificationId, {
        type: "success",
        title: "Print Batch Created",
        message: `${employeeCount} card(s) queued for printing`,
        autoClose: true,
      });

      setSelectedIds(new Set());
    } catch (err) {
      updateNotification(notificationId, {
        type: "error",
        title: "Print Failed",
        message: "Failed to create print batch. Please try again.",
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

  if (isInitialLoad && loading) {
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
            <h1 className="text-4xl font-bold text-slate-800 mb-2">
              NRS Card Manager
            </h1>
            <p className="text-slate-600">
              Manage employee cards and photo uploads
            </p>
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
              onClick={handleSyncData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Sync Data
            </button>
            <button
              onClick={() => navigate("/printing")}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-md"
            >
              <List className="w-4 h-4" />
              Printing Tasks
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium shadow-md"
            >
              <LogOut className="w-4 h-4" />
              Logout
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


          {employees.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Showing {(currentPage - 1) * pageSize + 1} to{" "}
                {Math.min(currentPage * pageSize, totalRecords)} of{" "}
                {totalRecords.toLocaleString()} employee
                {totalRecords !== 1 ? "s" : ""}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentPage === 1
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-slate-600">
                  Page {currentPage} of {Math.ceil(totalRecords / pageSize)}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage >= Math.ceil(totalRecords / pageSize)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentPage >= Math.ceil(totalRecords / pageSize)
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                >
                  Next
                </button>
              </div>
            </div>
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
    </div>
  );
}
