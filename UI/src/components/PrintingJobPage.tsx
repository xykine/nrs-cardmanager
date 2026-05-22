import { useState, useEffect } from 'react';
import { Printer, Download } from 'lucide-react';
import { PrintingJobSummary } from '../types';
import { printingService, resolvePdfUrl } from '../services/api';

export default function PrintingJobPage() {
  const [jobs, setJobs] = useState<PrintingJobSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const data = await printingService.getPrintingJobsSummary();
      setJobs(data);
    } catch (error) {
      console.error('Error loading printing jobs summary:', error);
    } finally {
      setLoading(false);
    }
  }

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
                  <Printer className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Printing Jobs</h1>
                  <p className="text-sm text-slate-600">Track and download generated print batches</p>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto bg-white rounded-b-lg shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 uppercase tracking-wider">Print ID</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="text-slate-500 font-medium">Loading printing jobs...</span>
                      </div>
                    </td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Printer className="w-12 h-12 text-slate-300" />
                        <span className="text-slate-500 font-medium">No printing jobs found</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.printId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{job.printId}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                        {formatDate(job.date)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {job.pdfUrl && (
                          <a 
                            href={resolvePdfUrl(job.pdfUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium rounded-lg text-sm transition-colors border border-blue-200"
                          >
                            <Download className="w-4 h-4" />
                            PDF
                          </a>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
