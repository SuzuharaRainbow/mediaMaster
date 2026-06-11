import { useQuery } from "@tanstack/react-query";
import api from "../api";

function cleanParams(params) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  );
}

async function fetchAlbumSlice({ albumId, needed, type }) {
  const collected = [];
  let total = 0;
  let remaining = needed;
  let page = 1;

  while (remaining > 0) {
    const size = Math.min(remaining, 100);
    if (size <= 0) {
      break;
    }

    const response = await api.get("/media", {
      params: cleanParams({
        album_id: albumId,
        page,
        size,
        type: type === "all" ? undefined : type,
      }),
    });

    const items = response?.items ?? [];
    if (page === 1) {
      total = response?.total ?? 0;
    }

    collected.push(...items);

    if (items.length < size) {
      break;
    }

    remaining = needed - collected.length;
    if (remaining <= 0) {
      break;
    }
    page += 1;
  }

  return { items: collected, total };
}

async function fetchCategoryMedia({ albumIds, page, size, type }) {
  if (!albumIds.length) {
    return { items: [], total: 0 };
  }

  const needed = page * size;
  const albumResults = await Promise.all(
    albumIds.map((albumId) => fetchAlbumSlice({ albumId, needed, type }))
  );

  const total = albumResults.reduce((sum, entry) => sum + (entry.total || 0), 0);
  const merged = albumResults.flatMap((entry) => entry.items || []);

  const getDateKey = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  };

  const toTimestamp = (value) => {
    if (!value) {
      return 0;
    }
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  };

  const numericFromName = (name) => {
    if (!name) return Number.POSITIVE_INFINITY;
    const base = name.split(".")[0];
    const parsed = Number.parseInt(base, 10);
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
  };

  merged.sort((a, b) => {
    const dateA = getDateKey(a.created_at);
    const dateB = getDateKey(b.created_at);
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }

    const timeDiff = toTimestamp(a.created_at) - toTimestamp(b.created_at);
    if (timeDiff !== 0) {
      return timeDiff;
    }

    const numDiff = numericFromName(a.filename) - numericFromName(b.filename);
    if (numDiff !== 0) {
      return numDiff;
    }

    const baseA = (a.filename || "").split(".")[0];
    const baseB = (b.filename || "").split(".")[0];
    const baseCompare = baseA.localeCompare(baseB);
    if (baseCompare !== 0) {
      return baseCompare;
    }

    return (a.id || 0) - (b.id || 0);
  });

  const start = (page - 1) * size;
  const items = merged.slice(start, start + size);

  return { items, total };
}

export function useCategoryMedia({ albumIds, page = 1, size = 8, type = "all" }) {
  const sortedIds = [...albumIds].sort((a, b) => a - b);
  return useQuery({
    queryKey: ["category-media", sortedIds, page, size, type],
    queryFn: () => fetchCategoryMedia({ albumIds: sortedIds, page, size, type }),
    enabled: sortedIds.length > 0,
    keepPreviousData: true,
    staleTime: 30_000,
  });
}