"""Unit tests for service functions."""

import pytest

from core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


# ── Password hashing ─────────────────────────────────────────────────────────

def test_hash_password():
    hashed = hash_password("secret")
    assert hashed != "secret"
    assert hashed.startswith("$2b$")


def test_verify_password_correct():
    hashed = hash_password("secret")
    assert verify_password("secret", hashed) is True


def test_verify_password_incorrect():
    hashed = hash_password("secret")
    assert verify_password("wrong", hashed) is False


# ── JWT tokens ────────────────────────────────────────────────────────────────

def test_create_and_decode_token():
    token = create_access_token(subject="user-123")
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "user-123"


def test_decode_invalid_token():
    payload = decode_access_token("invalid.token.here")
    assert payload is None


def test_token_contains_expiry():
    token = create_access_token(subject="user-456")
    payload = decode_access_token(token)
    assert payload is not None
    assert "exp" in payload
