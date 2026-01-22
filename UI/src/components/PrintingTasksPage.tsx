import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Clock, CheckCircle2, XCircle, AlertCircle, Eye } from 'lucide-react';
import { PrintBatch } from '../types';
import { printingService } from '../services/api';

export default function PrintingTasksPage() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<PrintBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBatches();
    const interval = setInterval(loadBatches, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadBatches = async () => {
    try {
      const data = await printingService.getBatches();
      setBatches(data);
    } catch (error) {
      console.error('Error loading batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'in_progress':
        return <Clock className="w-4 h-4" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      case 'partial':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'failed':
        return 'Failed';
      case 'partial':
        return 'Partial';
      default:
        return 'Pending';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-6 py-5 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Printer className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Printing Tasks</h1>
                <p className="text-sm text-slate-600">Manage and monitor all print batches</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : batches.length === 0 ? (
              <div className="text-center py-12">
                <Printer className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600">No print batches found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {batches.map((batch) => (
                  <div
                    key={batch.id}
                    className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-slate-900">
                            Batch #{batch.id.slice(0, 8)}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              batch.status
                            )}`}
                          >
                            {getStatusIcon(batch.status)}
                            {getStatusLabel(batch.status)}
                          </span>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-slate-600">
                          <div>
                            <span className="font-medium">Station:</span>{' '}
                            {batch.printing_stations?.name || 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">Total Jobs:</span> {batch.total_jobs}
                          </div>
                          <div>
                            <span className="font-medium">Completed:</span> {batch.completed_jobs}
                          </div>
                          {batch.failed_jobs > 0 && (
                            <div className="text-red-600">
                              <span className="font-medium">Failed:</span> {batch.failed_jobs}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Created:</span>{' '}
                            {formatDate(batch.created_at)}
                          </div>
                        </div>

                        <div className="mt-3 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              batch.status === 'failed'
                                ? 'bg-red-500'
                                : batch.status === 'completed'
                                ? 'bg-green-500'
                                : 'bg-blue-500'
                            }`}
                            style={{
                              width: `${(batch.completed_jobs / batch.total_jobs) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => navigate(`/printing/${batch.id}`)}
                        className="ml-4 p-2 hover:bg-blue-50 rounded-lg transition-colors group"
                      >
                        <Eye className="w-5 h-5 text-slate-500 group-hover:text-blue-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
