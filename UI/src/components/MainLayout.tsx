import React from "react";
import Navbar from "./Navbar";

interface MainLayoutProps {
    children: React.ReactNode;
    userRole: "manager" | "staff";
    onLogout: () => void;
}

export default function MainLayout({ children, userRole, onLogout }: MainLayoutProps) {
    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar userRole={userRole} onLogout={onLogout} />
            <main>
                {children}
            </main>
        </div>
    );
}
