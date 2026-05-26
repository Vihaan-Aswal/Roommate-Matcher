"""
supabase.py — Supabase admin client and Supabase-JWT verification.

Supabase JWTs are standard HS256 JWTs signed with the project's JWT secret,
or ES256/RS256 JWTs verified using the project's JWKS endpoint.

The supabase admin client (service-role equivalent) is built lazily so it is
available for server-side Supabase operations (user lookup, etc.) without
requiring it for every request.
"""
from __future__ import annotations

import jwt
from jwt import PyJWKClient
from functools import lru_cache
from typing import Any

from supabase import Client, create_client

from app.config import get_settings


@lru_cache(maxsize=1)
def get_supabase_admin_client() -> Client:
    """
    Returns a long-lived Supabase client initialised with the anon key.

    For server-side admin operations you would normally use the service-role
    key, but since it is not in the current config we use the anon key.
    This client is suitable for server-to-server calls that do not need
    row-level-security bypass.  Upgrade to service-role key in a later phase
    if needed.
    """
    settings = get_settings()
    return create_client(settings.supabase_project_url, settings.supabase_anon_key)


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
        # Use JWKS for asymmetric algorithms (RS256, ES256)
        jwks_client = get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience=settings.supabase_jwt_audience,
            issuer=settings.supabase_jwt_issuer,
            options=options,
        )
