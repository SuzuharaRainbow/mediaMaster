import { useQuery } from "@tanstack/react-query";
import api from "../api";

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const data = await api.get("/auth/users");
      return data?.items ?? [];
    },
    staleTime: 30_000,
  });
}