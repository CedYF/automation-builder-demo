import { describe, expect, it } from "vitest";
import { buildDemoHomePayload } from "./home-payload";
import { POST, PUT, DELETE } from "@/app/api/automation-rules/route";

describe("refreshed home and mock storage contract", () => {
  it("reflects create, partial rename, toggle and delete without losing the flow", async () => {
    const request = (method: string, body: unknown) => new Request("http://localhost/api/automation-rules", {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const created = await POST(request("POST", { name: "Contract test", status: "paused", flow: {
      nodes: [{ id: "trigger-test", type: "trigger", service: "meta-ads", event: "Performance Threshold" }],
    } }));
    expect(created.status).toBe(200);
    const { rule } = await created.json();
    try {
      const renamed = await PUT(request("PUT", { id: rule.id, name: "Renamed contract" }));
      expect(renamed.status).toBe(200);
      const toggled = await PUT(request("PUT", { id: rule.id, status: "active" }));
      const updated = (await toggled.json()).rule;
      expect(updated.flow.nodes).toEqual(rule.flow.nodes);
      const row = buildDemoHomePayload().rows.find((entry) => entry.id === rule.id);
      expect(row).toMatchObject({ name: "Renamed contract", enabled: true });
      expect(buildDemoHomePayload().stats.runsCompleted).toBe(0);
    } finally {
      const deleted = await DELETE(new Request(`http://localhost/api/automation-rules?id=${rule.id}`, { method: "DELETE" }));
      expect(deleted.status).toBe(200);
    }
    expect(buildDemoHomePayload().rows.some((entry) => entry.id === rule.id)).toBe(false);
  });

  it("rejects updates to missing rules", async () => {
    const response = await PUT(new Request("http://localhost/api/automation-rules", {
      method: "PUT", body: JSON.stringify({ id: 999999, status: "active" }),
    }));
    expect(response.status).toBe(404);
  });
});
