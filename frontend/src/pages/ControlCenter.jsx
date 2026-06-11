import React from "react";
import { useNavigate } from "react-router-dom";
import { useMe } from "../hooks/useMe";

const TAB_DEFINITIONS = { home: { id: "home", label: "主页" }, albums: { id: "albums", label: "相册" }, requests: { id: "requests", label: "访客申请" }, accounts: { id: "accounts", label: "账号管理" }, view: { id: "view", label: "视图控制" } };

export default function ControlCenter() {
  const navigate = useNavigate();
  const { data: user, isLoading } = useMe();
  const canAccess = user?.role === "developer" || user?.role === "manager";
  if (isLoading) return <div>加载中...</div>;
  if (!canAccess) return <button type="button" className="button-secondary" onClick={() => navigate(-1)}>返回</button>;
  return <section><header className="page-header"><h2 className="page-title">控制中心</h2><p className="page-subtitle">统一管理首页分类、相册内容、访客申请和账号视角。</p></header><div style={{ display: "flex", gap: 12 }}>{Object.values(TAB_DEFINITIONS).map((tab) => <button key={tab.id} className="button-secondary">{tab.label}</button>)}</div></section>;
}
