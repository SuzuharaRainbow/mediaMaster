import React from "react";
import { Link, Outlet } from "react-router-dom";

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <Link to="/" className="brand-lockup">Suzuhara</Link>
        <nav className="app-nav">
          <Link to="/">媒体</Link>
          <Link to="/login">登录</Link>
        </nav>
      </header>
      <main className="app-main"><Outlet /></main>
    </div>
  );
}
