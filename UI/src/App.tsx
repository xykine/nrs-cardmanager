import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import EmployeeList from "./components/EmployeeList";
import CardPage from "./components/Card/CardPage";
import EmployeeDetail from "./components/EmployeeDetail";
import Login from "./components/Login";
import PrintingHistoryPage from "./components/PrintingHistoryPage";
import PrintingJobPage from "./components/PrintingJobPage";
import PrintBatchDetail from "./components/PrintBatchDetail";
import DashboardPage from "./components/DashboardPage";
import MainLayout from "./components/MainLayout";
import UploadCreateSummaryPage from "./components/UploadCreateSummaryPage";
import UploadPrintSummaryPage from "./components/UploadPrintSummaryPage";
import NotificationsPage from "./components/NotificationsPage";
import ApiKeysSettingsPage from "./components/ApiKeysSettingsPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminProtectedRoute } from "./components/AdminProtectedRoute";
import { useAdminAuth } from "./contexts/AdminAuthContext";
import { EmployeeProvider } from "./contexts/EmployeeContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { AdminAuthProvider } from "./contexts/AdminAuthContext";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const savedEmployeeId = sessionStorage.getItem("nrs_employee_id");
    const savedRole = sessionStorage.getItem("nrs_user_role");
    return Boolean(savedEmployeeId && savedRole);
  });
  const [userRole, setUserRole] = useState<"manager" | "staff">(() => {
    const savedRole = sessionStorage.getItem("nrs_user_role");
    return savedRole === "manager" ? "manager" : "staff";
  });

  const { logoutAdmin } = useAdminAuth();

  const handleLogout = () => {
    sessionStorage.removeItem("nrs_employee_id");
    sessionStorage.removeItem("nrs_user_role");
    sessionStorage.removeItem("nrs_user_name");
    sessionStorage.removeItem("nrs_user_email");
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
                path="/employees/upload-create-summary"
                element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <AdminProtectedRoute>
                      <MainLayout userRole={userRole} onLogout={handleLogout}>
                        <UploadCreateSummaryPage />
                      </MainLayout>
                    </AdminProtectedRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/employees/upload-print-summary"
                element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <AdminProtectedRoute>
                      <MainLayout userRole={userRole} onLogout={handleLogout}>
                        <UploadPrintSummaryPage />
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
                        <PrintingHistoryPage />
                      </MainLayout>
                    </AdminProtectedRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <AdminProtectedRoute>
                      <MainLayout userRole={userRole} onLogout={handleLogout}>
                        <PrintingHistoryPage />
                      </MainLayout>
                    </AdminProtectedRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/printing-jobs"
                element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <AdminProtectedRoute>
                      <MainLayout userRole={userRole} onLogout={handleLogout}>
                        <PrintingJobPage />
                      </MainLayout>
                    </AdminProtectedRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <AdminProtectedRoute>
                      <MainLayout userRole={userRole} onLogout={handleLogout}>
                        <NotificationsPage />
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
              <Route
                path="/settings"
                element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <AdminProtectedRoute>
                      <MainLayout userRole={userRole} onLogout={handleLogout}>
                        <ApiKeysSettingsPage />
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
