import { useParams } from "react-router-dom";

import { InlineAlert } from "../../components/InlineAlert";

export function StudentResultsPage(): JSX.Element {
  const { runId } = useParams<{ runId: string }>();

  if (!runId) {
    return (
      <InlineAlert
        title="Run required"
        message="Select a matching run to view student-level results."
        tone="error"
      />
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="font-serif text-3xl font-semibold">Student Results</h2>
      <p className="text-sm text-muted-foreground">
        Student-level matching results for run {runId}.
      </p>
    </section>
  );
}
