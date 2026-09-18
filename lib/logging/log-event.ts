import { hashUserId } from "./hash.ts";
import { LocalStorageSink, MemorySink } from "./sinks.ts";
import { AXIOM_DATASET, type AgentEvent, type AgentEventInput, type LogSink } from "./types.ts";

let activeSink: LogSink | null = null;

function defaultSink(): LogSink {
  return typeof window === "undefined" ? new MemorySink() : new LocalStorageSink();
}

export function getSink(): LogSink {
  activeSink ??= defaultSink();
  return activeSink;
}

export function setSink(sink: LogSink): void {
  activeSink = sink;
}

/**
 * Records one agent event. The single entry point for emission: call sites pass a raw
 * `userId`, and only its hash is persisted.
 */
export function logEvent(input: AgentEventInput): AgentEvent {
  const { userId, time, ...rest } = input;
  const event: AgentEvent = {
    ...rest,
    _time: (time ?? new Date()).toISOString(),
    dataset: AXIOM_DATASET,
    userIdHash: hashUserId(userId),
  };
  getSink().write(event);
  return event;
}
