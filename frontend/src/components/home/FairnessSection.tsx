import { formatScore, type Run } from "./simulate";
import { useInView } from "./motion";
import { StationMark } from "./StationMark";
import type { CSSProperties } from "react";

interface FairnessSectionProps {
  run: Run;
}

const FLOOR = 0.55;
const CHART_MIN = 0.34;

export function FairnessSection({ run }: FairnessSectionProps): JSX.Element {
  const { ref, inView } = useInView<HTMLElement>();
  const rows = run.segments.map((segment) => {
    const students = segment.members
      .map((index) => run.students[index])
      .sort(
        (left, right) =>
          left.satisfaction - right.satisfaction || left.index - right.index,
      );
    const weakest = [...segment.rooms].sort((left, right) => left.score - right.score)[0];
    return { segment, students, weakest };
  });

  return (
    <section
      ref={ref}
      id="fairness"
      className={`mm-section mm-rail mm-fairness ${inView ? "is-in" : ""}`}
      aria-labelledby="fairness-heading"
      data-home-station="06"
      data-home-label="Fairness"
    >
      <div className="mm-wrap">
        <StationMark station="06" label="Report the floor" note="the weakest room first" />
        <div className="mm-split-head">
          <h2 id="fairness-heading">
            Report the floor,{" "}
            <br />
            not the average.
          </h2>
          <div className="mm-head-copy">
            <p className="mm-body">
              An average can hide the room a warden needs to visit. The fairness statement reports
              every student below the 0.55 floor, the label distribution, and the weakest room in
              each segment.
            </p>
            <p className="mm-body mm-body-dim">
              Weaker segments are surfaced, not smoothed. That is the point of the statement.
            </p>
          </div>
        </div>

        <div className="mm-floor-panel">
          <div className="mm-floor-head">
            <p className="mm-mono-label">
              {run.students.length} students · sorted by satisfaction within each segment
            </p>
            <ul className="mm-legend">
              {(["Excellent", "Good", "Okay", "Poor"] as const).map((label) => (
                <li key={label}>
                  <span
                    className={`mm-legend-mark label-${label.toLowerCase()}`}
                    aria-hidden="true"
                  />
                  {label} {run.labelCounts[label]}
                </li>
              ))}
            </ul>
          </div>

          <div
            className="mm-floor-register"
            role="table"
            aria-label="Fairness floor register. Four segments, sorted by satisfaction, with the 0.55 floor marked. S-009 and S-021 are below the floor."
          >
            <div className="mm-register-head" role="row">
              <span role="columnheader">Segment</span>
              <span role="columnheader">24 students · floor 0.55 marked</span>
              <span role="columnheader">Mean</span>
              <span role="columnheader">Weakest room</span>
              <span role="columnheader">Below floor</span>
            </div>

            {rows.map(({ segment, students, weakest }) => {
              const atRisk = segment.atRisk.length;
              return (
                <div
                  className={`mm-register-row ${atRisk > 0 ? "is-risk" : ""}`}
                  role="row"
                  key={segment.key}
                >
                  <div className="mm-register-seg" role="rowheader">
                    <b>{segment.short}</b>
                    <span>{segment.members.length} students</span>
                  </div>

                  <div className="mm-register-plot" role="cell">
                    <span className="mm-register-floor" aria-hidden="true" />
                    <span className="mm-register-marks" aria-hidden="true">
                      {students.map((student) => {
                        const height = Math.max(
                          0.02,
                          Math.min(
                            1,
                            (student.satisfaction - CHART_MIN) / (1 - CHART_MIN),
                          ),
                        );
                        return (
                          <i
                            key={student.id}
                            data-label={student.label}
                            style={{ ["--y" as string]: height } as CSSProperties}
                          />
                        );
                      })}
                    </span>
                    <span className="mm-sr">
                      {segment.short}: {atRisk} below 0.55. Weakest room {weakest.id} at{" "}
                      {formatScore(weakest.score)}. Mean {formatScore(segment.mean)}.
                    </span>
                  </div>

                  <p className="mm-register-stat is-mean" role="cell">
                    <span>mean</span>
                    <b>{formatScore(segment.mean)}</b>
                  </p>
                  <p className="mm-register-stat is-weakest" role="cell">
                    <span>{weakest.id}</span>
                    <b className={weakest.score < FLOOR ? "is-risk" : ""}>
                      {formatScore(weakest.score)}
                    </b>
                  </p>
                  <p className="mm-register-stat is-count" role="cell">
                    <span>below 0.55</span>
                    <b className={atRisk > 0 ? "is-risk" : ""}>{atRisk}</b>
                  </p>
                </div>
              );
            })}
          </div>

          <p className="mm-floor-caption">
            <span className="mm-risk-dot" aria-hidden="true" />
            Below the floor: {run.atRiskStudents.map((student) => student.id).join(" and ")}, both at{" "}
            {formatScore(run.atRiskStudents[0]?.satisfaction ?? 0)} and both in{" "}
            {run.atRiskStudents[0]?.roomId}. They are the first line of the fairness statement, not
            a footnote.
          </p>
        </div>
      </div>
    </section>
  );
}
