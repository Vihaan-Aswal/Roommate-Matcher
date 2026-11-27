import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";

import { LoginPage } from "../../pages/LoginPage";
import { warmBackend } from "../../lib/apiClient";

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: useAuthMock,
}));

vi.mock("../../lib/apiClient", () => ({
  warmBackend: vi.fn(() => Promise.resolve(false)),
}));

const signInWithEmailMock = vi.fn();
const startDemoSessionMock = vi.fn();

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={["/login"]}
    >
      <Routes>
        <Route
          path="/login"
          element={
            <>
              <LoginPage />
              <LocationProbe />
            </>
          }
        />
        <Route path="/app" element={<LocationProbe />} />
        <Route path="/app/:workspaceId/dashboard" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    signInWithEmailMock.mockReset();
    startDemoSessionMock.mockReset();
    vi.mocked(warmBackend).mockReset();
    vi.mocked(warmBackend).mockResolvedValue(false);
    sessionStorage.clear();

    useAuthMock.mockReturnValue({
      user: null,
      token: null,
      isLoading: false,
      signInWithEmail: signInWithEmailMock,
      startDemoSession: startDemoSessionMock,
      signOut: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers both doors: a throwaway demo workspace and a real sign-in", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Open the desk." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /open the demo workspace/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(
      screen.getByText(/kept for up to 24 hours; expired demos are cleaned up periodically/i),
    ).toBeInTheDocument();
  });

  it("hides the sign-in form on the entry-only demo page", () => {
    render(
      <MemoryRouter initialEntries={["/try"]}>
        <Routes>
          <Route path="/try" element={<LoginPage entryOnly />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", { name: /open the demo workspace/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("sends an already-signed-in visitor with a demo session straight to that workspace", () => {
    sessionStorage.setItem("demo_token", "demo-token");
    sessionStorage.setItem("demo_workspace_id", "ws-demo");
    useAuthMock.mockReturnValue({
      user: { email: "demo@example.com", isDemo: true },
      token: "demo-token",
      isLoading: false,
      signInWithEmail: signInWithEmailMock,
      startDemoSession: startDemoSessionMock,
      signOut: vi.fn(),
    });

    renderPage();

    expect(screen.getByTestId("location").textContent).toBe("/app/ws-demo/dashboard");
  });

  it("sends an already-signed-in visitor without a demo session to the chooser", () => {
    useAuthMock.mockReturnValue({
      user: { email: "warden@example.com", isDemo: false },
      token: "token",
      isLoading: false,
      signInWithEmail: signInWithEmailMock,
      startDemoSession: startDemoSessionMock,
      signOut: vi.fn(),
    });

    renderPage();

    expect(screen.getByTestId("location").textContent).toBe("/app");
  });

  it("creates a demo workspace and opens it", async () => {
    const pending = deferred();
    startDemoSessionMock.mockImplementation(async () => {
      await pending.promise;
      sessionStorage.setItem("demo_token", "demo-token");
      sessionStorage.setItem("demo_workspace_id", "ws-fresh-demo");
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /open the demo workspace/i }));
    expect(
      screen.getByRole("button", { name: /creating the workspace/i }),
    ).toBeDisabled();

    pending.resolve();

    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe("/app/ws-fresh-demo/dashboard"),
    );
    expect(startDemoSessionMock).toHaveBeenCalledWith("demo@example.com");
  });

  it("falls back to the chooser when the demo response carries no workspace id", async () => {
    startDemoSessionMock.mockResolvedValue(undefined);

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /open the demo workspace/i }));

    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/app"));
  });

  it("reports a demo failure with its message", async () => {
    startDemoSessionMock.mockRejectedValue(new Error("demo quota exhausted"));

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /open the demo workspace/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The demo could not start.");
    expect(alert).toHaveTextContent("demo quota exhausted");
    expect(screen.getByTestId("location").textContent).toBe("/login");
  });

  it("reports a demo failure that is not an Error", async () => {
    startDemoSessionMock.mockRejectedValue("gateway timeout");

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /open the demo workspace/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "The demo workspace could not be created.",
      ),
    );
  });

  it("signs in with the typed credentials", async () => {
    const pending = deferred();
    signInWithEmailMock.mockReturnValue(pending.promise);

    renderPage();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "warden@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
    expect(signInWithEmailMock).toHaveBeenCalledWith("warden@example.com", "correct horse");

    pending.resolve();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled(),
    );
  });

  it("reports a rejected sign-in and marks both fields invalid", async () => {
    signInWithEmailMock.mockRejectedValue(new Error("Invalid login credentials"));

    renderPage();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "warden@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Invalid login credentials");
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("location").textContent).toBe("/login");
  });

  it("reports a sign-in failure that is not an Error", async () => {
    signInWithEmailMock.mockRejectedValue("network down");

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Sign-in failed."),
    );
  });

  it("warms the backend on mount and again before the demo click", () => {
    renderPage();
    expect(warmBackend).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(
      screen.getByRole("button", { name: /open the demo workspace/i }),
    );
    expect(warmBackend).toHaveBeenCalledTimes(2);
  });

  it("shows no waking notice when the demo finishes before the grace period", async () => {
    startDemoSessionMock.mockImplementation(async () => {
      sessionStorage.setItem("demo_token", "demo-token");
      sessionStorage.setItem("demo_workspace_id", "ws-fast-demo");
    });

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /open the demo workspace/i }));

    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe("/app/ws-fast-demo/dashboard"),
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the sleeping-server notice after the cold grace period and counts down", () => {
    vi.useFakeTimers();
    startDemoSessionMock.mockReturnValue(new Promise<void>(() => {}));

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /open the demo workspace/i }));

    expect(screen.queryByRole("status")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1499);
    });
    expect(screen.queryByRole("status")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      "The demo server sleeps when idle, so the first load can take about a minute.",
    );
    expect(screen.getByText("About 60s left")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /creating the workspace/i })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText("About 59s left")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(59_000);
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Almost there — finishing the seeded workspace.",
    );
    expect(screen.queryByText(/left$/)).toBeNull();
  });

  it("shows no notice for a 3.5s response when the prewarm already woke the backend", async () => {
    vi.useFakeTimers();
    vi.mocked(warmBackend).mockResolvedValue(true);
    const pending = deferred();
    startDemoSessionMock.mockImplementation(async () => {
      await pending.promise;
      sessionStorage.setItem("demo_token", "demo-token");
      sessionStorage.setItem("demo_workspace_id", "ws-warm-demo");
    });

    renderPage();
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: /open the demo workspace/i }));
    act(() => {
      vi.advanceTimersByTime(3500);
    });

    expect(screen.queryByRole("status")).toBeNull();

    await act(async () => {
      pending.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("waits 5.5s on a warm prewarm before showing the notice", async () => {
    vi.useFakeTimers();
    vi.mocked(warmBackend).mockResolvedValue(true);
    startDemoSessionMock.mockReturnValue(new Promise<void>(() => {}));

    renderPage();
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: /open the demo workspace/i }));

    act(() => {
      vi.advanceTimersByTime(5499);
    });
    expect(screen.queryByRole("status")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "The demo server sleeps when idle, so the first load can take about a minute.",
    );
    expect(screen.getByText("About 60s left")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("About 59s left")).toBeInTheDocument();
  });

  it("clears the countdown timers when the page unmounts", () => {
    vi.useFakeTimers();
    startDemoSessionMock.mockReturnValue(new Promise<void>(() => {}));

    const { unmount } = renderPage();
    fireEvent.click(screen.getByRole("button", { name: /open the demo workspace/i }));

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns to the error state when a slow demo request fails", async () => {
    vi.useFakeTimers();
    let reject!: (reason?: unknown) => void;
    startDemoSessionMock.mockReturnValue(
      new Promise<void>((_resolve, rej) => {
        reject = rej;
      }),
    );

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /open the demo workspace/i }));

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    await act(async () => {
      reject(new Error("still waking"));
      await Promise.resolve();
    });

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("still waking");
    expect(screen.getByTestId("location").textContent).toBe("/login");
  });
});
