import { Printer, X } from 'lucide-react';


interface PrintingStationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (stationId: string) => void;
  employeeCount: number;
}

export default function PrintingStationModal({ isOpen, onClose, onSubmit, employeeCount }: PrintingStationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Printer className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Print Cards</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-slate-600 mb-4">
            You are about to generate a PDF for {employeeCount} ID card{employeeCount !== 1 ? 's' : ''}.
          </p>
          <p className="text-sm text-slate-500">
            A PDF will be downloaded or opened in a new tab. You can then use your system dialog to print to your local printer.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit("PDF_GENERATION")}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Generate PDF
          </button>
        </div>
      </div>
    </div>
  );
}
