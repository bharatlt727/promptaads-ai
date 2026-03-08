"""Unit tests for the ad-matching engine modules.

Tests the ranker and generator logic in isolation (no OpenAI / Qdrant needed).
"""

from __future__ import annotations

import pytest

from engine.ad_ranker import AdRanker, RankedAd
from engine.vector_search import SearchCandidate


# ---------------------------------------------------------------------------
# Helpers — build fake Ad / SearchCandidate objects
# ---------------------------------------------------------------------------

class _FakeAd:
    """Minimal stand-in for models.ad.Ad used in ranker tests."""

    def __init__(
        self,
        ad_id: str = "ad-1",
        advertiser_id: str = "adv-1",
        title: str = "Test Ad",
        description: str = "Test description",
        product_url: str = "https://example.com",
        category: str = "general",
        keywords: list[str] | None = None,
        bid_amount: float = 1.0,
    ):
        self.id = ad_id
        self.advertiser_id = advertiser_id
        self.title = title
        self.description = description
        self.product_url = product_url
        self.category = category
        self.keywords = keywords or []
        self.bid_amount = bid_amount


def _candidate(
    ad_id: str = "ad-1",
    advertiser_id: str = "adv-1",
    relevance: float = 0.90,
    bid: float = 1.0,
    title: str = "Test Ad",
) -> SearchCandidate:
    ad = _FakeAd(ad_id=ad_id, advertiser_id=advertiser_id, bid_amount=bid, title=title)
    return SearchCandidate(ad=ad, relevance_score=relevance)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# AdRanker tests
# ---------------------------------------------------------------------------

class TestAdRanker:
    def setup_method(self):
        self.ranker = AdRanker()

    def test_empty_candidates(self):
        assert self.ranker.rank([]) == []

    def test_single_candidate(self):
        result = self.ranker.rank([_candidate()])
        assert len(result) == 1
        assert result[0].rank == 1

    def test_higher_bid_wins_on_equal_relevance(self):
        c1 = _candidate(ad_id="low-bid", bid=0.50, relevance=0.90)
        c2 = _candidate(ad_id="high-bid", bid=2.00, relevance=0.90)
        result = self.ranker.rank([c1, c2])
        assert result[0].candidate.ad.id == "high-bid"

    def test_higher_relevance_wins_on_equal_bid(self):
        c1 = _candidate(ad_id="low-rel", relevance=0.60, bid=1.0)
        c2 = _candidate(ad_id="high-rel", relevance=0.95, bid=1.0)
        result = self.ranker.rank([c1, c2])
        assert result[0].candidate.ad.id == "high-rel"

    def test_relevance_weight_dominates(self):
        # High relevance, low bid should beat low relevance, high bid
        # when relevance_weight=0.90
        c1 = _candidate(ad_id="relevant", relevance=0.95, bid=0.10)
        c2 = _candidate(ad_id="bidder", relevance=0.30, bid=5.00)
        result = self.ranker.rank(
            [c1, c2], relevance_weight=0.90, bid_weight=0.10
        )
        assert result[0].candidate.ad.id == "relevant"

    def test_bid_weight_dominates(self):
        c1 = _candidate(ad_id="relevant", relevance=0.95, bid=0.10)
        c2 = _candidate(ad_id="bidder", relevance=0.30, bid=5.00)
        result = self.ranker.rank(
            [c1, c2], relevance_weight=0.10, bid_weight=0.90
        )
        assert result[0].candidate.ad.id == "bidder"

    def test_quality_floor_filters(self):
        c_good = _candidate(ad_id="good", relevance=0.80)
        c_bad = _candidate(ad_id="bad", relevance=0.10)
        result = self.ranker.rank([c_good, c_bad], quality_floor=0.50)
        assert len(result) == 1
        assert result[0].candidate.ad.id == "good"

    def test_quality_floor_fallback_keeps_best(self):
        """When ALL candidates are below the floor, keep the single best."""
        c1 = _candidate(ad_id="bad1", relevance=0.10)
        c2 = _candidate(ad_id="bad2", relevance=0.15)
        result = self.ranker.rank([c1, c2], quality_floor=0.50)
        assert len(result) == 1
        assert result[0].candidate.ad.id == "bad2"

    def test_diversity_cap(self):
        """Only max_per_advertiser ads from the same advertiser."""
        candidates = [
            _candidate(ad_id=f"ad-{i}", advertiser_id="same-adv", relevance=0.90 - i * 0.01)
            for i in range(5)
        ]
        result = self.ranker.rank(candidates, max_per_advertiser=2)
        assert len(result) == 2

    def test_diversity_allows_different_advertisers(self):
        candidates = [
            _candidate(ad_id="a1", advertiser_id="adv-A", relevance=0.90),
            _candidate(ad_id="a2", advertiser_id="adv-A", relevance=0.88),
            _candidate(ad_id="b1", advertiser_id="adv-B", relevance=0.85),
            _candidate(ad_id="b2", advertiser_id="adv-B", relevance=0.80),
        ]
        result = self.ranker.rank(candidates, max_per_advertiser=1)
        advertiser_ids = {r.candidate.ad.advertiser_id for r in result}
        assert advertiser_ids == {"adv-A", "adv-B"}
        assert len(result) == 2

    def test_ranks_are_sequential(self):
        candidates = [
            _candidate(ad_id=f"ad-{i}", relevance=0.90 - i * 0.05)
            for i in range(4)
        ]
        result = self.ranker.rank(candidates)
        ranks = [r.rank for r in result]
        assert ranks == [1, 2, 3, 4]

    def test_final_score_is_weighted_sum(self):
        c = _candidate(relevance=0.80, bid=2.0)
        result = self.ranker.rank(
            [c], relevance_weight=0.70, bid_weight=0.30
        )
        r = result[0]
        # Only one candidate, so normalised bid = 1.0
        expected = 0.70 * 0.80 + 0.30 * 1.0
        assert r.final_score == pytest.approx(expected, abs=1e-5)

    def test_zero_bid_handled(self):
        c = _candidate(relevance=0.80, bid=0.0)
        result = self.ranker.rank([c])
        assert len(result) == 1


