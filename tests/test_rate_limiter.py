"""Unit tests for the user-keyed rate-limit key function (M3)."""
import os
from types import SimpleNamespace

import jwt
import pytest


def _req(headers, host="1.2.3.4"):
    return SimpleNamespace(headers=headers, client=SimpleNamespace(host=host))


def test_key_is_user_for_valid_token():
    from middleware.rate_limiter import user_or_ip_key
    token = jwt.encode(
        {"user_id": "abc-123", "role": "teacher"},
        os.environ["JWT_SECRET"], algorithm="HS256",
    )
    assert user_or_ip_key(_req({"Authorization": f"Bearer {token}"})) == "user:abc-123"


def test_key_falls_back_to_ip_when_unauthenticated():
    from middleware.rate_limiter import user_or_ip_key
    assert user_or_ip_key(_req({}, host="9.9.9.9")) == "9.9.9.9"


def test_key_hashes_unparsable_bearer_token():
    from middleware.rate_limiter import user_or_ip_key
    key = user_or_ip_key(_req({"Authorization": "Bearer not-a-jwt"}))
    assert key.startswith("tok:")
    # two different IPs must not collapse to the same user key
    assert key != user_or_ip_key(_req({}, host="1.2.3.4"))
