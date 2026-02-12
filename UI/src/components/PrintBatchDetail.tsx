import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Clock, CheckCircle2, XCircle, RotateCw, AlertCircle } from 'lucide-react';
import { PrintBatch, JobStatus } from '../types';
import { printingService } from '../services/api';

export default function PrintBatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<PrintBatch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadBatchDetails();
      const interval = setInterval(loadBatchDetails, 3000);
      return () => clearInterval(interval);
    }
  }, [id]);

  const loadBatchDetails = async () => {
    try {
      if (!id) return;
      const data = await printingService.getBatchDetails(id);
      setBatch(data);
    } catch (error) {
      console.error('Error loading batch details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getJobStatusDisplay = (status: JobStatus, retryCount?: number, maxRetries?: number) => {
    switch (status) {
      case 'PENDING':
        return { label: 'Queued', color: 'text-slate-600 bg-slate-100', icon: Clock };
      case 'PRINTING':
        return { label: 'Printing...', color: 'text-blue-600 bg-blue-100', icon: Printer };
      case 'PRINTED':
        return { label: 'Done', color: 'text-green-600 bg-green-100', icon: CheckCircle2 };
      case 'RETRY':
        return {
          label: `Retrying (Attempt ${retryCount || 0}/${maxRetries || 3})`,
          color: 'text-yellow-600 bg-yellow-100',
          icon: RotateCw,
        };
      case 'FAILED':
        return { label: 'Failed', color: 'text-red-600 bg-red-100', icon: XCircle };
      default:
        return { label: 'Unknown', color: 'text-slate-600 bg-slate-100', icon: AlertCircle };
    }
  };

  const getBatchStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-slate-100 text-slate-800';
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
      second: '2-digit',
    }).format(date);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">Batch not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/printing')}
          className="mb-6 flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to Printing Report</span>
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
          <div className="px-6 py-5 border-b border-slate-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Printer className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">
                    Batch #{batch.id.slice(0, 8)}
                  </h1>
                  <p className="text-sm text-slate-600">
                    Station: {batch.printing_stations?.name || 'N/A'}
                  </p>
                </div>
              </div>
              <span
                className={`px-3 py-1.5 rounded-full text-sm font-medium ${getBatchStatusColor(
                  batch.status
                )}`}
              >
                {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
              </span>
            </div>

            <div className="mt-6 grid grid-cols-4 gap-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-sm text-slate-600 mb-1">Total Jobs</div>
                <div className="text-2xl font-bold text-slate-900">{batch.total_jobs}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 mb-1">Completed</div>
                <div className="text-2xl font-bold text-green-900">{batch.completed_jobs}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm text-red-600 mb-1">Failed</div>
                <div className="text-2xl font-bold text-red-900">{batch.failed_jobs}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 mb-1">In Progress</div>
                <div className="text-2xl font-bold text-blue-900">
                  {batch.total_jobs - batch.completed_jobs - batch.failed_jobs}
                </div>
              </div>
            </div>

            <div className="mt-4 bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{
                  width: `${(batch.completed_jobs / batch.total_jobs) * 100}%`,
                }}
              />
            </div>

            <div className="mt-4 text-sm text-slate-600">
              Created: {formatDate(batch.created_at)}
            </div>
          </div>

          <div className="p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Print Jobs</h2>

            {!batch.jobs || batch.jobs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-600">No jobs found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                        Employee
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                        Employee ID
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                        Started
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                        Completed
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {batch.jobs.map((job) => {
                      const statusDisplay = getJobStatusDisplay(
                        job.status,
                        job.retry_count,
                        job.max_retries
                      );
                      const StatusIcon = statusDisplay.icon;

                      return (
                        <tr key={job.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-900">
                            {job.employees?.name || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {job.employees?.employeeId || 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusDisplay.color}`}
                            >
                              <StatusIcon className="w-3.5 h-3.5" />
                              {statusDisplay.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {job.started_at ? formatDate(job.started_at) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {job.completed_at ? formatDate(job.completed_at) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
