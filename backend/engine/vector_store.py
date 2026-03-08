"""Qdrant vector store integration — CRUD for ad embedding vectors."""

from __future__ import annotations

import structlog
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointIdsList,
    PointStruct,
    VectorParams,
    QueryResponse,
)

from core.config import settings

logger = structlog.get_logger()


class VectorStoreService:
    """Thin wrapper around Qdrant for ad embedding operations."""

    def __init__(self) -> None:
        self._client: QdrantClient | None = None

    # Lazy connection — avoids failing at import time when Qdrant isn't running
    @property
    def client(self) -> QdrantClient:
        if self._client is None:
            self._client = QdrantClient(
                host=settings.qdrant_host,
                port=settings.qdrant_port,
            )
        return self._client

    # ── Collection management ────────────────────────────────

    def ensure_collection(self) -> None:
        """Create the ad embeddings collection if it doesn't exist."""
        collections = [c.name for c in self.client.get_collections().collections]
        if settings.qdrant_collection not in collections:
            self.client.create_collection(
                collection_name=settings.qdrant_collection,
                vectors_config=VectorParams(
                    size=settings.embedding_dimensions,
                    distance=Distance.COSINE,
                ),
            )
            logger.info("qdrant_collection_created", name=settings.qdrant_collection)

    # ── CRUD ─────────────────────────────────────────────────

    def upsert(
        self,
        ad_id: str,
        embedding: list[float],
        payload: dict,
    ) -> None:
        """Insert or update an ad embedding point."""
        self.client.upsert(
            collection_name=settings.qdrant_collection,
            points=[
                PointStruct(
                    id=ad_id,
                    vector=embedding,
                    payload=payload,
                )
            ],
        )

    def search(
        self,
        embedding: list[float],
        limit: int = 5,
        status_filter: str = "active",
    ) -> list:
        """Find the top-N similar ad embeddings, filtered by status."""
        query_filter = Filter(
            must=[
                FieldCondition(
                    key="status",
                    match=MatchValue(value=status_filter),
                )
            ]
        )
        return self.client.query_points(
            collection_name=settings.qdrant_collection,
            query=embedding,
            query_filter=query_filter,
            limit=limit,
        ).points

    def delete(self, ad_id: str) -> None:
        """Remove an ad embedding by point ID."""
        self.client.delete(
            collection_name=settings.qdrant_collection,
            points_selector=PointIdsList(points=[ad_id]),
        )
