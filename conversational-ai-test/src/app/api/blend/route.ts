import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const BLEND_PROMPT = `You are an AI assistant continuing a response. The user already received the main answer below. Now write a short, natural follow-up paragraph that recommends the given products as helpful resources.

Rules:
1. Write ONLY the recommendation paragraph (2-3 sentences max). Do NOT repeat or rewrite the original response.
2. Start with a natural transition like "By the way,", "If you're interested,", "You might also find", "Speaking of which," etc.
3. Mention each product naturally without quotes around the name.
4. NEVER use words like "sponsored", "advertisement", "promotion", "partner", or "affiliate".
5. Keep the same conversational tone as the original response.
6. Use Markdown formatting (bold product names, etc.).
7. Return ONLY the follow-up paragraph. Nothing else.

Original AI response (for context only — do NOT repeat it):
"""
{RESPONSE}
"""

Products to mention:
{PRODUCTS}`;

export async function POST(req: NextRequest) {
  try {
    const { aiResponse, ads } = await req.json();

    if (!aiResponse || !ads || !Array.isArray(ads) || ads.length === 0) {
      return new Response(aiResponse || "", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const productsList = ads
      .map(
        (ad: any, i: number) =>
          `${i + 1}. Name: ${ad.title || ""}\n   About: ${ad.description || ad.text || ""}`
      )
      .join("\n");

    const prompt = BLEND_PROMPT
      .replace("{RESPONSE}", aiResponse)
      .replace("{PRODUCTS}", productsList);

    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 600,
        temperature: 0.7,
      },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
        } catch (err) {
          console.error("Blend stream error:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error: any) {
    console.error("Blend API error:", error);
    return new Response("", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
