import { Link, useLocation } from "react-router-dom";
import {
    LayoutDashboard,
    Users,
    Printer,
    LogOut,
    CreditCard
} from "lucide-react";

interface NavbarProps {
    onLogout: () => void;
    userRole: "manager" | "staff";
}

export default function Navbar({ onLogout, userRole }: NavbarProps) {
    const location = useLocation();

    if (userRole !== "manager") return null;

    const navItems = [
        { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
        { label: "Employees", path: "/employees", icon: Users },
        { label: "Print Reports", path: "/printing", icon: Printer },
    ];

    const isActive = (path: string) => {
        if (path === "/employees" && location.pathname === "/") return true;
        return location.pathname === path || location.pathname.startsWith(`${path}/`);
    };

    return (
        <nav className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex">
                        <div className="flex-shrink-0 flex items-center gap-2 mr-8">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                                <CreditCard className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-bold text-slate-900 text-lg hidden md:block">
                                NRS Manager
                            </span>
                        </div>

                        <div className="hidden sm:flex sm:space-x-4">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.path);
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`inline-flex items-center px-3 py-2 mt-2 border-b-2 text-sm font-medium transition-colors ${active
                                                ? "border-blue-600 text-blue-600"
                                                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                                            }`}
                                    >
                                        <Icon className="w-4 h-4 mr-2" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end mr-2 hidden md:flex">
                            <span className="text-sm font-bold text-slate-900 capitalize">{userRole}</span>
                            <span className="text-xs text-slate-500">Administrator</span>
                        </div>
                        <button
                            onClick={onLogout}
                            className="inline-flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all group"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Nav */}
            <div className="sm:hidden border-t border-slate-100 bg-white">
                <div className="flex justify-around py-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex flex-col items-center p-2 text-xs font-medium transition-colors ${active ? "text-blue-600" : "text-slate-500"
                                    }`}
                            >
                                <Icon className="w-5 h-5 mb-1" />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
