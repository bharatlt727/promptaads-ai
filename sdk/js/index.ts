/**
 * PromptAds AI — JavaScript / TypeScript SDK
 *
 * Get contextual ads for AI apps in one function call:
 *
 * ```ts
 * import { getAd } from "promptads-ai";
 *
 * const ad = await getAd("best coding laptop");
 * console.log(ad);
 * ```
 *
 * Or use the full client for more control:
 *
 * ```ts
 * import { PromptAdsClient } from "promptads-ai";
 *
 * const client = new PromptAdsClient({ baseUrl: "https://api.promptads.ai" });
 * const ad = await client.getAd("best coding laptop", { topK: 20 });
 * ```
 *
 * @module promptads-ai
 */

export {
  PromptAdsClient,
  PromptAdsError,
  formatAdAsText,
  formatAdAsMarkdown,
} from "./client";

export type {
  Ad,
  PromptAdsConfig,
  MatchOptions,
  MatchMultiOptions,
  MatchMultiResult,
} from "./client";

import { PromptAdsClient } from "./client";
import type { Ad, PromptAdsConfig, MatchOptions, MatchMultiOptions, MatchMultiResult } from "./client";

// ── Singleton for the simple API ────────────────────────────────────────

let _client: PromptAdsClient | null = null;

/**
 * Configure the default client used by `getAd()` / `getAds()`.
 *
 * Call once at startup:
 * ```ts
 * import { configure } from "promptads-ai";
 * configure({ baseUrl: "https://api.promptads.ai", apiKey: "pk_live_xxx" });
 * ```
 */
export function configure(config: PromptAdsConfig): void {
  _client = new PromptAdsClient(config);
}

function defaultClient(): PromptAdsClient {
  if (!_client) _client = new PromptAdsClient();
  return _client;
}

/**
 * Get the single best contextual ad for a prompt.
 *
 * @example
 * ```ts
 * import { getAd } from "promptads-ai";
 *
 * const ad = await getAd("best coding laptop");
 * console.log(ad);
 * // { ad_id: "...", title: "...", text: "...", relevance_score: 0.87, ... }
 * ```
 */
export async function getAd(
  prompt: string,
  options?: MatchOptions
): Promise<Ad> {
  return defaultClient().getAd(prompt, options);
}

/**
 * Get multiple contextual ads for a prompt.
 *
 * @example
 * ```ts
 * import { getAds } from "promptads-ai";
 *
 * const result = await getAds("best coding laptop", { n: 3 });
 * result.ads.forEach(ad => console.log(ad.title));
 * ```
 */
export async function getAds(
  prompt: string,
  options?: MatchMultiOptions
): Promise<MatchMultiResult> {
  return defaultClient().getAds(prompt, options);
}

/**
 * Track an ad impression.
 */
export async function trackImpression(adId: string): Promise<void> {
  return defaultClient().trackImpression(adId);
}

/**
 * Track an ad click.
 */
export async function trackClick(adId: string): Promise<void> {
  return defaultClient().trackClick(adId);
}
