import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import { useMediaDetail } from "../hooks/useMediaDetail";
import { useAlbums } from "../hooks/useAlbums";
import { useMe } from "../hooks/useMe";

export default function MediaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const { data, isLoading, isError, error } = useMediaDetail(id);
  const { data: albums } = useAlbums();
  const { data: currentUser } = useMe();

  const role = currentUser?.effective_role || currentUser?.role || "viewer";
  const canEdit = role === "developer" || role === "manager";

  const [formState, setFormState] = useState({ title: "", album_id: "", taken_at: "" });
  const [tagsInput, setTagsInput] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (data && canEdit) {
      setFormState({
        title: data.title || "",
        album_id: data.album_id ? String(data.album_id) : "",
        taken_at: data.taken_at ? data.taken_at.slice(0, 16) : "",
      });
      setTagsInput(data.tags?.join(",") || "");
    }
  }, [data, canEdit]);

  const updateMutation = useMutation({
    mutationFn: (payload) => api.patch(`/media/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(["media", id]);
      queryClient.invalidateQueries(["media"]);
      setFeedback("已更新");
    },
    onError: (err) => setFeedback(err?.message || "更新失败"),
  });

  const tagMutation = useMutation({
    mutationFn: (tags) => api.post(`/media/${id}/tags`, { tags }),
    onSuccess: () => {
      queryClient.invalidateQueries(["media", id]);
      setFeedback("标签已保存");
    },
    onError: (err) => setFeedback(err?.message || "标签保存失败"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/media/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(["media"]);
      navigate("/");
    },
    onError: (err) => setFeedback(err?.message || "删除失败"),
  });

  if (isLoading) return <div>加载详情中…</div>;
  if (isError) return <div style={{ color: "#dc2626" }}>{error?.message || "加载失败"}</div>;

  const rawMedia = data;
  const fallbackMedia = !rawMedia && role === "viewer" ? location.state?.media ?? null : null;
  const media = rawMedia || fallbackMedia;

  if (!media) {
    return (
      <section>
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            background: "#fff",
            color: "#1f2937",
            cursor: "pointer",
          }}
        >
          ← 返回
        </button>
        <div style={{ marginTop: 24, color: "#4b5563" }}>该媒体暂时不可访问，请稍后再试。</div>
      </section>
    );
  }

  const hasFullData = !!rawMedia;
  const fileURL = hasFullData ? `${api.defaults.baseURL}/media/${id}/file?v=${media.sha256 || "preview"}` : null;
  const previewURL = hasFullData && media.preview_path
    ? `${api.defaults.baseURL}/media/${id}/preview?v=${media.sha256 || "preview"}`
    : undefined;

  const handleSubmit = (event) => {
    event.preventDefault();
    setFeedback("");
    const payload = {
      title: formState.title,
      album_id: formState.album_id ? Number(formState.album_id) : null,
      taken_at: formState.taken_at || null,
    };
    updateMutation.mutate(payload);
  };

  const handleTagsSave = () => {
    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    tagMutation.mutate(tags);
  };

  const infoList = canEdit && hasFullData ? (
    <div style={{ marginTop: 16, fontSize: 14, color: "#4b5563" }}>
      <div>文件名：{media.filename ?? "--"}</div>
      <div>类型：{media.mime_type ?? "--"}</div>
      <div>大小：{media.bytes ? (media.bytes / 1024 / 1024).toFixed(2) : "--"} MB</div>
      <div>创建时间：{media.created_at ? new Date(media.created_at).toLocaleString() : "--"}</div>
      {media.taken_at && <div>拍摄时间：{new Date(media.taken_at).toLocaleString()}</div>}
      <div>标签：{media.tags?.length ? media.tags.join(", ") : "无"}</div>
    </div>
  ) : null;

  return (
    <section
      style={{
        display: "grid",
        gap: 24,
        gridTemplateColumns: canEdit ? "minmax(0, 3fr) minmax(0, 2fr)" : "minmax(0, 1fr)",
      }}
    >
      <div style={{ gridColumn: "1 / -1" }}>
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            background: "#fff",
            color: "#1f2937",
            cursor: "pointer",
          }}
        >
          ← 返回
        </button>
      </div>
      <div>
        {hasFullData && media.type === "video" ? (
          <video
            key={fileURL || "video"}
            src={fileURL}
            controls
            poster={previewURL}
            style={{ width: "100%", maxHeight: 520, borderRadius: 12, background: "#000" }}
          />
        ) : hasFullData ? (
          <img
            key={fileURL || "image"}
            src={fileURL}
            alt={media.title}
            style={{ width: "100%", borderRadius: 12, objectFit: "contain", maxHeight: 520, background: "#f3f4f6" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: 360,
              borderRadius: 12,
              background: "rgba(248,167,208,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(50,44,84,0.6)",
              fontSize: 16,
            }}
          >
            该媒体暂时不可播放
          </div>
        )}
        {infoList}
        {!canEdit && (
          <div style={{ marginTop: 16, fontSize: 18, fontWeight: 600, color: "#1f2937" }}>
            {media.title || "无标题"}
          </div>
        )}
      </div>
      {canEdit && hasFullData && (
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>元数据</h3>
          {feedback && <div style={{ marginBottom: 16, color: "var(--brand-ink)" }}>{feedback}</div>}
          <>
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
              <label>
                标题
                <input
                  value={formState.title}
                  onChange={(e) => setFormState((state) => ({ ...state, title: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                  }}
                />
              </label>
              <label>
                所属相册
                <select
                  value={formState.album_id}
                  onChange={(e) => setFormState((state) => ({ ...state, album_id: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                  }}
                >
                  <option value="">不指定</option>
                  {(albums || []).map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                拍摄时间
                <input
                  type="datetime-local"
                  value={formState.taken_at}
                  onChange={(e) => setFormState((state) => ({ ...state, taken_at: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                  }}
                />
              </label>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "#1d4ed8",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                保存基本信息
              </button>
            </form>
            <div style={{ marginTop: 24 }}>
              <label>
                标签
                <textarea
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="多个标签用逗号分隔"
                  style={{
                    width: "100%",
                    minHeight: 96,
                    padding: "8px 10px",
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                  }}
                />
              </label>
              <button
                type="button"
                onClick={handleTagsSave}
                disabled={tagMutation.isPending}
                style={{
                  marginTop: 12,
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "#059669",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                保存标签
              </button>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid #dc2626",
                  background: deleteMutation.isPending ? "#fee2e2" : "#fff",
                  color: "#b91c1c",
                  cursor: "pointer",
                }}
              >
                删除媒体
              </button>
            </div>
          </>
        </div>
      )}
    </section>
  );
}