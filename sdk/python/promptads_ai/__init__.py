"""
PromptAds AI — Python SDK

Contextual ads for AI-powered apps. Zero dependencies.

Quick start::

    from promptads_ai import get_ad

    ad = get_ad("best coding laptop")
    print(ad)
"""

from promptads_ai.client import (
    Ad,
    MatchMultiResult,
    PromptAdsClient,
    PromptAdsError,
    configure,
    get_ad,
    get_ads,
    track_click,
    track_impression,
)

__all__ = [
    "Ad",
    "MatchMultiResult",
    "PromptAdsClient",
    "PromptAdsError",
    "configure",
    "get_ad",
    "get_ads",
    "track_click",
    "track_impression",
]

__version__ = "0.1.0"
