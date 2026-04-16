import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Printer, RefreshCw } from "lucide-react";
import { PrintUploadResult, PrintUploadRowResult } from "../types";
import { UPLOAD_PRINT_SUMMARY_STORAGE_KEY } from "./UploadToPrintModal";
import { printingService } from "../services/api";

type SummaryFilter =
  | "all"
  | "ready"
  | "missing-photo"
  | "missing-information"
  | "not-found"
  | "duplicate";

const FILTER_LABELS: Record<SummaryFilter, string> = {
  all: "All Rows",
  ready: "Ready",
  "missing-photo": "Missing Photo",
  "missing-information": "Missing Information",
  "not-found": "Not Found",
  duplicate: "Duplicates",
};

export default function UploadPrintSummaryPage() {
  const navigate = useNavigate();
  const [report, setReport] = useState<PrintUploadResult | null>(null);
  const [activeFilter, setActiveFilter] = useState<SummaryFilter>("all");
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(UPLOAD_PRINT_SUMMARY_STORAGE_KEY);
    if (!stored) {
      setReport(null);
      return;
    }

    try {
      setReport(JSON.parse(stored));
    } catch (error) {
      console.error("Failed to parse print upload summary", error);
      setReport(null);
    }
  }, []);

  const filteredRows = useMemo(() => {
    if (!report) return [];
    if (activeFilter === "all") return report.rows;
    return report.rows.filter((row) => row.status === activeFilter);
  }, [activeFilter, report]);

  const handleInitiatePrinting = async () => {
    if (!report || report.jobIds.length === 0) {
      return;
    }

    setPrinting(true);
    try {
      const localDate = new Date().toLocaleDateString("en-CA");
      const blob = await printingService.downloadBatchPdf(report.jobIds, localDate);
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (error) {
      console.error(error);
      alert("Failed to generate print PDF");
    } finally {
      setPrinting(false);
    }
  };

  if (!report) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Upload Print Summary</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">No print upload summary is available yet.</p>
          <button
            type="button"
            onClick={() => navigate("/employees")}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            Back to Employees
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Upload Print Summary
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review which rows were printed successfully and which ones need attention.
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
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="font-semibold text-slate-800">Print Jobs Prepared</p>
        <p className="text-sm mt-1 text-slate-600">
          Review the upload result below. When you select `Ready`, you can initiate printing for the prepared rows.
        </p>
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
          label="Ready"
          value={report.summary.ready}
          tone="green"
          isActive={activeFilter === "ready"}
          onClick={() => setActiveFilter("ready")}
        />
        <SummaryCard
          label="Missing Photo"
          value={report.summary.missingPhoto}
          tone="amber"
          isActive={activeFilter === "missing-photo"}
          onClick={() => setActiveFilter("missing-photo")}
        />
        <SummaryCard
          label="Missing Info"
          value={report.summary.missingInformation}
          tone="red"
          isActive={activeFilter === "missing-information"}
          onClick={() => setActiveFilter("missing-information")}
        />
        <SummaryCard
          label="Not Found"
          value={report.summary.notFound}
          tone="red"
          isActive={activeFilter === "not-found"}
          onClick={() => setActiveFilter("not-found")}
        />
        <SummaryCard
          label="Duplicates"
          value={report.summary.duplicates}
          tone="slate"
          isActive={activeFilter === "duplicate"}
          onClick={() => setActiveFilter("duplicate")}
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
          <div className="flex flex-wrap items-center gap-3">
            {activeFilter === "ready" && report.jobIds.length > 0 && (
              <button
                type="button"
                onClick={handleInitiatePrinting}
                disabled={printing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
              >
                {printing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                {printing ? "Generating PDF..." : "Initiate Printing"}
              </button>
            )}
            <div className="inline-flex items-center gap-2 text-sm text-slate-500">
              <Printer className="w-4 h-4" />
              Print processing results
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Row</th>
                <th className="px-4 py-3 text-left font-semibold">IR</th>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold">Position</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
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
                filteredRows.map((row) => <SummaryRow key={`${row.rowNumber}-${row.employeeId || row.message}`} row={row} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ row }: { row: PrintUploadRowResult }) {
  return (
    <tr className="border-t border-slate-200 align-top">
      <td className="px-4 py-3 text-slate-700">{row.rowNumber}</td>
      <td className="px-4 py-3 text-slate-700">{row.employeeId || "-"}</td>
      <td className="px-4 py-3 text-slate-700">{row.name || "-"}</td>
      <td className="px-4 py-3 text-slate-700">{row.position || "-"}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(row.status)}`}>
          {row.status}
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
  tone?: "slate" | "green" | "red" | "amber";
  isActive?: boolean;
  onClick?: () => void;
}) {
  const toneClass =
    tone === "green"
      ? "bg-green-50 text-green-700 border-green-100"
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

function statusClass(status: PrintUploadRowResult["status"]) {
  switch (status) {
    case "ready":
      return "bg-green-100 text-green-700";
    case "missing-photo":
      return "bg-amber-100 text-amber-700";
    case "missing-information":
      return "bg-red-100 text-red-700";
    case "not-found":
      return "bg-red-100 text-red-700";
    case "duplicate":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-red-100 text-red-700";
  }
}
