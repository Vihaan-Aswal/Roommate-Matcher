import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RouteErrorBoundary } from "../../components/RouteErrorBoundary";

function ThrowingChild(): JSX.Element {
  throw new Error("chunk failed");
}

describe("RouteErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a reload fallback when a route fails", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <RouteErrorBoundary>
        <ThrowingChild />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole("heading", { name: "This page could not load" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload the desk" })).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });

  it("renders children when nothing fails", () => {
    render(
      <RouteErrorBoundary>
        <p>Desk content</p>
      </RouteErrorBoundary>,
    );

    expect(screen.getByText("Desk content")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "This page could not load" })).not.toBeInTheDocument();
  });
});
