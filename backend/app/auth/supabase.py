"""
supabase.py — Supabase-JWT verification.

Supabase JWTs are standard HS256 JWTs signed with the project's JWT secret,
or ES256/RS256 JWTs verified using the project's JWKS endpoint.
"""
from __future__ import annotations

import jwt
from jwt import PyJWKClient
from typing import Any

from app.config import get_settings


_jwks_client: PyJWKClient | None = None

def get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        settings = get_settings()
        url = f"{settings.supabase_project_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(url)
    return _jwks_client


def verify_supabase_jwt(token: str) -> dict[str, Any]:
    """
    Decode and verify a Supabase-issued access token.

    Returns the decoded payload dict on success.
    Raises jwt.InvalidTokenError (or a subclass) on any failure:
      - expired token
      - wrong audience
      - wrong issuer
      - bad signature

    The caller (get_authenticated_user) catches these and raises HTTP 401.

    Supabase JWT claims of interest
    --------------------------------
    sub   : str  — auth.users.id (the user's UUID as a string)
    email : str  — the user's email
    role  : str  — "authenticated" (Supabase's internal role, NOT our app role)
    iss   : str  — supabase_jwt_issuer  e.g. "https://<ref>.supabase.co/auth/v1"
    aud   : str  — "authenticated"
    exp   : int  — unix expiry timestamp
    """
    settings = get_settings()

    try:
        header = jwt.get_unverified_header(token)
    except jwt.DecodeError:
        raise jwt.InvalidTokenError("Invalid token format")
        
    alg = header.get("alg")
    
    # We require issuer, sub, email, exp, aud for safety
    options = {"require": ["sub", "email", "exp", "iss", "aud"]}
    
    if alg == "HS256":
        if not settings.supabase_jwt_secret or not settings.supabase_jwt_issuer:
            raise jwt.InvalidTokenError("Supabase JWT verification is not configured")
        # Fallback to symmetric secret
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience=settings.supabase_jwt_audience,
            issuer=settings.supabase_jwt_issuer,
            options=options,
        )
    else:
        if not settings.supabase_project_url or not settings.supabase_jwt_issuer:
            raise jwt.InvalidTokenError("Supabase JWT verification is not configured")
        # Use JWKS for asymmetric algorithms (RS256, ES256)
        jwks_client = get_jwks_client()
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
        except jwt.PyJWKClientError as exc:
            # Missing kid / unreachable JWKS is an invalid token, not a 500.
            raise jwt.InvalidTokenError(f"Unable to resolve signing key: {exc}") from exc
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience=settings.supabase_jwt_audience,
            issuer=settings.supabase_jwt_issuer,
            options=options,
        )
