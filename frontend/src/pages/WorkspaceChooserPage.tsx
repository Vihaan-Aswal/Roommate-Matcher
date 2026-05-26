import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspacesQuery, useCreateWorkspaceMutation } from "../hooks/useWorkspacesQuery";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { InlineAlert } from "../components/InlineAlert";

export function WorkspaceChooserPage(): JSX.Element {
  const navigate = useNavigate();
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
    } catch (err) {
      // Error is rendered in the UI via createMutation.isError
    }
  };

  const workspaces = workspacesQuery.data?.workspaces || [];

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8 mt-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Welcome to Roommate Matcher
        </h1>
        <p className="text-muted-foreground">
          Select a workspace to continue or create a new one.
        </p>
      </div>

      {workspacesQuery.isLoading ? (
        <InlineAlert title="Loading workspaces..." message="Please wait while we fetch your workspaces." tone="info" />
      ) : null}

      {workspacesQuery.isError ? (
        <InlineAlert
          title="Error loading workspaces"
          message={workspacesQuery.error instanceof Error ? workspacesQuery.error.message : "An unknown error occurred"}
          tone="error"
        />
      ) : null}

      {createMutation.isError ? (
        <InlineAlert
          title="Failed to create workspace"
          message={createMutation.error instanceof Error ? createMutation.error.message : "An unknown error occurred"}
          tone="error"
        />
      ) : null}

      {workspacesQuery.isSuccess && workspaces.length === 0 && !isCreating ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg bg-white/50 space-y-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold">No workspaces found</h2>
            <p className="text-muted-foreground mt-1">Create your first workspace to get started.</p>
          </div>
          <Button onClick={() => setIsCreating(true)} size="lg" variant="accent">
            Create New Workspace
          </Button>
        </div>
      ) : null}

      {workspacesQuery.isSuccess && (workspaces.length > 0 || isCreating) ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <Card
              key={ws.id}
              className="cursor-pointer hover:border-primary/50 transition-colors flex flex-col justify-between"
              onClick={() => navigate(`/app/${encodeURIComponent(ws.id)}/dashboard`)}
            >
              <CardHeader>
                <CardTitle>{ws.name}</CardTitle>
                <CardDescription>Created: {new Date(ws.created_at).toLocaleDateString()}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <span className="capitalize text-xs px-2 py-1 bg-muted rounded-md">{ws.status}</span>
                  {ws.is_demo_seeded && (
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-md">Demo</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {isCreating ? (
            <Card className="border-primary/50 ring-1 ring-primary/20">
              <CardHeader>
                <CardTitle>New Workspace</CardTitle>
                <CardDescription>Enter a name for your workspace</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="space-y-4">
                  <input
                    type="text"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="Workspace Name"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                    disabled={createMutation.isPending}
                  />
                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCreating(false)}
                      disabled={createMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" variant="accent" disabled={createMutation.isPending || !newWorkspaceName.trim()}>
                      {createMutation.isPending ? "Creating..." : "Create"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : workspaces.length > 0 ? (
            <Card
              className="cursor-pointer border-dashed hover:border-primary/50 transition-colors flex items-center justify-center min-h-[160px]"
              onClick={() => setIsCreating(true)}
            >
              <div className="text-center p-6 text-muted-foreground hover:text-foreground">
                <span className="text-2xl block mb-2">+</span>
                <span className="font-medium">Create New Workspace</span>
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
