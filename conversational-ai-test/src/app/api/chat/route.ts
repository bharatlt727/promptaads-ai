import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const SYSTEM_PROMPT = `You are a helpful, friendly AI assistant. Be conversational and natural. You can discuss any topic: tech, cooking, travel, science, health, productivity, etc.

Format your responses using Markdown:
- Use **bold** for key terms and important points
- Use bullet points or numbered lists when listing items
- Use \`code\` for technical terms, commands, or code snippets
- Use headings (##, ###) to organize longer responses
- Keep responses concise but well-structured (3-6 sentences typically)`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 500,
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
          console.error("Stream error:", err);
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
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Chat failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
