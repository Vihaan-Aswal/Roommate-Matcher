import { useInView } from "./motion";
import { StationMark } from "./StationMark";
import type { CSSProperties } from "react";

const LIMITS = [
  {
    claim: "It is an allocation aid, not a legal audit.",
    detail:
      "It does not rule on eligibility, hostel policy or disputes. Your rules still decide those.",
  },
  {
    claim: "A person stays responsible.",
    detail:
      "The run proposes. A warden, dean or housing officer reviews it and signs before keys are issued.",
  },
  {
    claim: "The manual checker is advisory.",
    detail:
      "It offers an after-hours second opinion on a proposed group. It cannot create a run, edit a room or issue a key.",
  },
  {
    claim: "Sample figures are illustrative.",
    detail:
      "The 96 students, 38 rooms and every score on this page come from a sample cohort, not from your institute.",
  },
  {
    claim: "It sees only what students submit.",
    detail:
      "A missing answer is excluded and the remaining weights are redistributed. It is never filled in with a guess.",
  },
];

export function LimitsSection(): JSX.Element {
  const { ref, inView } = useInView<HTMLElement>();

  return (
    <section
      ref={ref}
      id="limits"
      className={`mm-section mm-limits ${inView ? "is-in" : ""}`}
      aria-labelledby="limits-heading"
      data-home-station="—"
      data-home-label="Edge notes"
    >
      <div className="mm-wrap">
        <StationMark station="—" label="Edge notes" note="what the desk will not do" />
        <div className="mm-limits-grid">
        <div className="mm-limits-intro">
          <h2 id="limits-heading">What it does not do.</h2>
          <p className="mm-body">
            Trust comes from the edges, not the promises. These are the edges.
          </p>
        </div>
        <ul className="mm-limits-list">
          {LIMITS.map((limit, index) => (
            <li key={limit.claim} style={{ ["--i" as string]: index } as CSSProperties}>
              <span className="mm-limit-mark" aria-hidden="true" />
              <div>
                <p className="mm-limit-claim">{limit.claim}</p>
                <p className="mm-limit-detail">{limit.detail}</p>
              </div>
            </li>
          ))}
        </ul>
        </div>
      </div>
    </section>
  );
}

