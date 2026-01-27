import { useState } from "react";
import { X } from "lucide-react";

interface CreateEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    employeeId: string;
    email: string;
    department?: string;
  }) => Promise<void>;
  departments: string[];
  isLoading?: boolean;
}

export default function CreateEmployeeModal({
  isOpen,
  onClose,
  onSubmit,
  departments,
  isLoading = false,
}: CreateEmployeeModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    employeeId: "",
    email: "",
    department: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Full name is required";
    }

    if (!formData.employeeId.trim()) {
      newErrors.employeeId = "IR Number is required";
    } else if (!/^\d+$/.test(formData.employeeId)) {
      newErrors.employeeId = "IR Number must contain only numbers and no spaces";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: formData.name.trim(),
        employeeId: formData.employeeId.trim(),
        email: formData.email.trim(),
        department: formData.department.trim() || undefined,
      });

      // Reset form on successful submission
      setFormData({
        name: "",
        employeeId: "",
        email: "",
        department: "",
      });
      setErrors({});
      onClose();
    } catch (error: any) {
      const msg = error.message || "An error occurred";
      // Basic heuristic to map backend error to field
      if (msg.toLowerCase().includes("email")) {
        setErrors({ email: msg });
      } else if (msg.toLowerCase().includes("id")) {
        setErrors({ employeeId: msg });
      } else {
        // General error - show at top of form or use a special field
        setErrors({ root: msg });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">Create Employee</h2>
          <button
            onClick={onClose}
            disabled={submitting || isLoading}
            className="text-slate-500 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errors.root && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {errors.root}
            </div>
          )}
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              disabled={submitting || isLoading}
              placeholder="Enter employee's full name"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${errors.name
                ? "border-red-500 focus:ring-red-500"
                : "border-slate-300 focus:ring-blue-500"
                } disabled:bg-slate-100 disabled:cursor-not-allowed`}
            />
            {errors.name && (
              <p className="text-red-600 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* Employee ID */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              IR Number *
            </label>
            <input
              type="text"
              name="employeeId"
              value={formData.employeeId}
              onChange={handleInputChange}
              disabled={submitting || isLoading}
              placeholder="Enter IR Number"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${errors.employeeId
                ? "border-red-500 focus:ring-red-500"
                : "border-slate-300 focus:ring-blue-500"
                } disabled:bg-slate-100 disabled:cursor-not-allowed`}
            />
            {errors.employeeId && (
              <p className="text-red-600 text-sm mt-1">{errors.employeeId}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              disabled={submitting || isLoading}
              placeholder="Enter email address"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${errors.email
                ? "border-red-500 focus:ring-red-500"
                : "border-slate-300 focus:ring-blue-500"
                } disabled:bg-slate-100 disabled:cursor-not-allowed`}
            />
            {errors.email && (
              <p className="text-red-600 text-sm mt-1">{errors.email}</p>
            )}
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
              <option value="">Select a department (optional)</option>
              {departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting || isLoading}
              className="flex-1 px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
                  Creating...
                </>
              ) : (
                "Create Employee"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
