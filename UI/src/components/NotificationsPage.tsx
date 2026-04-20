import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, CheckCheck, CreditCard, Eye, MoreVertical, Trash2 } from "lucide-react";
import { EmployeeNotification } from "../types";
import { notificationService } from "../services/api";

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<EmployeeNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationService.list(100, false);
      setNotifications(data.items);
    } catch (error) {
      console.error("Failed to load notifications", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    if (!openMenuId) return;
    const handleOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [openMenuId]);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markRead(id);
      await loadNotifications();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationService.delete(id);
      await loadNotifications();
    } catch (error) {
      console.error(error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      await loadNotifications();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track bookmarked employee responses and updates after email prompts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <CheckCheck className="h-4 w-4" />
            Mark All Read
          </button>
          <Link
            to="/printing"
            className="rounded-lg bg-slate-100 px-4 py-2 font-medium text-slate-700 hover:bg-slate-200"
          >
            Back to Print History
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <p className="text-sm text-slate-600">
            {loading
              ? "Loading notifications..."
              : `${notifications.length} notification(s) • ${unreadCount} unread`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Employee</th>
                <th className="px-4 py-3 text-left font-semibold">Title</th>
                <th className="px-4 py-3 text-left font-semibold">Message</th>
                <th className="px-4 py-3 text-left font-semibold">Created</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Loading notifications...
                  </td>
                </tr>
              ) : notifications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No notifications yet.
                  </td>
                </tr>
              ) : (
                notifications.map((notification) => (
                  <tr
                    key={notification.id}
                    className={`border-t border-slate-200 ${notification.isRead ? "bg-white" : "bg-blue-50/40"}`}
                  >
                    <td className="px-4 py-3">
                      {notification.isRead ? (
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          Read
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Unread
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {notification.employee?.name || notification.employee?.employeeId || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-medium">{notification.title}</td>
                    <td className="px-4 py-3 text-slate-700">{notification.message}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(notification.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="relative"
                        ref={openMenuId === notification.id ? menuRef : null}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenuId((prev) =>
                              prev === notification.id ? null : notification.id,
                            )
                          }
                          className="inline-flex items-center rounded-lg border border-slate-200 px-2 py-1.5 text-slate-700 hover:bg-slate-50"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {openMenuId === notification.id && (
                          <div className="absolute right-0 top-10 z-[120] w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                            {!notification.isRead && (
                              <button
                                type="button"
                                onClick={async () => {
                                  setOpenMenuId(null);
                                  await handleMarkRead(notification.id);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50"
                              >
                                <Bell className="h-4 w-4" />
                                Mark as Read
                              </button>
                            )}
                            {notification.employee?.id && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  navigate(`/detail/${notification.employee?.id}`);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                              >
                                <Eye className="h-4 w-4" />
                                View Details
                              </button>
                            )}
                            {notification.employee?.id && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  navigate(`/card/${notification.employee?.id}`);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-amber-50"
                              >
                                <CreditCard className="h-4 w-4" />
                                View/Edit Card
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                setOpenMenuId(null);
                                await handleDelete(notification.id);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
