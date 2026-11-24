import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";

import {
  formatCount,
  selectSampleCase,
  type Run,
  type SampleCase,
  type SampleCasePair,
} from "./simulate";
import { usePrefersReducedMotion } from "./motion";
import "./sample-film.css";

const PHASE_DURATION = [2600, 6200, 8400, 8600, 7400, 7400, 3600];
const LAST_PHASE = PHASE_DURATION.length - 1;

interface Chapter {
  phase: number;
  short: string;
  title: string;
  href: string;
  linkLabel: string;
  lines: string[];
}

const CHAPTERS: Chapter[] = [
  {
    phase: 1,
    short: "Boundary",
    title: "The boundary decides first",
    href: "#boundary",
    linkLabel: "Read the boundary section",
    lines: [
      "Four boundaries. 96 students. 4 segments.",
      "4,560 possible pairs. 3,456 never compared. 1,104 scored.",
    ],
  },
  {
    phase: 2,
    short: "Factors",
    title: "Ten weighted factors",
    href: "#compatibility",
    linkLabel: "Read the compatibility section",
    lines: [
      "Ten weighted factors. Missing answers renormalise; they are never guessed.",
      "S-009 × S-021: cleanliness 0.00, room use 0.00, night activity 0.00 → 0.416.",
      "S-035 × S-047 → 0.733.",
    ],
  },
  {
    phase: 3,
    short: "Rooms",
    title: "The room is chosen from every pair",
    href: "#compatibility",
    linkLabel: "Read how rooms are chosen",
    lines: [
      "The room is chosen from every pair.",
      "2 beds: maximum-weight matching. 3 beds: seed and grow. 4 beds: pair, then merge.",
      "3 swap passes. 3 accepted. 0 new Poor. R-12 stays at 0.416.",
    ],
  },
  {
    phase: 4,
    short: "Floor",
    title: "The average hides the room",
    href: "#fairness",
    linkLabel: "Read the fairness section",
    lines: [
      "The segment mean: 0.827. R-12: 0.416.",
      "Two students below 0.55. The fairness statement puts them first, not in a footnote.",
    ],
  },
  {
    phase: 5,
    short: "Sign",
    title: "A person signs",
    href: "#sign-off",
    linkLabel: "Read the sign-off section",
    lines: [
      "96 notes. 38 rooms. 2 at risk. 3 passes. 0 new Poor.",
      "Reasons, never raw answers. A person signs before keys are issued.",
    ],
  },
];

function cssVars(vars: Record<string, string | number>): CSSProperties {
  return vars as CSSProperties;
}

function filmScore(value: number): string {
  return value.toFixed(3);
}

function chapterForPhase(phase: number): Chapter | undefined {
  return CHAPTERS.find((chapter) => chapter.phase === phase);
}

