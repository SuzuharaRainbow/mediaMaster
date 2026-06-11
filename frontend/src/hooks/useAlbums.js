import { useQuery } from "@tanstack/react-query";
import api from "../api";

export function useAlbums() {
  return useQuery({
    queryKey: ["albums"],
    queryFn: () => api.get("/albums"),
    staleTime: 60_000,
  });
}