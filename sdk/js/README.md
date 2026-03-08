# PromptAds AI — JavaScript / TypeScript SDK

Contextual ads for AI-powered apps. Zero dependencies, TypeScript-first, works in Node.js 18+.

## Install

```bash
npm install promptads-ai
```

## Quick Start

```ts
import { getAd } from "promptads-ai";

const ad = await getAd("best coding laptop");
console.log(ad.title); // "MacBook Pro M3 — 30% off"
console.log(ad.text); // "The fastest laptop for developers..."
```

## Configuration

### Environment Variables

```bash
PROMPTADS_BASE_URL=http://localhost:8000   # API server URL
PROMPTADS_API_KEY=pk_live_xxx              # Optional API key
```

### Explicit Configuration

```ts
import { configure } from "promptads-ai";

configure({
  baseUrl: "https://api.promptads.ai",
  apiKey: "pk_live_xxx",
  timeout: 5000, // ms
});
```

## API

### `getAd(prompt, options?)`

Get the single best contextual ad for a user prompt.

```ts
const ad = await getAd("best coding laptop", {
  topK: 20, // Candidates to consider (default: 10)
  relevanceWeight: 0.8, // Weight for relevance score (default: 0.70)
  bidWeight: 0.2, // Weight for bid amount (default: 0.30)
});
```

Returns:

```ts
{
  ad_id: string;
  title: string;
  text: string;
  relevance_score: number;
  bid_amount: number;
  final_score: number;
}
```

### `getAds(prompt, options?)`

Get multiple contextual ads for a user prompt.

```ts
const result = await getAds("best coding laptop", { n: 3 });
result.ads.forEach((ad) => console.log(ad.title));
```

Returns:

```ts
{
  ads: Ad[];
  total_candidates: number;
  pipeline_latency_ms: number;
}
```

### `trackImpression(adId)` / `trackClick(adId)`

Track ad interactions for analytics.

```ts
import { trackImpression, trackClick } from "promptads-ai";

await trackImpression(ad.ad_id);
await trackClick(ad.ad_id);
```

### `PromptAdsClient` (Advanced)

Full client class for custom configurations and dependency injection.

```ts
import { PromptAdsClient } from "promptads-ai";

const client = new PromptAdsClient({
  baseUrl: "https://api.promptads.ai",
  apiKey: "pk_live_xxx",
  timeout: 5000,
});

const ad = await client.getAd("best coding laptop");
```

### Formatting Helpers

```ts
import { formatAdAsText, formatAdAsMarkdown } from "promptads-ai";

console.log(formatAdAsText(ad));
// [Sponsored] MacBook Pro M3 — 30% off
// The fastest laptop for developers...

console.log(formatAdAsMarkdown(ad));
// **[Sponsored]** MacBook Pro M3 — 30% off
//
// The fastest laptop for developers...
```

## Error Handling

```ts
import { getAd, PromptAdsError } from "promptads-ai";

try {
  const ad = await getAd("best coding laptop");
} catch (error) {
  if (error instanceof PromptAdsError) {
    console.error(`API Error (${error.status}): ${error.message}`);
  }
}
```

## License

MIT
