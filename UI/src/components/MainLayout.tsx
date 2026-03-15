import React from "react";
import Navbar from "./Navbar";

interface MainLayoutProps {
    children: React.ReactNode;
    userRole: "manager" | "staff";
    onLogout: () => void;
}

export default function MainLayout({ children, userRole, onLogout }: MainLayoutProps) {
    const userName = sessionStorage.getItem("nrs_user_name") || undefined;

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar userRole={userRole} onLogout={onLogout} userName={userName} />
            <main>
                {children}
            </main>
        </div>
    );
}
