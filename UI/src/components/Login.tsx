import { useState } from "react";
import { employeeService } from "../services/api";
import { CreditCard, AlertCircle } from "lucide-react";

interface LoginProps {
  setIsAuthenticated: (auth: boolean) => void;
  setUserRole: (role: "manager" | "staff") => void;
}

export default function Login({ setIsAuthenticated, setUserRole }: LoginProps) {
  const [employeeCode, setEmployeeCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeCode.trim()) {
      setError("Please enter an Employee ID");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const employee = await employeeService.getByCode(employeeCode.trim());
      const intendedLocation = sessionStorage.getItem("nrs_intended_location");
      if (
        employee &&
        (intendedLocation?.split("/card/")[1] === employee.id || employeeCode === employee.employeeId || employee.role === "manager")
      ) {
        sessionStorage.setItem("nrs_employee_id", employee.id);
        sessionStorage.setItem("nrs_user_role", employee.role);
        setUserRole(employee.role as "manager" | "staff");
        setIsAuthenticated(true);
      } else {
        setError("Unauthorized Access. Please contact your administrator.");
      }
    } catch (err) {
      setError("Failed to verify Employee ID. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <CreditCard className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              NRS Card Manager
            </h1>
            <p className="text-slate-600">
              Enter your Employee ID to access the system
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="employeeId"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Employee ID
              </label>
              <input
                type="text"
                id="employeeId"
                value={employeeCode}
                onChange={(e) => {
                  setEmployeeCode(e.target.value);
                  setError(null);
                }}
                placeholder="Enter your Employee ID"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-lg"
                disabled={loading}
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
            >
              {loading ? "Verifying..." : "Access System"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs text-center text-slate-500">
              Nigeria Revenue Service - Employee Card Management System
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-300">
            Need help? Contact your system administrator
          </p>
        </div>
      </div>
    </div>
  );
}
