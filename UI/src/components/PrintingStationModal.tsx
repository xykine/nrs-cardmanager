import { useState, useEffect } from 'react';
import { X, Printer, CheckCircle2 } from 'lucide-react';
import { PrintingStation } from '../types';
import { printingService } from '../services/api';

interface PrintingStationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (stationId: string) => void;
  employeeCount: number;
}

export default function PrintingStationModal({ isOpen, onClose, onSubmit, employeeCount }: PrintingStationModalProps) {
  const [stations, setStations] = useState<PrintingStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadStations();
    }
  }, [isOpen]);

  const loadStations = async () => {
    try {
      setLoading(true);
      const data = await printingService.getStations();
      setStations(data);
    } catch (error) {
      console.error('Error loading stations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
      onSubmit("");
      setSelectedStation(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Printer className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Select Printing Station</h2>
              <p className="text-sm text-slate-600">
                Printing {employeeCount} card{employeeCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : stations.length === 0 ? (
            <div className="text-center py-12">
              {/* <XCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" /> */}
              <p className="text-slate-600">You are about to print the ID Card for the selected Employee.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stations.map((station) => {
                const isOnline = station.status === 'online';
                const isSelected = selectedStation === station.id;

                return (
                  <button
                    key={station.id}
                    onClick={() => isOnline && setSelectedStation(station.id)}
                    disabled={!isOnline}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50'
                        : isOnline
                        ? 'border-slate-200 hover:border-blue-300 bg-white'
                        : 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            isOnline ? 'bg-green-100' : 'bg-slate-200'
                          }`}
                        >
                          <Printer
                            className={`w-6 h-6 ${
                              isOnline ? 'text-green-600' : 'text-slate-400'
                            }`}
                          />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{station.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                isOnline ? 'bg-green-500' : 'bg-slate-400'
                              }`}
                            />
                            <span
                              className={`text-sm font-medium ${
                                isOnline ? 'text-green-600' : 'text-slate-500'
                              }`}
                            >
                              {isOnline ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-6 h-6 text-blue-600" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            // disabled={selectedStation}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              selectedStation
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Start Printing
          </button>
        </div>
      </div>
    </div>
  );
}
