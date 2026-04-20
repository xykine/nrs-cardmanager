import { useMemo, useState } from "react";
import { CheckCircle2, Printer, XCircle } from "lucide-react";

export type PrintReviewRow = {
  employeeDbId?: string;
  employeeId?: string;
  name: string;
  hasPhoto: boolean;
  wasPreviouslyPrinted: boolean;
  canPrint?: boolean;
  baseSkipReason?: string;
  skipReasonIfExcluded?: string;
};

interface PrintBatchReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (includePreviouslyPrinted: boolean) => void;
  rows: PrintReviewRow[];
  title?: string;
  confirmLabel?: string;
}

export default function PrintBatchReviewModal({
  isOpen,
  onClose,
  onConfirm,
  rows,
  title = "Review Bulk Print",
  confirmLabel = "Continue to Print",
}: PrintBatchReviewModalProps) {
  const [includePreviouslyPrinted, setIncludePreviouslyPrinted] = useState(false);

  const breakdown = useMemo(() => {
    const isBaseEligible = (row: PrintReviewRow) =>
      (row.canPrint ?? row.hasPhoto) && Boolean(row.employeeDbId);
    const printable = rows.filter(
      (row) =>
        isBaseEligible(row) &&
        (includePreviouslyPrinted || !row.wasPreviouslyPrinted),
    );
    const skipped = rows.filter(
      (row) =>
        !isBaseEligible(row) ||
        (!includePreviouslyPrinted && row.wasPreviouslyPrinted),
    );
    return { printable, skipped };
  }, [includePreviouslyPrinted, rows]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Printer className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includePreviouslyPrinted}
              onChange={(event) =>
                setIncludePreviouslyPrinted(event.target.checked)
              }
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Include employees that were previously printed
          </label>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <SummaryPill
              label="Total Selected"
              value={rows.length}
              tone="slate"
            />
            <SummaryPill
              label="Will Be Printed"
              value={breakdown.printable.length}
              tone="green"
            />
            <SummaryPill
              label="Will Be Skipped"
              value={breakdown.skipped.length}
              tone="amber"
            />
          </div>

          <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Name</th>
                  <th className="px-3 py-2 text-left font-semibold">IR</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const baseEligible =
                    (row.canPrint ?? row.hasPhoto) && Boolean(row.employeeDbId);
                  const willPrint =
                    baseEligible &&
                    (includePreviouslyPrinted || !row.wasPreviouslyPrinted);
                  const reason = !row.employeeDbId
                    ? row.baseSkipReason || "Employee record not found"
                    : !(row.canPrint ?? row.hasPhoto)
                      ? row.baseSkipReason ||
                        (!row.hasPhoto
                          ? "No photo uploaded"
                          : "Not eligible for printing")
                      : !includePreviouslyPrinted && row.wasPreviouslyPrinted
                        ? row.skipReasonIfExcluded ||
                          "Previously printed (present in print history)"
                        : "Eligible for printing";

                  return (
                    <tr
                      key={`${row.employeeDbId || "unresolved"}-${row.employeeId || row.name}`}
                      className="border-t border-slate-200"
                    >
                      <td className="px-3 py-2 text-slate-700">{row.name}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {row.employeeId || "-"}
                      </td>
                      <td className="px-3 py-2">
                        {willPrint ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Print
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Skip
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(includePreviouslyPrinted)}
            disabled={breakdown.printable.length === 0}
            className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "green" | "amber";
}) {
  const toneClass =
    tone === "green"
      ? "bg-green-50 border-green-100 text-green-700"
      : tone === "amber"
        ? "bg-amber-50 border-amber-100 text-amber-700"
        : "bg-slate-50 border-slate-200 text-slate-700";
  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
