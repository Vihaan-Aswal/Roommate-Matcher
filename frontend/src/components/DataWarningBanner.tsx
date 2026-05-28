/**
 * DataWarningBanner.tsx
 *
 * Displayed when a workspace contains generated (synthetic) preference
 * profiles from Magic Fill. Warns that results may not reflect real
 * student preferences.
 */
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
    dashboard: `This workspace contains generated preference profiles. These were created by Magic Fill and do not represent real student responses.`,
    results: `⚠️ These matching results include students with generated (synthetic) preference data. Results for these students may not reflect their actual preferences.`,
    fairness: `⚠️ Fairness metrics include generated profiles. Statistical measures may be skewed by synthetic data.`,
  };

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <span className="text-lg">⚠️</span>
        <div>
          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Generated Data Present
          </h4>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
            {messages[context]}
          </p>
        </div>
      </div>
    </div>
  );
}
