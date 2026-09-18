import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateFixtureEvents, toNdjson } from "./fixture-generator";
import { hashUserId } from "./hash";
import { logEvent, setSink } from "./log-event";
import { AxiomSink, MemorySink } from "./sinks";
import type { AgentEvent } from "./types";

const fixturePath = new URL("../../fixtures/axiom-events.ndjson", import.meta.url);
const committed = readFileSync(fixturePath, "utf8");
const events = committed
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as AgentEvent);

function distinctUsers(matching: readonly AgentEvent[]): number {
  return new Set(matching.map((event) => event.userIdHash)).size;
}

describe("axiom-events fixture", () => {
  it("is the current output of the generator", () => {
    expect(committed).toBe(toNdjson(generateFixtureEvents()));
  });

  it("has enough volume", () => {
    expect(events.length).toBeGreaterThanOrEqual(300);
    expect(new Set(events.map((event) => event.conversationId)).size).toBeGreaterThanOrEqual(40);
  });

  it("only carries the automation-agent dataset and hashed user ids", () => {
    expect(events.every((event) => event.dataset === "automation-agent")).toBe(true);
    expect(events.every((event) => /^u_[0-9a-f]{16}$/.test(event.userIdHash))).toBe(true);
    expect(committed).not.toMatch(/user-\d|@/);
  });

  it("plants duplicate turn deliveries under one turnId", () => {
    const completed = events.filter((event) => event.event === "turn_completed");
    const attemptsPerTurn = new Map<string, Set<string>>();
    for (const event of completed) {
      const key = `${event.conversationId}/${event.turnId}`;
      attemptsPerTurn.set(key, (attemptsPerTurn.get(key) ?? new Set()).add(event.attemptId));
    }
    expect([...attemptsPerTurn.values()].filter((attempts) => attempts.size >= 2).length).toBeGreaterThanOrEqual(4);
  });

  it("plants Pinterest requests on Meta accounts that finished as if they worked", () => {
    const mismatched = events.filter((event) => event.errorCategory === "platform_mismatch");
    expect(mismatched.length).toBeGreaterThanOrEqual(5);
    expect(mismatched.every((event) => event.requestedPlatform === "pinterest" && event.accountPlatform === "meta")).toBe(true);
    expect(mismatched.every((event) => event.outcome === "ok")).toBe(true);
    expect(distinctUsers(mismatched)).toBeLessThan(mismatched.length);
  });

  it("plants repeated explain requests from several customers", () => {
    const explain = events.filter((event) => event.event === "explain_requested");
    expect(distinctUsers(explain)).toBeGreaterThanOrEqual(4);
    expect(explain.length).toBeGreaterThan(distinctUsers(explain));
  });

  it("plants schedule and timezone losses", () => {
    expect(events.filter((event) => event.errorCategory === "schedule_timezone_lost").length).toBeGreaterThanOrEqual(3);
  });

  it("drops customers before save and before activate", () => {
    const reached = (name: AgentEvent["event"]): number =>
      new Set(events.filter((event) => event.event === name).map((event) => event.conversationId)).size;
    expect(reached("draft_created")).toBeGreaterThan(reached("flow_saved"));
    expect(reached("flow_saved")).toBeGreaterThan(reached("flow_activated"));
    expect(reached("flow_activated")).toBeGreaterThan(reached("run_succeeded"));
  });
});

describe("logEvent", () => {
  it("persists a hash, never the raw user id", () => {
    const sink = new MemorySink();
    setSink(sink);
    logEvent({
      conversationId: "c_test",
      turnId: "t1",
      attemptId: "a1",
      userId: "user-raw",
      workspaceId: "ws_demo",
      accountPlatform: "meta",
      requestedPlatform: "meta",
      event: "prompt_submitted",
      outcome: "ok",
      flowRevision: 0,
      model: "agent-model-v2",
      promptVersion: "pv-2026-09",
    });
    const [written] = sink.read();
    expect(written.userIdHash).toBe(hashUserId("user-raw"));
    expect(JSON.stringify(written)).not.toContain("user-raw");
    expect(written.dataset).toBe("automation-agent");
  });

  it("keeps the Axiom sink unimplemented so nothing can be sent", () => {
    expect(() => new AxiomSink().write({} as AgentEvent)).toThrow(/stub/);
  });
});
