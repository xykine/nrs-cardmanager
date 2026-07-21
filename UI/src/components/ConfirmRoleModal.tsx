import { AlertTriangle, Loader, X } from "lucide-react";

interface ConfirmRoleModalProps {
  isOpen: boolean;
  employeeName: string;
  newRole: "manager" | "staff";
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ConfirmRoleModal({
  isOpen,
  employeeName,
  newRole,
  isSubmitting = false,
  onClose,
  onConfirm,
}: ConfirmRoleModalProps) {
  if (!isOpen) return null;

  const roleLabel = newRole === "manager" ? "Manager" : "Staff";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-role-title"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <h2
              id="confirm-role-title"
              className="text-lg font-semibold text-slate-900"
            >
              Confirm Role Change
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm leading-relaxed text-slate-700">
            Are you sure you want to update{" "}
            <span className="font-semibold text-slate-900">{employeeName}</span>
            's role to{" "}
            <span className="font-semibold text-slate-900">{roleLabel}</span>?
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting && <Loader className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "Updating..." : "Update Role"}
          </button>
        </div>
      </div>
    </div>
  );
}
