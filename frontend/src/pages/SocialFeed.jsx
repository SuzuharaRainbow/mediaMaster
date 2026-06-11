import React, { useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSocialFeed } from "../hooks/useSocial";
import SocialPostCard from "../components/SocialPostCard";

const tabs = [
  { value: "all", label: "全部" },
  { value: "x", label: "X" },
  { value: "instagram", label: "Instagram" },
];

export default function SocialFeed() {
  const [searchParams, setSearchParams] = useSearchParams();
  const platform = searchParams.get("type") || "all";
  const limit = 5;

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useSocialFeed({ platform, limit });
  const navigate = useNavigate();

  const posts = useMemo(() => data?.pages.flatMap((page) => page.items || []) || [], [data]);

  const loaderRef = useRef(null);

  useEffect(() => {
    const node = loaderRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [loaderRef, fetchNextPage, hasNextPage, isFetchingNextPage, platform]);

  const changePlatform = (value) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("type");
    } else {
      params.set("type", value);
    }
    setSearchParams(params, { replace: true });
  };

  return (
    <section>
      <header style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>社交媒体</h2>
          <p style={{ color: "#6b7280", fontSize: 14 }}>收录 X / Instagram 的最新帖子，点击可查看详情与回复。</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => changePlatform(tab.value)}
              style={{
                padding: "6px 16px",
                borderRadius: 999,
                border: "1px solid #d1d5db",
                background: platform === tab.value ? "#1d4ed8" : "#fff",
                color: platform === tab.value ? "#fff" : "#1f2937",
                cursor: "pointer",
                fontWeight: platform === tab.value ? 600 : 500,
              }}
            >
              {tab.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => refetch()}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid #d1d5db",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            刷新
          </button>
        </div>
      </header>

      {isLoading && !isRefetching && <div>加载中…</div>}
      {isError && <div style={{ color: "#dc2626" }}>{error?.message || "加载失败"}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {posts.map((post) => (
          <SocialPostCard key={post.id} post={post} onOpen={() => navigate(`/social/${post.id}`)} />
        ))}
      </div>

      <div ref={loaderRef} style={{ height: 40, marginTop: 24, display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>
        {isFetchingNextPage ? "加载更多…" : hasNextPage ? "下拉加载更多" : posts.length ? "没有更多内容" : "暂无内容"}
      </div>
    </section>
  );
}