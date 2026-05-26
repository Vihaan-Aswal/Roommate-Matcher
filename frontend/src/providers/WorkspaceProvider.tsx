/**
 * WorkspaceProvider.tsx
 *
 * Tracks which workspace the user is currently operating in.
 *
 * Phase 1: Populated from the app JWT / session metadata (the first/only workspace).
 * Phase 2: Will add workspace-switcher and URL-based workspace routing.
 */
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

interface WorkspaceState {
  workspaceId: string | null;
  setWorkspaceId: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const value = useMemo<WorkspaceState>(
    () => ({ workspaceId, setWorkspaceId }),
    [workspaceId]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
