import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api";

function cleanParams(params) {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null && value !== "")
  );
}

export function useMediaList(params) {
  const cleaned = cleanParams(params);
  const key = [
    "media",
    cleaned.album_id ?? "all",
    cleaned.type ?? "all",
    cleaned.q ?? "",
    Number(cleaned.page ?? 1),
    Number(cleaned.size ?? 12),
  ];

  const scopeKey = `${cleaned.album_id ?? "all"}::${cleaned.q ?? ""}`;
  const previousScopeRef = useRef(scopeKey);
  const isSameScope = previousScopeRef.current === scopeKey;

  useEffect(() => {
    previousScopeRef.current = scopeKey;
  }, [scopeKey]);

  return useQuery({
    queryKey: key,
    queryFn: () => api.get("/media", { params: cleaned }),
    keepPreviousData: isSameScope,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}