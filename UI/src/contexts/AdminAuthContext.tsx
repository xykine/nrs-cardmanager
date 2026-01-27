import React, { createContext, useContext, useState } from "react";

interface AdminAuthContextType {
    isAdminAuthenticated: boolean;
    loginAdmin: (irNumber: string, password: string) => Promise<boolean>;
    logoutAdmin: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
        return sessionStorage.getItem("nrs_admin_authenticated") === "true";
    });

    const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

    const loginAdmin = async (irNumber: string, password: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ irNumber, password }),
            });

            if (response.ok) {
                setIsAdminAuthenticated(true);
                sessionStorage.setItem("nrs_admin_authenticated", "true");
                return true;
            }
            return false;
        } catch (error) {
            console.error("Admin login error:", error);
            return false;
        }
    };

    const logoutAdmin = () => {
        setIsAdminAuthenticated(false);
        sessionStorage.removeItem("nrs_admin_authenticated");
    };

    return (
        <AdminAuthContext.Provider value={{ isAdminAuthenticated, loginAdmin, logoutAdmin }}>
            {children}
        </AdminAuthContext.Provider>
    );
};

export const useAdminAuth = () => {
    const context = useContext(AdminAuthContext);
    if (!context) {
        throw new Error("useAdminAuth must be used within an AdminAuthProvider");
    }
    return context;
};
