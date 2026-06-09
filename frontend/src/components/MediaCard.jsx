import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function stripExtension(name) {
  if (!name || typeof name !== "string") return name;
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0) return name;
  return name.slice(0, lastDot);
}

export default function MediaCard({ item, linkState }) {
  const [previewError, setPreviewError] = useState(false);
  const cacheBuster = item.updated_at || item.created_at || item.taken_at || `${item.id}`;
  const previewUrl = item.preview_path
    ? `${api.defaults.baseURL}/media/${item.id}/preview?t=${encodeURIComponent(cacheBuster)}`
    : `${api.defaults.baseURL}/media/${item.id}/file?t=${encodeURIComponent(cacheBuster)}`;

  const rawTitle = item.title || item.filename || "未命名";
  const title = stripExtension(rawTitle);
  const isVideo = item.type === "video";

  const renderThumb = () => {
    if (isVideo) {
      if (!previewError && item.preview_path) {
        return (
          <img
            src={previewUrl}
            alt={`${title} preview`}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setPreviewError(true)}
          />
        );
      }
      return (
        <div className="media-card__video-placeholder">
          <span className="media-card__video-icon">▶</span>
        </div>
      );
    }

    if (previewError) {
      return <span style={{ color: "#9ca3af", fontSize: 14 }}>预览不可用</span>;
    }

    return (
      <img
        src={previewUrl}
        alt={title}
        loading="lazy"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        onError={() => setPreviewError(true)}
      />
    );
  };

  const linkProps = { pathname: `/media/${item.id}` };
  const linkStateProp = linkState ? { state: linkState } : undefined;

  return (
    <Link to={linkProps} state={linkStateProp?.state} className="media-card">
      <div className="media-card__type">{isVideo ? "视频" : "图片"}</div>
      <div className="media-card__thumb">{renderThumb()}</div>
      <div className="media-card__title">{title}</div>
      <div className="media-card__meta">创建时间：{formatDate(item.created_at)}</div>
      {item.taken_at && (
        <div className="media-card__meta">拍摄时间：{formatDate(item.taken_at)}</div>
      )}
    </Link>
  );
}