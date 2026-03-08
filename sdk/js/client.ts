/**
 * PromptAds AI — JavaScript/TypeScript SDK Client
 *
 * Zero dependencies. Uses native `fetch`.
 *
 * @example
 * ```ts
 * const client = new PromptAdsClient({ baseUrl: "http://localhost:8000" });
 * const ad = await client.getAd("best coding laptop");
 * console.log(ad.title, ad.text);
 * ```
 */

// ── Types ──────────────────────────────────────────────────────────────

/** Configuration for the PromptAds client. */
export interface PromptAdsConfig {
  /** Backend API base URL. Defaults to http://localhost:8000 */
  baseUrl?: string;
  /** Bearer token for authenticated requests (optional). */
  apiKey?: string;
  /** Request timeout in milliseconds. Defaults to 10 000. */
  timeout?: number;
}

/** A matched ad returned by the engine. */
export interface Ad {
  ad_id: string;
  title: string;
  text: string;
  relevance_score: number;
  bid_amount: number;
  final_score: number;
}

/** Options for single-ad matching. */
export interface MatchOptions {
  /** Number of candidates to consider. Default: 10 */
  topK?: number;
  /** Weight for semantic relevance (0–1). Default: 0.70 */
  relevanceWeight?: number;
  /** Weight for bid amount (0–1). Default: 0.30 */
  bidWeight?: number;
}

/** Options for multi-ad matching. */
export interface MatchMultiOptions extends MatchOptions {
  /** Number of ads to return. Default: 3 */
  n?: number;
}

/** Response from the multi-ad endpoint. */
export interface MatchMultiResult {
  ads: Ad[];
  total_candidates: number;
  pipeline_latency_ms: number;
}

// ── Error ──────────────────────────────────────────────────────────────

export class PromptAdsError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PromptAdsError";
    this.status = status;
  }
}

// ── Client ─────────────────────────────────────────────────────────────

export class PromptAdsClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(config: PromptAdsConfig = {}) {
    this.baseUrl = (config.baseUrl ?? "http://localhost:8000").replace(
      /\/$/,
      ""
    );
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 10_000;
  }

  // ── Core methods ───────────────────────────────────────────────────

  /**
   * Match a user prompt to the single best contextual ad.
   *
   * @param prompt  The user's natural-language query
   * @param options Fine-tuning parameters
   * @returns       The best-matching ad
   *
   * @example
   * ```ts
   * const ad = await client.getAd("best coding laptop");
   * console.log(`[Sponsored] ${ad.title}\n${ad.text}`);
   * ```
   */
  async getAd(prompt: string, options: MatchOptions = {}): Promise<Ad> {
    return this.post<Ad>("/engine/match-ad", {
      user_prompt: prompt,
      ...(options.topK != null && { top_k: options.topK }),
      ...(options.relevanceWeight != null && {
        relevance_weight: options.relevanceWeight,
      }),
      ...(options.bidWeight != null && { bid_weight: options.bidWeight }),
    });
  }

  /**
   * Match a user prompt to multiple contextual ads.
   *
   * @param prompt  The user's natural-language query
   * @param options Fine-tuning parameters (includes `n` for count)
   * @returns       Ranked list of matching ads
   *
   * @example
   * ```ts
   * const result = await client.getAds("best coding laptop", { n: 3 });
   * result.ads.forEach(ad => console.log(ad.title));
   * ```
   */
  async getAds(
    prompt: string,
    options: MatchMultiOptions = {}
  ): Promise<MatchMultiResult> {
    return this.post<MatchMultiResult>("/engine/match-ads", {
      user_prompt: prompt,
      ...(options.n != null && { n: options.n }),
      ...(options.topK != null && { top_k: options.topK }),
      ...(options.relevanceWeight != null && {
        relevance_weight: options.relevanceWeight,
      }),
      ...(options.bidWeight != null && { bid_weight: options.bidWeight }),
    });
  }

  // ── Analytics ──────────────────────────────────────────────────────

  /** Record an impression for an ad. */
  async trackImpression(adId: string): Promise<void> {
    await this.post("/analytics/impression", { ad_id: adId });
  }

  /** Record a click for an ad. */
  async trackClick(adId: string): Promise<void> {
    await this.post("/analytics/click", { ad_id: adId });
  }

  // ── Internal ───────────────────────────────────────────────────────

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new PromptAdsError(
          err.detail ?? `HTTP ${res.status}`,
          res.status
        );
      }

      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

// ── Formatting helpers ─────────────────────────────────────────────────

/** Format an ad as a plain-text sponsored block. */
export function formatAdAsText(ad: Ad): string {
  return `\n[Sponsored] ${ad.title}\n${ad.text}\n`;
}

/** Format an ad as a Markdown blockquote. */
export function formatAdAsMarkdown(ad: Ad): string {
  return `\n> **Sponsored**\n> **${ad.title}**\n> ${ad.text}\n`;
}
