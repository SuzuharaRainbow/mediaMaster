import { useQuery } from "@tanstack/react-query";
import api from "../api";

export function useHomeSections() {
  return useQuery({
    queryKey: ["home-sections"],
    queryFn: () => api.get("/home-sections"),
    staleTime: 60_000,
  });
}