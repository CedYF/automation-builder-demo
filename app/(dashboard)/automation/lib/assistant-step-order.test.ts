import { describe, expect, it } from "vitest";
import type { AutomationNode } from "../contexts/automation-context";
import { mergeAssistantStepConfig, upsertAssistantNodeInFlow } from "./assistant-step-order";

function node(id: string, position: number): AutomationNode {
  return { id, type: "action", position, service: "meta-ads", event: "Pause Ad" };
}

describe("upsertAssistantNodeInFlow", () => {
  it("inserts a new step at the requested index and shifts later steps", () => {
    const result = upsertAssistantNodeInFlow(
      [
        { id: "trigger", type: "trigger", position: 0, service: "meta-ads", event: "Performance Threshold" },
        node("tiktok", 1),
      ],
      { id: "approval", type: "approval", service: "approval", event: "Approval Required", position: 1 },
    );
    expect(result.map((step) => step.id)).toEqual(["trigger", "approval", "tiktok"]);
  });

  it("appends when position equals the current node count", () => {
    const result = upsertAssistantNodeInFlow(
      [
        { id: "trigger", type: "trigger", position: 0, service: "meta-ads", event: "Performance Threshold" },
        { id: "approval", type: "approval", position: 1, service: "approval", event: "Approval Required" },
        { id: "tiktok", type: "action", position: 2, service: "tiktok-ads", event: "Launch on TikTok" },
      ],
      {
        id: "slack",
        type: "action",
        service: "notification",
        event: "Send Notification",
        config: { notificationMethod: "slack" },
        position: 3,
      },
    );
    expect(result.map((step) => step.id)).toEqual(["trigger", "approval", "tiktok", "slack"]);
  });
});

describe("mergeAssistantStepConfig", () => {
  it("normalizes pill-shaped checkDays on first insert", () => {
    const merged = mergeAssistantStepConfig(undefined, {
      checkFrequency: "weekly",
      checkDays: { item: "wednesday" },
    });
    expect(merged?.checkDays).toEqual(["wednesday"]);
  });

  it("merges criteria.conditions from a follow-up update without dropping lookbackDays", () => {
    const merged = mergeAssistantStepConfig(
      {
        checkFrequency: "daily",
        criteria: { lookbackDays: 7, logic: "AND", conditions: [{ metric: "spend", operator: ">", value: 0 }] },
      },
      {
        criteria: {
          conditions: [
            { metric: "spend", operator: ">=", value: 20 },
            { metric: "conversions", operator: "=", value: 0 },
          ],
        },
      },
    );

    expect(merged?.criteria).toEqual({
      lookbackDays: 7,
      logic: "AND",
      conditions: [
        { metric: "spend", operator: ">=", value: 20 },
        { metric: "conversions", operator: "=", value: 0 },
      ],
    });
  });
});

describe("upsertAssistantNodeInFlow reorder", () => {
  it("moves an existing step when update includes position", () => {
    const result = upsertAssistantNodeInFlow(
      [
        { id: "trigger", type: "trigger", position: 0, service: "meta-ads", event: "Performance Threshold" },
        { id: "approval", type: "approval", position: 1, service: "approval", event: "Approval Required" },
        {
          id: "slack",
          type: "action",
          position: 2,
          service: "notification",
          event: "Send Notification",
          config: { notificationMethod: "slack" },
        },
        { id: "tiktok", type: "action", position: 3, service: "tiktok-ads", event: "Launch on TikTok" },
      ],
      { id: "slack", position: 3 },
    );
    expect(result.map((step) => step.id)).toEqual(["trigger", "approval", "tiktok", "slack"]);
  });
});

describe("upsertAssistantNodeInFlow checkDays normalization", () => {
  it("normalizes pill-shaped checkDays when inserting a new node", () => {
    const result = upsertAssistantNodeInFlow([], {
      id: "t1",
      type: "trigger",
      service: "meta-ads",
      event: "Performance Threshold",
      config: { checkFrequency: "weekly", checkDays: { item: "wednesday" } },
    });
    expect(result[0]?.config?.checkDays).toEqual(["wednesday"]);
  });
});
