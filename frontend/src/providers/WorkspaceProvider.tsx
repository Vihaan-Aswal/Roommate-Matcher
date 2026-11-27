import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useWorkspacesQuery } from "../hooks/useWorkspacesQuery";

interface WorkspaceState {
  workspaceId: string | null;
  workspaceName: string | null;
  navigateToWorkspace: (id: string) => void;
}

export const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();

  const { data } = useWorkspacesQuery();

  const workspaceName = useMemo(() => {
    if (!workspaceId || !data) return null;
    const ws = data.workspaces.find((w) => w.id === workspaceId);
    return ws ? ws.name : null;
  }, [workspaceId, data]);

  const navigateToWorkspace = useCallback(
    (id: string) => {
      navigate(`/app/${encodeURIComponent(id)}/dashboard`);
    },
    [navigate]
  );

  const value = useMemo<WorkspaceState>(
    () => ({
      workspaceId: workspaceId || null,
      workspaceName,
      navigateToWorkspace,
    }),
    [workspaceId, workspaceName, navigateToWorkspace]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
