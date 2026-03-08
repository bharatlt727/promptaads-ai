# PromptAds AI — Python SDK

Contextual ads for AI-powered apps. Zero dependencies — uses only the Python standard library.

## Install

```bash
pip install promptads-ai
```

## Quick Start

```python
from promptads_ai import get_ad

ad = get_ad("best coding laptop")
print(ad)
# [Sponsored] MacBook Pro M3 — 30% off
# The fastest laptop for developers...
```

## Configuration

### Environment Variables

```bash
export PROMPTADS_BASE_URL=http://localhost:8000   # API server URL
export PROMPTADS_API_KEY=pk_live_xxx              # Optional API key
```

### Explicit Configuration

```python
import promptads_ai

promptads_ai.configure(
    base_url="https://api.promptads.ai",
    api_key="pk_live_xxx",
    timeout=5,  # seconds
)
```

## API

### `get_ad(prompt, **kwargs)`

Get the single best contextual ad for a user prompt.

```python
ad = get_ad(
    "best coding laptop",
    top_k=20,             # Candidates to consider (default: 10)
    relevance_weight=0.8,  # Weight for relevance (default: 0.70)
    bid_weight=0.2,        # Weight for bid amount (default: 0.30)
)

print(ad.ad_id)           # "abc123"
print(ad.title)           # "MacBook Pro M3 — 30% off"
print(ad.text)            # "The fastest laptop for developers..."
print(ad.relevance_score) # 0.87
print(ad.bid_amount)      # 2.50
print(ad.final_score)     # 0.82
```

### `get_ads(prompt, **kwargs)`

Get multiple contextual ads.

```python
from promptads_ai import get_ads

result = get_ads("best coding laptop", n=3)

for ad in result.ads:
    print(ad.title)

print(result.total_candidates)   # 42
print(result.pipeline_latency_ms) # 12.5
```

### `track_impression(ad_id)` / `track_click(ad_id)`

Track ad interactions for analytics.

```python
from promptads_ai import track_impression, track_click

track_impression(ad.ad_id)
track_click(ad.ad_id)
```

### `PromptAdsClient` (Advanced)

Full client class for custom configurations.

```python
from promptads_ai import PromptAdsClient

client = PromptAdsClient(
    base_url="https://api.promptads.ai",
    api_key="pk_live_xxx",
    timeout=5,
)

ad = client.get_ad("best coding laptop")
```

### Formatting

```python
print(ad)           # [Sponsored] MacBook Pro M3 — 30% off\nThe fastest ...
print(ad.to_markdown())  # **[Sponsored]** MacBook Pro M3 — 30% off\n\nThe fastest ...
print(ad.to_dict())      # {"ad_id": "abc123", "title": "...", ...}
```

## Error Handling

```python
from promptads_ai import get_ad, PromptAdsError

try:
    ad = get_ad("best coding laptop")
except PromptAdsError as e:
    print(f"API Error ({e.status}): {e}")
```

## License

MIT
