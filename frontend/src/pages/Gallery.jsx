import React, { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import MediaCard from "../components/MediaCard";
import { useCategoryMedia } from "../hooks/useCategoryMedia";
import { useHomeSections } from "../hooks/useHomeSections";

function CategoryPreviewSection({ section, albumIds, type, isConfigLoading }) {
  const rows = Math.max(1, section.preview_rows || 1);
  const { data, isLoading, isError, error } = useCategoryMedia({
    albumIds,
    page: 1,
    size: rows * 4,
    type,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const shouldShowMore = total > rows * 4;
  const search = type === "all" ? "" : `?type=${type}`;

  const renderBody = () => {
    if (isConfigLoading && albumIds.length === 0) {
      return <div>正在加载分类信息…</div>;
    }
    if (albumIds.length === 0) {
      return (
        <div style={{ color: "rgba(50,44,84,0.6)" }}>
          暂未找到对应相册，请在控制中心的「主页」设置中为「{section.title}」选择相册。
        </div>
      );
    }
    if (isLoading) {
      return <div>加载 {section.title} …</div>;
    }
    if (isError) {
      return <div style={{ color: "#dc2626" }}>{error?.message || "加载失败"}</div>;
    }
    if (items.length === 0) {
      return <div style={{ color: "rgba(50,44,84,0.6)" }}>该分类暂无内容，稍后再来看看吧。</div>;
    }
    return (
      <div className="card-grid">
        {items.map((item) => (
          <MediaCard key={item.id} item={item} linkState={{ media: item }} />
        ))}
      </div>
    );
  };

  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h3 style={{ fontSize: 22, fontWeight: 700 }}>{section.title}</h3>
        {shouldShowMore && (
          <Link
            to={`/collections/${section.key}${search}`}
            className="button-secondary"
            style={{ padding: "6px 16px" }}
          >
            more
          </Link>
        )}
      </div>
      {renderBody()}
    </section>
  );
}

export default function Gallery() {
  const [params] = useSearchParams();
  const type = params.get("type") || "all";

  const { data: sections, isLoading: sectionsLoading } = useHomeSections();

  const sectionAlbumMap = useMemo(() => {
    if (!sections) {
      return new Map();
    }
    return new Map(
      sections.map((section) => [section.key, section.album_ids])
    );
  }, [sections]);

  const orderedSections = sections ?? [];

  return (
    <section>
      {sectionsLoading && <div>加载分类中…</div>}
      {!sectionsLoading && orderedSections.length === 0 && (
        <div style={{ color: "rgba(50,44,84,0.6)", marginTop: 16 }}>
          暂无首页分类，请在控制中心新增分类。
        </div>
      )}
      {orderedSections.map((section) => (
        <CategoryPreviewSection
          key={section.id}
          section={section}
          albumIds={sectionAlbumMap.get(section.key) || []}
          type={type}
          isConfigLoading={sectionsLoading}
        />
      ))}
    </section>
  );
}