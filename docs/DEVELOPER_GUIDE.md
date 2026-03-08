# PromptAds AI — Developer Integration Guide

How to add contextual ads to your AI application in under 5 minutes.

---

## Table of Contents

1. [Overview](#overview)
2. [Install the SDK](#install-the-sdk)
3. [Basic Integration](#basic-integration)
4. [Advanced Configuration](#advanced-configuration)
5. [Tracking Impressions & Clicks](#tracking-impressions--clicks)
6. [Formatting Ads](#formatting-ads)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)
9. [Framework Examples](#framework-examples)

---

## Overview

PromptAds works with **any** AI application — chatbots, copilots, search
agents, content generators. The integration has three steps:

1. Send the user's prompt to PromptAds
2. Get back a contextual ad
3. Append it to your AI response

No user data is collected. Ads are matched purely on prompt content.

## Install the SDK

**JavaScript / TypeScript:**

    npm install promptads-ai

**Python:**

    pip install promptads-ai

Both SDKs have **zero dependencies** — the JS SDK uses native `fetch`,
the Python SDK uses only the standard library (`urllib.request`).

## Basic Integration

### JavaScript / TypeScript

```typescript
import { getAd } from "promptads-ai";

// Inside your chat handler
async function handleMessage(userPrompt: string): Promise<string> {
  // 1. Generate your AI response (OpenAI, Anthropic, etc.)
  const aiResponse = await generateAIResponse(userPrompt);

  // 2. Get a contextual ad
  const ad = await getAd(userPrompt);

  // 3. Append it
  return `${aiResponse}\n\n---\nSponsored: ${ad.title}\n${ad.text}`;
}
```

### Python

```python
from promptads_ai import get_ad

def handle_message(user_prompt: str) -> str:
    # 1. Generate your AI response
    ai_response = generate_ai_response(user_prompt)

    # 2. Get a contextual ad
    ad = get_ad(user_prompt)

    # 3. Append it
    return f"{ai_response}\n\n---\nSponsored: {ad.title}\n{ad.text}"
```

## Advanced Configuration

### Environment Variables

Set these before your app starts:

    PROMPTADS_BASE_URL=http://localhost:8000    # Your PromptAds server
    PROMPTADS_API_KEY=pk_live_xxx               # Optional API key

### Explicit Configuration

**JavaScript:**

```typescript
import { configure } from "promptads-ai";

configure({
  baseUrl: "https://api.promptads.ai",
  apiKey: "pk_live_xxx",
  timeout: 5000, // milliseconds
});
```

**Python:**

```python
import promptads_ai

promptads_ai.configure(
    base_url="https://api.promptads.ai",
    api_key="pk_live_xxx",
    timeout=5,  # seconds
)
```

### Tuning Relevance vs Revenue

Control how much relevance vs bid amount matters:

```typescript
// High relevance mode — prioritize user experience
const ad = await getAd("best coding laptop", {
  relevanceWeight: 0.9,
  bidWeight: 0.1,
});

// Balanced mode (default)
const ad = await getAd("best coding laptop", {
  relevanceWeight: 0.7,
  bidWeight: 0.3,
});

// Revenue mode — prioritize higher-paying ads
const ad = await getAd("best coding laptop", {
  relevanceWeight: 0.5,
  bidWeight: 0.5,
});
```

### Multiple Ads

```typescript
import { getAds } from "promptads-ai";

const result = await getAds("best coding laptop", { n: 3 });

for (const ad of result.ads) {
  console.log(ad.title, ad.final_score);
}

console.log(`Matched from ${result.total_candidates} candidates`);
console.log(`Pipeline took ${result.pipeline_latency_ms}ms`);
```

## Tracking Impressions & Clicks

Track when users see and interact with ads for analytics:

```typescript
import { getAd, trackImpression, trackClick } from "promptads-ai";

const ad = await getAd(userPrompt);

// Track when the ad is shown to the user
await trackImpression(ad.ad_id);

// Track when the user clicks the ad link
await trackClick(ad.ad_id);
```

```python
from promptads_ai import get_ad, track_impression, track_click

ad = get_ad(user_prompt)
track_impression(ad.ad_id)   # User saw the ad
track_click(ad.ad_id)        # User clicked the ad
```

## Formatting Ads

### JavaScript

```typescript
import { getAd, formatAdAsText, formatAdAsMarkdown } from "promptads-ai";

const ad = await getAd("best coding laptop");

// Plain text
console.log(formatAdAsText(ad));
// [Sponsored] MacBook Pro M3 — 30% off
// The fastest laptop for developers...

// Markdown
console.log(formatAdAsMarkdown(ad));
// **[Sponsored]** MacBook Pro M3 — 30% off
//
// The fastest laptop for developers...
```

### Python

```python
ad = get_ad("best coding laptop")

print(str(ad))           # [Sponsored] MacBook Pro M3...
print(ad.to_markdown())  # **[Sponsored]** MacBook Pro M3...
print(ad.to_dict())      # {"ad_id": "...", "title": "...", ...}
```

## Error Handling

Both SDKs throw typed errors you can catch:

```typescript
import { getAd, PromptAdsError } from "promptads-ai";

try {
  const ad = await getAd("best coding laptop");
} catch (error) {
  if (error instanceof PromptAdsError) {
    console.error(`API Error (${error.status}): ${error.message}`);
  }
  // Gracefully degrade — show response without ad
}
```

```python
from promptads_ai import get_ad, PromptAdsError

try:
    ad = get_ad("best coding laptop")
except PromptAdsError as e:
    print(f"API Error ({e.status}): {e}")
    # Gracefully degrade — show response without ad
```

**Always wrap ad calls in try/catch.** If the ad service is down, your AI
app should still work — just without ads.

## Best Practices

1. **Always handle errors gracefully** — Never let ad failures break your AI response
2. **Use the full user prompt** — Send the complete prompt, not just keywords
3. **Track impressions** — Helps advertisers see value, which funds your app
4. **Tune relevance weight** — Start at 0.70 and adjust based on user feedback
5. **Cache on your side** — If the same prompt repeats often, cache the ad result
6. **Label ads clearly** — Always mark ads as "Sponsored" for user trust
7. **Respect the user** — Don't show more than one ad per response

## Framework Examples

### Express.js API

```typescript
import express from "express";
import { getAd } from "promptads-ai";

const app = express();

app.post("/chat", async (req, res) => {
  const { prompt } = req.body;
  const aiResponse = await callOpenAI(prompt);

  try {
    const ad = await getAd(prompt);
    res.json({ response: aiResponse, ad });
  } catch {
    res.json({ response: aiResponse, ad: null });
  }
});
```

### FastAPI Endpoint

```python
from fastapi import FastAPI
from promptads_ai import get_ad, PromptAdsError

app = FastAPI()

@app.post("/chat")
async def chat(prompt: str):
    ai_response = call_openai(prompt)

    try:
        ad = get_ad(prompt)
        return {"response": ai_response, "ad": ad.to_dict()}
    except PromptAdsError:
        return {"response": ai_response, "ad": None}
```

### LangChain Callback

```python
from langchain.callbacks.base import BaseCallbackHandler
from promptads_ai import get_ad

class PromptAdsCallback(BaseCallbackHandler):
    def on_llm_end(self, response, **kwargs):
        prompt = kwargs.get("prompts", [""])[0]
        try:
            ad = get_ad(prompt)
            response.generations[0][0].text += f"\n\n---\n{ad}"
        except Exception:
            pass
```

### Next.js Server Action

```typescript
"use server";
import { getAd } from "promptads-ai";

export async function chat(prompt: string) {
  const aiResponse = await callAI(prompt);

  try {
    const ad = await getAd(prompt);
    return { response: aiResponse, ad };
  } catch {
    return { response: aiResponse, ad: null };
  }
}
```
