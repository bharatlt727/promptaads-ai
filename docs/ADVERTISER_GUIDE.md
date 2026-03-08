# PromptAds AI — Advertiser Guide

How to create and manage contextual ads that reach users inside AI applications.

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Creating an Ad](#creating-an-ad)
4. [Managing Ads](#managing-ads)
5. [Understanding Ad Matching](#understanding-ad-matching)
6. [Analytics](#analytics)
7. [Budgeting & Bidding](#budgeting--bidding)
8. [Writing Effective Ad Copy](#writing-effective-ad-copy)

---

## Overview

PromptAds places your ads inside AI conversations — chatbots, copilots,
and search agents. When a user asks a question that matches your ad's
topic, your ad appears alongside the AI response.

**How it differs from traditional ads:**

|               | Traditional Ads       | PromptAds                  |
| ------------- | --------------------- | -------------------------- |
| Targeting     | Cookies, demographics | Prompt content (semantic)  |
| Placement     | Banner, sidebar       | Inline with AI response    |
| User tracking | Extensive             | None — privacy first       |
| Relevance     | Keyword-based         | Semantic similarity (AI)   |
| Format        | Images, video         | Text only (native to chat) |

## Getting Started

### 1. Create an Account

**Via Dashboard:**

Go to `http://localhost:3000/register` and create an account.

**Via API:**

    curl -X POST http://localhost:8000/auth/register \
      -H "Content-Type: application/json" \
      -d '{"email": "you@company.com", "password": "your_password"}'

Save the returned JWT token for API calls.

### 2. Log In to the Dashboard

Go to `http://localhost:3000/login` and sign in with your credentials.
You'll land on the dashboard overview page.

## Creating an Ad

### Via Dashboard

1. Navigate to **Ads** in the sidebar
2. Click **Create New Ad**
3. Fill in the form:
   - **Title**: Short headline (e.g., "MacBook Pro M3 — 30% off")
   - **Text**: Description (keep it concise, 1-2 sentences)
   - **Target Keywords**: Topics your ad should match (comma-separated)
   - **Bid Amount**: How much you'll pay per impression ($)
   - **Daily Budget**: Maximum daily spend ($)
   - **Destination URL**: Where clicks go
4. Click **Create Ad**

### Via API

    curl -X POST http://localhost:8000/ads/create \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer <YOUR_TOKEN>" \
      -d '{
        "title": "MacBook Pro M3 — 30% off",
        "text": "The fastest laptop for developers. Apple M3 chip, 18h battery.",
        "target_keywords": ["laptop", "coding", "developer", "macbook", "programming"],
        "bid_amount": 2.50,
        "daily_budget": 100.00,
        "destination_url": "https://apple.com/macbook-pro"
      }'

## Managing Ads

### Dashboard

The **Ads Manager** page shows all your ads in a searchable table. For each ad
you can:

- **Edit** — Update title, text, keywords, bid, budget
- **Pause/Resume** — Toggle the active status
- **Delete** — Permanently remove the ad

### API

    # List all your ads
    GET /ads/list

    # Update an ad
    PUT /ads/update/{ad_id}

    # Delete an ad
    DELETE /ads/delete/{ad_id}

## Understanding Ad Matching

When a developer's AI app calls `getAd("best coding laptop")`, the engine:

1. **Embeds** the prompt into a 384-dimensional vector
2. **Searches** Qdrant for the nearest ad vectors (your keywords + title + text)
3. **Ranks** candidates by a weighted score:

   final_score = (0.70 × relevance) + (0.30 × normalized_bid)

4. **Returns** the highest-scoring ad

### What This Means for You

- **Relevance matters most** — A $1 bid with 0.95 relevance beats a $5 bid
  with 0.20 relevance
- **Keyword quality matters** — Choose keywords that match what users actually
  ask about, not just product names
- **Ad text is indexed** — The title and text contribute to the semantic
  embedding, so write them naturally

## Analytics

### Dashboard

Navigate to **Analytics** in the sidebar to see:

- **Impressions** — How many times your ad was shown
- **Clicks** — How many times users clicked through
- **CTR** — Click-through rate (clicks / impressions × 100)
- **Trends** — Line and area charts over time

### API

Analytics events are recorded automatically when developers call
`trackImpression()` and `trackClick()` from the SDK.

## Budgeting & Bidding

| Setting        | Description                             | Example |
| -------------- | --------------------------------------- | ------- |
| `bid_amount`   | Cost you pay per impression (CPM model) | $2.50   |
| `daily_budget` | Maximum spend per day                   | $100.00 |

**Tips:**

- Start with a low bid ($0.50–$1.00) and increase if you're not getting
  enough impressions
- Set a daily budget to control costs while testing
- Monitor your CTR — a high CTR means your ad copy resonates with users

## Writing Effective Ad Copy

### Do

- Keep the title under 60 characters
- Write the text in 1-2 natural sentences
- Focus on the value proposition
- Include a clear call-to-action in the text
- Use keywords that users would naturally say in conversation

### Don't

- Use ALL CAPS or excessive punctuation (!!!)
- Write clickbait — AI users are sophisticated
- Stuff keywords into the title/text unnaturally
- Make the ad sound like a traditional display ad

### Examples

**Good:**

    Title: "GitHub Copilot — Free for Students"
    Text: "Write code 55% faster with AI pair programming. Free for verified students."
    Keywords: ["coding", "programming", "IDE", "code editor", "developer tools"]

**Bad:**

    Title: "BUY NOW!!! BEST CODING TOOL EVER!!!"
    Text: "Click here for amazing deals on coding software tools programs apps!!"
    Keywords: ["buy", "deal", "cheap", "free", "download"]

The good example reads naturally in an AI conversation. The bad one feels
like spam and will get low relevance scores.
