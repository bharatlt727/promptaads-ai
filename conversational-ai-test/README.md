# Conversational AI Test — PromptAds SDK Demo

A standalone Next.js chatbot that uses the **PromptAds AI SDK** to inject contextual ads into AI-generated conversation responses.

Uses **Gemini 2.5 Flash** for chat and the **promptads-ai** JS SDK for ad matching.

## Quick Start

```bash
cd conversational-ai-test
npm install
npm run dev       # → http://localhost:3050
```

Make sure the PromptAds backend is running on `http://localhost:8000` and has some active ads.

## What It Tests

- `promptads-ai` JS SDK (`getAd`, `trackImpression`, `trackClick`)
- Real Gemini-powered conversation
- Ad injection into chat responses
- Impression & click tracking
