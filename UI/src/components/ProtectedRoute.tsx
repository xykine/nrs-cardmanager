import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ReactNode, useEffect } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  isAuthenticated: boolean;
}

export function ProtectedRoute({
  children,
  isAuthenticated,
}: ProtectedRouteProps) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      const savedEmployeeId = sessionStorage.getItem("nrs_employee_id");
      const savedRole = sessionStorage.getItem("nrs_user_role");

      if (savedRole === "manager") {
        navigate(`/`);
      } else if (savedEmployeeId && savedEmployeeId !== "null") {
        navigate(`/card/${savedEmployeeId}`);
      } else {
        // Fallback if no employee ID is found for a staff member
        navigate("/login");
      }

      sessionStorage.removeItem("nrs_intended_location");
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    // Store the intended location before redirecting to login
    if (location.pathname !== "/") {
      sessionStorage.setItem(
        "nrs_intended_location",
        location.pathname + location.search,
      );
    }

    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
