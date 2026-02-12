import { useState, useEffect } from "react";
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
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
    const [recentReports, setRecentReports] = useState<any[]>([]);
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
            const [statsData, analyticsData, recentData] = await Promise.all([
                printingService.getDashboardStats(),
                printingService.getDailyAnalytics(7, localDate), // Last 7 days
                printingService.getPrintReports(1, 5) // Last 5 reports
            ]);
            setStats(statsData);
            setAnalytics(analyticsData);
            setRecentReports(recentData.items || []);
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
        });
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
            label: "Today's Prints",
            value: analytics.find(a => a.date === new Date().toLocaleDateString("en-CA"))?.count.toLocaleString() || "0",
            icon: Printer,
            color: "indigo",
            bg: "bg-indigo-500",
            text: "text-indigo-600",
            description: "Printed today"
        },
        {
            label: "Total Prints",
            value: stats.totalPrints.toLocaleString(),
            icon: FileText,
            color: "blue",
            bg: "bg-blue-500",
            text: "text-blue-600",
            description: "Lifetime printing volume"
        },
        {
            label: "Total Employees",
            value: stats.totalEmployees.toLocaleString(),
            icon: Users,
            color: "emerald",
            bg: "bg-emerald-500",
            text: "text-emerald-600",
            description: "Total registered workforce"
        },
        {
            label: "With Photos",
            value: stats.employeesWithPhotos.toLocaleString(),
            icon: UserCheck,
            color: "purple",
            bg: "bg-purple-500",
            text: "text-purple-600",
            description: "Ready for ID generation"
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Printing Analytics</h1>
                        <p className="text-slate-500 mt-1">Overview of ID card production performance</p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={loadDashboardData}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-all duration-200 font-medium text-sm shadow-sm hover:shadow"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                        <button
                            onClick={() => setReportModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md hover:shadow-blue-200"
                        >
                            <FileText className="w-4 h-4" />
                            Generate Report
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {statCards.map((stat, i) => (
                        <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300 relative group">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
                                    <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{stat.value}</h3>
                                </div>
                                <div className={`p-3 rounded-xl bg-opacity-10 ${stat.bg.replace('500', '100')}`}>
                                    <stat.icon className={`w-6 h-6 ${stat.text}`} />
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-50">
                                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider flex items-center gap-2">
                                    <span className={`w-1.5 h-1.5 rounded-full ${stat.bg}`} />
                                    {stat.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Graph Section */}
                    <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Production Trend</h2>
                                <p className="text-sm text-slate-500">Daily card output volume (Last 7 days)</p>
                            </div>
                            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 text-xs font-semibold uppercase tracking-wide">
                                <TrendingUp className="w-3 h-3" />
                                Live
                            </div>
                        </div>

                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={analytics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: "#64748b", fontSize: 12 }}
                                        dy={10}
                                        tickFormatter={formatDateForChart}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: "#64748b", fontSize: 12 }}
                                    />
                                    <Tooltip
                                        cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                                        contentStyle={{
                                            borderRadius: "12px",
                                            border: "none",
                                            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                                            fontSize: "14px",
                                            fontWeight: "500",
                                            padding: "12px 16px"
                                        }}
                                        labelStyle={{ color: "#64748b", marginBottom: "4px", fontSize: "12px" }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="count"
                                        name="Cards Printed"
                                        stroke="#3b82f6"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorCount)"
                                        activeDot={{ r: 6, strokeWidth: 0, fill: "#2563eb" }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                        <h2 className="text-lg font-bold text-slate-900 mb-6">Recent Print Jobs</h2>
                        <div className="flex-1 overflow-auto">
                            {recentReports.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-8">
                                    <Printer className="w-8 h-8 mb-2 opacity-50" />
                                    <p className="text-sm">No recent jobs found</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {recentReports.map((report) => (
                                        <div key={report.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                                            <div className="w-10 h-10 rounded-full bg-blue-100/50 flex items-center justify-center flex-shrink-0 text-blue-600 font-bold text-sm">
                                                {report.employee?.name?.charAt(0) || "?"}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-slate-900 truncate">
                                                    {report.employee?.name || "Unknown"}
                                                </p>
                                                <p className="text-xs text-slate-500 truncate">
                                                    {report.employee?.department || "N/A"}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wide rounded-full">
                                                    Printed
                                                </span>
                                                <p className="text-[10px] text-slate-400 mt-1">
                                                    {new Date(report.printDate).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="mt-6 pt-4 border-t border-slate-50">
                            <Link to="/reports" className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1 justify-center">
                                View Full Report <TrendingUp className="w-3 h-3" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Report Modal */}
            {reportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-900">Generate Report</h3>
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
