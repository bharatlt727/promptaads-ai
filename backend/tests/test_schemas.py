"""Unit tests for Pydantic schemas."""

import pytest
from pydantic import ValidationError

from schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse
from schemas.ad import AdCreate, AdUpdate, AdResponse
from schemas.analytics import AnalyticsEvent, AnalyticsResponse
from schemas.engine import MatchRequest, MatchResponse, MatchMultiRequest, MatchMultiResponse


# ── Auth schemas ──────────────────────────────────────────────────────────────

def test_register_request_valid():
    req = RegisterRequest(
        email="user@example.com",
        password="pass123",
        company_name="TestCo",
    )
    assert req.email == "user@example.com"


def test_register_request_invalid_email():
    with pytest.raises(ValidationError):
        RegisterRequest(email="bad", password="pass", company_name="Co")


def test_login_request():
    req = LoginRequest(email="a@b.com", password="pwd")
    assert req.password == "pwd"


def test_token_response():
    resp = TokenResponse(access_token="abc")
    assert resp.token_type == "bearer"


def test_user_response():
    resp = UserResponse(
        id="uid", email="a@b.com", company_name="Co", is_active=True
    )
    assert resp.is_active is True


# ── Ad schemas ────────────────────────────────────────────────────────────────

def test_ad_create_defaults():
    ad = AdCreate(
        title="Ad",
        description="Desc",
        product_url="https://example.com",
    )
    assert ad.category == "general"
    assert ad.keywords == []
    assert ad.bid_amount == 0.01


def test_ad_create_full():
    ad = AdCreate(
        title="X1",
        description="Laptop",
        product_url="https://x.com",
        category="tech",
        keywords=["laptop"],
        bid_amount=2.0,
        status="active",
    )
    assert ad.status.value == "active"


def test_ad_update_partial():
    upd = AdUpdate(title="New")
    assert upd.title == "New"
    assert upd.description is None


# ── Analytics schemas ─────────────────────────────────────────────────────────

def test_analytics_event():
    evt = AnalyticsEvent(ad_id="ad-1")
    assert evt.ad_id == "ad-1"


def test_analytics_response():
    resp = AnalyticsResponse(
        ad_id="ad-1", impressions=100, clicks=10, ctr=0.1
    )
    assert resp.ctr == pytest.approx(0.1)


# ── Engine schemas ────────────────────────────────────────────────────────────

def test_match_request():
    req = MatchRequest(user_prompt="best laptop")
    assert req.user_prompt == "best laptop"
    assert req.top_k == 10
    assert req.relevance_weight == 0.70
    assert req.bid_weight == 0.30


def test_match_request_custom_weights():
    req = MatchRequest(
        user_prompt="coding tools",
        top_k=5,
        relevance_weight=0.80,
        bid_weight=0.20,
    )
    assert req.top_k == 5
    assert req.relevance_weight == 0.80


def test_match_request_empty_prompt():
    with pytest.raises(ValidationError):
        MatchRequest(user_prompt="")


def test_match_response():
    resp = MatchResponse(
        ad_id="ad-1",
        title="ThinkPad",
        text="Sponsored: ThinkPad for devs.",
        relevance_score=0.92,
        bid_amount=1.50,
        final_score=0.79,
    )
    assert resp.title == "ThinkPad"
    assert resp.text.startswith("Sponsored:")
    assert resp.relevance_score == pytest.approx(0.92)


def test_match_multi_request():
    req = MatchMultiRequest(user_prompt="best laptop", n=5)
    assert req.n == 5


def test_match_multi_response():
    resp = MatchMultiResponse(
        ads=[
            MatchResponse(
                ad_id="a1", title="T", text="Sponsored: T",
                relevance_score=0.9, bid_amount=1.0, final_score=0.8,
            )
        ],
        total_candidates=3,
        pipeline_latency_ms=42.5,
    )
    assert len(resp.ads) == 1
    assert resp.total_candidates == 3
