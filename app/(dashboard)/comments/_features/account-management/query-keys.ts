export const facebookTokenKeys = {
  all: ["facebookToken"] as const,
};

export const adAccountPagesKeys = {
  all: ["adAccountPages"] as const,
  detail: (businessId: string) => [...adAccountPagesKeys.all, businessId] as const,
};

export const pageSubscriptionKeys = {
  all: ["pageSubscription"] as const,
  detail: (pageId: string | null) => [...pageSubscriptionKeys.all, pageId] as const,
};

export const allPagesSubscriptionKeys = {
  all: ["allPagesSubscription"] as const,
  detail: (pageIdsKey: string) => [...allPagesSubscriptionKeys.all, pageIdsKey] as const,
};

export const availablePagesKeys = {
  all: ["availablePages"] as const,
  withToken: (token: string | null | undefined) => [...availablePagesKeys.all, token] as const,
};
