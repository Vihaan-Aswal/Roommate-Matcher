import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getPlatformTenants } from "../../lib/apiClient";
import { adminQueryKeys } from "../../hooks/adminQueryKeys";

export function PlatformTenantsPage() {
  const navigate = useNavigate();
  const [includeDemo, setIncludeDemo] = useState(false);
  const [filter, setFilter] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.platformTenants(includeDemo),
    queryFn: () => getPlatformTenants(includeDemo),
  });

  const filtered = (data?.tenants ?? []).filter((t) =>
    t.display_name.toLowerCase().includes(filter.toLowerCase()) ||
    t.slug.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-gray-900 flex items-center gap-2">
          <span className="bg-amber-100 text-amber-800 text-sm px-2 py-1 rounded-md font-sans">God Mode</span>
          Platform Console — All Tenants
        </h1>
        <p className="text-muted-foreground mt-2">View all tenants and assume control of any workspace.</p>
      </header>

      <div className="mb-6 flex items-center justify-between">
        <input
          type="text"
          placeholder="Filter by name or slug..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 w-64 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={includeDemo}
            onChange={(e) => setIncludeDemo(e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          Show Demo Tenants
        </label>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-200 rounded-md"></div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-4 rounded-md">
          Failed to load tenants. {(error as Error).message}
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Workspaces</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{t.display_name}</div>
                    <div className="text-gray-500 text-xs">{t.slug}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {t.contact_email || <span className="text-gray-400 italic">None</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {t.is_demo ? (
                      <span className="inline-flex rounded-full bg-blue-100 px-2 text-xs font-semibold leading-5 text-blue-800">Demo</span>
                    ) : (
                      <span className="inline-flex rounded-full bg-green-100 px-2 text-xs font-semibold leading-5 text-green-800">Real</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {t.workspace_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                    <button
                      onClick={() => navigate(`/platform/tenants/${t.id}/workspaces`)}
                      className="text-primary hover:text-primary-dark font-semibold inline-flex items-center gap-1"
                    >
                      Impersonate &rarr;
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No tenants found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
