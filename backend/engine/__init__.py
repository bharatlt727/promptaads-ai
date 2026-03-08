"""Ad matching engine — vector search + LLM embedding integration.

Modules
-------
embedding_service : Text → embedding vectors (OpenAI, cached)
vector_search     : Qdrant similarity search + DB verification
ad_ranker         : Score candidates by relevance × bid
ad_generator      : LLM-rewrite ads into contextual sponsored copy
engine_service    : Top-level pipeline orchestrator
vector_store      : Low-level Qdrant CRUD wrapper
matcher           : Legacy / simplified matching entry-point
"""
