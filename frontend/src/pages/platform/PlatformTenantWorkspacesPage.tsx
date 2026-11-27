import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import {
  getPlatformTenantWorkspaces,
  impersonateTenant,
  getPlatformTenant,
  setApiToken,
} from "../../lib/apiClient";
import { adminQueryKeys } from "../../hooks/adminQueryKeys";
import { useAuth } from "../../providers/AuthProvider";
import { useToast } from "../../hooks/use-toast";
import { InlineAlert } from "../../components/InlineAlert";
import { EmptyState } from "../../components/EmptyState";
import { Button } from "../../components/ui/button";

const IMPERSONATION_TOKEN_KEY = "impersonation_token";
const REAL_ADMIN_TOKEN_KEY = "real_admin_token";

export function PlatformTenantWorkspacesPage(): JSX.Element {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { token: realToken } = useAuth();
  const { toast } = useToast();

  const { data: tenantData } = useQuery({
    queryKey: adminQueryKeys.platformTenant(tenantId!),
    queryFn: () => getPlatformTenant(tenantId!),
    enabled: !!tenantId,
  });

  const { data, isLoading, error } = useQuery({
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
      toast({
        title: "Impersonation failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const workspaces = data?.workspaces ?? [];

  return (
    <div className="desk desk-canvas">
      <div className="desk-canvas-inner" style={{ maxWidth: 1000 }}>
        <header className="desk-row-between" style={{ marginBottom: 26 }}>
          <div>
            <Link className="desk-canvas-mark" to="/app">
              Roommate Matcher
            </Link>
            <p className="desk-mono" style={{ color: "var(--ink-faint)", marginTop: 4 }}>
              Platform console · super-admin
            </p>
          </div>
          <Link className="desk-btn desk-btn-field desk-btn-sm" to="/platform">
            <ArrowLeft size={13} strokeWidth={1.8} aria-hidden="true" />
            All tenants
          </Link>
        </header>

        <main className="desk-paper" style={{ minHeight: 0, margin: 0 }}>
          <div className="desk-page">
            <header className="desk-mast">
              <div className="desk-mast-main">
                <h1 className="desk-mast-title">
                  {tenantData?.display_name ?? "Tenant workspaces"}
                </h1>
                <p className="desk-mast-lede">
                  Entering a workspace replaces this session with the tenant's. The amber strip at the
                  top of every page says whose data you are reading; exiting returns you here.
                </p>
              </div>
            </header>

            {isLoading ? (
              <div className="desk-stack" style={{ marginTop: 18 }} aria-busy="true">
                <p className="desk-loading-note">Reading workspaces</p>
                <div className="desk-skel" style={{ height: 44 }} />
                <div className="desk-skel" style={{ height: 44 }} />
              </div>
            ) : null}

            {error ? (
              <div style={{ marginTop: 18 }}>
                <InlineAlert
                  title="Workspaces could not be read"
                  message={(error as Error).message}
                  tone="error"
                />
              </div>
            ) : null}

            {!isLoading && !error && workspaces.length === 0 ? (
              <div style={{ marginTop: 18 }}>
                <EmptyState
                  title="This tenant has no workspaces"
                  line="A tenant gets its first workspace when the institute creates one from the chooser."
                />
              </div>
            ) : null}

            {workspaces.length > 0 ? (
              <div className="desk-list" style={{ marginTop: 18 }}>
                {workspaces.map((workspace) => (
                  <div className="desk-list-row" key={workspace.id}>
                    <div className="desk-list-main">
                      <p className="desk-list-title" style={{ fontSize: 15 }}>
                        {workspace.name}
                      </p>
                      <p className="desk-list-meta">
                        <span className="desk-mono">{workspace.id}</span>
                        <span className="desk-sep"> · </span>
                        {workspace.status}
                        <span className="desk-sep"> · </span>
                        {workspace.source}
                      </p>
                    </div>
                    <div className="desk-list-side">
                      {workspace.is_demo_seeded ? (
                        <span className="desk-chip" data-tone="quiet">
                          Demo seeded
                        </span>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => impersonateMutation.mutate({ workspaceId: workspace.id })}
                        disabled={impersonateMutation.isPending}
                      >
                        {impersonateMutation.isPending ? "Entering…" : "Enter as this workspace"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {impersonateMutation.isError ? (
              <p className="desk-error" style={{ marginTop: 12 }} role="alert">
                {impersonateMutation.error?.message}
              </p>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
