import { formatScore, FACTORS, labelForScore, type Run } from "./simulate";
import { useInView } from "./motion";
import { StationMark } from "./StationMark";
import type { CSSProperties } from "react";

interface CompatibilitySectionProps {
  run: Run;
}

function StrategyDiagram({ beds }: { beds: 2 | 3 | 4 }): JSX.Element {
  const nodes =
    beds === 2
      ? [
          [36, 30],
          [84, 30],
        ]
      : beds === 3
        ? [
            [30, 40],
            [60, 12],
            [90, 40],
          ]
        : [
            [30, 14],
            [90, 14],
            [30, 46],
            [90, 46],
          ];

  const edges =
    beds === 2
      ? [[0, 1]]
      : beds === 3
        ? [
            [0, 1],
            [1, 2],
            [0, 2],
          ]
        : [
            [0, 1],
            [0, 2],
            [0, 3],
            [1, 2],
            [1, 3],
            [2, 3],
          ];

  return (
    <svg
      className={`mm-strategy-diagram mm-strategy-${beds}`}
      viewBox="0 0 120 60"
      aria-hidden="true"
      focusable="false"
    >
      {edges.map(([from, to]) => (
        <line
          key={`${from}-${to}`}
          className="mm-strategy-edge"
          x1={nodes[from][0]}
          y1={nodes[from][1]}
          x2={nodes[to][0]}
          y2={nodes[to][1]}
          pathLength={1}
        />
      ))}
      {nodes.map(([x, y], index) => (
        <circle
          key={`${x}-${y}`}
          className={`mm-strategy-node ${beds === 3 && index === 0 ? "is-seed" : ""}`}
          cx={x}
          cy={y}
          r={5}
          style={{ transitionDelay: `${index * 60}ms` }}
        />
      ))}
    </svg>
  );
}

export function CompatibilitySection({ run }: CompatibilitySectionProps): JSX.Element {
  const { ref, inView } = useInView<HTMLElement>();
  const pair = run.samplePair;
  const room = pair.room;

  return (
    <section
      ref={ref}
      id="compatibility"
      className={`mm-section mm-rail mm-compat ${inView ? "is-in" : ""}`}
      aria-labelledby="compat-heading"
      data-home-station="04–05"
      data-home-label="Score & Match"
    >
      <div className="mm-wrap">
        <StationMark station="04–05" label="Score, then match" note="ten factors · three strategies" />
        <div className="mm-split-head">
          <h2 id="compat-heading">Ten weighted factors.</h2>
          <div className="mm-head-copy">
            <p className="mm-body">
              Inside the boundary, every eligible pair is scored on the same ten factors. Weights
              add to one. A missing answer is excluded and the rest are redistributed — never filled
              in with a guess.
            </p>
            <p className="mm-body mm-body-dim">
              A pair only reaches Excellent when it clears 0.90 and no heavy factor is zero. A high
              average cannot hide a critical clash.
            </p>
          </div>
        </div>

        <article className="mm-paper mm-pair-sheet" aria-labelledby="pair-title">
          <header className="mm-pair-head">
            <div>
              <p className="mm-mono-label">Sample pair</p>
              <h3 id="pair-title">
                {run.students[pair.a].id} × {run.students[pair.b].id}
              </h3>
            </div>
            <p className="mm-pair-context">
              Room {room.id} · {pair.segments.short}
            </p>
          </header>

          <div className="mm-pair-grid">
            <div className="mm-pair-story">
              <p className="mm-pair-score">
                {formatScore(pair.score)}
                <span> / 1.00</span>
              </p>
              <p className={`mm-pair-verdict label-${pair.score >= 0.7 ? "good" : "okay"}`}>
                {labelForScore(pair.score, pair.factors)} pair
              </p>

              <div className="mm-reasons">
                <p className="mm-mono-label">The note a warden sees</p>
                <ul>
                  {pair.reasons.map((reason) => (
                    <li key={reason}>
                      <span className="mm-reason-dash" aria-hidden="true" />
                      {reason}
                    </li>
                  ))}
                </ul>
                <p className="mm-footnote">
                  Privacy-safe phrasing. Raw answers are never shown, to anyone.
                </p>
              </div>
            </div>

            <div className="mm-factors">
              <div className="mm-factor-head" aria-hidden="true">
                <span>Factor</span>
                <span>Weight</span>
                <span>Pair fit</span>
                <span>Raw</span>
                <span>Points</span>
              </div>
              {pair.factors.map((factor, factorIndex) => {
                const heavy = FACTORS.find((definition) => definition.key === factor.key)?.heavy;
                return (
                  <div
                    className="mm-factor"
                    key={factor.key}
                    role="group"
                    style={{ ["--fi" as string]: factorIndex } as CSSProperties}
                    aria-label={`${factor.label}: weight ${Math.round(
                      factor.weight * 100,
                    )} percent, pair fit ${factor.raw.toFixed(2)}, contributes ${factor.contribution.toFixed(
                      3,
                    )}`}
                  >
                    <span className="mm-factor-name">
                      {factor.label}
                      {heavy ? (
                        <span className="mm-heavy" aria-label="heavy factor">
                          •
                        </span>
                      ) : null}
                    </span>
                    <span className="mm-factor-weight">{Math.round(factor.weight * 100)}%</span>
                    <span className="mm-factor-bar" aria-hidden="true">
                      <span
                        className={`mm-factor-fill ${factor.raw < 0.4 ? "is-low" : ""}`}
                        style={{ ["--raw" as string]: factor.raw } as CSSProperties}
                      />
                    </span>
                    <span className="mm-factor-value">{factor.raw.toFixed(2)}</span>
                    <span className="mm-factor-points">
                      {factor.contribution.toFixed(3)}
                      <span className="mm-points-unit"> pts</span>
                    </span>
                  </div>
                );
              })}
              <p className="mm-factor-total">
                Ten contributions total {formatScore(pair.score)}. The bullet marks a heavy factor;
                Excellent needs all five non-zero. Contributions are shown to three decimals, the
                pair score to two.
              </p>
            </div>
          </div>

          <div className="mm-strategies">
            <div className="mm-strategy">
              <StrategyDiagram beds={2} />
              <p className="mm-strategy-title">2 beds</p>
              <p>Maximum-weight matching over every eligible pair.</p>
            </div>
            <div className="mm-strategy">
              <StrategyDiagram beds={3} />
              <p className="mm-strategy-title">3 beds</p>
              <p>Blossom seed pairs grow from the student with the fewest options.</p>
            </div>
            <div className="mm-strategy">
              <StrategyDiagram beds={4} />
              <p className="mm-strategy-title">4 beds</p>
              <p>Pairs first, then merge the best of six edges in each quad.</p>
            </div>
            <div className="mm-swap">
              <p className="mm-mono-label">Then the swap pass</p>
              <p>
                A swap is only accepted if it strictly improves the weakest student, and never
                creates a new Poor.
              </p>
              <p className="mm-swap-data">
                {run.audit.swapPasses} passes · {run.audit.swapsAccepted} accepted ·{" "}
                {run.audit.newPoorFromSwaps} new Poor
              </p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
