import React from "react";
import { useNavigate } from "react-router-dom";
import { useMe } from "../hooks/useMe";
import { useHomeSections } from "../hooks/useHomeSections";

export default function ControlCenter() {
  const navigate = useNavigate();
  const { data: user, isLoading } = useMe();
  const { data: sections = [] } = useHomeSections();
  const canAccess = user?.role === "developer" || user?.role === "manager";
  if (isLoading) return <div>加载中...</div>;
  if (!canAccess) return <button type="button" className="button-secondary" onClick={() => navigate(-1)}>返回</button>;
  return (
    <section>
      <header className="page-header"><h2 className="page-title">控制中心</h2><p className="page-subtitle">管理首页分类、相册内容和账号视角。</p></header>
      <div style={{ display: "grid", gap: 16 }}>
        <section style={{ padding: 24, background: "var(--card-surface)", border: "1px solid var(--card-border)", borderRadius: 18 }}><h3>首页栏目</h3><p>当前已有 {sections.length} 个首页分类，可配置预览排数和挂载相册。</p></section>
        <section style={{ padding: 24, background: "var(--card-surface)", border: "1px solid var(--card-border)", borderRadius: 18 }}><h3>相册管理</h3><p>创建相册、调整可见性并进入相册详情。</p></section>
      </div>
    </section>
  );
}
