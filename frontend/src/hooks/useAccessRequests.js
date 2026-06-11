import { useQuery } from "@tanstack/react-query";
import api from "../api";

export function useAccessRequests() {
  return useQuery({
    queryKey: ["access-requests"],
    queryFn: async () => {
      const data = await api.get("/auth/access-requests");
      return data?.items ?? [];
    },
    staleTime: 30_000,
  });
}