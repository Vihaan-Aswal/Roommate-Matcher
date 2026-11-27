import React from "react";
import { ShieldAlert } from "lucide-react";

import { useAuth } from "../providers/AuthProvider";
import { setApiToken } from "../lib/apiClient";

const IMPERSONATION_TOKEN_KEY = "impersonation_token";
const REAL_ADMIN_TOKEN_KEY = "real_admin_token";

export function ImpersonationBanner(): JSX.Element | null {
  const { user } = useAuth();

  if (!user?.impersonatedTenantId) return null;

  function exitImpersonation() {
    const realToken = sessionStorage.getItem(REAL_ADMIN_TOKEN_KEY);
    if (realToken) {
      setApiToken(realToken);
    }
    sessionStorage.removeItem(IMPERSONATION_TOKEN_KEY);
    sessionStorage.removeItem(REAL_ADMIN_TOKEN_KEY);
    window.location.href = "/platform";
  }

  return (
    <div className="desk-impersonation" role="alert" aria-live="polite">
      <span className="desk-row" style={{ gap: 8 }}>
        <ShieldAlert size={16} strokeWidth={1.9} aria-hidden="true" />
        Platform console · you are inside tenant
        <strong>{user.impersonatedTenantId}</strong>
      </span>
      <button
        id="exit-impersonation-btn"
        className="desk-btn desk-btn-sm"
        type="button"
        onClick={exitImpersonation}
      >
        Exit impersonation
      </button>
    </div>
  );
}
