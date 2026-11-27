import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "../../providers/AuthProvider";

const { getSupabaseMock, hasSupabaseSessionHintMock } = vi.hoisted(() => ({
  getSupabaseMock: vi.fn(),
  hasSupabaseSessionHintMock: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  getSupabase: getSupabaseMock,
  hasSupabaseSessionHint: hasSupabaseSessionHintMock,
  isSupabaseConfigured: true,
}));

function AuthProbe(): JSX.Element {
  const { isLoading, user } = useAuth();
  return <p>{isLoading ? "loading" : user ? "user" : "signed-out"}</p>;
}

describe("AuthProvider lazy Supabase", () => {
  afterEach(() => {
    sessionStorage.clear();
    getSupabaseMock.mockReset();
    hasSupabaseSessionHintMock.mockReset();
  });

  it("does not load the Supabase SDK without a session hint", async () => {
    hasSupabaseSessionHintMock.mockReturnValue(false);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("signed-out")).toBeInTheDocument(),
    );
    expect(getSupabaseMock).not.toHaveBeenCalled();
  });
});
