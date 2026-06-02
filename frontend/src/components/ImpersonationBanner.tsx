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
      className="sticky top-0 z-[9999] flex items-center justify-between bg-amber-700 px-6 py-2.5 font-sans text-sm font-semibold text-amber-50 shadow-sm"
    >
      <span className="flex items-center gap-2.5">
        <ShieldAlert size={18} />
        God Mode Active — Impersonating tenant{" "}
        <strong className="font-extrabold">
          {user.impersonatedTenantId}
        </strong>
      </span>
      <button
        id="exit-impersonation-btn"
        onClick={exitImpersonation}
        className="cursor-pointer rounded-md border-none bg-amber-100 px-4 py-1.5 text-[0.8125rem] font-bold text-amber-900"
      >
        Exit Impersonation
      </button>
    </div>
  );
}
