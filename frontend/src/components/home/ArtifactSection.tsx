import { formatScore, formatCount, type Run } from "./simulate";
import { useInView } from "./motion";
import type { CSSProperties } from "react";

interface ArtifactSectionProps {
  run: Run;
}

export function ArtifactSection({ run }: ArtifactSectionProps): JSX.Element {
  const { ref, inView } = useInView<HTMLElement>();
  const riskStudent = run.atRiskStudents[0];
  const sampleA = run.samplePair.a;
  const pickedRooms = [
    riskStudent ? run.rooms.find((room) => room.id === riskStudent.roomId) : undefined,
    run.samplePair.room,
    run.segments[3]?.rooms[0],
    run.segments[2]?.rooms[0],
  ].filter((room, index, rooms) => room && rooms.findIndex((other) => other?.id === room.id) === index);

  const topStudent = run.sortedStudents[run.sortedStudents.length - 1];
  const reasonRows = [riskStudent, run.students[sampleA], topStudent].filter(
    (student): student is Run["students"][number] => Boolean(student),
  );

  return (
    <section
      ref={ref}
      id="artifacts"
      className={`mm-section mm-artifacts ${inView ? "is-in" : ""}`}
      aria-labelledby="artifacts-heading"
    >
      <div className="mm-wrap">
        <div className="mm-split-head">
          <h2 id="artifacts-heading">
            A run leaves{" "}
            <br />
            four documents.
          </h2>
          <div className="mm-head-copy">
            <p className="mm-body">
              Not a screen state. A run writes a proposal, a reason for every student, a fairness
              statement and an audit trail. Each is a working document — something to act on, hand
              over or file.
            </p>
            <p className="mm-body mm-body-dim">
              Runs append. Nothing is overwritten, so last week&rsquo;s allocation can still be
              reconstructed.
            </p>
          </div>
        </div>

        <div className="mm-folder">
          <div className="mm-folder-tab">
            <span>Run pack</span>
            <span>{run.audit.runId}</span>
            <span className="mm-folder-tab-note">sample</span>
          </div>

          <div className="mm-files">
            <article className="mm-file" style={{ "--i": 0, "--tilt": "-0.35deg" } as CSSProperties}>
              <header className="mm-file-head">
                <h3>Assignments</h3>
                <span>4 of {run.rooms.length} rooms shown</span>
              </header>
              <table className="mm-doc-table">
                <caption className="mm-sr">Sample room assignments</caption>
                <thead>
                  <tr>
                    <th scope="col">Room</th>
                    <th scope="col">Beds</th>
                    <th scope="col">Segment</th>
                    <th scope="col">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {pickedRooms.map((room) => {
                    if (!room) return null;
                    const segment = run.segments[room.segmentIndex];
                    return (
                      <tr key={room.id}>
                        <td>{room.id}</td>
                        <td>{room.members.length}</td>
                        <td>{segment.short}</td>
                        <td className={room.score < 0.55 ? "is-risk" : ""}>
                          {formatScore(room.score)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </article>

            <article className="mm-file" style={{ "--i": 1, "--tilt": "0.3deg" } as CSSProperties}>
              <header className="mm-file-head">
                <h3>Reasons</h3>
                <span>one per student</span>
              </header>
              <ul className="mm-reason-list">
                {reasonRows.map((student) => (
                  <li key={student.id}>
                    <span className="mm-reason-id">
                      {student.id} · {student.roomId}
                    </span>
                    <span className="mm-reason-text">
                      {(run.studentReasons[student.index] ?? []).join("; ") ||
                        "No window where every factor is weak."}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mm-file-note">
                Written from factor-level claims. The raw answer behind a reason is never printed.
              </p>
            </article>

            <article className="mm-file" style={{ "--i": 2, "--tilt": "-0.25deg" } as CSSProperties}>
              <header className="mm-file-head">
                <h3>Fairness statement</h3>
                <span>the floor, not the average</span>
              </header>
              <div className="mm-mini-fairness">
                <p className="mm-mini-floor">
                  <span>Floor</span>
                  <strong>{formatScore(run.floor)}</strong>
                </p>
                <p className="mm-mini-risk">
                  <span className="mm-risk-dot" aria-hidden="true" />
                  {run.atRiskStudents.length} below 0.55:{" "}
                  {run.atRiskStudents.map((student) => student.id).join(", ")}
                </p>
              </div>
              <ul className="mm-mini-rooms">
                {run.segments.map((segment) => {
                  const weakest = [...segment.rooms].sort((left, right) => left.score - right.score)[0];
                  return (
                    <li key={segment.key}>
                      <span>{segment.short}</span>
                      <span className={weakest.score < 0.55 ? "is-risk" : ""}>
                        {weakest.id} · {formatScore(weakest.score)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </article>

            <article className="mm-file" style={{ "--i": 3, "--tilt": "0.4deg" } as CSSProperties}>
              <header className="mm-file-head">
                <h3>Audit trail</h3>
                <span>reproducible by run</span>
              </header>
              <dl className="mm-audit">
                <div>
                  <dt>Run</dt>
                  <dd>{run.audit.runId}</dd>
                </div>
                <div>
                  <dt>Input digest</dt>
                  <dd>0x{run.audit.digest}</dd>
                </div>
                <div>
                  <dt>Pairs scored</dt>
                  <dd>{formatCount(run.pairsScored)}</dd>
                </div>
                <div>
                  <dt>Swap passes</dt>
                  <dd>
                    {run.audit.swapPasses} · {run.audit.swapsAccepted} accepted ·{" "}
                    {run.audit.newPoorFromSwaps} new Poor
                  </dd>
                </div>
              </dl>
              <p className="mm-file-note">
                Same inputs produce the same digest, the same rooms and the same tie-breaks.
              </p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}



