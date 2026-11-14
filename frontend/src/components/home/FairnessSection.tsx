import { formatScore, type Run } from "./simulate";
import { useInView } from "./motion";
import type { CSSProperties } from "react";

interface FairnessSectionProps {
  run: Run;
}

const FLOOR = 0.55;
const CHART_MIN = 0.34;

export function FairnessSection({ run }: FairnessSectionProps): JSX.Element {
  const { ref, inView } = useInView<HTMLElement>();
  const panels = run.segments.map((segment) => {
    const students = segment.members
      .map((index) => run.students[index])
      .sort(
        (left, right) =>
          left.satisfaction - right.satisfaction || left.index - right.index,
      );
    const riskPositions = students
      .map((student, index) => ({ student, index }))
      .filter(({ student }) => student.label === "Poor");
    return { segment, students, riskPositions };
  });

  return (
    <section
      ref={ref}
      id="fairness"
      className={`mm-section mm-fairness ${inView ? "is-in" : ""}`}
      aria-labelledby="fairness-heading"
    >
      <div className="mm-wrap">
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
            className="mm-fair-grid"
            role="img"
            aria-label={`Fairness chart: four segments of 24 students each, sorted by satisfaction. ${run.labelCounts.Excellent} excellent, ${run.labelCounts.Good} good, ${run.labelCounts.Okay} okay and ${run.labelCounts.Poor} poor. S-009 and S-021 are below the 0.55 floor.`}
          >
            {panels.map(({ segment, students, riskPositions }, panelIndex) => {
              const riskLabel = riskPositions
                .map(({ student }) => student.id)
                .join(" · ");
              const firstRisk = riskPositions[0]?.index ?? 0;
              const lastRisk = riskPositions[riskPositions.length - 1]?.index ?? 0;
              const riskCenter =
                (((firstRisk + lastRisk) / 2 + 0.5) / students.length) * 100;
              const riskAlign =
                riskCenter < 20 ? "left" : riskCenter > 80 ? "right" : "center";
              const riskStyle =
                riskAlign === "left"
                  ? { left: "0%", transform: "none" }
                  : riskAlign === "right"
                    ? { left: "100%", transform: "translateX(-100%)" }
                    : { left: `${riskCenter}%`, transform: "translateX(-50%)" };

              return (
                <div className="mm-fair-panel" key={segment.key}>
                  <div className="mm-fair-panel-head">
                    <span>{segment.short}</span>
                    <span className={segment.atRisk.length > 0 ? "is-risk" : ""}>
                      {segment.atRisk.length} at risk
                    </span>
                  </div>
                  <div className="mm-fair-plot">
                    <div
                      className="mm-fair-floor"
                      style={{
                        bottom: `${((FLOOR - CHART_MIN) / (1 - CHART_MIN)) * 100}%`,
                      }}
                    >
                      <span>floor 0.55</span>
                    </div>
                    <div className="mm-fair-marks">
                      {students.map((student) => {
                        const height = Math.max(
                          0,
                          Math.min(
                            1,
                            (student.satisfaction - CHART_MIN) / (1 - CHART_MIN),
                          ),
                        );
                        return (
                          <span className="mm-fair-cell" key={student.id}>
                            <span
                              className="mm-fair-mark"
                              data-label={student.label}
                              style={
                                {
                                  ["--y" as string]: height,
                                  ["--delay" as string]: panelIndex * 120,
                                } as CSSProperties
                              }
                            />
                          </span>
                        );
                      })}
                    </div>
                    {riskPositions.length > 0 ? (
                      <div
                        className="mm-fair-risk"
                        style={riskStyle}
                      >
                        <span className="mm-fair-risk-rule" aria-hidden="true" />
                        <span className="mm-fair-risk-label">{riskLabel}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="mm-fair-panel-foot">
                    <span>
                      floor{" "}
                      {formatScore(
                        Math.min(...segment.rooms.map((room) => room.score)),
                      )}
                    </span>
                    <span>mean {formatScore(segment.mean)}</span>
                  </div>
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

        <div className="mm-floors">
          <h3>Weakest room, segment by segment</h3>
          <table className="mm-floor-table">
            <caption className="mm-sr">
              Segment means, weakest room scores and at-risk counts for the sample run
            </caption>
            <thead>
              <tr>
                <th scope="col">Segment</th>
                <th scope="col">Mean</th>
                <th scope="col">Weakest room</th>
                <th scope="col">Room floor</th>
                <th scope="col">At risk</th>
              </tr>
            </thead>
            <tbody>
              {run.segments.map((segment) => {
                const weakest = [...segment.rooms].sort((left, right) => left.score - right.score)[0];
                return (
                  <tr key={segment.key}>
                    <td>{segment.short}</td>
                    <td>{formatScore(segment.mean)}</td>
                    <td>{weakest.id}</td>
                    <td className={weakest.score < FLOOR ? "is-risk" : ""}>
                      {formatScore(weakest.score)}
                    </td>
                    <td className={segment.atRisk.length > 0 ? "is-risk" : ""}>
                      {segment.atRisk.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
