/**
 * ImpersonationBanner.tsx
 *
 * Always-visible warning banner shown while a platform admin is impersonating
 * a tenant. Rendered by AdminLayout so it appears on every workspace page.
 *
 * Not rendered when user.impersonatedTenantId is null.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "../providers/AuthProvider";
import { setApiToken } from "../lib/apiClient";

const IMPERSONATION_TOKEN_KEY = "impersonation_token";
const REAL_ADMIN_TOKEN_KEY = "real_admin_token";   // stored when impersonation begins

export function ImpersonationBanner() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Only render during impersonation
  if (!user?.impersonatedTenantId) return null;

  function exitImpersonation() {
    // Restore real admin token
    const realToken = sessionStorage.getItem(REAL_ADMIN_TOKEN_KEY);
    if (realToken) {
      setApiToken(realToken);
    }
    // Clear impersonation artefacts
    sessionStorage.removeItem(IMPERSONATION_TOKEN_KEY);
    sessionStorage.removeItem(REAL_ADMIN_TOKEN_KEY);

    // Force a full page reload so AuthProvider re-bootstraps with the real token
    window.location.href = "/platform";
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 9999,
        background: "linear-gradient(90deg, #92400e, #b45309)",
        color: "#fef3c7",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 24px",
        fontFamily: "Inter, sans-serif",
        fontSize: "0.875rem",
        fontWeight: 600,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <ShieldAlert size={18} />
        God Mode Active — Impersonating tenant{" "}
        <strong style={{ fontWeight: 800 }}>
          {user.impersonatedTenantId}
        </strong>
      </span>
      <button
        id="exit-impersonation-btn"
        onClick={exitImpersonation}
        style={{
          background: "#fef3c7",
          color: "#92400e",
          border: "none",
          borderRadius: 6,
          padding: "6px 16px",
          fontWeight: 700,
          cursor: "pointer",
          fontSize: "0.8125rem",
        }}
      >
        Exit Impersonation
      </button>
    </div>
  );
}
