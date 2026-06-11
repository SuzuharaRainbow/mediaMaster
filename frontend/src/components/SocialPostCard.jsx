import React from "react";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function SocialPostCard({ post, onOpen }) {
  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen?.();
    }
  };

  return (
    <article
      className="social-card"
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <img
        src={post.author_avatar_url || "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png"}
        alt={post.author_name}
        className="social-card__avatar"
      />
      <div style={{ flex: 1 }}>
        <header className="social-card__header">
          <strong>{post.author_name}</strong>
          <span style={{ color: "#94a3b8" }}>@{post.author_handle}</span>
          <span style={{ color: "#64748b", fontSize: 12 }}>{formatDate(post.created_at)}</span>
          {post.is_pinned && (
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#facc15" }}>已置顶</span>
          )}
        </header>
        <p style={{ marginTop: 8, whiteSpace: "pre-line", lineHeight: 1.6 }}>{post.content}</p>
        {post.media?.length > 0 && (
          <div className="social-card__media" style={{ gridTemplateColumns: `repeat(${Math.min(post.media.length, 2)}, 1fr)` }}>
            {post.media.map((item) => (
              <SocialMediaPreview key={item.id} item={item} fallbackText={post.content.slice(0, 30)} />
            ))}
          </div>
        )}
        <footer className="social-card__stats">
          <span>回复 {post.reply_count}</span>
          <span>转发 {post.repost_count}</span>
          <span>喜欢 {post.like_count}</span>
        </footer>
      </div>
    </article>
  );
}

function SocialMediaPreview({ item, fallbackText }) {
  if (item.media_type === "video") {
    return (
      <video
        src={item.url}
        controls
        style={{ width: "100%", height: 200, borderRadius: 12, background: "#1f2937" }}
      />
    );
  }

  return (
    <img
      src={item.preview_url || item.url}
      alt={item.alt_text || fallbackText}
      style={{ width: "100%", height: 200, objectFit: "cover" }}
      onError={(event) => {
        event.currentTarget.src = `https://placehold.co/300x200?text=${encodeURIComponent(item.media_type)}`;
      }}
    />
  );
}