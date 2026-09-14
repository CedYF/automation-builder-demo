import { useQuery } from "@tanstack/react-query";
import { useFacebookToken } from "./useFacebookToken";
import { pagesApi, type Page } from "../../../lib/api";

// Re-export Page type for backwards compatibility
export type { Page };

export interface PageDetails {
  id: string;
  name: string;
  category: string;
  followers_count: number;
  fan_count: number;
  about?: string;
  picture: {
    data: {
      height: number;
      is_silhouette: boolean;
      url: string;
      width: number;
    };
  };
}

export const usePages = () => {
  // Fetch Facebook token first
  const { data: facebookToken, isLoading: isLoadingToken, error: tokenError } = useFacebookToken();

  const query = useQuery({
    queryKey: ["pages", facebookToken],
    queryFn: async () => {
      if (!facebookToken) {
        throw new Error("Facebook token required");
      }

      return pagesApi.fetch(facebookToken);
    },
    enabled: !!facebookToken, // Only run query when token is available
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    // Only show loading if we don't have data yet AND something is loading
    isLoading: !query.data && (isLoadingToken || query.isLoading),
    error: tokenError || query.error,
  };
};
