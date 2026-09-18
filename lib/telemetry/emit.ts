"use client";

import { FLOW_REVISION, PROMPT_VERSION, type TelemetryEvent } from "./events";
import { getSessionId, recordEvent } from "./store";

function newEventId(): string {
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Fills in the correlation/versioning fields every event shares, then persists it.
 * Callers only supply the event-specific fields plus `attemptId`/`turnId`.
 */
export function emitTelemetry<T extends Omit<TelemetryEvent, "eventId" | "timestamp" | "sessionId" | "flowRevision" | "promptVersion" | "source">>(
  event: T,
): void {
  const full = {
    ...event,
    eventId: newEventId(),
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    flowRevision: FLOW_REVISION,
    promptVersion: PROMPT_VERSION,
    source: "live",
  } as unknown as TelemetryEvent;
  recordEvent(full);
}
