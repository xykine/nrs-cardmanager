import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Copy, CreditCard, Eye, Mail, Printer, Trash } from "lucide-react";
import { Employee } from "../types";

type UserRole = "manager" | "staff";
type EmployeeRole = "manager" | "staff";

export type EmployeeTableProps = {
  employees: Employee[];
  userRole: UserRole;
  /** (manager only) send upload/invitation link */
  onSendInvitation?: (employeeId: string) => void | Promise<void>;
  /** (manager only) print card */
  onPrintCard?: (employee: Employee) => void | Promise<void>;
  /** (manager only) update role */
  onRoleChange?: (id: string, role: EmployeeRole) => void | Promise<void>;
  /** (manager only) delete employee */
  onDelete?: (id: string) => void | Promise<void>;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onToggleSelectAll?: (ids: string[]) => void;
  isAllSelected?: boolean;
  /** Optional: route base paths */
  routes?: {
    card?: (id: string) => string;
    detail?: (id: string) => string;
  };
};

export default function EmployeeTable({
  employees,
  userRole,
  onSendInvitation,
  onPrintCard,
  onRoleChange,
  onDelete,
  onToggleSelection,
  onToggleSelectAll,
  selectedIds: propsSelectedIds,
  isAllSelected,
  routes,
}: EmployeeTableProps) {
  const navigate = useNavigate();

  const cardRoute = routes?.card ?? ((id: string) => `/card/${id}`);
  const detailRoute = routes?.detail ?? ((id: string) => `/detail/${id}`);

  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());
  const selectedIds = propsSelectedIds ?? internalSelectedIds;

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const allSelected = useMemo(() => {
    if (isAllSelected) return true;
    return employees.length > 0 && employees.every(e => selectedIds.has(e.id));
  }, [employees, selectedIds, isAllSelected]);

  const handleSelectAll = () => {
    const allIds = employees.map((e) => e.id);
    if (onToggleSelectAll) {
      onToggleSelectAll(allIds);
    } else {
      setInternalSelectedIds((prev) => {
        if (prev.size === allIds.length) return new Set();
        return new Set(allIds);
      });
    }
  };

  const handleSelectRow = (id: string) => {
    if (onToggleSelection) {
      onToggleSelection(id);
    } else {
      setInternalSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  };

  const copyToClipboard = async (text: string, rowId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(rowId);
      window.setTimeout(() => setCopiedId(null), 1200);
    } catch {
      // Fallback: old browsers
      try {
        const el = document.createElement("textarea");
        el.value = text;
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopiedId(rowId);
        window.setTimeout(() => setCopiedId(null), 1200);
      } catch {
        // ignore
      }
    }
  };

  const handleRoleChange = async (id: string, role: EmployeeRole) => {
    if (!onRoleChange) return;
    await onRoleChange(id, role);
  };

  const handleSendInvitation = async (employeeId: string) => {
    if (!onSendInvitation) return;
    await onSendInvitation(employeeId);
  };

  const handlePrintCard = async (employee: Employee) => {
    if (!onPrintCard) return;
    await onPrintCard(employee);
  };

  const handleDelete = async (id: string) => {
    if (!onDelete) return;
    await onDelete(id);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-800 text-white">
          <tr>
            {userRole === "manager" && (
              <th className="px-6 py-4 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  aria-label="Select all employees"
                />
              </th>
            )}
            <th className="px-6 py-4 text-left text-sm font-semibold">Name</th>
            <th className="px-6 py-4 text-left text-sm font-semibold">
              ID
            </th>
            <th className="px-6 py-4 text-left text-sm font-semibold">
              Department
            </th>
            <th className="px-6 py-4 text-left text-sm font-semibold">
              Position
            </th>
            {userRole === "manager" && (
              <th className="px-6 py-4 text-center text-sm font-semibold">
                Role
              </th>
            )}
            <th className="px-6 py-4 text-center text-sm font-semibold">
              Photo
            </th>
            <th className="px-6 py-4 text-center text-sm font-semibold">
              Actions
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-200">
          {employees.length === 0 ? (
            <tr>
              <td
                className="px-6 py-10 text-center text-slate-500"
                colSpan={userRole === "manager" ? 7 : 6}
              >
                No employees found.
              </td>
            </tr>
          ) : (
            employees.map((employee) => (
              <tr
                key={employee.id}
                className={`hover:bg-slate-50 transition-colors ${isAllSelected || selectedIds.has(employee.id) ? "bg-blue-50" : ""
                  }`}
              >
                {userRole === "manager" && (
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={isAllSelected || selectedIds.has(employee.id)}
                      onChange={() => handleSelectRow(employee.id)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      aria-label={`Select ${employee.name}`}
                    />
                  </td>
                )}

                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">
                    <div>{employee.name}</div>
                    <div className="text-slate-700 text-sm">
                      {employee.email}
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-700 font-mono text-sm">
                      {employee.employeeId}
                    </span>

                    <button
                      onClick={() =>
                        copyToClipboard(employee.employeeId, employee.id)
                      }
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                      title="Copy Employee ID"
                      type="button"
                    >
                      {copiedId === employee.id ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </td>

                <td className="px-6 py-4">
                  <span className="text-slate-700">
                    {employee.department || "N/A"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-slate-700">
                    {employee.position || "N/A"}
                  </span>
                </td>

                {userRole === "manager" && (
                  <td className="px-6 py-4 text-center">
                    <select
                      value={employee.role}
                      onChange={(e) =>
                        handleRoleChange(
                          employee.id,
                          e.target.value as EmployeeRole
                        )
                      }
                      className="px-3 py-1 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      aria-label={`Set role for ${employee.name}`}
                    >
                      <option value="staff">Staff</option>
                      <option value="manager">Manager</option>
                    </select>
                  </td>
                )}

                <td className="px-6 py-4 text-center">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${employee.photoPresent
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800"
                      }`}
                  >
                    {employee.photoPresent ? "Yes" : "No"}
                  </span>
                </td>

                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    {userRole === "manager" && (
                      <>
                        <button
                          onClick={() => handleSendInvitation(employee.id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Send Invitation Link"
                          type="button"
                          disabled={!onSendInvitation}
                        >
                          <Mail className="w-5 h-5" />
                        </button>

                        <button
                          onClick={() => handlePrintCard(employee)}
                          disabled={!employee.photoPresent || !onPrintCard}
                          className={`p-2 rounded-lg transition-colors ${employee.photoPresent && onPrintCard
                            ? "text-green-600 hover:bg-green-50"
                            : "text-slate-300 cursor-not-allowed"
                            }`}
                          title={
                            employee.photoPresent
                              ? "Print Card"
                              : "Photo required to print"
                          }
                          type="button"
                        >
                          <Printer className="w-5 h-5" />
                        </button>

                        <button
                          onClick={() => handleDelete(employee.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Employee"
                          type="button"
                          disabled={!onDelete}
                        >
                          <Trash className="w-5 h-5" />
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => navigate(cardRoute(employee.id))}
                      className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      title="View/Edit Card"
                      type="button"
                    >
                      <CreditCard className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => navigate(detailRoute(employee.id))}
                      className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                      title="View Details"
                      type="button"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}