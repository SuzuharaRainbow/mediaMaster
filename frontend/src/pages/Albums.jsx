import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import { useAlbums } from "../hooks/useAlbums";
import { useMe } from "../hooks/useMe";

export default function Albums() {
  const { data: albums, isLoading, isError, error } = useAlbums();
  const { data: user } = useMe();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [feedback, setFeedback] = useState("");

  const createMutation = useMutation({
    mutationFn: (body) => api.post("/albums", body),
    onSuccess: () => {
      setTitle("");
      setVisibility("private");
      setFeedback("创建成功");
      queryClient.invalidateQueries(["albums"]);
    },
    onError: (err) => {
      setFeedback(err?.message || "创建失败");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`/albums/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(["albums"]);
      setFeedback("更新成功");
    },
    onError: (err) => setFeedback(err?.message || "更新失败"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/albums/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(["albums"]);
      setFeedback("已删除");
    },
    onError: (err) => setFeedback(err?.message || "删除失败"),
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setFeedback("请输入标题");
      return;
    }
    createMutation.mutate({ title: title.trim(), visibility });
  };

  const onRename = (album) => {
    const nextTitle = window.prompt("新的相册名称", album.title);
    if (nextTitle && nextTitle.trim() && nextTitle !== album.title) {
      updateMutation.mutate({ id: album.id, payload: { title: nextTitle.trim() } });
    }
  };

  const onChangeVisibility = (album, nextVisibility) => {
    if (nextVisibility !== album.visibility) {
      updateMutation.mutate({ id: album.id, payload: { visibility: nextVisibility } });
    }
  };

  const onDelete = (album) => {
    if (window.confirm(`确定删除相册「${album.title}」吗？`)) {
      deleteMutation.mutate(album.id);
    }
  };

  const role = user?.effective_role || user?.role || "viewer";
  const canManage = role === "developer" || role === "manager";
  const baseURL = api.defaults.baseURL || "";
  const orderedAlbums = useMemo(() => albums || [], [albums]);
  if (role === "viewer") {
    return <div style={{ color: "#dc2626" }}>访客无法访问相册页。</div>;
  }
  return (
    <section>
      <header className="page-header">
        <h2 className="page-title">相册管理</h2>
        <p className="page-subtitle">集中查看相册，管理员与开发者可新建、重命名与删除。</p>
      </header>

      {canManage && (
        <form onSubmit={handleCreate} className="album-form" style={{ marginBottom: 24 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="相册标题" style={{ flex: "1 1 220px" }} />
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="private">private</option>
            <option value="unlisted">unlisted</option>
            <option value="public">public</option>
          </select>
          <button type="submit" disabled={createMutation.isPending} className="button-primary" style={{ padding: "8px 18px" }}>
            创建
          </button>
        </form>
      )}

      {feedback && <div style={{ marginBottom: 16, color: "var(--brand-ink)" }}>{feedback}</div>}

      {isLoading && <div>加载相册中…</div>}
      {isError && <div style={{ color: "#dc2626" }}>{error?.message || "加载失败"}</div>}

      <div style={{ display: "grid", gap: 16 }}>
        {orderedAlbums.map((album) => {
          const cacheKey = album.first_media_id || album.id;
          const hasPreview = album.first_media_id;
          const previewEndpoint = hasPreview
            ? album.first_media_preview_path
              ? `/media/${album.first_media_id}/preview`
              : album.first_media_type === "image"
                ? `/media/${album.first_media_id}/file`
                : null
            : null;
          const previewUrl = previewEndpoint
            ? `${baseURL}${previewEndpoint}?t=${encodeURIComponent(cacheKey)}`
            : null;

          return (
            <div key={album.id} className="album-card">
              <div className="album-card__thumb">
                {previewUrl ? (
                  <img src={previewUrl} alt={`${album.title} 缩略图`} loading="lazy" />
                ) : (
                  <div className="album-card__thumb--placeholder">无封面</div>
                )}
              </div>
              <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                <div className="album-card__title">{album.title}</div>
                <div className="album-card__meta">
                  可见性：{album.visibility} ｜ 创建于 {new Date(album.created_at).toLocaleString()}
                </div>
                <div className="album-card__meta">媒体数量：{album.media_count ?? 0}</div>
              </div>
            <Link to={`/albums/${album.id}`} className="pill-button">
              查看
            </Link>
            {canManage && (
              <>
                <button type="button" onClick={() => onRename(album)} className="pill-button">
                  重命名
                </button>
                <select
                  value={album.visibility}
                  onChange={(e) => onChangeVisibility(album, e.target.value)}
                  style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(248,167,208,0.45)" }}
                >
                  <option value="private">private</option>
                  <option value="unlisted">unlisted</option>
                  <option value="public">public</option>
                </select>
                <button type="button" onClick={() => onDelete(album)} className="pill-button pill-button--danger">
                  删除
                </button>
              </>
            )}
          </div>
          );
        })}
      </div>

      {!isLoading && orderedAlbums.length === 0 && <div style={{ marginTop: 24 }}>暂无相册</div>}
    </section>
  );
}