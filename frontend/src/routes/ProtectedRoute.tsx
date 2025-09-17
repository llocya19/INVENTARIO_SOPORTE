// src/routes/ProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { getUser } from "../services/authService";
import type { JSX } from "react";

export default function ProtectedRoute({ children, roles }: { children: JSX.Element; roles?: string[] }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.rol)) return <Navigate to="/" replace />;
  return children;
}
