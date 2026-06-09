import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api, { ApiError } from "../api";
import { useAlbums } from "../hooks/useAlbums";
import { useRequireManager } from "../hooks/useMe";
import { useSearchParams } from "react-router-dom";

export default function Upload() {
  const { isLoading, isManager } = useRequireManager();
  const [searchParams] = useSearchParams();
  const defaultAlbumParam = searchParams.get("albumId") || searchParams.get("album_id") || "";
  const [files, setFiles] = useState([]);
  const [albumId, setAlbumId] = useState(defaultAlbumParam);
  const [title, setTitle] = useState("");
  const [takenAt, setTakenAt] = useState("");
  const [message, setMessage] = useState("");
  const { data: albums } = useAlbums();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!files.length) {
        throw new Error("请选择文件");
      }
      const formData = new FormData();
      files.forEach((file) => formData.append("file", file));
      if (albumId) {
        formData.append("album_id", albumId);
      }
      if (title) {
        formData.append("title", title);
      }
      if (takenAt) {
        formData.append("taken_at", takenAt);
      }
      const result = await api.post("/media/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return result;
    },
    onSuccess: () => {
      setMessage("上传成功");
      setFiles([]);
      setTitle("");
      setTakenAt("");
      queryClient.invalidateQueries(["media"]);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setMessage(err.message || "上传失败");
      } else {
        setMessage(err?.message || "上传失败");
      }
    },
  });

  const albumOptions = useMemo(() => albums || [], [albums]);

  const handleFileChange = (event) => {
    setMessage("");
    const selected = Array.from(event.target.files || []);
    setFiles(selected);
  };

  useEffect(() => {
    setAlbumId(defaultAlbumParam);
  }, [defaultAlbumParam]);

  if (isLoading) {
    return <div>加载中…</div>;
  }
  if (!isManager) {
    return <div style={{ color: "#dc2626" }}>您没有权限访问上传页。</div>;
  }

  return (
    <section>
      <header className="page-header">
        <h2 className="page-title">批量上传</h2>
        <p className="page-subtitle">管理员与开发者可批量上传媒体，系统会自动判断图片或视频类型。</p>
      </header>

      <form className="form-card" onSubmit={(e) => e.preventDefault()}>
        <label style={{ display: "block", marginBottom: 16 }}>
          文件
          <input type="file" multiple onChange={handleFileChange} />
        </label>
        <label style={{ display: "block", marginBottom: 16 }}>
          标题（可选，若填写则应用于所有文件）
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label style={{ display: "block", marginBottom: 16 }}>
          拍摄时间（可选）
          <input type="datetime-local" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
        </label>
        <label style={{ display: "block", marginBottom: 16 }}>
          归属相册（可选）
          <select value={albumId} onChange={(e) => setAlbumId(e.target.value)}>
            <option value="">不指定</option>
            {albumOptions.map((album) => (
              <option key={album.id} value={album.id}>
                {album.title}（{album.visibility}）
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="button-primary">
          {mutation.isPending ? "上传中…" : "开始上传"}
        </button>
        {files.length > 0 && (
          <ul style={{ marginTop: 16, color: "rgba(50,44,84,0.7)", fontSize: 14 }}>
            {files.map((file) => (
              <li key={file.name}>{file.name}</li>
            ))}
          </ul>
        )}
        {message && <div style={{ marginTop: 16, color: "var(--brand-ink)" }}>{message}</div>}
      </form>
    </section>
  );
}