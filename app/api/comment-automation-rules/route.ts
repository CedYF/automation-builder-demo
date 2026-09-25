import { NextResponse } from "next/server";
import { deleteCommentRule, getCommentRule, listCommentRules, saveCommentRule } from "@/lib/mock/comment-automation-store";

const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (id === null) return NextResponse.json({ rules: listCommentRules() }, { headers });
  const rule = getCommentRule(Number(id));
  if (!rule) return NextResponse.json({ error: "Comment automation not found" }, { status: 404, headers });
  return NextResponse.json({
    rule,
    groupId: rule.groupId,
    pageIds: rule.pageIds,
    pagePlatforms: rule.pagePlatforms,
    pageNames: rule.pageNames,
  }, { headers });
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => null);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ error: "Invalid comment automation" }, { status: 400, headers });
  }
  const body = input as Record<string, unknown>;
  if (body.action === "toggle") {
    const id = Number(body.id);
    const existing = getCommentRule(id);
    if (!existing) return NextResponse.json({ error: "Comment automation not found" }, { status: 404, headers });
    const status = body.status === "active" || body.status === "paused"
      ? body.status
      : existing.status === "active" ? "paused" : "active";
    return NextResponse.json({ rule: saveCommentRule({ id, status }) }, { headers });
  }
  const rule = saveCommentRule(body);
  return NextResponse.json({ rule }, { headers });
}

export async function PUT(request: Request) {
  const input = await request.json().catch(() => null);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ error: "Invalid comment automation" }, { status: 400, headers });
  }
  const rule = saveCommentRule(input as Record<string, unknown>);
  if (!rule) return NextResponse.json({ error: "Comment automation not found" }, { status: 404, headers });
  return NextResponse.json({ rule }, { headers });
}

export async function DELETE(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id") ?? listCommentRules().find((rule) => rule.groupId === params.get("groupId"))?.id;
  if (!id || !deleteCommentRule(Number(id))) {
    return NextResponse.json({ error: "Comment automation not found" }, { status: 404, headers });
  }
  return NextResponse.json({ ok: true }, { headers });
}
