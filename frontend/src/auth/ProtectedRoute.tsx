import { Navigate, Outlet, useLocation } from "react-router-dom";
import { FullPageSpinner } from "../components/ui";
import { useAuth } from "./auth-context";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}