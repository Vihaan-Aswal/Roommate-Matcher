import { formatScore, formatCount, type Run } from "./simulate";
import { useInView } from "./motion";
import type { CSSProperties } from "react";

interface BoundarySectionProps {
  run: Run;
}

export function BoundarySection({ run }: BoundarySectionProps): JSX.Element {
  const { ref, inView } = useInView<HTMLElement>();
  const segment = run.healthySegment;
  const weakestRoom = run.healthySegmentRoom;
  const riskHere = weakestRoom.atRisk.length;

  return (
    <section
      ref={ref}
      id="boundary"
      className={`mm-section mm-boundaries ${inView ? "is-in" : ""}`}
      aria-labelledby="boundary-heading"
    >
      <div className="mm-wrap">
        <div className="mm-split-head">
          <h2 id="boundary-heading">
            The boundary{" "}
            <br />
            decides first.
          </h2>
          <div className="mm-head-copy">
            <p className="mm-body">
              Four hard boundaries split the cohort before compatibility is even
              considered: gender, year group, AC type and room size. Nothing crosses them — not a
              pair, not a reason, not a fairness number.
            </p>
            <p className="mm-body mm-body-dim">
              Four segments exist in this sample. The desk can hold many more; the rule is the same
              for every one.
            </p>
          </div>
        </div>

        <dl className="mm-rule-index" aria-label="The four boundaries">
          <div>
            <dt>Gender</dt>
            <dd>Men · Women</dd>
          </div>
          <div>
            <dt>Year group</dt>
            <dd>1st year · 2nd–4th year</dd>
          </div>
          <div>
            <dt>AC type</dt>
            <dd>AC · Non-AC</dd>
          </div>
          <div>
            <dt>Room size</dt>
            <dd>2 · 3 · 4 beds</dd>
          </div>
        </dl>

        <div className="mm-pair-ledger">
          <div>
            <span className="mm-ledger-number">{formatCount(run.pairsPossible)}</span>
            <span className="mm-ledger-label">possible pairs in the cohort</span>
          </div>
          <span className="mm-ledger-rule" aria-hidden="true" />
          <div>
            <span className="mm-ledger-number">{formatCount(run.pairsRejected)}</span>
            <span className="mm-ledger-label">discarded at the boundary</span>
          </div>
          <span className="mm-ledger-rule" aria-hidden="true" />
          <div>
            <span className="mm-ledger-number is-strong">{formatCount(run.pairsScored)}</span>
            <span className="mm-ledger-label">pairs actually scored</span>
          </div>
        </div>

        <div className="mm-segments">
          {run.segments.map((seg) => (
            <article className="mm-segment" key={seg.key}>
              <header className="mm-segment-head">
                <h3>{seg.short}</h3>
                <p>
                  {seg.members.length} students · {seg.rooms.length} rooms
                </p>
              </header>
              <div
                className="mm-room-grid"
                style={{ ["--cols" as string]: 3 } as CSSProperties}
              >
                {seg.rooms.map((room, roomIndex) => (
                  <div
                    className={`mm-room ${room.atRisk.length > 0 ? "is-risk" : ""}`}
                    key={room.id}
                    style={{ ["--i" as string]: roomIndex } as CSSProperties}
                  >
                    {room.members.map((member) => (
                      <span
                        className="mm-room-mark"
                        data-label={run.students[member].label}
                        key={run.students[member].id}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <footer className="mm-segment-foot">
                <p>
                  <span>mean</span>
                  <strong>{formatScore(seg.mean)}</strong>
                </p>
                <p>
                  <span>floor</span>
                  <strong className={seg.floor < 0.55 ? "is-risk" : ""}>
                    {formatScore(seg.floor)}
                  </strong>
                </p>
              </footer>
            </article>
          ))}
        </div>

        <div className="mm-callout">
          <span className="mm-callout-mark" aria-hidden="true" />
          <p>
            <strong>{segment.short}</strong> looks healthy at {formatScore(segment.mean)} mean. Room{" "}
            <strong>{weakestRoom.id}</strong> sits at {formatScore(weakestRoom.score)}, and{" "}
            {riskHere === 2 ? "both at-risk students live" : "an at-risk student lives"} there. That
            is the room the fairness statement puts first.
          </p>
        </div>
      </div>
    </section>
  );
}

