import React, { useMemo, useState } from "react";
import { Search, X, ChevronDown, ChevronUp, Filter } from "lucide-react";

export type PhotoStatusFilter = "all" | "yes" | "no";
export type EmployeeTypeFilter = "all" | "staff" | "non-staff";

export type EmployeeFilters = {
  name: string;
  employeeId: string;
  email: string;
  isBookmarked: boolean;
  department: string;
  photoStatus: PhotoStatusFilter;
  employeeType: EmployeeTypeFilter;
  position: string;
  consultantPrefix: string;
  role: string;
  startDate: string;
  endDate: string;
  requestStatus: string;
};

export type EmployeeFilterPanelProps = {
  filters: EmployeeFilters;
  setFilters: React.Dispatch<React.SetStateAction<EmployeeFilters>>;
  departments: string[];
  clearFilters: () => void;
  onSearch: () => void;
};

export default function EmployeeFilterPanel({
  filters,
  setFilters,
  departments,
  clearFilters,
  onSearch,
}: EmployeeFilterPanelProps) {
  const [isAdvancedVisible, setIsAdvancedVisible] = useState(false);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.name.trim().length > 0 ||
      filters.employeeId.trim().length > 0 ||
      filters.email.trim().length > 0 ||
      filters.isBookmarked ||
      filters.department !== "all" ||
      filters.photoStatus !== "all" ||
      filters.employeeType !== "all" ||
      filters.position !== "all" ||
      filters.consultantPrefix.trim().length > 0 ||
      filters.role !== "all" ||
      filters.startDate !== "" ||
      filters.endDate !== "" ||
      filters.requestStatus !== "all"
    );
  }, [filters]);

  const toggleAdvanced = () => setIsAdvancedVisible(!isAdvancedVisible);

  const handleInputChange = (field: keyof EmployeeFilters, value: string) => {
    setFilters((p) => ({ ...p, [field]: value }));
  };

  return (
    <div className="p-6 border-b border-slate-200 bg-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-bold text-slate-800">
            Filter Management
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.isBookmarked}
              onChange={(e) => setFilters((p) => ({ ...p, isBookmarked: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-blue-600 hover:text-blue-800">Bookmarked</span>
          </label>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              type="button"
            >
              <X className="w-4 h-4" />
              Reset All
            </button>
          )}
          <button
            onClick={toggleAdvanced}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${
              isAdvancedVisible
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {isAdvancedVisible ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            {isAdvancedVisible ? "Hide Advanced" : "Show Advanced Filter"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Basic Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Search Name
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Ex: John Doe"
                value={filters.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Employee ID
            </label>
            <input
              type="text"
              placeholder="Ex: 12345"
              value={filters.employeeId}
              onChange={(e) => handleInputChange("employeeId", e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Email
            </label>
            <input
              type="text"
              placeholder="Ex: john@company.com"
              value={filters.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Department
            </label>
            <select
              value={filters.department}
              onChange={(e) => handleInputChange("department", e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none appearance-none cursor-pointer"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={onSearch}
              className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all transform active:scale-95"
            >
              <Search className="w-5 h-5" />
              Search Employees
            </button>
          </div>
        </div>

        {/* Advanced Filters Section */}
        {isAdvancedVisible && (
          <div className="pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-6 animate-slide-down">
            {/* Employee Type Toggle */}
            <div className="col-span-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Employee Type
              </label>
              <div className="flex p-1 bg-slate-100 rounded-xl">
                {(["all", "staff", "non-staff"] as EmployeeTypeFilter[]).map(
                  (type) => (
                    <button
                      key={type}
                      onClick={() => handleInputChange("employeeType", type)}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg capitalize transition-all ${
                        filters.employeeType === type
                          ? "bg-white text-blue-600 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {type}
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* Position Select (Conditional) */}
            {filters.employeeType === "non-staff" && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Non-Staff Position
                </label>
                <select
                  value={filters.position}
                  onChange={(e) =>
                    handleInputChange("position", e.target.value)
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none cursor-pointer"
                >
                  <option value="all">All Positions</option>
                  <option value="Missing">Missing</option>
                  <option value="Consultant">Consultant</option>
                  <option value="Group Director">Group Director</option>
                  <option value="Transport Assistant">
                    Transport Assistant
                  </option>
                </select>
              </div>
            )}

            {/* Consultant Prefix (Conditional) */}
            {filters.position === "Consultant" && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Consultant Prefix
                </label>
                <input
                  type="text"
                  placeholder="Ex: CONS/"
                  value={filters.consultantPrefix}
                  onChange={(e) =>
                    handleInputChange("consultantPrefix", e.target.value)
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Request Status
              </label>
              <select
                value={filters.requestStatus}
                onChange={(e) =>
                  handleInputChange("requestStatus", e.target.value)
                }
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                System Role
              </label>
              <select
                value={filters.role}
                onChange={(e) => handleInputChange("role", e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Employment Start
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleInputChange("startDate", e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Employment End
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleInputChange("endDate", e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Photo Status
              </label>
              <select
                value={filters.photoStatus}
                onChange={(e) =>
                  handleInputChange(
                    "photoStatus",
                    e.target.value as PhotoStatusFilter,
                  )
                }
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none cursor-pointer"
              >
                <option value="all">All</option>
                <option value="yes">With Photo</option>
                <option value="no">No Photo</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
