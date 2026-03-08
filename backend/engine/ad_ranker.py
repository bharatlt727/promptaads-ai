"""Ad ranker — score and rank candidate ads.

Combines two signals:
  1. **Relevance score** — cosine similarity from vector search (0..1)
  2. **Bid amount** — advertiser's willingness-to-pay

The final score is a weighted linear combination::

    final_score = (w_relevance × relevance) + (w_bid × normalised_bid)

Weights are configurable per request.  The ranker also applies
diversity rules (e.g. max ads per advertiser) and quality floor
constraints.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

import structlog

from engine.vector_search import SearchCandidate

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
DEFAULT_RELEVANCE_WEIGHT: Final[float] = 0.70
DEFAULT_BID_WEIGHT: Final[float] = 0.30
DEFAULT_QUALITY_FLOOR: Final[float] = 0.55      # min relevance to be considered
DEFAULT_MAX_PER_ADVERTISER: Final[int] = 2       # diversity cap


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class RankedAd:
    """A candidate that has been scored and ranked."""

    candidate: SearchCandidate
    relevance_score: float          # raw cosine similarity
    bid_score: float                # normalised bid (0..1)
    final_score: float              # weighted combination
    rank: int = 0                   # 1-based rank (filled by ranker)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class AdRanker:
    """Stateless ad ranker — call :meth:`rank` with a list of candidates."""

    def rank(
        self,
        candidates: list[SearchCandidate],
        *,
        relevance_weight: float = DEFAULT_RELEVANCE_WEIGHT,
        bid_weight: float = DEFAULT_BID_WEIGHT,
        quality_floor: float = DEFAULT_QUALITY_FLOOR,
        max_per_advertiser: int = DEFAULT_MAX_PER_ADVERTISER,
    ) -> list[RankedAd]:
        """Score, filter, and rank candidates.

        Parameters
        ----------
        candidates:
            Raw candidates from the vector search step.
        relevance_weight:
            Weight for cosine-similarity component  (default 0.70).
        bid_weight:
            Weight for normalised bid component (default 0.30).
        quality_floor:
            Minimum relevance score to stay in the pool.
        max_per_advertiser:
            Maximum ads from a single advertiser in the result set.

        Returns
        -------
        list[RankedAd]
            Sorted descending by ``final_score``, with ``rank`` populated.
        """
        if not candidates:
            return []

        # Normalise weights so they sum to 1
        w_total = relevance_weight + bid_weight
        if w_total == 0:
            relevance_weight, bid_weight = 0.5, 0.5
            w_total = 1.0
        relevance_weight /= w_total
        bid_weight /= w_total

        # ------------------------------------------------------------------
        # Step 1 — quality floor
        # ------------------------------------------------------------------
        pool = [c for c in candidates if c.relevance_score >= quality_floor]
        if not pool:
            logger.info(
                "ranker_all_below_floor",
                total=len(candidates),
                floor=quality_floor,
            )
            return []

        # ------------------------------------------------------------------
        # Step 2 — normalise bid amounts to [0..1]
        # ------------------------------------------------------------------
        bids = [c.ad.bid_amount for c in pool]
        max_bid = max(bids) if bids else 1.0
        if max_bid == 0:
            max_bid = 1.0

        # ------------------------------------------------------------------
        # Step 3 — compute final score
        # ------------------------------------------------------------------
        scored: list[RankedAd] = []
        for c in pool:
            bid_norm = c.ad.bid_amount / max_bid
            final = (relevance_weight * c.relevance_score) + (bid_weight * bid_norm)
            scored.append(
                RankedAd(
                    candidate=c,
                    relevance_score=c.relevance_score,
                    bid_score=bid_norm,
                    final_score=round(final, 6),
                )
            )

        # Sort descending by final score (tie-break: higher bid wins)
        scored.sort(key=lambda r: (r.final_score, r.bid_score), reverse=True)

        # ------------------------------------------------------------------
        # Step 4 — diversity: cap ads per advertiser
        # ------------------------------------------------------------------
        result: list[RankedAd] = []
        advertiser_counts: dict[str, int] = {}
        for item in scored:
            adv_id = item.candidate.ad.advertiser_id
            count = advertiser_counts.get(adv_id, 0)
            if count >= max_per_advertiser:
                continue
            advertiser_counts[adv_id] = count + 1
            result.append(item)

        # Assign 1-based ranks
        for i, item in enumerate(result, start=1):
            item.rank = i

        logger.info(
            "ranker_complete",
            input=len(candidates),
            after_floor=len(pool),
            after_diversity=len(result),
            top_score=result[0].final_score if result else None,
        )
        return result
