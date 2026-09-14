"use client";

import { useQuery } from "@tanstack/react-query";
import { getFacebookToken } from "../../../actions/getFacebookToken";
import { facebookTokenKeys } from "../query-keys";

interface UseFacebookTokenOptions {
  // When provided (typically seeded from a server component), the hook skips
  // the first server-action round-trip and renders with this value immediately.
  initialData?: string | null;
  enabled?: boolean;
}

export const useFacebookToken = (options: UseFacebookTokenOptions = {}) => {
  return useQuery({
    queryKey: facebookTokenKeys.all,
    queryFn: async () => {
      const result = await getFacebookToken();

      if (result.error) {
        throw new Error(result.error);
      }
      return result.token;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    initialData: options.initialData ?? undefined,
    enabled: options.enabled ?? true,
  });
};
