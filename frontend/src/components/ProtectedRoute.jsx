import { Navigate } from "react-router-dom";
import { getDashboardPathForRole, useAuth } from "../context/AuthContext";

function ProtectedRoute({ allowedRoles, children }) {
  const { auth } = useAuth();

  if (!auth?.token || !auth?.user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(auth.user.role)) {
    return <Navigate to={getDashboardPathForRole(auth.user.role)} replace />;
  }

  return children;
}

export default ProtectedRoute;

