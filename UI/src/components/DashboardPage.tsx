import { useState, useEffect } from "react";
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from "recharts";
import {
    Printer, Users, FileText,
    Calendar, Download, RefreshCw,
    TrendingUp, UserCheck
} from "lucide-react";
import { Link } from "react-router-dom";
import { printingService } from "../services/api";

export default function DashboardPage() {
    const [stats, setStats] = useState({ totalPrints: 0, totalEmployees: 0, employeesWithPhotos: 0 });
    const [analytics, setAnalytics] = useState<{ date: string, count: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" });
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            const localDate = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
            const [statsData, analyticsData] = await Promise.all([
                printingService.getDashboardStats(),
                printingService.getDailyAnalytics(5, localDate) // Last 5 days
            ]);
            setStats(statsData);
            setAnalytics(analyticsData);
        } catch (error) {
            console.error("Error loading dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateReport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dateRange.startDate || !dateRange.endDate) return;

        try {
            setGenerating(true);
            const blob = await printingService.generateSummaryReport(
                new Date(dateRange.startDate).toISOString(),
                new Date(dateRange.endDate).toISOString()
            );
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `print_summary_${dateRange.startDate}_to_${dateRange.endDate}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            setReportModalOpen(false);
        } catch (error) {
            console.error("Error generating report:", error);
            alert("Failed to generate report");
        } finally {
            setGenerating(false);
        }
    };

    const formatDateForChart = (dateStr: any) => {
        if (typeof dateStr !== "string") return "";
        const [year, month, day] = dateStr.split("-");
        if (!year || !month || !day) return dateStr;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }).replace(/ /g, ", ");
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                    <p className="text-slate-600 font-medium">Loading Analytics...</p>
                </div>
            </div>
        );
    }

    const statCards = [
        {
            label: "Total Prints",
            value: stats.totalPrints.toLocaleString(),
            icon: Printer,
            color: "blue",
            description: "Lifetime printing volume"
        },
        {
            label: "Total Employees",
            value: stats.totalEmployees.toLocaleString(),
            icon: Users,
            color: "emerald",
            description: "Total registered workforce"
        },
        {
            label: "With Photos",
            value: stats.employeesWithPhotos.toLocaleString(),
            icon: UserCheck,
            color: "purple",
            description: "Ready for ID generation"
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Printing Analytics</h1>
                        <p className="text-slate-600">Overview of ID card production performance</p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={loadDashboardData}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm shadow-sm"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                        <button
                            onClick={() => setReportModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
                        >
                            <FileText className="w-4 h-4" />
                            Generate Summary Report
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {statCards.map((stat, i) => (
                        <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-${stat.color}-50 rounded-full opacity-50`} />
                            <div className="relative flex items-center gap-4">
                                <div className={`p-3 bg-${stat.color}-100 rounded-xl`}>
                                    <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                                    <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                                </div>
                            </div>
                            <p className="mt-4 text-xs text-slate-400 font-medium uppercase tracking-wider">{stat.description}</p>
                        </div>
                    ))}
                </div>

                {/* Graph Section */}
                <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Printing Trend</h2>
                            <p className="text-sm text-slate-500">Daily card output volume (Last 5 days)</p>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 shadow-sm">
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-sm font-bold">Live Tracking</span>
                        </div>
                    </div>

                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: "#64748b", fontSize: 12 }}
                                    dy={10}
                                    tickFormatter={(val) => {
                                        const [year, month, day] = val.split("-");
                                        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                        return date.toLocaleDateString("en-GB", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric"
                                        }).replace(/ /g, ", ");
                                    }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: "#64748b", fontSize: 12 }}
                                    dx={-10}
                                />
                                <Tooltip
                                    labelFormatter={formatDateForChart}
                                    contentStyle={{
                                        borderRadius: "12px",
                                        border: "none",
                                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                                        fontSize: "14px",
                                        fontWeight: "500"
                                    }}
                                    labelStyle={{ color: "#1e293b", marginBottom: "4px" }}
                                />
                                <Bar
                                    dataKey="count"
                                    name="Cards Printed"
                                    fill="#2563eb"
                                    radius={[4, 4, 0, 0]}
                                    barSize={32}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Report Modal */}
            {reportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-900">Generate Summary Report</h3>
                            <button
                                onClick={() => setReportModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <RefreshCw className="w-5 h-5 rotate-45" />
                            </button>
                        </div>

                        <form onSubmit={handleGenerateReport} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-slate-400" />
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={dateRange.startDate}
                                        onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-slate-400" />
                                        End Date
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={dateRange.endDate}
                                        onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <p className="text-sm text-blue-700 leading-relaxed">
                                    This report will generate a PDF summary including daily printing volume and totals for the selected period.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setReportModalOpen(false)}
                                    className="flex-1 px-4 py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={generating}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                                >
                                    {generating ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Download className="w-4 h-4" />
                                    )}
                                    {generating ? "Generating..." : "Download PDF"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
