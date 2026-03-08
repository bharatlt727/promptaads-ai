import { NextRequest, NextResponse } from "next/server";

const PROMPTADS_URL =
  process.env.PROMPTADS_BASE_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const { ad_id, event } = await req.json();

    const endpoint =
      event === "click" ? "/analytics/click" : "/analytics/impression";

    await fetch(`${PROMPTADS_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ad_id }),
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Analytics error:", error);
    return NextResponse.json({ ok: false });
  }
}
