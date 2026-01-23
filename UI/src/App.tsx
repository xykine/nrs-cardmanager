import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import EmployeeList from "./components/EmployeeList";
import CardPage from "./components/Card/CardPage";
import EmployeeDetail from "./components/EmployeeDetail";
import Login from "./components/Login";
import PrintingTasksPage from "./components/PrintingTasksPage";
import PrintBatchDetail from "./components/PrintBatchDetail";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { NotificationProvider } from "./contexts/NotificationContext";

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

  const handleLogout = () => {
    sessionStorage.removeItem("nrs_employee_id");
    sessionStorage.removeItem("nrs_user_role");
    sessionStorage.removeItem("nrs_intended_location");
    setIsAuthenticated(false);
    setUserRole("staff");
  };

  return (
    <BrowserRouter>
      <NotificationProvider>
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
                <EmployeeList onLogout={handleLogout} userRole={userRole} />
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
                <EmployeeDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/printing"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <PrintingTasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/printing/:id"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <PrintBatchDetail />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </NotificationProvider>
    </BrowserRouter>
  );
}

export default App;
