/**
 * Example: AI Chatbot with PromptAds Contextual Ads
 *
 * A simple command-line chatbot that injects relevant ads into responses.
 * This demonstrates how to integrate PromptAds into any AI application.
 *
 * Usage:
 *   export PROMPTADS_BASE_URL=http://localhost:8000
 *   npx tsx index.ts
 */

import { getAd, trackImpression, PromptAdsError, formatAdAsText } from "promptads-ai";
import * as readline from "node:readline";

// ── Simulated AI response ───────────────────────────────────────────────

function generateAIResponse(prompt: string): string {
  const responses: Record<string, string> = {
    laptop: "For coding, I'd recommend looking at laptops with at least 16GB RAM and a fast SSD.",
    coffee: "A good cup of coffee starts with freshly ground beans and filtered water.",
    cloud: "Cloud hosting options range from simple PaaS like Heroku to full IaaS like AWS.",
  };

  const key = Object.keys(responses).find((k) => prompt.toLowerCase().includes(k));
  return responses[key ?? ""] ?? "That's a great question! Let me think about that for you.";
}

// ── Main loop ───────────────────────────────────────────────────────────

async function formatResponseWithAd(aiResponse: string, prompt: string): Promise<string> {
  try {
    const ad = await getAd(prompt);
    await trackImpression(ad.ad_id);

    return [
      aiResponse,
      "",
      "───────────────────────────",
      `📢 ${ad.title}`,
      `   ${ad.text}`,
      "───────────────────────────",
    ].join("\n");
  } catch (error) {
    // If ad matching fails, just return the AI response without an ad.
    return aiResponse;
  }
}

async function main(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("🤖 AI Chatbot with PromptAds (type 'quit' to exit)\n");

  const ask = (): void => {
    rl.question("You: ", async (prompt) => {
      const trimmed = prompt.trim();
      if (!trimmed || ["quit", "exit", "q"].includes(trimmed.toLowerCase())) {
        console.log("Goodbye!");
        rl.close();
        return;
      }

      // 1. Generate the AI response
      const aiResponse = generateAIResponse(trimmed);

      // 2. Inject a contextual ad
      const fullResponse = await formatResponseWithAd(aiResponse, trimmed);

      console.log(`\nAssistant: ${fullResponse}\n`);
      ask();
    });
  };

  ask();
}

main();
