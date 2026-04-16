import { Download, Upload, X } from "lucide-react";

interface UploadToCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UploadToCreateModal({
  isOpen,
  onClose,
}: UploadToCreateModalProps) {
  const handleDownloadTemplate = () => {
    const templateUrl = new URL(
      "../assets/Template Upload Create.xlsx",
      import.meta.url
    ).href;
    const link = document.createElement("a");

    link.href = templateUrl;
    link.download = "Template Upload Create.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Upload className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                Upload To Create
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Bulk-create employees from a file
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — functionality coming soon */}
        <div className="p-8 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
            <Upload className="w-8 h-8 text-green-400" />
          </div>
          <p className="text-slate-500 text-sm max-w-sm">
            Upload functionality will be configured here. Functionality
            description coming soon.
          </p>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <Download className="w-4 h-4" />
            Download Template
          </button>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
