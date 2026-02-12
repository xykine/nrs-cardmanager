import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import EmployeeList from "./components/EmployeeList";
import CardPage from "./components/Card/CardPage";
import EmployeeDetail from "./components/EmployeeDetail";
import Login from "./components/Login";
import PrintingReportPage from "./components/PrintingReportPage";
import PrintBatchDetail from "./components/PrintBatchDetail";
import DashboardPage from "./components/DashboardPage";
import MainLayout from "./components/MainLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminProtectedRoute } from "./components/AdminProtectedRoute";
import { useAdminAuth } from "./contexts/AdminAuthContext";
import { EmployeeProvider } from "./contexts/EmployeeContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { AdminAuthProvider } from "./contexts/AdminAuthContext";

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

  const savedEmployeeId = sessionStorage.getItem("nrs_employee_id");

  return (
    <AdminAuthProvider>
      <NotificationProvider>
        <EmployeeProvider>
          <BrowserRouter>
            <Routes>
              <Route
                path="/login"
                element={
                  isAuthenticated ? (
                    userRole === "manager" ? (
                      <Navigate to="/dashboard" replace />
                    ) : (
                      <Navigate to={`/card/${savedEmployeeId}`} replace />
                    )
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
                    {userRole === "manager" ? (
                      <Navigate to="/dashboard" replace />
                    ) : (
                      <Navigate to={`/card/${savedEmployeeId}`} replace />
                    )}
                  </ProtectedRoute>
                }
              />
              <Route
                path="/employees"
                element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <AdminProtectedRoute>
                      <MainLayout userRole={userRole} onLogout={handleLogout}>
                        <EmployeeList userRole={userRole} />
                      </MainLayout>
                    </AdminProtectedRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/card/:employeeId"
                element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <MainLayout userRole={userRole} onLogout={handleLogout}>
                      <CardPage onLogout={handleLogout} />
                    </MainLayout>

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
                      <MainLayout userRole={userRole} onLogout={handleLogout}>
                        <EmployeeDetail />
                      </MainLayout>
                    </AdminProtectedRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/printing"
                element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <AdminProtectedRoute>
                      <MainLayout userRole={userRole} onLogout={handleLogout}>
                        <PrintingReportPage />
                      </MainLayout>
                    </AdminProtectedRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/printing/:id"
                element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <AdminProtectedRoute>
                      <MainLayout userRole={userRole} onLogout={handleLogout}>
                        <PrintBatchDetail />
                      </MainLayout>
                    </AdminProtectedRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <AdminProtectedRoute>
                      <MainLayout userRole={userRole} onLogout={handleLogout}>
                        <DashboardPage />
                      </MainLayout>
                    </AdminProtectedRoute>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </EmployeeProvider>
      </NotificationProvider>
    </AdminAuthProvider>
  );
}

export default App;
