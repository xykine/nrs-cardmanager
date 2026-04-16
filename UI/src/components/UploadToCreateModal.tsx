import { ChangeEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { employeeService } from "../services/api";

interface UploadToCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => Promise<void> | void;
}

export const UPLOAD_CREATE_SUMMARY_STORAGE_KEY = "nrs_upload_create_summary";

export default function UploadToCreateModal({
  isOpen,
  onClose,
  onUploadComplete,
}: UploadToCreateModalProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const resetState = () => {
    setSelectedFile(null);
    setSubmitting(false);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please choose the upload template file first.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const uploadResult = await employeeService.uploadCreateFile(selectedFile);
      sessionStorage.setItem(
        UPLOAD_CREATE_SUMMARY_STORAGE_KEY,
        JSON.stringify(uploadResult)
      );

      if (onUploadComplete) {
        await onUploadComplete();
      }

      handleClose();
      navigate("/employees/upload-create-summary");
    } catch (uploadError: any) {
      setError(uploadError.message || "Failed to process upload file");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col">
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
                Upload the filled template to create or update employees
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-700">
              Use the official template, fill the employee rows, then upload the same
              `.xlsx` file here for processing.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-dashed border-slate-300 p-5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-6 h-6 text-green-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {selectedFile ? selectedFile.name : "No file selected"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Accepted format: `.xlsx`
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-medium disabled:opacity-50"
              >
                Choose File
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Download Template
          </button>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium disabled:opacity-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={submitting || !selectedFile}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Processing..." : "Upload and Process"}
          </button>
        </div>
      </div>
    </div>
  );
}
