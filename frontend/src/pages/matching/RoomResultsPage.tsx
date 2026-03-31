import { useParams } from "react-router-dom";

import { InlineAlert } from "../../components/InlineAlert";

export function RoomResultsPage(): JSX.Element {
  const { runId } = useParams<{ runId: string }>();

  if (!runId) {
    return (
      <InlineAlert
        title="Run required"
        message="Select a matching run to view room assignments."
        tone="error"
      />
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="font-serif text-3xl font-semibold">Room Results</h2>
      <p className="text-sm text-muted-foreground">
        Room-level matching results for run {runId}.
      </p>
    </section>
  );
}
