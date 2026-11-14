import type { SegmentIdentity } from "../lib/segmentLabel";
import { hasReadableSegmentLabel, segmentLabel } from "../lib/segmentLabel";

interface SegmentLabelProps {
  segment: SegmentIdentity;
  /** Show the raw key as a mono subline: registers, proofs, support. */
  showKey?: boolean;
}

/**
 * Human label primary, raw key secondary. The key is only printed when the
 * label is a real translation (never twice).
 */
export function SegmentLabel({ segment, showKey = false }: SegmentLabelProps): JSX.Element {
  return (
    <span className="desk-segname">
      <span className="desk-segname-main">{segmentLabel(segment)}</span>
      {showKey && hasReadableSegmentLabel(segment) ? (
        <span className="desk-segname-key">{segment.segment_key}</span>
      ) : null}
    </span>
  );
}
