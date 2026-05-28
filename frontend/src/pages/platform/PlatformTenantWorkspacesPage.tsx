import React from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getPlatformTenantWorkspaces, impersonateTenant, getPlatformTenant } from "../../lib/apiClient";
import { adminQueryKeys } from "../../hooks/adminQueryKeys";
import { setApiToken } from "../../lib/apiClient";
import { useAuth } from "../../providers/AuthProvider";

const IMPERSONATION_TOKEN_KEY = "impersonation_token";
const REAL_ADMIN_TOKEN_KEY = "real_admin_token";

export function PlatformTenantWorkspacesPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const { token: realToken } = useAuth();

  const { data: tenantData } = useQuery({
    queryKey: adminQueryKeys.platformTenant(tenantId!),
    queryFn: () => getPlatformTenant(tenantId!),
    enabled: !!tenantId,
  });

  const { data, isLoading } = useQuery({
    queryKey: adminQueryKeys.platformTenantWorkspaces(tenantId!),
    queryFn: () => getPlatformTenantWorkspaces(tenantId!),
    enabled: !!tenantId,
  });

  const impersonateMutation = useMutation({
    mutationFn: ({ workspaceId }: { workspaceId: string }) =>
      impersonateTenant(tenantId!, workspaceId),
    onSuccess: (response) => {
      if (realToken) {
        sessionStorage.setItem(REAL_ADMIN_TOKEN_KEY, realToken);
      }
      sessionStorage.setItem(IMPERSONATION_TOKEN_KEY, response.token);
      setApiToken(response.token);
      window.location.href = `/app/${response.workspace_id}/dashboard`;
    },
    onError: (err: Error) => {
      alert(`Impersonation failed: ${err.message}`);
    },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/platform" className="text-sm font-medium text-primary hover:underline mb-4 inline-block">
        &larr; Back to Tenants
      </Link>
      <header className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-gray-900 flex items-center gap-2">
          <span className="bg-amber-100 text-amber-800 text-sm px-2 py-1 rounded-md font-sans">God Mode</span>
          Impersonate {tenantData?.display_name || "Tenant"}
        </h1>
        <p className="text-muted-foreground mt-2">Select a workspace to enter as this tenant.</p>
      </header>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-32 bg-gray-200 rounded-md"></div>
          ))}
        </div>
      ) : data?.workspaces.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          This tenant has no workspaces yet.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data?.workspaces.map(w => (
            <div key={w.id} className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 flex flex-col">
              <h3 className="font-semibold text-lg text-gray-900 mb-1">{w.name}</h3>
              <p className="text-xs text-gray-500 mb-4 font-mono">{w.id}</p>
              <div className="text-sm text-gray-600 space-y-1 mb-6 flex-grow">
                <div>Status: <span className="font-medium">{w.status}</span></div>
                <div>Source: <span className="font-medium">{w.source}</span></div>
                {w.is_demo_seeded && <span className="inline-block mt-2 rounded-full bg-blue-100 px-2 text-xs font-semibold leading-5 text-blue-800">Demo Seeded</span>}
              </div>
              <button
                onClick={() => impersonateMutation.mutate({ workspaceId: w.id })}
                disabled={impersonateMutation.isPending}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded transition-colors disabled:opacity-50"
              >
                {impersonateMutation.isPending ? "Entering..." : "Enter as this workspace"}
              </button>
              {impersonateMutation.isError && (
                <div className="mt-2 text-xs text-red-600">{impersonateMutation.error?.message}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
