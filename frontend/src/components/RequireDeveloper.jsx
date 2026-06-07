import React from "react";
import { Navigate } from "react-router-dom";
import { useRequireDeveloper } from "../hooks/useMe";

export default function RequireDeveloper({ children, fallback }) {
  const { isLoading, user, isDeveloper } = useRequireDeveloper();

  if (isLoading) {
    return fallback ?? <div>加载中…</div>;
  }
  if (!isDeveloper) {
    if (fallback) return fallback;
    return <Navigate to="/" replace />;
  }
  return children;
}