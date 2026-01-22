import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Employee } from "../types";
import { employeeService, printingService } from "../services/api";
import {
  Mail,
  Printer,
  CreditCard,
  Eye,
  Copy,
  Check,
  Search,
  X,
  LogOut,
  RefreshCw,
  List,
  Plus,
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
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

  useEffect(() => {
    if (userRole === "manager") loadEmployees();
  }, [currentPage, userRole, filters]);

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
        filters,
      );
      setEmployees(response.items);
      setTotalRecords(response.total);
      setError(null);
    } catch (err) {
      setError("Failed to load employees");
      console.error(err);
    } finally {
      setLoading(false);
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

  const handleSelectAll = () => {};

  const handleSelectRow = (id: string) => {
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
    const selectedEmployees = employees.filter((e) => selectedIds.has(e.id));

    setEmailDialog({
      isOpen: true,
      isBulk: true,
    });
  };

  const handleSendBulkEmail = async (message: string) => {
    const selectedEmployees = employees.filter((e) => selectedIds.has(e.id));
    const ids = Array.from(selectedIds);

    const notificationId = addNotification({
      type: "progress",
      title: "Sending Emails",
      message: `Sending emails to ${selectedEmployees.length} employee(s)...`,
      progress: 0,
      autoClose: false,
    });

    setEmailDialog({ isOpen: false, isBulk: false });

    try {
      const result = await employeeService.sendBulkEmail(ids, message);

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
    const selectedEmployees = employees.filter((e) => selectedIds.has(e.id));
    const employeesWithPhoto = selectedEmployees.filter((e) => e.photoPresent);

    if (employeesWithPhoto.length === 0) {
      addNotification({
        type: "error",
        title: "Print Failed",
        message: "None of the selected employees have photos uploaded",
        autoClose: true,
      });
      return;
    }

    if (employeesWithPhoto.length < selectedEmployees.length) {
      const withoutPhoto = selectedEmployees.length - employeesWithPhoto.length;
      if (
        !confirm(
          `${withoutPhoto} employee(s) don't have photos. Continue printing for the rest?`,
        )
      ) {
        return;
      }
    }

    const ids = employeesWithPhoto.map((e) => e.id);
    setPrintingModal({ isOpen: true, employeeIds: ids });
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
      await employeeService.sendEmail(employeeId, message);

      updateNotification(notificationId, {
        type: "success",
        title: "Email Sent",
        message: `Email successfully sent to ${employeeName}`,
        autoClose: true,
      });

      await loadEmployees();
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
    const employeeCount = printingModal.employeeIds.length;
    setPrintingModal({ isOpen: false, employeeIds: [] });

    const notificationId = addNotification({
      type: "progress",
      title: "Creating Print Batch",
      message: `Preparing ${employeeCount} card(s) for printing...`,
      progress: 50,
      autoClose: false,
    });

    try {
      const batch = await printingService.createBatch(
        stationId,
        printingModal.employeeIds,
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

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearFilters = () => {
    setFilters({
      name: "",
      employeeId: "",
      photoStatus: "all",
      department: "all",
    });
  };

  if (loading) {
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

  const hasActiveFilters =
    filters.name ||
    filters.employeeId ||
    filters.photoStatus !== "all" ||
    filters.department !== "all";

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

        {selectedIds.size > 0 && userRole === "manager" && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-blue-800 font-medium">
                {selectedIds.size} employee{selectedIds.size > 1 ? "s" : ""}{" "}
                selected
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
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
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
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
            onSendInvitation={handleSendInvitation}
            onPrintCard={handlePrintCard}
            onRoleChange={handleRoleChange}
            routes={{
              card: (id) => `/card/${id}`,
              detail: (id) => `/detail/${id}`,
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
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentPage === 1
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
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentPage >= Math.ceil(totalRecords / pageSize)
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
        recipientCount={selectedIds.size}
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
