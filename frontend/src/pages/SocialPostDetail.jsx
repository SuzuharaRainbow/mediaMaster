import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSocialPost } from "../hooks/useSocial";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function SocialPostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useSocialPost(id);

  if (isLoading) return <div>加载中…</div>;
  if (isError) return <div style={{ color: "#dc2626" }}>{error?.message || "加载失败"}</div>;
  if (!data) return <div>未找到帖子</div>;

  const post = data;

  return (
    <section className="social-detail">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/social"))}
        style={{
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid rgba(248,167,208,0.45)",
          background: "rgba(255,255,255,0.9)",
          cursor: "pointer",
          marginBottom: 16,
        }}
      >
        ← 返回
      </button>

      <article>
        <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src={post.author_avatar_url || "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png"}
            alt={post.author_name}
            style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,244,68,0.5)" }}
          />
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{post.author_name}</div>
            <div style={{ color: "#64748b", fontSize: 14 }}>@{post.author_handle}</div>
          </div>
        </header>
        <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.6, whiteSpace: "pre-line" }}>{post.content}</p>
        {post.media?.length > 0 && (
          <div
            style={{
              marginTop: 12,
              borderRadius: 16,
              overflow: "hidden",
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(post.media.length, 2)}, 1fr)` ,
              gap: 8,
            }}
          >
            {post.media.map((media) => (
              media.media_type === "video" ? (
                <video key={media.id} src={media.url} controls style={{ width: "100%", borderRadius: 12, background: "#0f172a" }} />
              ) : (
                <img
                  key={media.id}
                  src={media.url}
                  alt={media.alt_text || post.content.slice(0, 30)}
                  style={{ width: "100%", borderRadius: 12 }}
                  onError={(event) => {
                    event.currentTarget.src = `https://placehold.co/400x300?text=${encodeURIComponent(media.media_type)}`;
                  }}
                />
              )
            ))}
          </div>
        )}
        <footer style={{ marginTop: 16, display: "flex", gap: 16, color: "#64748b", fontSize: 14 }}>
          <span>时间 {formatDate(post.created_at)}</span>
          <span>转发 {post.repost_count}</span>
          <span>喜欢 {post.like_count}</span>
        </footer>
        {post.permalink && (
          <a href={post.permalink} target="_blank" rel="noreferrer" style={{ marginTop: 12, display: "inline-block", color: "var(--brand-pink-strong)" }}>
            在平台打开
          </a>
        )}
      </article>

      <section style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>回复 ({post.replies?.length || 0})</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {post.replies?.map((reply) => (
            <article key={reply.id} className="social-detail__reply">
              <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img
                  src={reply.author_avatar_url || "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png"}
                  alt={reply.author_name}
                  style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,244,68,0.45)" }}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>{reply.author_name}</div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>@{reply.author_handle} · {formatDate(reply.created_at)}</div>
                </div>
                {reply.permalink && (
                  <a href={reply.permalink} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", color: "#1d4ed8" }}>
                    查看原帖
                  </a>
                )}
              </header>
              <p style={{ marginTop: 12, whiteSpace: "pre-line", lineHeight: 1.6 }}>{reply.content}</p>
              <footer style={{ marginTop: 12, fontSize: 12, color: "#94a3b8" }}>喜欢 {reply.like_count}</footer>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}