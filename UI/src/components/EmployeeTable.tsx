import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Copy,
  CreditCard,
  Eye,
  Loader,
  Mail,
  MoreVertical,
  Pencil,
  Printer,
  Trash,
} from "lucide-react";
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
  /** (manager only) edit employee */
  onEdit?: (employee: Employee) => void;
  /** (manager only) bookmark employee */
  onBookmark?: (employee: Employee) => void | Promise<void>;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onToggleSelectAll?: (ids: string[]) => void;
  isAllSelected?: boolean;
  /** ID of employee whose role is currently being updated */
  updatingRoleId?: string | null;
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
  updatingRoleId = null,
  routes,
  onEdit,
  onBookmark,
}: EmployeeTableProps) {
  const navigate = useNavigate();

  const cardRoute = routes?.card ?? ((id: string) => `/card/${id}`);
  const detailRoute = routes?.detail ?? ((id: string) => `/detail/${id}`);

  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());
  const selectedIds = propsSelectedIds ?? internalSelectedIds;

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const allSelected = useMemo(() => {
    if (isAllSelected) return true;
    return employees.length > 0 && employees.every(e => selectedIds.has(e.id));
  }, [employees, selectedIds, isAllSelected]);
  const openEmployee = useMemo(
    () => employees.find((employee) => employee.id === openMenuId) ?? null,
    [employees, openMenuId],
  );
  const updateMenuPosition = () => {
    if (!menuTriggerRef.current) return;
    const rect = menuTriggerRef.current.getBoundingClientRect();
    const menuWidth = 208; // w-52
    const menuHeight = menuRef.current?.offsetHeight ?? (userRole === "manager" ? 360 : 180);
    const viewportPadding = 8;
    const gap = 4;

    let top = rect.bottom + gap;
    if (top + menuHeight > window.innerHeight - viewportPadding) {
      top = Math.max(viewportPadding, rect.top - menuHeight - gap);
    }

    const left = Math.min(
      Math.max(viewportPadding, rect.right - menuWidth),
      window.innerWidth - menuWidth - viewportPadding,
    );

    setMenuPosition({ top, left });
  };


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

  const handleBookmark = async (employee: Employee) => {
    if (!onBookmark) return;
    await onBookmark(employee);
  };

  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideMenu = menuRef.current?.contains(target);
      const clickedTrigger = menuTriggerRef.current?.contains(target);
      if (!clickedInsideMenu && !clickedTrigger) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  useEffect(() => {
    if (!openMenuId) return;
    updateMenuPosition();

    const onViewportChange = () => updateMenuPosition();
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [openMenuId, userRole]);

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
                    {employee.position === 'Consultant' && employee.consultantPrefix
                      ? `${employee.consultantPrefix} ${employee.position}`
                      : employee.position || "N/A"}
                  </span>
                </td>

                {userRole === "manager" && (
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex items-center justify-center gap-2">
                      <select
                        value={employee.role}
                        disabled={updatingRoleId === employee.id}
                        onChange={(e) =>
                          handleRoleChange(
                            employee.id,
                            e.target.value as EmployeeRole
                          )
                        }
                        className="px-3 py-1 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                        aria-label={`Set role for ${employee.name}`}
                      >
                        <option value="staff">Staff</option>
                        <option value="manager">Manager</option>
                      </select>
                      {updatingRoleId === employee.id && (
                        <Loader
                          className="w-4 h-4 animate-spin text-blue-600"
                          aria-label="Updating role"
                        />
                      )}
                    </div>
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
                  <div className="relative flex justify-center">
                    <button
                      ref={openMenuId === employee.id ? menuTriggerRef : null}
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-slate-700 hover:bg-slate-50"
                      aria-label={`Open actions for ${employee.name}`}
                      aria-expanded={openMenuId === employee.id}
                      onClick={() => {
                        setOpenMenuId((prev) => {
                          const next = prev === employee.id ? null : employee.id;
                          if (next) {
                            requestAnimationFrame(() => updateMenuPosition());
                          }
                          return next;
                        });
                      }}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {openMenuId &&
        openEmployee &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
            style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
          >
            {userRole === "manager" && (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    setOpenMenuId(null);
                    await handleSendInvitation(openEmployee.id);
                  }}
                  disabled={!onSendInvitation}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  <Mail className="w-4 h-4" />
                  Send Invitation Link
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setOpenMenuId(null);
                    await handlePrintCard(openEmployee);
                  }}
                  disabled={!openEmployee.photoPresent || !onPrintCard}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  <Printer className="w-4 h-4" />
                  Print Card
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setOpenMenuId(null);
                    await handleBookmark(openEmployee);
                  }}
                  disabled={!onBookmark}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {openEmployee.isBookmarked ? (
                    <BookmarkCheck className="w-4 h-4" />
                  ) : (
                    <Bookmark className="w-4 h-4" />
                  )}
                  {openEmployee.isBookmarked ? "Remove Bookmark" : "Bookmark Employee"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOpenMenuId(null);
                    onEdit?.(openEmployee);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-violet-50"
                >
                  <Pencil className="w-4 h-4" />
                  Edit Employee
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setOpenMenuId(null);
                    await handleDelete(openEmployee.id);
                  }}
                  disabled={!onDelete}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  <Trash className="w-4 h-4" />
                  Delete Employee
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOpenMenuId(null);
                    navigate(cardRoute(openEmployee.id));
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-amber-50"
                >
                  <CreditCard className="w-4 h-4" />
                  View/Edit Card
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOpenMenuId(null);
                    navigate(detailRoute(openEmployee.id));
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </button>

                <div className="my-1 border-t border-slate-100" />
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}