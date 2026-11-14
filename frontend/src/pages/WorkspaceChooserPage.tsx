import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { useWorkspacesQuery, useCreateWorkspaceMutation } from "../hooks/useWorkspacesQuery";
import { useAuth } from "../providers/AuthProvider";
import { Button } from "../components/ui/button";
import { InlineAlert } from "../components/InlineAlert";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";

function formatCreated(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function WorkspaceChooserPage(): JSX.Element {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const workspacesQuery = useWorkspacesQuery();
  const createMutation = useCreateWorkspaceMutation();
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    try {
      const newWs = await createMutation.mutateAsync({ name: newWorkspaceName.trim() });
      navigate(`/app/${encodeURIComponent(newWs.id)}/dashboard`);
    } catch {
      // Rendered from createMutation.isError below.
    }
  };

  const workspaces = workspacesQuery.data?.workspaces || [];

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="desk desk-canvas">
      <div className="desk-canvas-inner" style={{ maxWidth: 880 }}>
        <header className="desk-row-between" style={{ marginBottom: 28 }}>
          <div>
            <Link className="desk-canvas-mark" to="/">
              Roommate Matcher
            </Link>
            <p className="desk-mono" style={{ color: "var(--ink-faint)", marginTop: 4 }}>
              {user?.email ?? "signed in"}
            </p>
          </div>
          <div className="desk-row" style={{ gap: 8 }}>
            {user?.isDemo ? <span className="desk-chip" data-tone="mark">Demo</span> : null}
            <Button variant="field" size="sm" onClick={() => void handleSignOut()}>
              Sign out
            </Button>
          </div>
        </header>

        <main className="desk-paper" style={{ minHeight: 0, margin: 0 }}>
          <div className="desk-page" style={{ padding: "30px 34px 34px" }}>
            <header className="desk-mast">
              <div className="desk-mast-main">
                <h1 className="desk-mast-title">Choose a workspace</h1>
                <p className="desk-mast-lede">
                  Each workspace holds its own roster, rooms, responses and runs. Nothing crosses
                  between them.
                </p>
              </div>
              {!isCreating && workspaces.length > 0 ? (
                <div className="desk-mast-actions">
                  <Button variant="outline" onClick={() => setIsCreating(true)}>
                    Create New Workspace
                  </Button>
                </div>
              ) : null}
            </header>

            {workspacesQuery.isLoading ? (
              <div className="desk-stack" style={{ marginTop: 22 }} aria-busy="true">
                <p className="desk-loading-note">Reading your workspaces</p>
                <div className="desk-skel desk-skel-row" />
                <div className="desk-skel desk-skel-row" />
              </div>
            ) : null}

            {workspacesQuery.isError ? (
              <div style={{ marginTop: 22 }}>
                <InlineAlert
                  title="Your workspaces could not be loaded"
                  message={
                    workspacesQuery.error instanceof Error
                      ? workspacesQuery.error.message
                      : "The request failed."
                  }
                  tone="error"
                  actions={
                    <Button size="sm" variant="outline" onClick={() => void workspacesQuery.refetch()}>
                      Try again
                    </Button>
                  }
                />
              </div>
            ) : null}

            {createMutation.isError ? (
              <div style={{ marginTop: 22 }}>
                <InlineAlert
                  title="The workspace was not created"
                  message={
                    createMutation.error instanceof Error
                      ? createMutation.error.message
                      : "The request failed."
                  }
                  tone="error"
                />
              </div>
            ) : null}

            {workspacesQuery.isSuccess && workspaces.length === 0 && !isCreating ? (
              <div style={{ marginTop: 22 }}>
                <EmptyState
                  title="No workspaces yet"
                  line="Create one workspace per institute desk you run. It starts empty and waits for the roster file."
                  action={
                    <Button onClick={() => setIsCreating(true)}>Create New Workspace</Button>
                  }
                />
              </div>
            ) : null}

            {workspacesQuery.isSuccess && (workspaces.length > 0 || isCreating) ? (
              <div className="desk-list" style={{ marginTop: 22 }}>
                {workspaces.map((ws) => (
                  <Link
                    className="desk-list-row"
                    key={ws.id}
                    to={`/app/${encodeURIComponent(ws.id)}/dashboard`}
                  >
                    <span className="desk-list-main">
                      <span className="desk-list-title" style={{ fontSize: 16, fontFamily: '"Besley MM", Georgia, serif' }}>
                        {ws.name}
                      </span>
                      <span className="desk-list-meta">
                        Created {formatCreated(ws.created_at)}
                        <span className="desk-sep"> · </span>
                        {ws.status}
                      </span>
                    </span>
                    <span className="desk-list-side">
                      {ws.is_demo_seeded ? <StatusBadge value="Demo" /> : null}
                      <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                  </Link>
                ))}

                {isCreating ? (
                  <form
                    onSubmit={handleCreate}
                    className="desk-row"
                    style={{ padding: "14px 4px", gap: 10 }}
                  >
                    <label className="desk-field" style={{ flex: 1, minWidth: 220 }}>
                      <span className="desk-label">New workspace name</span>
                      <input
                        className="desk-input"
                        type="text"
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        placeholder="e.g. Hostel office 2026"
                        autoFocus
                        disabled={createMutation.isPending}
                      />
                    </label>
                    <div className="desk-row" style={{ gap: 8 }}>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreating(false)}
                        disabled={createMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createMutation.isPending || !newWorkspaceName.trim()}
                      >
                        {createMutation.isPending ? "Creating…" : "Create"}
                      </Button>
                    </div>
                  </form>
                ) : null}
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
