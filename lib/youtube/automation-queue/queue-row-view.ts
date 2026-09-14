import { MAX_UPLOAD_ATTEMPTS } from "./backoff";

/**
 * Presentation rules for one queued upload.
 *
 * Kept pure and separate from the panel because the interesting decisions are
 * about meaning, not markup: a waiting row must say *when*, or it is
 * indistinguishable from a stuck one, and a permanent failure must not look like
 * something that will eventually resolve itself.
 */

export type QueueItemStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export interface QueueRow {
  itemId: number;
  taskId: number;
  fileName: string;
  destination: string;
  /** Channel this row targets, named where the connection still records a title. */
  channelLabel: string | null;
  status: QueueItemStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  errorText: string | null;
  failureKind: string | null;
  videoId: string | null;
  videoUrl: string | null;
  createdAt: string;
}

export type QueueTone = "pending" | "active" | "good" | "warn" | "bad" | "muted";

export interface QueueStatusView {
  label: string;
  tone: QueueTone;
}

/** State as a word plus a tone, so what needs attention reads at a glance. */
export function describeQueueStatus(
  row: Pick<QueueRow, "status" | "attemptCount" | "failureKind" | "videoId">,
): QueueStatusView {
  switch (row.status) {
    case "running":
      return { label: "Uploading", tone: "active" };
    case "succeeded":
      // A success with no video id is not a success anyone can act on: there is
      // nothing to open and nothing to find. Saying "Uploaded" for it sends
      // people hunting through channels for a video that was never created.
      return row.videoId ? { label: "Uploaded", tone: "good" } : { label: "No video created", tone: "warn" };
    case "canceled":
      return { label: "Canceled", tone: "muted" };
    case "failed":
      // A permanent failure will never resolve on its own; saying "Failed" invites
      // someone to wait for a retry that is never coming.
      return row.failureKind === "permanent"
        ? { label: "Can't upload", tone: "bad" }
        : { label: "Failed", tone: "bad" };
    default:
      return row.attemptCount > 0 ? { label: "Retrying", tone: "warn" } : { label: "Queued", tone: "pending" };
  }
}

/**
 * When this row is next going to be touched.
 *
 * @param row - The queue row.
 * @param now - Current time, injected so this stays testable.
 */
export function describeQueueWait(
  row: Pick<QueueRow, "status" | "attemptCount" | "maxAttempts" | "nextAttemptAt">,
  now: Date,
): string {
  if (row.status === "succeeded" || row.status === "failed" || row.status === "canceled") return "—";
  if (row.status === "running") return "in progress";
  if (!row.nextAttemptAt) return "next in queue";

  const due = new Date(row.nextAttemptAt);
  if (Number.isNaN(due.getTime()) || due.getTime() <= now.getTime()) return "next in queue";

  const minutes = Math.max(1, Math.round((due.getTime() - now.getTime()) / 60_000));
  const when = minutes < 60 ? `in ${minutes} min` : `in ${Math.round(minutes / 60)}h`;
  const attempts = row.maxAttempts || MAX_UPLOAD_ATTEMPTS;
  return row.attemptCount > 0 ? `${when} · try ${row.attemptCount + 1} of ${attempts}` : when;
}

/** Only a row that has not started can be pulled out of the queue cleanly. */
export function canCancel(row: Pick<QueueRow, "status">): boolean {
  return row.status === "queued";
}

/** A failed row can be put back; a permanent failure will just fail again. */
export function canRetry(row: Pick<QueueRow, "status">): boolean {
  return row.status === "failed";
}

/**
 * Where this video is going, specifically.
 *
 * "YouTube channel" is not an answer when a company has several connected, so
 * name the channel whenever it is known and fall back to saying the default will
 * be used rather than implying a choice that was never made.
 */
export function describeQueueDestination(row: Pick<QueueRow, "destination" | "channelLabel">): string {
  if (row.destination === "ad_storage") return "Google Ads storage";
  if (row.channelLabel) return row.channelLabel;
  return "Default channel";
}

/**
 * A link to the finished video.
 *
 * Falls back to building the watch URL from the id, because api-admanage only
 * returns `youtubeUrl` on some paths and a bare id leaves someone hunting
 * through channel tabs to answer "where did it go" — vertical uploads land under
 * Shorts rather than Videos, so they are easy to believe missing.
 */
export function queueRowWatchUrl(row: Pick<QueueRow, "videoUrl" | "videoId">): string | null {
  if (row.videoUrl) return row.videoUrl;
  return row.videoId ? `https://www.youtube.com/watch?v=${row.videoId}` : null;
}

/** Counts that belong above the table rather than in it. */
export function summarizeQueue(rows: readonly QueueRow[]): {
  waiting: number;
  uploading: number;
  uploaded: number;
  failed: number;
} {
  return {
    waiting: rows.filter((row) => row.status === "queued").length,
    uploading: rows.filter((row) => row.status === "running").length,
    uploaded: rows.filter((row) => row.status === "succeeded").length,
    failed: rows.filter((row) => row.status === "failed").length,
  };
}
