import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { Employee } from "../types";
import { EmployeeFilters } from "../components/FilterEmployee";

interface EmployeeContextType {
    employees: Employee[];
    totalRecords: number;
    currentPage: number;
    pageSize: number;
    filters: EmployeeFilters;
    hasMore: boolean;
    setEmployees: (employees: Employee[] | ((prev: Employee[]) => Employee[])) => void;
    setTotalRecords: (total: number) => void;
    setCurrentPage: (page: number | ((prev: number) => number)) => void;
    setPageSize: (size: number | ((prev: number) => number)) => void;
    setFilters: (filters: EmployeeFilters | ((prev: EmployeeFilters) => EmployeeFilters)) => void;
    setHasMore: (hasMore: boolean) => void;
    clearCache: () => void;
}

const defaultFilters: EmployeeFilters = {
    name: "",
    employeeId: "",
    email: "",
    isBookmarked: false,
    photoStatus: "all",
    department: "all",
    employeeType: "all",
    position: "all",
    consultantPrefix: "",
    role: "all",
    startDate: "",
    endDate: "",
    requestStatus: "all",
};

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

export function EmployeeProvider({ children }: { children: ReactNode }) {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [currentPage, setCurrentPage] = useState(() => {
        const saved = localStorage.getItem("employee_list_page");
        return saved ? parseInt(saved) : 1;
    });
    const [pageSize, setPageSize] = useState(200);
    const [filters, setFilters] = useState<EmployeeFilters>(defaultFilters);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        localStorage.setItem("employee_list_page", currentPage.toString());
    }, [currentPage]);

    const clearCache = useCallback(() => {
        setEmployees([]);
        setTotalRecords(0);
        setCurrentPage(1);
        setHasMore(true);
    }, []);

    return (
        <EmployeeContext.Provider
            value={{
                employees,
                totalRecords,
                currentPage,
                pageSize,
                setPageSize,
                filters,
                hasMore,
                setEmployees,
                setTotalRecords,
                setCurrentPage,
                setFilters,
                setHasMore,
                clearCache,
            }}
        >
            {children}
        </EmployeeContext.Provider>
    );
}

export function useEmployees() {
    const context = useContext(EmployeeContext);
    if (context === undefined) {
        throw new Error("useEmployees must be used within an EmployeeProvider");
    }
    return context;
}
