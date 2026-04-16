import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Mail, RefreshCw } from "lucide-react";
import EmailDialog from "./EmailDialog";
import {
  EmployeeUploadResult,
  EmployeeUploadRowResult,
} from "../types";
import { employeeService } from "../services/api";
import { useNotification } from "../contexts/NotificationContext";
import { UPLOAD_CREATE_SUMMARY_STORAGE_KEY } from "./UploadToCreateModal";

type SummaryFilter = "all" | "created" | "updated" | "skipped" | "error" | "missingPhoto";

const FILTER_LABELS: Record<SummaryFilter, string> = {
  all: "All Rows",
  created: "Created",
  updated: "Updated",
  skipped: "Skipped",
  error: "Errors",
  missingPhoto: "Missing Photo",
};

export default function UploadCreateSummaryPage() {
  const navigate = useNavigate();
  const { addNotification, updateNotification } = useNotification();
  const [report, setReport] = useState<EmployeeUploadResult | null>(null);
  const [activeFilter, setActiveFilter] = useState<SummaryFilter>("all");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(UPLOAD_CREATE_SUMMARY_STORAGE_KEY);
    if (!stored) {
      setReport(null);
      return;
    }

    try {
      setReport(JSON.parse(stored));
    } catch (error) {
      console.error("Failed to parse upload summary", error);
      setReport(null);
    }
  }, []);

  const filteredRows = useMemo(() => {
    if (!report) return [];
    if (activeFilter === "all") return report.rows;
    if (activeFilter === "missingPhoto") {
      return report.rows.filter((row) => !row.photoPresent);
    }
    return report.rows.filter((row) => row.action === activeFilter);
  }, [activeFilter, report]);

  const createdEmployeeIds = useMemo(
    () =>
      report?.rows
        .filter((row) => row.action === "created" && row.employeeDbId)
        .map((row) => row.employeeDbId as string) ?? [],
    [report]
  );

  const filteredCreatedEmployeeIds = useMemo(
    () =>
      filteredRows
        .filter((row) => row.action === "created" && row.employeeDbId)
        .map((row) => row.employeeDbId as string),
    [filteredRows]
  );

  const handleDownload = async () => {
    if (!report) return;

    setDownloading(true);
    try {
      const blob = await employeeService.downloadUploadCreateReport(report);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "upload-create-report.xls";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Failed to download upload report");
    } finally {
      setDownloading(false);
    }
  };

  const handleSendBulkEmail = async (message: string) => {
    const idsToSend =
      activeFilter === "created" ? filteredCreatedEmployeeIds : createdEmployeeIds;

    if (idsToSend.length === 0) {
      return;
    }

    const notificationId = addNotification({
      type: "progress",
      title: "Sending Emails",
      message: `Sending emails to ${idsToSend.length} employee(s)...`,
      progress: 0,
      autoClose: false,
    });

    setEmailDialogOpen(false);

    try {
      const result = await employeeService.sendBulkEmail(idsToSend, message, {} as any, false);
      updateNotification(notificationId, {
        type: "success",
        title: "Emails Sent",
        message: `Successfully sent ${result.success} email(s).${result.failed > 0 ? ` ${result.failed} failed.` : ""}`,
        autoClose: true,
      });
    } catch (error) {
      console.error(error);
      updateNotification(notificationId, {
        type: "error",
        title: "Email Failed",
        message: "Failed to send emails. Please try again.",
        autoClose: true,
      });
    }
  };

  if (!report) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Upload Processing Summary</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">No upload summary is available yet.</p>
          <button
            type="button"
            onClick={() => navigate("/employees")}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Back to Employees
          </button>
        </div>
      </div>
    );
  }

  const canSendBulkEmail =
    (activeFilter === "created" ? filteredCreatedEmployeeIds : createdEmployeeIds).length > 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Upload Processing Summary
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review the processed rows, filter by outcome, and export the report.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate("/employees")}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
          >
            Back to Employees
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
          >
            {downloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <SummaryCard
          label="Rows"
          value={report.summary.totalRows}
          tone="slate"
          isActive={activeFilter === "all"}
          onClick={() => setActiveFilter("all")}
        />
        <SummaryCard
          label="Created"
          value={report.summary.created}
          tone="green"
          isActive={activeFilter === "created"}
          onClick={() => setActiveFilter("created")}
        />
        <SummaryCard
          label="Updated"
          value={report.summary.updated}
          tone="blue"
          isActive={activeFilter === "updated"}
          onClick={() => setActiveFilter("updated")}
        />
        <SummaryCard
          label="Skipped"
          value={report.summary.skipped}
          tone="slate"
          isActive={activeFilter === "skipped"}
          onClick={() => setActiveFilter("skipped")}
        />
        <SummaryCard
          label="Errors"
          value={report.summary.errors}
          tone="red"
          isActive={activeFilter === "error"}
          onClick={() => setActiveFilter("error")}
        />
        <SummaryCard
          label="Missing Photo"
          value={report.summary.missingPhoto}
          tone="amber"
          isActive={activeFilter === "missingPhoto"}
          onClick={() => setActiveFilter("missingPhoto")}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {FILTER_LABELS[activeFilter]}
            </h2>
            <p className="text-sm text-slate-500">
              Showing {filteredRows.length} row(s).
            </p>
          </div>

          {activeFilter === "created" && canSendBulkEmail && (
            <button
              type="button"
              onClick={() => setEmailDialogOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Mail className="w-4 h-4" />
              Send Bulk Email
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Row</th>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">ID</th>
                <th className="px-4 py-3 text-left font-semibold">Action</th>
                <th className="px-4 py-3 text-left font-semibold">Message</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No rows match this filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <SummaryRow key={`${row.rowNumber}-${row.email || row.employeeId || row.message}`} row={row} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EmailDialog
        isOpen={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        onSend={handleSendBulkEmail}
        isBulk
        recipientCount={
          activeFilter === "created"
            ? filteredCreatedEmployeeIds.length
            : createdEmployeeIds.length
        }
      />
    </div>
  );
}

function SummaryRow({ row }: { row: EmployeeUploadRowResult }) {
  return (
    <tr className="border-t border-slate-200 align-top">
      <td className="px-4 py-3 text-slate-700">{row.rowNumber}</td>
      <td className="px-4 py-3 text-slate-700">
        {[row.firstName, row.lastName].filter(Boolean).join(" ") || "-"}
      </td>
      <td className="px-4 py-3 text-slate-700">{row.email || "-"}</td>
      <td className="px-4 py-3 text-slate-700">{row.employeeId || "-"}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
            row.action === "created"
              ? "bg-green-100 text-green-700"
              : row.action === "updated"
                ? "bg-blue-100 text-blue-700"
                : row.action === "error"
                  ? "bg-red-100 text-red-700"
                  : "bg-slate-100 text-slate-700"
          }`}
        >
          {row.action}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-700">{row.message}</td>
    </tr>
  );
}

function SummaryCard({
  label,
  value,
  tone = "slate",
  isActive,
  onClick,
}: {
  label: string;
  value: number;
  tone?: "slate" | "green" | "blue" | "red" | "amber";
  isActive?: boolean;
  onClick?: () => void;
}) {
  const toneClass =
    tone === "green"
      ? "bg-green-50 text-green-700 border-green-100"
      : tone === "blue"
        ? "bg-blue-50 text-blue-700 border-blue-100"
        : tone === "red"
          ? "bg-red-50 text-red-700 border-red-100"
          : tone === "amber"
            ? "bg-amber-50 text-amber-700 border-amber-100"
            : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-all hover:shadow-sm ${toneClass} ${isActive ? "ring-2 ring-slate-300" : ""}`}
    >
      <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </button>
  );
}
