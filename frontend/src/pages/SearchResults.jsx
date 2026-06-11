import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import MediaCard from "../components/MediaCard";
import { useMediaList } from "../hooks/useMediaList";

const PAGE_SIZE = 12;

export default function SearchResults() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const query = (params.get("query") || "").trim();
  const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10));

  const { data, isLoading, isError, error, isFetching } = useMediaList({
    q: query || undefined,
    page,
    size: PAGE_SIZE,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total]
  );

  const [searchValue, setSearchValue] = useState(query);
  const [pageInput, setPageInput] = useState(String(page));

  useEffect(() => {
    setSearchValue(query);
  }, [query]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const goToPage = (nextPage) => {
    if (nextPage === page || nextPage < 1 || nextPage > totalPages) {
      return;
    }
    const nextParams = new URLSearchParams(params);
    nextParams.set("page", String(nextPage));
    setParams(nextParams, { replace: true });
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const trimmed = searchValue.trim();
    if (!trimmed) {
      navigate("/search");
      return;
    }
    setSearchValue(trimmed);
    navigate(`/search?query=${encodeURIComponent(trimmed)}`);
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
      <header className="page-header" style={{ marginBottom: 24 }}>
        <h2 className="page-title" style={{ marginBottom: 12 }}>搜索媒体</h2>
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            type="search"
            placeholder="输入标题、文件名或标签"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid rgba(248,167,208,0.45)",
              minWidth: 220,
            }}
          />
          <button type="submit" className="button-primary" style={{ padding: "8px 18px" }}>
            搜索
          </button>
        </form>
      </header>

      {!query && (
        <div style={{ color: "rgba(50,44,84,0.65)" }}>
          输入关键词后按回车，即可搜索所有可访问的媒体内容。
        </div>
      )}

      {query && (
        <>
          {isLoading && items.length === 0 && <div>正在搜索「{query}」…</div>}
          {isError && <div style={{ color: "#dc2626" }}>{error?.message || "搜索失败"}</div>}

          {!isLoading && !isError && (
            <>
              {items.length === 0 ? (
                <div style={{ color: "rgba(50,44,84,0.6)" }}>没有找到与「{query}」匹配的媒体。</div>
              ) : (
                <>
                  <div className="card-grid">
                    {items.map((item) => (
                      <MediaCard key={item.id} item={item} linkState={{ media: item }} />
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
                      className="button-secondary"
                    >
                      首页
                    </button>
                    <button
                      type="button"
                      onClick={() => goToPage(Math.max(1, page - 1))}
                      disabled={page <= 1 || isFetching}
                      className="button-secondary"
                    >
                      上一页
                    </button>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
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
                      className="button-secondary"
                    >
                      下一页
                    </button>
                    <button
                      type="button"
                      onClick={() => goToPage(totalPages)}
                      disabled={page >= totalPages || isFetching}
                      className="button-secondary"
                    >
                      末页
                    </button>
                  </form>
                  {isFetching && items.length > 0 && (
                    <div style={{ marginTop: 12, textAlign: "center", fontSize: 13, color: "rgba(50,44,84,0.6)" }}>
                      正在载入更多结果…
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}