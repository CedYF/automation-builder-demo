"use client";

import type { TelemetryEvent } from "./events";

/**
 * Local persistence for the automation-agent telemetry.
 *
 * Storage choice: `localStorage`, scoped to this browser. It needs no server,
 * no accounts and no keys, which matches the brief ("reviewers need no
 * accounts or keys to see data"). The trade-off: it is per-browser (not
 * shared across tabs/devices) and capped in size, which is why events are
 * capped at `MAX_EVENTS` (oldest dropped first) and free text is redacted
 * before it is ever written (see `redactText`).
 *
 * Retention: events live until the browser clears site storage or a reviewer
 * clicks "Reset fixtures" (see `resetToFixtures`), which wipes everything and
 * reloads the seeded demo dataset. There is no TTL — this is a demo, not a
 * production retention policy.
 *
 * Production sink: see `EVENT_SINK_NOTE` in `events.ts`.
 */

const STORAGE_KEY = "automation_telemetry_events_v1";
const SESSION_KEY = "automation_telemetry_session_id_v1";
const MAX_EVENTS = 4000;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeTelemetry(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Small, dependency-free deterministic hash — good enough to spot repeated content, not to invert it. */
function hashText(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Redacts free-text customer content before it is ever persisted. We keep
 * only a length and a hash — enough to notice "the customer asked the same
 * thing three times" without storing what they said. This runs here, not in
 * the UI layer, so nothing bypasses it on the way to storage or export.
 */
export function redactText(raw: string): { readonly length: number; readonly hash: string } {
  return { length: raw.length, hash: hashText(raw) };
}

let sessionIdCache: string | null = null;

/** One id per browser tab session; persisted so a reload doesn't fragment an attempt's session. */
export function getSessionId(): string {
  if (sessionIdCache) return sessionIdCache;
  if (!isBrowser()) return "server-session";
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) {
      sessionIdCache = existing;
      return existing;
    }
  } catch {
    // storage unavailable (private mode, disabled) — fall through to an ephemeral id
  }
  const fresh = `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  sessionIdCache = fresh;
  try {
    window.localStorage.setItem(SESSION_KEY, fresh);
  } catch {
    // best effort
  }
  return fresh;
}

function readAll(): TelemetryEvent[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as TelemetryEvent[]) : [];
  } catch {
    return [];
  }
}

function writeAll(events: readonly TelemetryEvent[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // best effort — a full/blocked store just means this event is lost, not a crash
  }
  notify();
}

/** Appends one event, de-duplicating by `eventId` so a replayed delivery cannot double-count. */
export function recordEvent(event: TelemetryEvent): void {
  const existing = readAll();
  if (existing.some((entry) => entry.eventId === event.eventId)) return;
  writeAll([...existing, event]);
}

export function recordEvents(events: readonly TelemetryEvent[]): void {
  const existing = readAll();
  const knownIds = new Set(existing.map((entry) => entry.eventId));
  const additions = events.filter((event) => !knownIds.has(event.eventId));
  if (additions.length === 0) return;
  writeAll([...existing, ...additions]);
}

export function listEvents(): TelemetryEvent[] {
  return readAll();
}

export function clearEvents(): void {
  writeAll([]);
}

/** Wipes local telemetry and reloads the bundled fixture dataset — the "reset fixtures" affordance. */
export function resetToFixtures(fixtureEvents: readonly TelemetryEvent[]): void {
  writeAll([...fixtureEvents]);
}
