/**
 * DataWarningBanner.tsx
 *
 * Displayed when a workspace contains generated (synthetic) preference
 * profiles from Magic Fill. Amber, because it is a caveat on the evidence.
 */
import { AlertTriangle } from "lucide-react";

interface DataWarningBannerProps {
  hasGeneratedProfiles: boolean;
  context?: "dashboard" | "results" | "fairness";
}

export default function DataWarningBanner({
  hasGeneratedProfiles,
  context = "dashboard",
}: DataWarningBannerProps) {
  if (!hasGeneratedProfiles) return null;

  const messages = {
    dashboard:
      "This workspace contains generated preference profiles. They were created by Magic Fill and are not real student responses.",
    results:
      "These results include students with generated preference data, so their placements may not reflect real preferences.",
    fairness:
      "These fairness figures include generated profiles, so the distribution may be skewed by synthetic answers.",
  };

  return (
    <div className="desk-note" data-tone="attention" role="note">
      <AlertTriangle size={16} strokeWidth={1.8} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div>
        <p className="desk-note-title">Generated data present</p>
        <p className="desk-note-body">{messages[context]}</p>
      </div>
    </div>
  );
}
