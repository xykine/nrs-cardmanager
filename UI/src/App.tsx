import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import EmployeeList from "./components/EmployeeList";
import CardPage from "./components/Card/CardPage";
import EmployeeDetail from "./components/EmployeeDetail";
import Login from "./components/Login";
import PrintingTasksPage from "./components/PrintingTasksPage";
import PrintBatchDetail from "./components/PrintBatchDetail";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminProtectedRoute } from "./components/AdminProtectedRoute";
import { useAdminAuth } from "./contexts/AdminAuthContext";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<"manager" | "staff">("staff");

  useEffect(() => {
    const savedEmployeeId = sessionStorage.getItem("nrs_employee_id");
    const savedRole = sessionStorage.getItem("nrs_user_role");
    if (savedEmployeeId && savedRole) {
      setIsAuthenticated(true);
      setUserRole(savedRole as "manager" | "staff");
    }
  }, []);

  const { logoutAdmin } = useAdminAuth();

  const handleLogout = () => {
    sessionStorage.removeItem("nrs_employee_id");
    sessionStorage.removeItem("nrs_user_role");
    sessionStorage.removeItem("nrs_intended_location");
    logoutAdmin(); // Clear admin context and session storage
    setIsAuthenticated(false);
    setUserRole("staff");
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <Login
                setIsAuthenticated={setIsAuthenticated}
                setUserRole={setUserRole}
              />
            )
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <AdminProtectedRoute>
                <EmployeeList onLogout={handleLogout} userRole={userRole} />
              </AdminProtectedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/card/:employeeId"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <CardPage onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/card-upload/invitation"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <CardPage onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/detail/:employeeId"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <AdminProtectedRoute>
                <EmployeeDetail />
              </AdminProtectedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/printing"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <AdminProtectedRoute>
                <PrintingTasksPage />
              </AdminProtectedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/printing/:id"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <AdminProtectedRoute>
                <PrintBatchDetail />
              </AdminProtectedRoute>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
