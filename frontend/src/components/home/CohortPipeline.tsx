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
import { Pause, Play, RotateCcw } from "lucide-react";

import {
  formatCount,
  selectSampleCase,
  type Run,
} from "./simulate";
import {
  PIPELINE_DURATION,
  PIPELINE_STEPS,
  batchAt,
  cameraAt,
  cardArrivalAt,
  foldersAt,
  formatFilmTime,
  inputsRevealAt,
  ledgerAt,
  normalisedAt,
  openAt,
  sealAt,
  stampAt,
  stationOpacityAt,
  stepIndexAt,
  travelAt,
} from "./pipelineTimeline";
import "./cohort-pipeline.css";

const STATION_COUNT = 4;

function vars(values: Record<string, string | number>): CSSProperties {
  return values as CSSProperties;
}

function score3(value: number): string {
  return value.toFixed(3);
}

interface CohortPipelineProps {
  run: Run;
  playKey: number;
}

export function CohortPipeline({ run, playKey }: CohortPipelineProps): JSX.Element {
  const data = useMemo(() => selectSampleCase(run), [run]);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const inputsRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const boundaryRef = useRef<HTMLDivElement>(null);
  const batchRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const timecodeRef = useRef<HTMLSpanElement>(null);
  const stationRefs = useRef<Array<HTMLElement | null>>([]);

  const timeRef = useRef(0);
  const stepRef = useRef(0);
  const startedRef = useRef(false);
  const playingRef = useRef(false);
  const endedRef = useRef(false);
  const resumeRef = useRef(false);

  const render = useCallback((time: number) => {
    const world = worldRef.current;
    if (!world) return;

    world.style.setProperty("--cam", cameraAt(time).toFixed(4));
    world.style.setProperty("--travel", travelAt(time).toFixed(4));

    stationRefs.current.forEach((node, index) => {
      node?.style.setProperty("--on", stationOpacityAt(time, index).toFixed(4));
    });

    inputsRef.current?.style.setProperty("--in", inputsRevealAt(time).toFixed(4));
    formRef.current?.style.setProperty("--fp", cardArrivalAt(time).toFixed(4));
    formRef.current?.style.setProperty("--seal", sealAt(time).toFixed(4));
    formRef.current?.style.setProperty("--norm", normalisedAt(time).toFixed(4));

    if (boundaryRef.current) {
      boundaryRef.current.style.setProperty("--fold", foldersAt(time).toFixed(4));
      boundaryRef.current.style.setProperty("--ledger", ledgerAt(time).toFixed(4));
      boundaryRef.current.style.setProperty("--open", openAt(time).toFixed(4));
      for (let index = 0; index < 4; index += 1) {
        boundaryRef.current.style.setProperty(
          `--s${index}`,
          stampAt(time, index).toFixed(4),
        );
      }
    }

    if (batchRef.current) {
      batchRef.current.style.setProperty("--batch", batchAt(time).toFixed(4));
      batchRef.current.style.setProperty("--travel", travelAt(time).toFixed(4));
      batchRef.current.style.setProperty("--seal", sealAt(time).toFixed(4));
      for (let index = 0; index < 4; index += 1) {
        batchRef.current.style.setProperty(
          `--s${index}`,
          stampAt(time, index).toFixed(4),
        );
      }
    }

    if (sliderRef.current) {
      sliderRef.current.value = String(time);
      sliderRef.current.setAttribute("aria-valuenow", time.toFixed(1));
      sliderRef.current.setAttribute(
        "aria-valuetext",
        `${formatFilmTime(time)} of 00:10`,
      );
    }
    if (timecodeRef.current) {
      timecodeRef.current.textContent = formatFilmTime(time);
    }

    const nextStep = stepIndexAt(time);
    if (nextStep !== stepRef.current) {
      stepRef.current = nextStep;
      setStepIndex(nextStep);
    }
  }, []);

  const pause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
  }, []);

  const restart = useCallback(() => {
    timeRef.current = 0;
    endedRef.current = false;
    stepRef.current = 0;
    setEnded(false);
    setStepIndex(0);
    render(0);
    startedRef.current = true;
    if (document.visibilityState === "hidden") {
      resumeRef.current = true;
      pause();
      return;
    }
    playingRef.current = true;
    setPlaying(true);
  }, [pause, render]);

  const play = useCallback(() => {
    if (endedRef.current || timeRef.current >= PIPELINE_DURATION - 0.001) {
      restart();
      return;
    }
    playingRef.current = true;
    setPlaying(true);
  }, [restart]);

  const seek = useCallback(
    (time: number) => {
      const next = Math.min(PIPELINE_DURATION, Math.max(0, time));
      timeRef.current = next;
      endedRef.current = next >= PIPELINE_DURATION;
      setEnded(next >= PIPELINE_DURATION);
      pause();
      stepRef.current = stepIndexAt(next);
      setStepIndex(stepRef.current);
      render(next);
    },
    [pause, render],
  );

  const toggle = useCallback(() => {
    if (playingRef.current) pause();
    else play();
  }, [pause, play]);

  useEffect(() => {
    render(0);
    if (startedRef.current) return;

    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      playingRef.current = true;
      setPlaying(true);
    };

    if (document.visibilityState === "hidden") {
      const onVisible = () => {
        if (document.visibilityState === "hidden") return;
        document.removeEventListener("visibilitychange", onVisible);
        start();
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => document.removeEventListener("visibilitychange", onVisible);
    }

    // The film is the hero: there is deliberately no intersection gate. At a
    // short laptop viewport the stage can sit below the fold and must still run.
    start();
  }, [render]);

  useEffect(() => {
    if (playKey === 0) return;
    restart();
  }, [playKey, restart]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = 0;

    const tick = (now: number) => {
      const delta = last === 0 ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const next = Math.min(PIPELINE_DURATION, timeRef.current + delta);
      timeRef.current = next;
      render(next);

      if (next >= PIPELINE_DURATION) {
        playingRef.current = false;
        endedRef.current = true;
        setPlaying(false);
        setEnded(true);
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing, render]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (playingRef.current) {
          resumeRef.current = true;
          pause();
        }
        return;
      }
      if (resumeRef.current && !endedRef.current) {
        resumeRef.current = false;
        play();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pause, play]);

  const onStageKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      toggle();
      return;
    }
    if (event.key === "Escape") {
      if (playingRef.current) {
        event.preventDefault();
        pause();
      }
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      seek(timeRef.current + (event.key === "ArrowRight" ? 0.5 : -0.5));
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      seek(0);
    }
  };

  const step = PIPELINE_STEPS[stepIndex];
  const risk = data.risk;

  return (
    <figure className="mm-film cp-film" id="sample-run">
      <div className="mm-film-frame">
        <div className="mm-film-head">
          <span className="mm-film-tag">Cohort pipeline</span>
          <span className="mm-film-meta mm-film-meta-full">
            One cohort · eight stations · steps 1–4 of 8
          </span>
          <span className="mm-film-meta mm-film-meta-short">Steps 1–4 · 10s</span>
          <span className="mm-film-run">{data.audit.runId}</span>
        </div>

        <div
          className="cp-stage"
          ref={stageRef}
          role="group"
          aria-label="Cohort pipeline animation"
          tabIndex={0}
          data-step={stepIndex + 1}
          data-playing={playing ? "true" : "false"}
          onKeyDown={onStageKeyDown}
        >
          <div className="cp-world" ref={worldRef} aria-hidden="true">
            <div className="cp-desk" />
            <div className="cp-rule" />

            <section className="cp-station" style={vars({ "--i": 0, "--on": 1 })} ref={(node) => { stationRefs.current[0] = node; }}>
              <header className="cp-bay-head">
                <span className="cp-bay-num">01</span>
                <h2 className="cp-bay-name">Inputs</h2>
                <span className="cp-bay-note">cohort intake</span>
              </header>
              <div className="cp-bay-body">
                <div className="cp-inputs" ref={inputsRef}>
                  <article className="cp-paper cp-intake">
                    <header className="cp-paper-head">
                      <span>Intake</span>
                      <span>illustrative sample</span>
                    </header>
                    <div className="cp-stat-row">
                      <strong>{formatCount(data.boundary.students)}</strong>
                      <div>
                        <b>students</b>
                        <span>roster · one row each</span>
                      </div>
                    </div>
                    <div className="cp-stat-row">
                      <strong>{data.boundary.rooms}</strong>
                      <div>
                        <b>rooms</b>
                        <span>2, 3 and 4 beds</span>
                      </div>
                    </div>
                  </article>

                  <article className="cp-paper cp-form-card">
                    <header className="cp-paper-head">
                      <span>Private form</span>
                      <span>one link</span>
                    </header>
                    <div className="cp-form-count">
                      <strong>12</strong>
                      <span>questions</span>
                    </div>
                    <div className="cp-form-lines">
                      {Array.from({ length: 5 }, (_, index) => (
                        <span key={index} />
                      ))}
                    </div>
                    <p className="cp-form-foot">one response per student</p>
                    <span className="cp-form-seal">private</span>
                  </article>
                </div>
              </div>
            </section>

            <section className="cp-station" style={vars({ "--i": 1, "--on": 0 })} ref={(node) => { stationRefs.current[1] = node; }}>
              <header className="cp-bay-head">
                <span className="cp-bay-num">02</span>
                <h2 className="cp-bay-name">Form</h2>
                <span className="cp-bay-note">responses arrive</span>
              </header>
              <div className="cp-bay-body">
                <div className="cp-form-layout" ref={formRef}>
                  <article className="cp-paper cp-response-board">
                    <header className="cp-board-head">
                      <div>
                        <span className="cp-mono">Responses</span>
                        <strong>{formatCount(data.boundary.students)}</strong>
                      </div>
                      <span className="cp-board-note">one per student</span>
                    </header>
                    <div className="cp-card-grid">
                      {Array.from({ length: data.boundary.students }, (_, index) => (
                        <span
                          className="cp-response-card"
                          key={index}
                          style={vars({ "--i": index })}
                        />
                      ))}
                    </div>
                  </article>

                  <div className="cp-form-side">
                    <article className="cp-envelope">
                      <span className="cp-mono">Raw answers</span>
                      <strong>Sealed</strong>
                      <span className="cp-envelope-note">not read on the desk</span>
                      <span className="cp-wax">RM</span>
                    </article>

                    <article className="cp-paper cp-normalised">
                      <span className="cp-mono">Normalised preferences</span>
                      <ul>
                        {risk.pair.factors.map((factor) => (
                          <li key={factor.key}>{factor.label}</li>
                        ))}
                      </ul>
                      <span className="cp-norm-foot">10 weighted factors</span>
                    </article>
                  </div>
                </div>
              </div>
            </section>

            <section className="cp-station" style={vars({ "--i": 2, "--on": 0 })} ref={(node) => { stationRefs.current[2] = node; }}>
              <header className="cp-bay-head">
                <span className="cp-bay-num">03</span>
                <h2 className="cp-bay-name">Boundaries</h2>
                <span className="cp-bay-note">who can be compared</span>
              </header>
              <div className="cp-bay-body">
                <div className="cp-boundary-layout" ref={boundaryRef}>
                  <div className="cp-stamp-row">
                    {["Gender", "Year", "AC", "Room size"].map((label, index) => (
                      <span
                        className="cp-stamp"
                        key={label}
                        style={vars({ "--s": `var(--s${index})` })}
                      >
                        {label}
                      </span>
                    ))}
                  </div>

                  <div className="cp-folders">
                    {data.segments.map((segment, index) => {
                      const isRisk = segment.index === risk.segment.index;
                      return (
                        <div
                          className={`cp-folder ${isRisk ? "is-risk" : ""}`}
                          key={segment.key}
                          style={vars({ "--fi": index })}
                        >
                          <span className="cp-folder-back" />
                          <span className="cp-folder-front">
                            <span className="cp-folder-count">{segment.members.length}</span>
                          </span>
                          <span className="cp-folder-tab">
                            <span>
                              {segment.gender} ·{" "}
                              {segment.year === "1st year" ? "1st" : "2nd–4th"} · {segment.ac}
                            </span>
                            <strong>
                              {segment.size}-bed · {segment.members.length} students
                            </strong>
                          </span>
                          {isRisk ? (
                            <span className="cp-open-slip">
                              <span className="cp-mono">Open · {risk.room.id}</span>
                              <strong>
                                {risk.students[0].id} × {risk.students[1].id}
                              </strong>
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className="cp-pair-ledger">
                    <div>
                      <strong>{formatCount(data.boundary.possible)}</strong>
                      <span>possible pairs</span>
                    </div>
                    <span className="cp-ledger-arrow">→</span>
                    <div>
                      <strong className="is-muted">{formatCount(data.boundary.rejected)}</strong>
                      <span>never compared</span>
                    </div>
                    <span className="cp-ledger-arrow">→</span>
                    <div>
                      <strong className="is-strong">{formatCount(data.boundary.scored)}</strong>
                      <span>scored</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="cp-station" style={vars({ "--i": 3, "--on": 0 })} ref={(node) => { stationRefs.current[3] = node; }}>
              <header className="cp-bay-head">
                <span className="cp-bay-num">04</span>
                <h2 className="cp-bay-name">Score</h2>
                <span className="cp-bay-note">ten weighted factors</span>
              </header>
              <div className="cp-bay-body">
                <article className="cp-paper cp-score-sheet">
                  <header className="cp-score-head">
                    <span className="cp-mono">Pair ledger · ten weighted factors</span>
                    <span className="cp-score-tag">sample score</span>
                  </header>

                  <div className="cp-score-main">
                    <div>
                      <span className="cp-score-pair">
                        {risk.students[0].id} × {risk.students[1].id}
                      </span>
                      <strong>{score3(risk.pair.score)}</strong>
                      <span className="cp-score-room">
                        {risk.room.id} · {risk.segment.short}
                      </span>
                    </div>
                    <span className="cp-score-verdict">Poor · below 0.55</span>
                  </div>

                  <div className="cp-factor-list">
                    {risk.pair.factors.map((factor) => (
                      <div
                        className={`cp-factor ${factor.missing ? "is-missing" : ""}`}
                        key={factor.key}
                      >
                        <span className="cp-factor-name">
                          {factor.label}
                          {factor.missing ? <em>blank</em> : null}
                        </span>
                        <span className="cp-factor-weight">
                          {factor.missing ? "—" : `${Math.round(factor.effectiveWeight * 100)}%`}
                        </span>
                        <span className="cp-factor-track">
                          <span
                            className="cp-factor-fill"
                            style={vars({
                              "--w": factor.missing ? 0 : factor.effectiveWeight,
                            })}
                          />
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="cp-score-note">
                    Missing answers are excluded; the remaining weights renormalise. No raw answer
                    appears.
                  </p>
                </article>
              </div>
            </section>

          </div>

          <div
            className="cp-batch"
            ref={batchRef}
            aria-hidden="true"
            style={vars({ "--batch": 0, "--travel": 0, "--seal": 0 })}
          >
            <span className="cp-batch-tab">
              Cohort pack · {formatCount(data.boundary.students)}
            </span>
            <span className="cp-batch-face">
              <span className="cp-batch-title">Students · rooms</span>
              <span className="cp-batch-meta">
                {data.boundary.students} · {data.boundary.rooms}
              </span>
              <span className="cp-batch-marks">
                <i /><i /><i /><i />
              </span>
              <span className="cp-batch-wax">sealed</span>
            </span>
          </div>

          <div className="cp-vignette" aria-hidden="true" />
          <div className="mm-film-grain" aria-hidden="true" />
        </div>

        <nav className="cp-rail" aria-label="Pipeline steps">
          <div className="cp-rail-head">
            <span className="cp-mono">Eight stations</span>
            <span className="cp-rail-current">
              {String(stepIndex + 1).padStart(2, "0")} / 08 · {step.label}
            </span>
          </div>
          <ol className="cp-rail-list">
            {PIPELINE_STEPS.map((item, index) => {
              const active = index === stepIndex;
              const built = item.seekAt !== null;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`cp-rail-step ${active ? "is-active" : ""} ${built ? "" : "is-future"}`}
                    onClick={() => {
                      if (item.seekAt !== null) seek(item.seekAt);
                    }}
                    disabled={!built}
                    aria-current={active ? "step" : undefined}
                    aria-label={`Step ${index + 1}: ${item.label}${built ? "" : " (not in this preview)"}`}
                    title={item.caption}
                  >
                    <span className="cp-rail-num">{String(index + 1).padStart(2, "0")}</span>
                    <span className="cp-rail-label">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="cp-caption" aria-live="polite" aria-atomic="true">
          <span className="cp-caption-kicker">
            Step {String(stepIndex + 1).padStart(2, "0")} · {step.label}
          </span>
          <p className="cp-caption-line">{step.caption}</p>
          <p className="cp-caption-detail">{step.detail}</p>
        </div>

        <div className="cp-controls">
          <div className="cp-transport">
            <button
              type="button"
              className="mm-film-control"
              onClick={toggle}
              aria-label={playing ? "Pause pipeline" : "Play pipeline"}
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
              onClick={restart}
              aria-label="Replay pipeline"
            >
              <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" />
              Replay
            </button>
            <span className="cp-timecode">
              <span ref={timecodeRef}>00:00.0</span> / 00:10
            </span>
            {ended ? <span className="cp-ended">End of take</span> : null}
          </div>

          <input
            className="cp-scrub"
            ref={sliderRef}
            type="range"
            min={0}
            max={PIPELINE_DURATION}
            step={0.1}
            defaultValue={0}
            aria-label="Pipeline position"
            aria-valuetext="00:00.0 of 00:10"
            onChange={(event) => seek(Number(event.currentTarget.value))}
          />
        </div>
      </div>

      <figcaption className="mm-film-note cp-note">
        Illustrative sample data. {formatCount(data.boundary.students)} students,{" "}
        {data.boundary.rooms} rooms, {formatCount(data.boundary.possible)} possible pairs,{" "}
        {formatCount(data.boundary.rejected)} never compared,{" "}
        {formatCount(data.boundary.scored)} scored. R-12 · {risk.students[0].id} ×{" "}
        {risk.students[1].id} · {score3(risk.pair.score)}. This 10-second spike covers steps 1–4;
        the rail shows the remaining stations. No raw student answers appear.{" "}
        <Link className="cp-compare-link" to="/">
          Compare the classic film
        </Link>
      </figcaption>
    </figure>
  );
}
