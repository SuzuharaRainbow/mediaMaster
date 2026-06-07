import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import api, { ApiError } from "../api";
import { useMe } from "../hooks/useMe";
import mascot from "../assets/mascot.png";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: currentUser, isLoading: isMeLoading } = useMe();

  const intendedPath =
    (location.state?.from?.pathname && location.state.from.pathname !== "/login"
      ? location.state.from.pathname
      : "/") || "/";

  useEffect(() => {
    if (currentUser && location.pathname === "/login") {
      navigate(intendedPath, { replace: true });
    }
  }, [currentUser, intendedPath, navigate, location.pathname]);

  const requestAccess = useMutation({
    mutationFn: (body) => api.post("/auth/access-requests", body),
    onSuccess: () => {
      setError("");
      setInfo("账号创建申请已提交，请等待管理员审核开通后再登录。");
    },
    onError: (err) => {
      setInfo("");
      if (err instanceof ApiError) {
        if (err.code === 40910) {
          setError("账号已存在，请确认填写的密码是否正确。");
          return;
        }
        if (err.code === 40912) {
          setError("该申请已处理，请稍后再试。");
          return;
        }
        if (err.code === 42200) {
          setError("请输入有效的用户名和密码。");
          return;
        }
        setError(err.message || "申请失败，请稍后再试。");
        return;
      }
      setError("申请失败，请检查网络连接。");
    },
  });

  const loginMutation = useMutation({
    mutationFn: (body) => api.post("/auth/login", body),
    onSuccess: () => {
      setError("");
      setInfo("");
      queryClient.invalidateQueries(["me"]);
      navigate(intendedPath, { replace: true });
    },
    onError: (err) => {
      if (err instanceof ApiError && (err.code === 40100 || err.code === 40400)) {
        const trimmed = username.trim();
        if (!trimmed || !password) {
          setError("请输入用户名和密码。");
          return;
        }
        setError("");
        if (!requestAccess.isPending) {
          setInfo("账号尚未开通，正在向管理员发送申请…");
          requestAccess.mutate({
            username: trimmed,
            password,
            message: "自动提交的访客访问申请",
          });
        }
        return;
      }
      setInfo("");
      if (err instanceof ApiError) {
        setError(err.message || "登录失败");
      } else {
        setError("登录失败，请稍后重试。");
      }
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = username.trim();
    if (!trimmed || !password) {
      setError("请输入用户名和密码。");
      return;
    }
    setError("");
    setInfo("");
    loginMutation.mutate({ username: trimmed, password });
  };

  const isSubmitting = loginMutation.isPending || requestAccess.isPending || isMeLoading;

  return (
    <div className="login-page">
      <div className="login-page__glow login-page__glow--one" />
      <div className="login-page__glow login-page__glow--two" />
      <div className="login-card">
        <div className="login-card__brand">
          <span className="login-card__badge">
            <img src={mascot} alt="Suzuhara mascot" />
          </span>
          <h1 className="login-card__title">すずはら家</h1>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-field">
            <span>用户名</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              autoCapitalize="none"
              placeholder="guest"
              disabled={isSubmitting}
            />
          </label>
          <label className="login-field">
            <span>密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={isSubmitting}
            />
          </label>
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}
          {info && !error && (
            <div className="login-info" role="status">
              {info}
            </div>
          )}
          <button type="submit" disabled={isSubmitting} className="login-submit">
            {loginMutation.isPending ? "登录中…" : requestAccess.isPending ? "提交申请…" : "进入すずはら家"}
          </button>
        </form>
      </div>
    </div>
  );
}