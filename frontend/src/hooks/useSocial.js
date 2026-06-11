import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import api from "../api";

export function useSocialFeed({ platform, limit }) {
  return useInfiniteQuery({
    queryKey: ["social-feed", platform, limit],
    queryFn: async ({ pageParam }) => {
      const params = { limit };
      if (platform && platform !== "all") params.type = platform;
      if (pageParam) params.cursor = pageParam;
      const data = await api.get("/social/posts", { params });
      return data;
    },
    getNextPageParam: (lastPage) => (lastPage?.next_cursor ? lastPage.next_cursor : undefined),
    initialPageParam: undefined,
  });
}

export function useSocialPost(postId) {
  return useQuery({
    queryKey: ["social-post", postId],
    queryFn: () => api.get(`/social/posts/${postId}`),
    enabled: !!postId,
  });
}