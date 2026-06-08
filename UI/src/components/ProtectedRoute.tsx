import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  isAuthenticated: boolean;
}

export function ProtectedRoute({
  children,
  isAuthenticated,
}: ProtectedRouteProps) {
  const location = useLocation();

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
