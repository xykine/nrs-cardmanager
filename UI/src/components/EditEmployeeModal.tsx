import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Employee } from "../types";

interface EditEmployeeModalProps {
  isOpen: boolean;
  employee: Employee | null;
  onClose: () => void;
  onSubmit: (employeeId: string, data: {
    name?: string;
    email?: string;
    employeeId?: string;
    position?: string;
    idPrefix?: string;
    consultantPrefix?: string;
    employmentStartDate?: string;
    employmentEndDate?: string;
    department?: string;
  }) => Promise<void>;
  departments: string[];
  isLoading?: boolean;
}

function toDateInputValue(val?: string | null): string {
  if (!val) return "";
  // Backend may return ISO datetime strings like "2024-01-15T00:00:00"
  return val.substring(0, 10);
}

export default function EditEmployeeModal({
  isOpen,
  employee,
  onClose,
  onSubmit,
  departments,
  isLoading = false,
}: EditEmployeeModalProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    employeeId: "",
    email: "",
    idPrefix: "",
    position: "",
    consultantPrefix: "",
    employmentStartDate: "",
    employmentEndDate: "",
    department: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Pre-populate form whenever the employee prop changes
  useEffect(() => {
    if (employee) {
      const nameParts = (employee.name || "").trim().split(/\s+/);
      const firstName = nameParts[0] ?? "";
      const lastName = nameParts.slice(1).join(" ");

      setFormData({
        firstName,
        lastName,
        employeeId: employee.employeeId ?? "",
        email: employee.email ?? "",
        idPrefix: employee.idPrefix ?? "IR",
        position: employee.position ?? "",
        consultantPrefix: employee.consultantPrefix ?? "",
        employmentStartDate: toDateInputValue(employee.employmentStartDate),
        employmentEndDate: toDateInputValue(employee.employmentEndDate),
        department: employee.department ?? "",
      });
      setErrors({});
    }
  }, [employee]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim())  newErrors.lastName  = "Last name is required";
    if (!formData.employeeId.trim()) {
      newErrors.employeeId = "IR Number is required";
    } else if (!/^\d+$/.test(formData.employeeId.trim())) {
      newErrors.employeeId = "IR Number must contain only numbers and no spaces";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !employee) return;

    setSubmitting(true);
    try {
      await onSubmit(employee.id, {
        name: `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim(),
        employeeId: formData.employeeId.trim(),
        email: formData.email.trim(),
        position: formData.position || undefined,
        idPrefix: formData.idPrefix.trim() || undefined,
        consultantPrefix: formData.consultantPrefix.trim() || undefined,
        employmentStartDate: formData.employmentStartDate || undefined,
        employmentEndDate: formData.employmentEndDate || undefined,
        department: formData.department || undefined,
      });
      onClose();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "An error occurred";
      if (msg.toLowerCase().includes("email")) {
        setErrors({ email: msg });
      } else if (msg.toLowerCase().includes("id")) {
        setErrors({ employeeId: msg });
      } else {
        setErrors({ root: msg });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isNonStaff = formData.employeeId.length > 5;

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Edit Employee</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              ID: <span className="font-mono">{employee.employeeId}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting || isLoading}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 overflow-y-auto flex-1"
        >
          {errors.root && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {errors.root}
            </div>
          )}

          {/* Name row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                disabled={submitting || isLoading}
                placeholder="First name"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors
                  ${errors.firstName ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"}
                  disabled:bg-slate-100 disabled:cursor-not-allowed`}
              />
              {errors.firstName && (
                <p className="text-red-600 text-xs mt-1">{errors.firstName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                disabled={submitting || isLoading}
                placeholder="Last name"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors
                  ${errors.lastName ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"}
                  disabled:bg-slate-100 disabled:cursor-not-allowed`}
              />
              {errors.lastName && (
                <p className="text-red-600 text-xs mt-1">{errors.lastName}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ID # <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="employeeId"
                value={formData.employeeId}
                onChange={handleInputChange}
                disabled={submitting || isLoading}
                placeholder="Enter ID Number"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors
                  ${errors.employeeId ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"}
                  disabled:bg-slate-100 disabled:cursor-not-allowed`}
              />
              {errors.employeeId && (
                <p className="text-red-600 text-xs mt-1">{errors.employeeId}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                disabled={submitting || isLoading}
                placeholder="name@example.com"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors
                  ${errors.email ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"}
                  disabled:bg-slate-100 disabled:cursor-not-allowed`}
              />
              {errors.email && (
                <p className="text-red-600 text-xs mt-1">{errors.email}</p>
              )}
            </div>
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Department
            </label>
            <select
              name="department"
              value={formData.department}
              onChange={handleInputChange}
              disabled={submitting || isLoading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              <option value="">Select department (optional)</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Non-staff fields */}
          {isNonStaff && (
            <>
              {/* ID Prefix */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ID Prefix
                </label>
                <input
                  type="text"
                  name="idPrefix"
                  value={formData.idPrefix}
                  onChange={handleInputChange}
                  disabled={submitting || isLoading}
                  placeholder="e.g. IRCONS"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* Position + Consultant Prefix */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Position
                  </label>
                  <select
                    name="position"
                    value={formData.position}
                    onChange={handleInputChange}
                    disabled={submitting || isLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Select position</option>
                    <option value="Consultant">Consultant</option>
                    <option value="Contract Staff">Contract Staff</option>
                    <option value="Group Director">Group Director</option>
                    <option value="Transport Assistant">Transport Assistant</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Consultant Prefix
                  </label>
                  <input
                    type="text"
                    name="consultantPrefix"
                    value={formData.consultantPrefix}
                    onChange={handleInputChange}
                    disabled={submitting || isLoading}
                    placeholder="e.g. SAP - HR"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Employment Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    name="employmentStartDate"
                    value={formData.employmentStartDate}
                    onChange={handleInputChange}
                    disabled={submitting || isLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    name="employmentEndDate"
                    value={formData.employmentEndDate}
                    onChange={handleInputChange}
                    disabled={submitting || isLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </>
          )}

          {/* Footer buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting || isLoading}
              className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting || isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
