import React, { useMemo } from "react";
import { Search, X } from "lucide-react";

export type PhotoStatusFilter = "all" | "yes" | "no";

export type EmployeeFilters = {
  name: string;
  employeeId: string;
  department: string; // use "all" for no filter
  photoStatus: PhotoStatusFilter;
};

export type EmployeeFilterPanelProps = {
  filters: EmployeeFilters;
  setFilters: React.Dispatch<React.SetStateAction<EmployeeFilters>>;
  departments: string[];
  clearFilters: () => void;
};

export default function EmployeeFilterPanel({
  filters,
  setFilters,
  departments,
  clearFilters,
}: EmployeeFilterPanelProps) {
  const hasActiveFilters = useMemo(() => {
    return (
      filters.name.trim().length > 0 ||
      filters.employeeId.trim().length > 0 ||
      filters.department !== "all" ||
      filters.photoStatus !== "all"
    );
  }, [filters]);

  return (
    <div className="p-6 border-b border-slate-200">
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-5 h-5 text-slate-400" />
        <h2 className="text-lg font-semibold text-slate-800">
          Filter Employees
        </h2>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="ml-auto flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800"
            type="button"
          >
            <X className="w-4 h-4" />
            Clear filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Name
          </label>
          <input
            type="text"
            placeholder="Search by name..."
            value={filters.name}
            onChange={(e) => setFilters((p) => ({ ...p, name: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Employee ID
          </label>
          <input
            type="text"
            placeholder="Search by ID..."
            value={filters.employeeId}
            onChange={(e) =>
              setFilters((p) => ({ ...p, employeeId: e.target.value }))
            }
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Department
          </label>
          <select
            value={filters.department}
            onChange={(e) =>
              setFilters((p) => ({ ...p, department: e.target.value }))
            }
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="all">All</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Photo Status
          </label>
          <select
            value={filters.photoStatus}
            onChange={(e) =>
              setFilters((p) => ({
                ...p,
                photoStatus: e.target.value as PhotoStatusFilter,
              }))
            }
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="all">All</option>
            <option value="yes">With Photo</option>
            <option value="no">Without Photo</option>
          </select>
        </div>
      </div>
    </div>
  );
}