function FactorRows({
  pair,
  compact = false,
}: {
  pair: SampleCasePair;
  compact?: boolean;
}): JSX.Element {
  return (
    <div className={`film-factor-rows ${compact ? "is-compact" : ""}`} aria-hidden="true">
      {pair.pair.factors.map((factor, index) => (
        <div
          className={[
            "film-factor-row",
            factor.missing ? "is-missing" : "",
            !factor.missing && factor.raw === 0 ? "is-zero" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          key={factor.key}
          style={cssVars({ "--fi": index })}
        >
          <span className="film-factor-name">
            {factor.label}
            {factor.missing ? <em>not answered</em> : null}
          </span>
          <span className="film-factor-weight">{Math.round(factor.weight * 100)}%</span>
          <span className="film-factor-track">
            <span
              className="film-factor-fill"
              style={cssVars({ "--raw": factor.missing ? 0 : factor.raw })}
            />
          </span>
          <span className="film-factor-raw">{factor.missing ? "—" : factor.raw.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

function WeightRule({ pair }: { pair: SampleCasePair }): JSX.Element {
  const present = pair.pair.factors.filter((factor) => !factor.missing);
  const missing = pair.missingFactors.map((factor) => factor.label.toLowerCase()).join(", ");
  return (
    <div className="film-weight-rule" aria-hidden="true">
      <div className="film-weight-row">
        <span className="film-weight-caption">nominal</span>
        <span className="film-weight-track">
          {pair.pair.factors.map((factor) => (
            <span
              className={`film-weight-segment ${factor.missing ? "is-missing" : ""}`}
              key={factor.key}
              style={cssVars({ "--w": `${factor.weight * 100}%` })}
            />
          ))}
        </span>
      </div>
      <div className="film-weight-row">
        <span className="film-weight-caption">renormalised</span>
        <span className="film-weight-track is-effective">
          {present.map((factor) => (
            <span
              className="film-weight-segment"
              key={factor.key}
              style={cssVars({ "--w": `${factor.effectiveWeight * 100}%` })}
            />
          ))}
        </span>
      </div>
      <div className="film-weight-foot">
        <span className="film-weight-rule-mark" aria-hidden="true" />
        {missing ? `${missing} not answered · weights renormalised to 1.00` : "no missing answers · weights stand"}
      </div>
    </div>
  );
}

function StrategyGlyph({ beds }: { beds: 2 | 3 | 4 }): JSX.Element {
  if (beds === 2) {
    return (
      <svg viewBox="0 0 44 24" className="film-strategy-glyph" aria-hidden="true" focusable="false">
        <line x1="10" y1="12" x2="34" y2="12" />
        <circle cx="10" cy="12" r="3.2" />
        <circle cx="34" cy="12" r="3.2" />
      </svg>
    );
  }
  if (beds === 3) {
    return (
      <svg viewBox="0 0 44 24" className="film-strategy-glyph" aria-hidden="true" focusable="false">
        <line x1="10" y1="17" x2="22" y2="6" />
        <line x1="22" y1="6" x2="34" y2="17" />
        <line x1="10" y1="17" x2="34" y2="17" />
        <circle className="is-seed" cx="10" cy="17" r="3.2" />
        <circle cx="22" cy="6" r="3.2" />
        <circle cx="34" cy="17" r="3.2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 44 24" className="film-strategy-glyph" aria-hidden="true" focusable="false">
      <line x1="10" y1="7" x2="34" y2="7" />
      <line x1="10" y1="17" x2="34" y2="17" />
      <line x1="10" y1="7" x2="10" y2="17" />
      <line x1="34" y1="7" x2="34" y2="17" />
      <line x1="10" y1="7" x2="34" y2="17" />
      <line x1="34" y1="7" x2="10" y2="17" />
      <circle cx="10" cy="7" r="2.7" />
      <circle cx="34" cy="7" r="2.7" />
      <circle cx="10" cy="17" r="2.7" />
      <circle cx="34" cy="17" r="2.7" />
    </svg>
  );
}

function WaxSeal({ small = false }: { small?: boolean }): JSX.Element {
  return (
    <span className={`film-wax ${small ? "is-small" : ""}`} aria-hidden="true">
      <span>
        Roommate
        <br />
        Matcher
      </span>
    </span>
  );
}

function ColdOpen(): JSX.Element {
  return (
    <div className="film-cold" aria-hidden="true">
      <span className="film-lamp" />
      <span className="film-desk-shadow" />
      <span className="film-cold-roster">
        <span className="film-cold-roster-head">Room roster · sample</span>
        <span className="film-cold-rule" />
        <span className="film-cold-rule" />
        <span className="film-cold-rule is-short" />
        <span className="film-cold-roster-mark">96</span>
      </span>
      <span className="film-cold-cards">
        {Array.from({ length: 7 }, (_, index) => (
          <span key={index} style={cssVars({ "--i": index })} />
        ))}
      </span>
      <span className="film-brass-ruler" />
      <span className="film-wax-stick" />
      <span className="film-cold-tag">Sample case · R-12</span>
    </div>
  );
}

function BoundaryScene({ data }: { data: SampleCase }): JSX.Element {
  const stamps = ["Gender", "Year", "AC", "Size"];
  return (
    <div className="film-boundary">
      <div className="film-sheet film-boundary-ledger">
        <div className="film-ledger-cell">
          <span className="film-ledger-number">{formatCount(data.boundary.possible)}</span>
          <span className="film-ledger-label">possible pairs</span>
        </div>
        <span className="film-ledger-arrow" aria-hidden="true" />
        <div className="film-ledger-cell">
          <span className="film-ledger-number is-muted">{formatCount(data.boundary.rejected)}</span>
          <span className="film-ledger-label">never compared</span>
        </div>
        <span className="film-ledger-arrow" aria-hidden="true" />
        <div className="film-ledger-cell">
          <span className="film-ledger-number is-strong">{formatCount(data.boundary.scored)}</span>
          <span className="film-ledger-label">scored</span>
        </div>
      </div>

      <div className="film-stamp-row" aria-hidden="true">
        {stamps.map((stamp, index) => (
          <span className="film-brass-stamp" key={stamp} style={cssVars({ "--i": index })}>
            {stamp}
          </span>
        ))}
      </div>

      <div className="film-card-fan" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <span
            className="film-fan-card"
            key={index}
            style={cssVars({
              "--i": index,
              "--x": `${(index - 5.5) * 4.6}%`,
              "--y": `${Math.abs(index - 5.5) * -4}px`,
              "--r": `${(index - 5.5) * 3.2}deg`,
            })}
          />
        ))}
        <span className="film-fan-label">96 response cards · one per student</span>
      </div>

      <div className="film-folders">
        {data.segments.map((segment, folderIndex) => {
          const isRisk = segment.index === data.risk.segment.index;
          return (
            <div
              className={`film-folder ${isRisk ? "is-open" : ""}`}
              key={segment.key}
              style={cssVars({ "--folder": folderIndex })}
            >
              <span className="film-folder-back" />
              <span className="film-card-stack">
                {Array.from({ length: segment.members.length }, (_, cardIndex) => (
                  <span
                    className="film-response-card"
                    key={cardIndex}
                    style={cssVars({
                      "--i": cardIndex,
                      "--sx": `${(1.5 - folderIndex) * 22}px`,
                      "--sy": `${-84 + folderIndex * 6}px`,
                      "--sr": `${(folderIndex - 1.5) * 4}deg`,
                    })}
                  />
                ))}
              </span>
              <span className="film-folder-front" />
              <span className="film-folder-tab">
                {segment.gender} · {segment.year === "1st year" ? "1st" : "2–4"} ·{" "}
                {segment.ac} · {segment.size}-bed
              </span>
              <span className="film-folder-count">{segment.members.length} students</span>
              {isRisk ? (
                <span className="film-open-note">
                  <span>R-12</span>
                  <span>S-009 × S-021</span>
                  <strong>0.416</strong>
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FactorsScene({ data }: { data: SampleCase }): JSX.Element {
  return (
    <div className="film-factors">
      <div className="film-sheet film-factors-main">
        <header className="film-sheet-head">
          <div>
            <span className="film-mono">Pair ledger · R-12</span>
            <p className="film-sheet-title">
              {data.risk.students[0].id} × {data.risk.students[1].id}
            </p>
          </div>
          <span className="film-verdict is-poor">Poor</span>
        </header>

        <div className="film-score-row">
          <div>
            <span className="film-score-big">{filmScore(data.risk.pair.score)}</span>
            <span className="film-score-caption">pair score</span>
          </div>
          <div className="film-score-side">
            <span>
              room <strong>{data.risk.room.id}</strong>
            </span>
            <span>{filmScore(data.risk.room.score)}</span>
            <span>{data.risk.segment.size}-bed · {data.risk.segment.short}</span>
          </div>
        </div>

        <WeightRule pair={data.risk} />
        <FactorRows pair={data.risk} />
      </div>

      <div className="film-sheet film-factors-side">
        <header className="film-sheet-head">
          <div>
            <span className="film-mono">Pair ledger · R-15</span>
            <p className="film-sheet-title">
              {data.healthy.students[0].id} × {data.healthy.students[1].id}
            </p>
          </div>
          <span className="film-verdict is-good">Good</span>
        </header>
        <div className="film-score-row is-compact">
          <div>
            <span className="film-score-big">{filmScore(data.healthy.pair.score)}</span>
            <span className="film-score-caption">pair score</span>
          </div>
          <span className="film-side-room">
            {data.healthy.room.id} · {data.healthy.segment.size}-bed
          </span>
        </div>
        <FactorRows pair={data.healthy} compact />
        <p className="film-sheet-foot">Same ten factors. Different outcome.</p>
      </div>
    </div>
  );
}

function PlanGraph({ data }: { data: SampleCase }): JSX.Element {
  const rooms = data.risk.segment.rooms;
  const x = (index: number) => 5 + index * 10;
  return (
    <div className="film-plan-body" aria-hidden="true">
      <svg viewBox="0 0 124 54" className="film-plan-svg" focusable="false">
        {rooms.map((room, index) => (
          <g key={room.id}>
            <line
              className={`film-plan-pair ${room.id === data.risk.room.id ? "is-risk" : ""}`}
              x1={x(index)}
              y1="20"
              x2={x(index)}
              y2="36"
            />
            <circle
              className={`film-plan-node ${room.id === data.risk.room.id ? "is-risk" : ""}`}
              cx={x(index)}
              cy="20"
              r="2.2"
            />
            <circle
              className={`film-plan-node ${room.id === data.risk.room.id ? "is-risk" : ""}`}
              cx={x(index)}
              cy="36"
              r="2.2"
            />
          </g>
        ))}
        <path className="film-plan-alt" d="M115 20 C 111 8, 105 8, 101 20" />
        <text className="film-plan-alt-label" x="64" y="5" textAnchor="middle">
          alternative pairing · not chosen
        </text>
        <line className="film-plan-baseline" x1="3" y1="46" x2="121" y2="46" />
      </svg>
      <span className="film-plan-caption">12 rooms · 24 students · matching draws the chosen pairs</span>
    </div>
  );
}

function RoomsScene({ data }: { data: SampleCase }): JSX.Element {
  return (
    <div className="film-rooms">
      <div className="film-sheet film-plan">
        <header className="film-sheet-head">
          <div>
            <span className="film-mono">2-bed pair graph</span>
            <p className="film-sheet-title">Every eligible pair, one chosen matching</p>
          </div>
          <span className="film-verdict is-good">maximum weight</span>
        </header>
        <PlanGraph data={data} />
        <div className="film-plan-risk">
          <span className="film-plan-risk-id">{data.risk.room.id}</span>
          <span>
            {data.risk.students[0].id} × {data.risk.students[1].id}
          </span>
          <strong>{filmScore(data.risk.room.score)}</strong>
          <span className="film-plan-risk-note">at risk · review</span>
        </div>
      </div>

      <div className="film-strategy-set">
        {[
          { beds: 2 as const, label: "2 beds", detail: "maximum weight" },
          { beds: 3 as const, label: "3 beds", detail: "seed and grow" },
          { beds: 4 as const, label: "4 beds", detail: "pair, then merge" },
        ].map((strategy) => (
          <div className="film-strategy" key={strategy.beds}>
            <StrategyGlyph beds={strategy.beds} />
            <span className="film-strategy-label">{strategy.label}</span>
            <span className="film-strategy-detail">{strategy.detail}</span>
          </div>
        ))}
      </div>

      <div className="film-swap-ledger">
        <span className="film-mono">Then the swap pass</span>
        <div className="film-swap-ticks" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="film-swap-row">
          <span>
            <strong>{data.audit.swapPasses}</strong> passes
          </span>
          <span>
            <strong>{data.audit.swapsAccepted}</strong> accepted
          </span>
          <span>
            <strong>{data.audit.newPoorFromSwaps}</strong> new Poor
          </span>
        </div>
        <p className="film-swap-stays">
          {data.risk.room.id} stays at {filmScore(data.risk.room.score)}
        </p>
      </div>
    </div>
  );
}

const CHART_MIN = 0.34;

function FairnessScene({ data }: { data: SampleCase }): JSX.Element {
  const rooms = [...data.risk.segment.rooms].sort(
    (left, right) => left.score - right.score || left.id.localeCompare(right.id),
  );
  const height = (score: number) =>
    Math.max(2, Math.min(100, ((score - CHART_MIN) / (1 - CHART_MIN)) * 100));
  const floorHeight = ((0.55 - CHART_MIN) / (1 - CHART_MIN)) * 100;
  const meanHeight = height(data.risk.segment.mean);

  return (
    <div className="film-fairness">
      <div className="film-sheet film-fair-sheet">
        <header className="film-sheet-head is-fair">
          <div>
            <span className="film-mono">Fairness statement · {data.risk.segment.short}</span>
            <p className="film-sheet-title">12 rooms, sorted by room score</p>
          </div>
          <span className="film-fair-legend">
            <span className="film-fair-key is-risk" /> below 0.55
          </span>
        </header>

        <div className="film-fair-body">
          <div className="film-fair-chart" aria-hidden="true">
            <span className="film-fair-rule is-mean" style={cssVars({ "--y": `${meanHeight}%` })}>
              <span>mean {filmScore(data.risk.segment.mean)}</span>
            </span>
            <span className="film-fair-rule is-floor" style={cssVars({ "--y": `${floorHeight}%` })}>
              <span>floor 0.55</span>
            </span>
            <span className="film-fair-grid-lines" />
            <span className="film-fair-bars">
              {rooms.map((room, index) => (
                <span
                  className={`film-fair-bar ${room.score < 0.55 ? "is-risk" : ""}`}
                  key={room.id}
                  style={cssVars({ "--h": `${height(room.score)}%`, "--i": index })}
                >
                  <span className="film-fair-bar-value">
                    {room.id === data.risk.room.id ? filmScore(room.score) : ""}
                  </span>
                </span>
              ))}
            </span>
            <span className="film-fair-room-id">R-12</span>
          </div>

          <span className="film-thread" aria-hidden="true">
            <span className="film-thread-knot" />
          </span>

          <div className="film-fair-cards">
            {data.risk.atRisk.slice(0, 2).map((student) => (
              <div className="film-student-card" key={student.id}>
                <span className="film-student-id">{student.id}</span>
                <strong>{filmScore(student.satisfaction)}</strong>
                <span className="film-student-note">{student.roomId} · below 0.55</span>
              </div>
            ))}
          </div>
        </div>

        <div className="film-fair-stamp">
          <span>Fairness statement</span>
          <strong>2 at risk · review required</strong>
        </div>
      </div>
    </div>
  );
}

function SignOffScene({ data }: { data: SampleCase }): JSX.Element {
  return (
    <div className="film-signoff">
      <div className="film-sheet film-reasons">
        <header className="film-sheet-head">
          <div>
            <span className="film-mono">Reasons sheet</span>
            <p className="film-sheet-title">96 notes · one per student</p>
          </div>
          <span className="film-verdict is-good">privacy-safe</span>
        </header>
        <ul className="film-note-list">
          {data.notes.slice(0, 4).map(({ student, reasons }) => (
            <li key={student.id}>
              <span className="film-note-id">
                {student.id} · {student.roomId}
              </span>
              <span className="film-note-text">
                {reasons.length > 0
                  ? reasons.join("; ")
                  : "No window where every factor is weak."}
              </span>
            </li>
          ))}
        </ul>
        <p className="film-sheet-foot">
          96 notes written from factor-level claims. Raw answers never appear.
        </p>
      </div>

      <div className="film-signoff-side">
        <div className="film-envelope">
          <span className="film-envelope-flap" aria-hidden="true" />
          <span className="film-mono">Sealed input</span>
          <strong>Raw answers</strong>
          <span className="film-envelope-note">not read · not shown</span>
          <WaxSeal small />
        </div>

        <div className="film-sheet film-sign-slip">
          <header className="film-sign-head">
            <span className="film-mono">Sign-off slip</span>
            <span className="film-sign-run">{data.audit.runId} · sample</span>
          </header>
          <dl className="film-sign-data">
            <div>
              <dt>Proposal</dt>
              <dd>{data.boundary.rooms} rooms · {data.boundary.students} beds</dd>
            </div>
            <div>
              <dt>At-risk cases</dt>
              <dd>
                {data.risk.atRisk.length} · {data.risk.room.id} · review required
              </dd>
            </div>
            <div>
              <dt>Fairness floor</dt>
              <dd>{filmScore(data.risk.room.score)}</dd>
            </div>
          </dl>
          <div className="film-signature">
            <span className="film-sign-rule" />
            <span className="film-sign-caption">Signed by a person</span>
            <WaxSeal small />
          </div>
        </div>
      </div>

      <div className="film-audit-strip">
        <span className="film-audit-title">Audit strip</span>
        <span>{data.boundary.rooms} rooms</span>
        <span>96 notes</span>
        <span>{data.risk.atRisk.length} at risk</span>
        <span>{data.audit.swapPasses} passes</span>
        <span>{data.audit.newPoorFromSwaps} new Poor</span>
        <span className="film-audit-run">{data.audit.runId}</span>
        <span className="film-audit-digest">digest {data.audit.digest}</span>
      </div>
    </div>
  );
}

function EndCard({
  data,
  onReplay,
}: {
  data: SampleCase;
  onReplay: () => void;
}): JSX.Element {
  return (
    <div className="film-end">
      <span className="film-lamp is-end" aria-hidden="true" />
      <div className="film-end-card">
        <WaxSeal />
        <p className="film-end-kicker">{data.audit.runId} · illustrative sample run</p>
        <p className="film-end-title">
          Same inputs,
          <br />
          same rooms.
        </p>
        <p className="film-end-line">The desk proposes. A person signs.</p>
        <div className="film-end-actions">
          <Link className="mm-btn mm-btn-wax" to="/login">
            Open the desk
            <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </Link>
          <button type="button" className="mm-btn mm-btn-ghost" onClick={onReplay}>
            <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" />
            Replay the film
          </button>
        </div>
        <p className="film-end-foot">Digest {data.audit.digest} · 96 students · 38 rooms</p>
      </div>
    </div>
  );
}

interface SampleRunFilmProps {
  run: Run;
  playKey: number;
  onReplay: () => void;
}

export function SampleRunFilm({ run, playKey, onReplay }: SampleRunFilmProps): JSX.Element {
  const reduced = usePrefersReducedMotion();
  const data = useMemo(() => selectSampleCase(run), [run]);
  const [phase, setPhase] = useState(reduced ? 1 : 0);
  const [playing, setPlaying] = useState(false);
  const [cycle, setCycle] = useState(0);
  const figureRef = useRef<HTMLElement>(null);
  const startedRef = useRef(false);
  const timerKeyRef = useRef("");
  const remainingRef = useRef(0);
  const resumeAfterHiddenRef = useRef(false);

  const restart = useCallback(() => {
    if (reduced) {
      setPlaying(false);
      setPhase(1);
      return;
    }
    startedRef.current = true;
    setCycle((value) => value + 1);
    setPhase(0);
    setPlaying(true);
  }, [reduced]);

  const handleReplay = useCallback(() => {
    restart();
    onReplay();
  }, [onReplay, restart]);

  useEffect(() => {
    if (playKey === 0) return;
    startedRef.current = true;
    if (reduced) {
      setPlaying(false);
      setPhase(1);
      return;
    }
    setCycle((value) => value + 1);
    setPhase(0);
    setPlaying(true);
  }, [playKey, reduced]);

  useEffect(() => {
    if (!reduced) return;
    setPlaying(false);
    setPhase((current) => (current >= 1 && current <= 5 ? current : 1));
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    const node = figureRef.current;
    if (!node) return;

    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      setCycle((value) => value + 1);
      setPhase(0);
      setPlaying(true);
    };

    if (typeof IntersectionObserver === "undefined") {
      if (document.visibilityState !== "hidden") {
        start();
        return;
      }
      const onVisibility = () => {
        if (document.visibilityState !== "hidden") {
          document.removeEventListener("visibilitychange", onVisibility);
          start();
        }
      };
      document.addEventListener("visibilitychange", onVisibility);
      return () => document.removeEventListener("visibilitychange", onVisibility);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          start();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    const timerKey = `${cycle}:${phase}`;
    if (timerKeyRef.current !== timerKey) {
      timerKeyRef.current = timerKey;
      remainingRef.current = PHASE_DURATION[phase] ?? 0;
    }
    if (!playing || remainingRef.current <= 0) return;

    const startedAt = performance.now();
    const timer = window.setTimeout(() => {
      remainingRef.current = 0;
      if (phase >= LAST_PHASE) {
        setPlaying(false);
        return;
      }
      setPhase(phase + 1);
      if (phase + 1 === LAST_PHASE) setPlaying(false);
    }, remainingRef.current);

    return () => {
      window.clearTimeout(timer);
      if (playing) {
        remainingRef.current = Math.max(
          0,
          remainingRef.current - (performance.now() - startedAt),
        );
      }
    };
  }, [cycle, phase, playing, reduced]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (playing) {
          resumeAfterHiddenRef.current = true;
          setPlaying(false);
        }
        return;
      }
      if (resumeAfterHiddenRef.current) {
        resumeAfterHiddenRef.current = false;
        setPlaying(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [playing]);

  const jumpTo = (nextPhase: number) => {
    setPlaying(false);
    setCycle((value) => value + 1);
    setPhase(nextPhase);
  };

  const togglePlay = () => {
    if (reduced) return;
    setPlaying((value) => !value);
  };

  const stepScene = (direction: -1 | 1) => {
    const current = phase >= 1 && phase <= 5 ? phase : 1;
    setPlaying(false);
    setPhase(Math.min(5, Math.max(1, current + direction)));
  };

  const onStageKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      if (playing) {
        event.preventDefault();
        setPlaying(false);
      }
      return;
    }
    if (event.key === " " && event.target === event.currentTarget) {
      event.preventDefault();
      togglePlay();
    }
  };

  const chapter = chapterForPhase(phase);
  const isReducedStatic = reduced;
  const progressStatic = isReducedStatic || phase === LAST_PHASE;
  const progress = phase === 0 ? 0 : phase >= LAST_PHASE ? 1 : phase / 5;

  const caption =
    phase === 0
      ? {
          scene: "Cold open · the desk at night",
          lines: ["A room list you can sign.", "The desk proposes. A person signs."],
        }
      : phase === LAST_PHASE
        ? {
            scene: "End card · same inputs, same rooms",
            lines: [
              `Run ${data.audit.runId} · digest ${data.audit.digest} · illustrative sample.`,
            ],
          }
        : {
            scene: `Scene ${chapter?.phase} of 5 · ${chapter?.title}`,
            lines: chapter?.lines ?? [],
          };

  return (
    <figure className="mm-film" id="sample-run" ref={figureRef}>
      <div className="mm-film-frame">
        <div className="mm-film-head">
          <span className="mm-film-tag">Sample run</span>
          <span className="mm-film-meta">Illustrative sample run · 96 students · 38 rooms</span>
          <span className="mm-film-run">{data.audit.runId}</span>
        </div>

        <div
          className={`mm-film-viewport ${playing ? "is-playing" : ""}`}
          role="group"
          aria-label="Sample run film"
          tabIndex={0}
          onKeyDown={onStageKeyDown}
        >
          <div className="mm-film-light" aria-hidden="true" />
          <div className="mm-film-grain" aria-hidden="true" />

          <div
            className={`film-scene film-scene-cold ${phase === 0 ? "is-active" : ""}`}
            aria-hidden={phase !== 0}
          >
            <ColdOpen />
          </div>

          <div
            className={`film-scene film-scene-boundary ${phase === 1 ? "is-active" : ""}`}
            aria-hidden={phase !== 1}
          >
            <BoundaryScene data={data} />
          </div>

          <div
            className={`film-scene film-scene-factors ${phase === 2 ? "is-active" : ""}`}
            aria-hidden={phase !== 2}
          >
            <FactorsScene data={data} />
          </div>

          <div
            className={`film-scene film-scene-rooms ${phase === 3 ? "is-active" : ""}`}
            aria-hidden={phase !== 3}
          >
            <RoomsScene data={data} />
          </div>

          <div
            className={`film-scene film-scene-fairness ${phase === 4 ? "is-active" : ""}`}
            aria-hidden={phase !== 4}
          >
            <FairnessScene data={data} />
          </div>

          <div
            className={`film-scene film-scene-signoff ${phase === 5 ? "is-active" : ""}`}
            aria-hidden={phase !== 5}
          >
            <SignOffScene data={data} />
          </div>

          <div
            className={`film-scene film-scene-end ${phase === LAST_PHASE ? "is-active" : ""}`}
            aria-hidden={phase !== LAST_PHASE}
          >
            <EndCard data={data} onReplay={handleReplay} />
          </div>
        </div>

        <div className={`mm-film-caption ${phase === 0 ? "is-title" : ""}`}>
          <div className="mm-film-caption-top">
            <span className="mm-film-scene-label" aria-live="polite">
              {caption.scene}
            </span>
            {chapter && phase !== LAST_PHASE ? (
              <a className="mm-film-section-link" href={chapter.href}>
                {chapter.linkLabel}
                <ArrowRight size={12} strokeWidth={1.8} aria-hidden="true" />
              </a>
            ) : null}
          </div>
          <div className="mm-film-lines">
            {caption.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>

        <div className="mm-film-progress" aria-hidden="true">
          <span
            key={progressStatic ? `static-${phase}` : `${cycle}-${phase}`}
            className={progressStatic ? "is-static" : playing ? "is-running" : "is-paused"}
            style={cssVars({
              "--progress": progressStatic ? progress : 0,
              "--duration": `${PHASE_DURATION[phase] ?? 0}ms`,
            })}
          />
        </div>

        <div className="mm-film-controls">
          <div className="mm-film-transport">
            {isReducedStatic ? (
              <>
                <button
                  type="button"
                  className="mm-film-control"
                  onClick={() => stepScene(-1)}
                  disabled={phase <= 1}
                  aria-label="Previous scene"
                >
                  <ChevronLeft size={15} strokeWidth={1.8} aria-hidden="true" />
                  Previous
                </button>
                <span className="mm-film-scene-count">
                  Scene {phase} of 5 · static
                </span>
                <button
                  type="button"
                  className="mm-film-control"
                  onClick={() => stepScene(1)}
                  disabled={phase >= 5}
                  aria-label="Next scene"
                >
                  Next
                  <ChevronRight size={15} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </>
            ) : phase === LAST_PHASE ? (
              <button
                type="button"
                className="mm-film-control"
                onClick={handleReplay}
                aria-label="Replay film"
              >
                <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" />
                Replay
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="mm-film-control"
                  onClick={togglePlay}
                  aria-label={playing ? "Pause film" : "Play film"}
                >
                  {playing ? (
                    <Pause size={14} strokeWidth={1.8} aria-hidden="true" />
                  ) : (
                    <Play size={14} strokeWidth={1.8} aria-hidden="true" />
                  )}
                  {playing ? "Pause" : "Play"}
                </button>
                <button
                  type="button"
                  className="mm-film-control"
                  onClick={handleReplay}
                  aria-label="Replay film"
                >
                  <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" />
                  Replay
                </button>
              </>
            )}
          </div>

          <div className="mm-film-chapters" role="group" aria-label="Film chapters">
            {CHAPTERS.map((item) => {
              const active = phase === item.phase;
              return (
                <button
                  type="button"
                  className={`mm-film-chapter ${active ? "is-active" : ""}`}
                  key={item.phase}
                  onClick={() => jumpTo(item.phase)}
                  aria-label={`Chapter ${item.phase}: ${item.title} · 0${item.phase} ${item.short}`}
                  aria-current={active ? "step" : undefined}
                >
                  <span className="mm-film-chapter-number">0{item.phase}</span>{" "}
                  <span className="mm-film-chapter-label">{item.short}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <figcaption className="mm-film-note">
        Illustrative sample data. {formatCount(data.boundary.students)} students,{" "}
        {data.boundary.rooms} rooms, {formatCount(data.boundary.scored)} pair scores. No raw
        student answers appear anywhere in this film.
        {reduced
          ? " Motion is reduced on this device; use Previous and Next to read the five scenes."
          : ""}
      </figcaption>
    </figure>
  );
}
