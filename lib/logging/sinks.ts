import type { AgentEvent, LogSink } from "./types.ts";

const STORAGE_KEY = "automation-agent-events";
const MAX_LOCAL_EVENTS = 2000;

export class MemorySink implements LogSink {
  private events: AgentEvent[] = [];

  write(event: AgentEvent): void {
    this.events.push(event);
  }

  read(): readonly AgentEvent[] {
    return this.events;
  }

  clear(): void {
    this.events = [];
  }
}

/** Persists events in the browser so the dashboard can read what the demo just did. */
export class LocalStorageSink implements LogSink {
  private readonly fallback = new MemorySink();

  write(event: AgentEvent): void {
    const next = [...this.read(), event].slice(-MAX_LOCAL_EVENTS);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      this.fallback.write(event);
    }
  }

  read(): readonly AgentEvent[] {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw === null ? this.fallback.read() : (JSON.parse(raw) as AgentEvent[]);
    } catch {
      return this.fallback.read();
    }
  }

  clear(): void {
    this.fallback.clear();
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      return;
    }
  }
}

/**
 * NOT IMPLEMENTED. This is where the real sink attaches.
 *
 * Production ships these events to the `automation-agent` Axiom dataset from the server
 * (never the browser, so the ingest token stays secret): batch events, POST them to
 * `https://api.axiom.co/v1/datasets/automation-agent/ingest`, and hash `userId` with a
 * salted SHA-256 before the event leaves the process. This demo must not send events anywhere.
 */
export class AxiomSink implements LogSink {
  write(_event: AgentEvent): void {
    throw new Error("AxiomSink is a stub: the demo never sends events to Axiom.");
  }

  read(): readonly AgentEvent[] {
    throw new Error("AxiomSink is a stub: read events from the mock sink or the fixture file.");
  }

  clear(): void {
    throw new Error("AxiomSink is a stub.");
  }
}
