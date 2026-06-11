import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import MediaCard from "../components/MediaCard";
import { useAlbums } from "../hooks/useAlbums";
import { useMediaList } from "../hooks/useMediaList";

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: "20px",
};

export default function AlbumDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const type = params.get("type") || "all";
  const page = Number.parseInt(params.get("page") || "1", 10);
  const size = 12;

  const { data: albums } = useAlbums();
  const album = albums?.find((item) => String(item.id) === String(id));

  const { data, isLoading, isError, error, isFetching } = useMediaList({
    album_id: id,
    type: type === "all" ? undefined : type,
    page,
    size,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const showInitialLoading = isLoading && items.length === 0;
  const isEmpty = !showInitialLoading && items.length === 0;
  const [pageInput, setPageInput] = useState(String(page));

  useEffect(() => {
    if (!showInitialLoading && page > totalPages) {
      const safePage = Math.max(1, totalPages);
      if (safePage !== page) {
        const next = new URLSearchParams(params);
        next.set("page", String(safePage));
        setParams(next, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInitialLoading, page, totalPages]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const goToPage = (nextPage) => {
    if (nextPage === page || nextPage < 1 || nextPage > totalPages) return;
    const next = new URLSearchParams(params);
    next.set("page", String(nextPage));
    setParams(next, { replace: true });
  };

  const handlePageSubmit = (event) => {
    event.preventDefault();
    if (!pageInput) return;
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.min(Math.max(parsed, 1), totalPages);
    goToPage(clamped);
  };

  return (
    <section>
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/albums"))}
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
      <header style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
          {album ? album.title : "相册详情"}
        </h2>
      </header>
      {showInitialLoading && <div>加载相册内容…</div>}
      {isError && <div style={{ color: "#dc2626" }}>{error?.message || "加载失败"}</div>}
      {!isEmpty ? (
        <>
          <div style={gridStyle}>
            {items.map((item) => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>
          <form
            onSubmit={handlePageSubmit}
            style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 24, flexWrap: "wrap" }}
          >
            <button
              type="button"
              onClick={() => goToPage(1)}
              disabled={page <= 1 || isFetching}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: page <= 1 || isFetching ? "#f3f4f6" : "#fff",
                cursor: page <= 1 || isFetching ? "not-allowed" : "pointer",
              }}
            >
              首页
            </button>
            <button
              type="button"
              onClick={() => goToPage(Math.max(1, page - 1))}
              disabled={page <= 1 || isFetching}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: page <= 1 || isFetching ? "#f3f4f6" : "#fff",
                cursor: page <= 1 || isFetching ? "not-allowed" : "pointer",
              }}
            >
              上一页
            </button>
            <label style={{ display: "flex", alignItems: "center", fontSize: 14, gap: 6 }}>
              <span>第</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
                style={{
                  width: 60,
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  textAlign: "center",
                }}
              />
              <span>页 / 共 {totalPages} 页</span>
            </label>
            <button
              type="button"
              onClick={() => goToPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages || isFetching}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: page >= totalPages || isFetching ? "#f3f4f6" : "#fff",
                cursor: page >= totalPages || isFetching ? "not-allowed" : "pointer",
              }}
            >
              下一页
            </button>
            <button
              type="button"
              onClick={() => goToPage(totalPages)}
              disabled={page >= totalPages || isFetching}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: page >= totalPages || isFetching ? "#f3f4f6" : "#fff",
                cursor: page >= totalPages || isFetching ? "not-allowed" : "pointer",
              }}
            >
              末页
            </button>
          </form>
          {isFetching && !showInitialLoading && <div style={{ marginTop: 12, textAlign: "center", fontSize: 13, color: "rgba(50,44,84,0.6)" }}>正在加载更多媒体…</div>}
        </>
      ) : (
        !showInitialLoading && <div>该相册暂无媒体</div>
      )}
    </section>
  );
}