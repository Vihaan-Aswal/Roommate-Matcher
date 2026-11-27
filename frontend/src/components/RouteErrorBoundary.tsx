import { Component, type ReactNode } from "react";

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  failed: boolean;
}

/** Keeps the desk shell mounted when a lazy route chunk fails to load. */
export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { failed: true };
  }

  render(): ReactNode {
    if (!this.state.failed) {
      return this.props.children;
    }

    return (
      <div className="desk-empty" role="alert">
        <h1 className="desk-empty-title">This page could not load</h1>
        <p className="desk-empty-line">
          The app may have been updated while you were away. Reload to pick up the new files.
        </p>
        <button className="desk-btn desk-btn-field" type="button" onClick={() => window.location.reload()}>
          Reload the desk
        </button>
      </div>
    );
  }
}
