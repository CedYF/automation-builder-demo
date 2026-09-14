import { NextResponse } from "next/server";
import { countByStatus, deleteRule, getRule, listRules, upsertRule, type StoredRule } from "@/lib/mock/automation-store";

/**
 * Mock `/api/automation-rules`.
 *
 * Mirrors the response shapes the real route returns, because the ported client
 * code reads them directly: `{ rule }` for a single fetch, `{ rules }` for a
 * list, and `{ rule }` again from a save. Getting these shapes right is what lets
 * `automation-context.tsx` stay byte-identical to the app's copy.
 */

/** Parses an `id` query param, rejecting anything that is not a positive integer. */
function readId(request: Request): number | null {
  const raw = new URL(request.url).searchParams.get("id");
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: Request) {
  const id = readId(request);
  if (id !== null) {
    const rule = getRule(id);
    if (rule === null) return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    return NextResponse.json({ rule });
  }
  return NextResponse.json({ rules: listRules(), counts: { active: countByStatus("active") } });
}

/** Shared by POST (create) and PUT (update): the client sends the same payload. */
async function save(request: Request) {
  let body: Partial<StoredRule> & { id?: number };
  try {
    body = (await request.json()) as Partial<StoredRule> & { id?: number };
  } catch {
    return NextResponse.json({ error: "Request body was not valid JSON" }, { status: 400 });
  }

  if (body.id !== undefined) {
    const existing = getRule(body.id);
    if (!existing) return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    body = { ...existing, ...body };
  }

  if (typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json({ error: "An automation needs a name" }, { status: 400 });
  }

  const rule = upsertRule(body, new Date().toISOString());
  return NextResponse.json({ rule });
}

export async function POST(request: Request) {
  return save(request);
}

export async function PUT(request: Request) {
  return save(request);
}

export async function DELETE(request: Request) {
  const id = readId(request);
  if (id === null) return NextResponse.json({ error: "A numeric id is required" }, { status: 400 });
  if (!deleteRule(id)) return NextResponse.json({ error: "Automation not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
