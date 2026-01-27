import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../contexts/AdminAuthContext";
import { Lock, ShieldAlert } from "lucide-react";

interface AdminProtectedRouteProps {
    children: React.ReactNode;
}

export const AdminProtectedRoute: React.FC<AdminProtectedRouteProps> = ({ children }) => {
    const { isAdminAuthenticated, loginAdmin, logoutAdmin } = useAdminAuth();
    const [password, setPassword] = useState("");
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(false);

        if (await loginAdmin(password)) {
            setError(false);
        } else {
            setError(true);
            setPassword("");
        }
        setLoading(false);
    };

    const handleBack = () => {
        // Clear all authentication storage
        sessionStorage.removeItem("nrs_employee_id");
        sessionStorage.removeItem("nrs_user_role");
        sessionStorage.removeItem("nrs_intended_location");

        // Clear admin auth context
        logoutAdmin();

        // Use full page redirect to clear all React/Context state
        window.location.href = "/login";
    };

    if (!isAdminAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
                    <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                            <Lock className="w-8 h-8 text-blue-600" />
                        </div>

                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Admin Access Required</h2>
                        <p className="text-slate-600 mb-8">
                            Please enter your credentials to access this page.
                        </p>

                        <form onSubmit={handleSubmit} className="w-full space-y-4">
                            <div className="space-y-2">

                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter Admin Password"
                                    className={`w-full px-4 py-3 bg-slate-50 border ${error ? "border-red-500" : "border-slate-200"
                                        } rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                                    disabled={loading}
                                />
                                {error && (
                                    <div className="mt-2 flex items-center justify-center gap-1 text-sm text-red-600 font-medium">
                                        <ShieldAlert className="w-4 h-4" />
                                        <span>Invalid credentials</span>
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:bg-blue-400"
                            >
                                {loading ? "Authenticating..." : "Access Page"}
                            </button>
                        </form>

                        <button
                            onClick={handleBack}
                            className="mt-6 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
                        >
                            Go Back to Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
