/**
 * Pending drafted replies for one per-page comment-automation rule, as
 * `/api/comment-automation-approvals` returns them.
 *
 * Lives beside the other CommentsServer request types rather than in the
 * `/automation` feature folder: the API route, the home list and the
 * notifications history all read it, so no one surface owns it.
 */
export interface CommentApprovalSummary {
  readonly ruleId: number;
  readonly pendingCount: number;
  /** ISO timestamp of the oldest draft on that rule. */
  readonly oldestCreatedAt: string;
  readonly pageIds: readonly string[];
}
