import { useQuery } from "@tanstack/react-query";
import api, { ApiError } from "../api";

export function useMediaDetail(id) {
  return useQuery({
    queryKey: ["media", id],
    queryFn: () => api.get(`/media/${id}`),
    enabled: !!id,
  });
}