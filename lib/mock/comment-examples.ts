export interface DemoCommentExample {
  readonly id: string;
  readonly pageId: string;
  readonly author: string;
  readonly text: string;
  readonly sentimentScore: number;
  readonly brandStance: "undermining" | "critical" | "supportive" | "neutral";
  readonly hostilePileOn: boolean;
  readonly postedMinutesAgo: number;
  readonly scoredMinutesAgo: number;
  readonly isHidden: boolean;
}

/** Fixed sample comments for the offline automation demo. */
export const DEMO_COMMENT_EXAMPLES: readonly DemoCommentExample[] = [
  { id: "comment-1", pageId: "demo-page-1", author: "Alex M.", text: "The coffee arrived cold and tasted awful. Really disappointing.", sentimentScore: 18, brandStance: "critical", hostilePileOn: false, postedMinutesAgo: 4, scoredMinutesAgo: 3, isHidden: true },
  { id: "comment-2", pageId: "demo-page-1", author: "Jamie P.", text: "Northwind keeps making promises it can't deliver. Don't trust this brand.", sentimentScore: 55, brandStance: "undermining", hostilePileOn: false, postedMinutesAgo: 17, scoredMinutesAgo: 15, isHidden: true },
  { id: "comment-3", pageId: "demo-page-1", author: "Morgan L.", text: "Love the new blend. Ordering another bag!", sentimentScore: 91, brandStance: "supportive", hostilePileOn: false, postedMinutesAgo: 38, scoredMinutesAgo: 35, isHidden: false },
  { id: "comment-4", pageId: "demo-ig-1", author: "Taylor R.", text: "Everyone pile on this post. Let's flood every reply until they take it down.", sentimentScore: 53, brandStance: "neutral", hostilePileOn: true, postedMinutesAgo: 52, scoredMinutesAgo: 49, isHidden: true },
  { id: "comment-5", pageId: "demo-ig-1", author: "Sam K.", text: "This is so bad. I won't buy it again.", sentimentScore: 26, brandStance: "critical", hostilePileOn: false, postedMinutesAgo: 75, scoredMinutesAgo: 71, isHidden: true },
  { id: "comment-6", pageId: "demo-ig-1", author: "Casey J.", text: "Is the decaf available online?", sentimentScore: 68, brandStance: "neutral", hostilePileOn: false, postedMinutesAgo: 112, scoredMinutesAgo: 109, isHidden: false },
  { id: "comment-7", pageId: "demo-page-2", author: "Robin D.", text: "This company is dishonest about its sourcing.", sentimentScore: 62, brandStance: "undermining", hostilePileOn: false, postedMinutesAgo: 143, scoredMinutesAgo: 140, isHidden: true },
  { id: "comment-8", pageId: "demo-page-2", author: "Avery S.", text: "My order was delayed again. Not happy.", sentimentScore: 32, brandStance: "critical", hostilePileOn: false, postedMinutesAgo: 181, scoredMinutesAgo: 178, isHidden: true },
  { id: "comment-9", pageId: "demo-page-2", author: "Jordan B.", text: "Great service at the new store.", sentimentScore: 89, brandStance: "supportive", hostilePileOn: false, postedMinutesAgo: 247, scoredMinutesAgo: 242, isHidden: false },
];

export interface DemoCommentDecision {
  readonly comment: DemoCommentExample;
  readonly reasons: readonly string[];
  readonly willHide: boolean;
}

export function previewDemoComments(config: Record<string, unknown>): DemoCommentDecision[] {
  const pageIds = Array.isArray(config.pageIds)
    ? config.pageIds.filter((id): id is string => typeof id === "string")
    : [];
  const conditions = config.conditions && typeof config.conditions === "object" && !Array.isArray(config.conditions)
    ? config.conditions as Record<string, unknown>
    : {};
  const stances = Array.isArray(conditions.brandStances) ? conditions.brandStances : [];
  const intents = Array.isArray(conditions.customIntents) ? conditions.customIntents : [];

  return DEMO_COMMENT_EXAMPLES.filter((comment) => pageIds.includes(comment.pageId)).map((comment) => {
    const reasons = [
      typeof conditions.sentimentMax === "number" && comment.sentimentScore <= conditions.sentimentMax
        ? "Negative tone" : null,
      stances.includes(comment.brandStance) ? "Undermines the brand" : null,
      intents.includes("custom-comment-scan") && comment.hostilePileOn ? "Hostile pile-on" : null,
    ].filter((reason): reason is string => reason !== null);
    const enabledChecks = Number(typeof conditions.sentimentMax === "number") + Number(stances.length > 0) + Number(intents.length > 0);
    return {
      comment,
      reasons,
      willHide: enabledChecks > 0 && (conditions.matchMode === "all" ? reasons.length === enabledChecks : reasons.length > 0),
    };
  });
}
