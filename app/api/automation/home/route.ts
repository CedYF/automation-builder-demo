import { NextResponse } from "next/server";
import { buildDemoHomePayload } from "@/lib/mock/home-payload";
export async function GET() {
  return NextResponse.json(buildDemoHomePayload(), { headers: { "Cache-Control": "no-store" } });
}
