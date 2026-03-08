"""Integration tests for API endpoints."""

import pytest
from httpx import AsyncClient


# ── Auth endpoints ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register(client: AsyncClient):
    resp = await client.post(
        "/auth/register",
        json={
            "email": "test@example.com",
            "password": "strongpass123",
            "company_name": "TestCorp",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate(client: AsyncClient):
    payload = {
        "email": "dup@example.com",
        "password": "pass123",
        "company_name": "Dup Inc",
    }
    await client.post("/auth/register", json=payload)
    resp = await client.post("/auth/register", json=payload)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_login(client: AsyncClient):
    await client.post(
        "/auth/register",
        json={
            "email": "login@example.com",
            "password": "pass123",
            "company_name": "LoginCorp",
        },
    )
    resp = await client.post(
        "/auth/login",
        json={"email": "login@example.com", "password": "pass123"},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_invalid(client: AsyncClient):
    resp = await client.post(
        "/auth/login",
        json={"email": "nobody@example.com", "password": "wrong"},
    )
    assert resp.status_code == 401


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_token(client: AsyncClient, email: str = "ads_user@example.com") -> str:
    resp = await client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "pass123",
            "company_name": "AdsCorp",
        },
    )
    if resp.status_code == 200:
        return resp.json()["access_token"]
    # Already registered — login
    resp = await client.post(
        "/auth/login",
        json={"email": email, "password": "pass123"},
    )
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Ad endpoints ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_ad(client: AsyncClient):
    token = await _get_token(client, "create_ad@example.com")
    resp = await client.post(
        "/ads/create",
        json={
            "title": "ThinkPad X1",
            "description": "Built for developers.",
            "product_url": "https://example.com/thinkpad",
            "category": "laptops",
            "keywords": ["laptop", "developer"],
            "bid_amount": 1.50,
            "status": "active",
        },
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "ThinkPad X1"
    assert data["status"] == "active"


@pytest.mark.asyncio
async def test_list_ads(client: AsyncClient):
    token = await _get_token(client, "list_ads@example.com")
    # Create an ad first
    await client.post(
        "/ads/create",
        json={
            "title": "Test Ad",
            "description": "Test description.",
            "product_url": "https://example.com",
        },
        headers=_auth(token),
    )
    resp = await client.get("/ads/list", headers=_auth(token))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_update_ad(client: AsyncClient):
    token = await _get_token(client, "update_ad@example.com")
    create_resp = await client.post(
        "/ads/create",
        json={
            "title": "Old Title",
            "description": "Old desc.",
            "product_url": "https://example.com",
        },
        headers=_auth(token),
    )
    ad_id = create_resp.json()["id"]
    resp = await client.put(
        f"/ads/update/{ad_id}",
        json={"title": "New Title"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "New Title"


@pytest.mark.asyncio
async def test_delete_ad(client: AsyncClient):
    token = await _get_token(client, "delete_ad@example.com")
    create_resp = await client.post(
        "/ads/create",
        json={
            "title": "To Delete",
            "description": "Will be deleted.",
            "product_url": "https://example.com",
        },
        headers=_auth(token),
    )
    ad_id = create_resp.json()["id"]
    resp = await client.delete(f"/ads/delete/{ad_id}", headers=_auth(token))
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_create_ad_unauthorized(client: AsyncClient):
    resp = await client.post(
        "/ads/create",
        json={
            "title": "Nope",
            "description": "Shouldn't work.",
            "product_url": "https://example.com",
        },
    )
    assert resp.status_code == 403


# ── Health ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"
