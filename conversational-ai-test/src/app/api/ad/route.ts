import { NextRequest, NextResponse } from "next/server";

const PROMPTADS_URL =
  process.env.PROMPTADS_BASE_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const { user_prompt } = await req.json();

    const res = await fetch(`${PROMPTADS_URL}/engine/match-ad`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_prompt }),
    });

    if (!res.ok) {
      // No ad found is not an error — just return null
      if (res.status === 404) {
        return NextResponse.json({ ad: null });
      }
      throw new Error(`PromptAds API error: ${res.status}`);
    }

    const ad = await res.json();
    return NextResponse.json({ ad });
  } catch (error: any) {
    console.error("Ad match error:", error);
    return NextResponse.json({ ad: null });
  }
}