# ---------------------------------------------------------------------------
# AdGenerator fallback tests (no LLM call)
# ---------------------------------------------------------------------------

class TestAdGeneratorFallback:
    def test_fallback_text(self):
        from engine.ad_generator import AdGenerator

        text = AdGenerator._fallback_text("Webflow", "Build websites visually")
        assert text.startswith("Sponsored:")
        assert "Webflow" in text
        assert "Build websites visually" in text


# ---------------------------------------------------------------------------
# EmbeddingService cache tests (no OpenAI call)
# ---------------------------------------------------------------------------

class TestEmbeddingCache:
    def test_cache_put_and_get(self):
        from engine.embedding_service import _EmbeddingCache

        cache = _EmbeddingCache()
        cache.put("hello", "model-1", [0.1, 0.2, 0.3])
        got = cache.get("hello", "model-1")
        assert got == [0.1, 0.2, 0.3]

    def test_cache_miss(self):
        from engine.embedding_service import _EmbeddingCache

        cache = _EmbeddingCache()
        assert cache.get("nope", "model-1") is None

    def test_cache_eviction(self):
        from engine.embedding_service import _EmbeddingCache

        cache = _EmbeddingCache(max_size=2)
        cache.put("a", "m", [1.0])
        cache.put("b", "m", [2.0])
        cache.put("c", "m", [3.0])
        assert cache.size == 2
        # "a" should have been evicted (LRU)
        assert cache.get("a", "m") is None
        assert cache.get("b", "m") is not None
        assert cache.get("c", "m") is not None

    def test_cache_clear(self):
        from engine.embedding_service import _EmbeddingCache

        cache = _EmbeddingCache()
        cache.put("a", "m", [1.0])
        cache.clear()
        assert cache.size == 0
