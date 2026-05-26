"""
contracts.py — typed request context for the auth layer.

Both Supabase JWTs (real users) and app-signed JWTs (demo / impersonation)
normalise into a single AuthenticatedUser dataclass. No route ever inspects
a raw token after this point.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Literal

RoleKind = Literal["owner", "admin", "viewer"]
AuthKind = Literal["supabase", "app_jwt"]


@dataclass(frozen=True, slots=True)
class AuthenticatedUser:
    """
    Normalised, immutable request context populated by get_authenticated_user().

    Fields
    ------
    auth_kind       : "supabase" for real users; "app_jwt" for demo/impersonation.
    supabase_user_id: UUID string from Supabase auth.users (real) or the demo
                      placeholder ID embedded in the app JWT (demo).
    email           : The user's email address.
    tenant_id       : UUID of the tenant this request is scoped to.
    role            : "owner" | "admin" | "viewer" — sourced from tenant_memberships
                      (real) or embedded in the JWT claim (demo).
    is_demo         : True when this session was created by POST /api/auth/demo.
    is_platform_admin: True when email is in the ADMIN_EMAILS env allowlist.
    impersonated_tenant_id: Non-None only when a platform admin is impersonating
                            a tenant via a special app-JWT.  Set by
                            get_authenticated_user() when the "impersonated_tenant"
                            claim is present.
    """

    auth_kind: AuthKind
    supabase_user_id: str          # UUID as string, matches auth.users.id
    email: str
    tenant_id: uuid.UUID
    role: RoleKind
    is_demo: bool = False
    is_platform_admin: bool = False
    impersonated_tenant_id: uuid.UUID | None = None
