import { NextRequest, NextResponse } from "next/server";

const PROMPTADS_URL =
  process.env.PROMPTADS_BASE_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const { user_prompt } = await req.json();

    const res = await fetch(`${PROMPTADS_URL}/engine/match-ads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_prompt, n: 5 }),
    });

    if (!res.ok) {
      // No ads found is not an error — just return empty
      if (res.status === 404) {
        return NextResponse.json({ ads: [] });
      }
      throw new Error(`PromptAds API error: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json({ ads: data.ads || [] });
  } catch (error: any) {
    console.error("Ad match error:", error);
    return NextResponse.json({ ads: [] });
  }
}
