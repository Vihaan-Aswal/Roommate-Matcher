import { formatScore, type Run } from "./simulate";
import { useInView } from "./motion";

interface SignOffSectionProps {
  run: Run;
}

export function SignOffSection({ run }: SignOffSectionProps): JSX.Element {
  const { ref, inView } = useInView<HTMLElement>();
  const beds = run.rooms.reduce((total, room) => total + room.members.length, 0);
  const riskRooms = [...new Set(run.atRiskStudents.map((student) => student.roomId))].join(", ");

  return (
    <section
      ref={ref}
      id="sign-off"
      className={`mm-section mm-signoff ${inView ? "is-in" : ""}`}
      aria-labelledby="signoff-heading"
    >
      <div className="mm-wrap mm-signoff-grid">
        <div className="mm-signoff-copy">
          <h2 id="signoff-heading">
            A person signs{" "}
            <br />
            before keys are issued.
          </h2>
          <p className="mm-body">
            The desk does not issue keys. It writes a proposal, a set of reasons and the fairness
            statement; a warden, dean or housing officer reads the flagged cases and signs.
          </p>
          <p className="mm-body mm-body-dim">
            In the sample, {run.atRiskStudents.length} students are flagged, both in {riskRooms}. They
            go to a person before anything is issued. Deterministic output makes that review
            repeatable: same inputs, same rooms, same tie-breaks.
          </p>
        </div>

        <div className="mm-paper mm-sign-slip">
          <header className="mm-sign-head">
            <span className="mm-mono-label">Sign-off slip</span>
            <span className="mm-sign-run">{run.audit.runId} · sample</span>
          </header>

          <dl className="mm-sign-data">
            <div>
              <dt>Proposal</dt>
              <dd>
                {run.rooms.length} rooms · {beds} beds
              </dd>
            </div>
            <div>
              <dt>At-risk cases</dt>
              <dd>
                {run.atRiskStudents.length} · {riskRooms} · review required
              </dd>
            </div>
            <div>
              <dt>Fairness floor</dt>
              <dd>{formatScore(run.floor)}</dd>
            </div>
          </dl>

          <p className="mm-sign-statement">
            The proposal is complete.{" "}
            <br />
            The signature is not.
          </p>

          <div className="mm-signature-line">
            <div className="mm-sign-field">
              <span className="mm-sign-rule" aria-hidden="true" />
              <span className="mm-sign-caption">Signed by a person</span>
            </div>
            <div className="mm-sign-field">
              <span className="mm-sign-rule" aria-hidden="true" />
              <span className="mm-sign-caption">Date</span>
            </div>
            <div className="mm-wax" aria-hidden="true">
              <span className="mm-wax-name">
                Roommate
                <br />
                Matcher
              </span>
            </div>
          </div>

          <p className="mm-file-note">
            The manual checker is advisory. It cannot create a run, edit a room or issue a key.
          </p>
        </div>
      </div>
    </section>
  );
}

