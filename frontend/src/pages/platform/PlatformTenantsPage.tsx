import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getPlatformTenants } from "../../lib/apiClient";
import { adminQueryKeys } from "../../hooks/adminQueryKeys";
import { InlineAlert } from "../../components/InlineAlert";
import { EmptyState } from "../../components/EmptyState";

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : parsed.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function PlatformTenantsPage(): JSX.Element {
  const navigate = useNavigate();
  const [includeDemo, setIncludeDemo] = useState(false);
  const [filter, setFilter] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.platformTenants(includeDemo),
    queryFn: () => getPlatformTenants(includeDemo),
  });

  const filtered = (data?.tenants ?? []).filter(
    (tenant) =>
      tenant.display_name.toLowerCase().includes(filter.toLowerCase()) ||
      tenant.slug.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="desk desk-canvas">
      <div className="desk-canvas-inner" style={{ maxWidth: 1080 }}>
        <header className="desk-row-between" style={{ marginBottom: 26 }}>
          <div>
            <Link className="desk-canvas-mark" to="/app">
              Roommate Matcher
            </Link>
            <p className="desk-mono" style={{ color: "var(--ink-faint)", marginTop: 4 }}>
              Platform console · super-admin
            </p>
          </div>
          <Link className="desk-btn desk-btn-field desk-btn-sm" to="/app">
            My workspaces
          </Link>
        </header>

        <main className="desk-paper" style={{ minHeight: 0, margin: 0 }}>
          <div className="desk-page">
            <header className="desk-mast">
              <div className="desk-mast-main">
                <h1 className="desk-mast-title">All tenants</h1>
                <p className="desk-mast-lede">
                  Every tenant on the platform and how many workspaces each one keeps. Opening a
                  workspace enters it as that tenant; the amber strip stays until you exit.
                </p>
              </div>
            </header>

            <div className="desk-filterbar" style={{ marginTop: 18 }}>
              <label className="desk-field" style={{ flex: 1, minWidth: 220 }}>
                <span className="desk-label">Filter</span>
                <input
                  className="desk-input"
                  type="text"
                  placeholder="Name or slug"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                />
              </label>
              <label className="desk-check" style={{ paddingBottom: 9 }}>
                <input
                  className="desk-checkbox"
                  type="checkbox"
                  checked={includeDemo}
                  onChange={(event) => setIncludeDemo(event.target.checked)}
                />
                Include demo tenants
              </label>
              <p className="desk-section-note" style={{ paddingBottom: 9 }}>
                {filtered.length} tenant{filtered.length === 1 ? "" : "s"}
              </p>
            </div>

            {isLoading ? (
              <div className="desk-stack" style={{ marginTop: 18 }} aria-busy="true">
                <p className="desk-loading-note">Reading tenants</p>
                <div className="desk-skel" style={{ height: 44 }} />
                <div className="desk-skel" style={{ height: 44 }} />
                <div className="desk-skel" style={{ height: 44 }} />
              </div>
            ) : null}

            {error ? (
              <div style={{ marginTop: 18 }}>
                <InlineAlert
                  title="Tenants could not be read"
                  message={(error as Error).message}
                  tone="error"
                />
              </div>
            ) : null}

            {!isLoading && !error && filtered.length === 0 ? (
              <div style={{ marginTop: 18 }}>
                <EmptyState
                  title={filter ? "No tenant matches that filter" : "No tenants on this platform yet"}
                  line={
                    filter
                      ? "Clear the filter, or include demo tenants to see the sandboxes."
                      : "A tenant is created when an institute signs in for the first time."
                  }
                />
              </div>
            ) : null}

            {!isLoading && !error && filtered.length > 0 ? (
              <div className="desk-table-wrap" data-stack="true" style={{ marginTop: 18 }}>
                <table className="desk-table">
                  <caption className="sr-only">All tenants</caption>
                  <thead>
                    <tr>
                      <th scope="col">Tenant</th>
                      <th scope="col">Contact</th>
                      <th scope="col">Type</th>
                      <th scope="col" data-align="right">
                        Workspaces
                      </th>
                      <th scope="col">Created</th>
                      <th scope="col">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((tenant) => (
                      <tr key={tenant.id}>
                        <td data-label="Tenant">
                          <p style={{ fontWeight: 600 }}>{tenant.display_name}</p>
                          <p className="desk-mono" style={{ color: "var(--paper-mid)", marginTop: 2 }}>
                            {tenant.slug}
                          </p>
                        </td>
                        <td data-label="Contact">
                          {tenant.contact_email ? (
                            <span className="desk-mono">{tenant.contact_email}</span>
                          ) : (
                            <span style={{ color: "var(--paper-mid)" }}>No contact recorded</span>
                          )}
                        </td>
                        <td data-label="Type">
                          <span className="desk-chip" data-tone={tenant.is_demo ? "quiet" : "mark"}>
                            {tenant.is_demo ? "Demo" : "Real"}
                          </span>
                        </td>
                        <td data-label="Workspaces" data-align="right">
                          <span className="desk-num">{tenant.workspace_count}</span>
                        </td>
                        <td data-label="Created">
                          <span className="desk-num">{formatDate(tenant.created_at)}</span>
                        </td>
                        <td data-label="Open">
                          <button
                            className="desk-link"
                            style={{ fontSize: 13 }}
                            type="button"
                            onClick={() => navigate(`/platform/tenants/${tenant.id}/workspaces`)}
                          >
                            Workspaces
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
