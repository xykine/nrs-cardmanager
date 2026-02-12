import { useState, useEffect } from 'react';
import { Printer, FileText, Download, Calendar, Search, RefreshCw } from 'lucide-react';
import { PrintReport } from '../types';
import { printingService } from '../services/api';
import Pagination from './Pagination';

export default function PrintingReportPage() {
  const [reports, setReports] = useState<PrintReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem('printing_report_page');
    return saved ? parseInt(saved) : 1;
  });
  const [pageSize, setPageSize] = useState(200);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    localStorage.setItem('printing_report_page', currentPage.toString());
    loadReports();
  }, [currentPage, pageSize]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await printingService.getPrintReports(
        currentPage,
        pageSize,
        startDate ? new Date(startDate).toISOString() : undefined,
        endDate ? new Date(endDate).toISOString() : undefined
      );
      setReports(data.items);
      setTotal(data.total);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadReports();
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
    // loadReports will be triggered by the effect if page changes, but we should call it manually if page is already 1
    if (currentPage === 1) {
      loadReports();
    }
  };

  const handleDownload = async () => {
    try {
      setExporting(true);
      const blob = await printingService.exportPrintReports(
        startDate ? new Date(startDate).toISOString() : undefined,
        endDate ? new Date(endDate).toISOString() : undefined
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `printing_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting reports:', error);
      alert('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="px-6 py-5 border-b border-slate-200 bg-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Print Report</h1>
                  <p className="text-sm text-slate-600">Track all card printing activities</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="Start Date"
                    />
                  </div>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="End Date"
                    />
                  </div>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                  >
                    <Search className="w-4 h-4" />
                    Filter
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reset
                  </button>
                </form>

                <div className="h-8 w-px bg-slate-200 mx-1 hidden md:block"></div>

                <button
                  onClick={handleDownload}
                  disabled={exporting || reports.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium shadow-sm"
                >
                  {exporting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Export Excel
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 uppercase tracking-wider">IR number</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 uppercase tracking-wider">Card Count</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 uppercase tracking-wider">Print Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="text-slate-500 font-medium">Loading reports...</span>
                      </div>
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Printer className="w-12 h-12 text-slate-300" />
                        <span className="text-slate-500 font-medium">No printing reports found for selected range</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{report.employee?.name || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{report.employee?.employeeId || report.employeeId}</td>
                      <td className="px-6 py-4 text-slate-600">{report.employee?.email || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                          {report.cardCount} cards
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                        {formatDate(report.printDate)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            itemName="report"
          />
        </div>
      </div>
    </div>
  );
}
