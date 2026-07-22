import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { isAdmin } from "@/lib/roles";

export function RequireAdmin({ children }) {
  const { auth, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isAdmin(auth.user)) {
    return <Navigate to="/settings/account" replace />;
  }

  return children;
}
