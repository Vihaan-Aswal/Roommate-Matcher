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
  documentSealAt,
  documentsAt,
  fairnessBarsAt,
  fairnessMeanAt,
  fairnessRiskAt,
  fairnessSwapAt,
  fairnessThreadAt,
  foldersAt,
  formatFilmTime,
  inputsRevealAt,
  keyAt,
  ledgerAt,
  matchAt,
  normalisedAt,
  notesAt,
  openAt,
  roomsAt,
  sealAt,
  signSlipAt,
  stampAt,
  stationOpacityAt,
  stepIndexAt,
  strategyAt,
  travelAt,
  waxAt,
} from "./pipelineTimeline";
import "./film-chrome.css";
import "./cohort-pipeline.css";

function vars(values: Record<string, string | number>): CSSProperties {
  return values as CSSProperties;
}

function score3(value: number): string {
  return value.toFixed(3);
}

function StrategyDiagram({ beds }: { beds: 2 | 3 | 4 }): JSX.Element {
  if (beds === 2) {
    return (
      <svg viewBox="0 0 48 28" className="cp-strategy-glyph" aria-hidden="true" focusable="false">
        <line x1="10" y1="14" x2="38" y2="14" />
        <circle cx="10" cy="14" r="3.2" />
        <circle cx="38" cy="14" r="3.2" />
      </svg>
    );
  }
  if (beds === 3) {
    return (
      <svg viewBox="0 0 48 28" className="cp-strategy-glyph" aria-hidden="true" focusable="false">
        <line x1="10" y1="19" x2="24" y2="19" />
        <line className="is-grow" x1="24" y1="19" x2="38" y2="8" />
        <line className="is-grow" x1="10" y1="19" x2="38" y2="8" />
        <circle className="is-seed" cx="10" cy="19" r="3.3" />
        <circle cx="24" cy="19" r="3" />
        <circle className="is-grown" cx="38" cy="8" r="3.3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 28" className="cp-strategy-glyph" aria-hidden="true" focusable="false">
      <line x1="9" y1="7" x2="9" y2="21" />
      <line x1="39" y1="7" x2="39" y2="21" />
      <line className="is-merge" x1="9" y1="14" x2="39" y2="14" />
      <circle cx="9" cy="7" r="2.8" />
      <circle cx="9" cy="21" r="2.8" />
      <circle cx="39" cy="7" r="2.8" />
      <circle cx="39" cy="21" r="2.8" />
      <circle className="is-merge-node" cx="24" cy="14" r="2.2" />
    </svg>
  );
}

interface CohortPipelineProps {
  run: Run;
  playKey: number;
}

export function CohortPipeline({ run, playKey }: CohortPipelineProps): JSX.Element {
  const data = useMemo(() => selectSampleCase(run), [run]);
  const strategyCounts = useMemo(() => {
    const countFor = (size: 2 | 3 | 4) =>
      data.segments
        .filter((segment) => segment.size === size)
        .reduce((total, segment) => total + segment.rooms.length, 0);
    return { 2: countFor(2), 3: countFor(3), 4: countFor(4) };
  }, [data]);
  const fairnessRooms = useMemo(
    () =>
      [...data.risk.segment.rooms].sort(
        (left, right) => left.score - right.score || left.id.localeCompare(right.id),
      ),
    [data],
  );
  const notes = data.notes.slice(0, 3);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const inputsRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const boundaryRef = useRef<HTMLDivElement>(null);
  const matchRef = useRef<HTMLDivElement>(null);
  const fairnessRef = useRef<HTMLDivElement>(null);
  const riskFillRef = useRef<HTMLSpanElement>(null);
  const riskCardsRef = useRef<HTMLDivElement>(null);
  const threadPathRef = useRef<SVGPathElement>(null);
  const documentsRef = useRef<HTMLDivElement>(null);
  const signoffRef = useRef<HTMLDivElement>(null);
  const batchRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const timecodeRef = useRef<HTMLSpanElement>(null);
  const stationRefs = useRef<Array<HTMLElement | null>>([]);
  const stationBodyRefs = useRef<Array<HTMLElement | null>>([]);

  const timeRef = useRef(0);
  const stepRef = useRef(0);
  const startedRef = useRef(false);
  const playingRef = useRef(false);
  const endedRef = useRef(false);
  const resumeRef = useRef(false);

  const render = useCallback((time: number) => {
    const world = worldRef.current;
    if (!world) return;

    world.style.transform = `translate3d(${(cameraAt(time) * -12.5).toFixed(4)}%, 0, 0)`;

    stationRefs.current.forEach((node, index) => {
      if (!node) return;
      const body =
        stationBodyRefs.current[index] ?? node.querySelector<HTMLElement>(".cp-bay-body");
      stationBodyRefs.current[index] = body;
      if (body) body.style.opacity = stationOpacityAt(time, index).toFixed(4);
    });

    if (stationOpacityAt(time, 0) > 0 && inputsRef.current) {
      inputsRef.current.style.setProperty("--in", inputsRevealAt(time).toFixed(4));
    }

    if (stationOpacityAt(time, 1) > 0 && formRef.current) {
      formRef.current.style.setProperty("--fp", cardArrivalAt(time).toFixed(4));
      formRef.current.style.setProperty("--seal", sealAt(time).toFixed(4));
      formRef.current.style.setProperty("--norm", normalisedAt(time).toFixed(4));
    }

    if (stationOpacityAt(time, 2) > 0 && boundaryRef.current) {
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

    if (stationOpacityAt(time, 4) > 0 && matchRef.current) {
      matchRef.current.style.setProperty("--match", matchAt(time).toFixed(4));
      matchRef.current.style.setProperty("--strategy", strategyAt(time).toFixed(4));
      matchRef.current.style.setProperty("--rooms", roomsAt(time).toFixed(4));
    }

    if (stationOpacityAt(time, 5) > 0 && fairnessRef.current) {
      fairnessRef.current.style.setProperty("--bars", fairnessBarsAt(time).toFixed(4));
      fairnessRef.current.style.setProperty("--mean", fairnessMeanAt(time).toFixed(4));
      fairnessRef.current.style.setProperty("--thread", fairnessThreadAt(time).toFixed(4));
      fairnessRef.current.style.setProperty("--risk", fairnessRiskAt(time).toFixed(4));
      fairnessRef.current.style.setProperty("--swap", fairnessSwapAt(time).toFixed(4));
    }

    if (stationOpacityAt(time, 6) > 0 && documentsRef.current) {
      documentsRef.current.style.setProperty("--docs", documentsAt(time).toFixed(4));
      documentsRef.current.style.setProperty("--notes", notesAt(time).toFixed(4));
      documentsRef.current.style.setProperty("--sealed", documentSealAt(time).toFixed(4));
    }

    if (stationOpacityAt(time, 7) > 0 && signoffRef.current) {
      signoffRef.current.style.setProperty("--slip", signSlipAt(time).toFixed(4));
      signoffRef.current.style.setProperty("--waxed", waxAt(time).toFixed(4));
      signoffRef.current.style.setProperty("--key", keyAt(time).toFixed(4));
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
        `${formatFilmTime(time)} of 00:50`,
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

  useEffect(() => {
    const layout = fairnessRef.current;
    const fill = riskFillRef.current;
    const cards = riskCardsRef.current;
    const path = threadPathRef.current;
    if (!layout || !fill || !cards || !path) return;

    const update = () => {
      const frame = layout.getBoundingClientRect();
      if (frame.width < 1 || frame.height < 1) return;
      // offsetHeight ignores the scaleY entrance, so the thread starts at the
      // bar's final top even before the bars finish growing.
      const track = fill.parentElement as HTMLElement;
      const trackRect = track.getBoundingClientRect();
      const cardRects = Array.from(cards.children).map((child) =>
        child.getBoundingClientRect(),
      );
      if (cardRects.length === 0) return;

      const startX = trackRect.left + trackRect.width / 2 - frame.left;
      const startY =
        trackRect.top + (track.offsetHeight - fill.offsetHeight) - frame.top;
      // The container is untransformed; the cards slide up on entry.
      const cardTop = cards.getBoundingClientRect().top - frame.top;
      const bracketY = Math.max(2, cardTop - 4);
      const centers = cardRects.map(
        (rect) => rect.left + rect.width / 2 - frame.left,
      );
      const first = centers[0];
      const last = centers[centers.length - 1];
      const center = (first + last) / 2;
      const d =
        `M ${startX.toFixed(2)} ${startY.toFixed(2)} ` +
        `L ${center.toFixed(2)} ${bracketY.toFixed(2)} ` +
        `M ${first.toFixed(2)} ${bracketY.toFixed(2)} ` +
        `L ${last.toFixed(2)} ${bracketY.toFixed(2)} ` +
        `M ${first.toFixed(2)} ${bracketY.toFixed(2)} ` +
        `L ${first.toFixed(2)} ${(bracketY + 8).toFixed(2)} ` +
        `M ${last.toFixed(2)} ${bracketY.toFixed(2)} ` +
        `L ${last.toFixed(2)} ${(bracketY + 8).toFixed(2)}`;
      path.setAttribute("d", d);
      path.setAttribute("data-start-x", startX.toFixed(2));
      path.setAttribute("data-start-y", startY.toFixed(2));
      path.setAttribute("data-bracket-y", bracketY.toFixed(2));
      path.setAttribute("data-first-x", first.toFixed(2));
      path.setAttribute("data-last-x", last.toFixed(2));
      path.ownerSVGElement?.setAttribute(
        "viewBox",
        `0 0 ${frame.width.toFixed(2)} ${frame.height.toFixed(2)}`,
      );
    };

    update();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(layout);
    window.addEventListener("resize", update);
    document.fonts?.ready.then(update).catch(() => undefined);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

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
  const CHART_MIN = 0.3;
  const chartHeight = (score: number) =>
    Math.max(2, Math.min(100, ((score - CHART_MIN) / (1 - CHART_MIN)) * 100));
  const meanHeight = chartHeight(risk.segment.mean);
  const floorHeight = chartHeight(0.55);

  return (
    <figure className="mm-film cp-film" id="sample-run">
      <div className="mm-film-frame">
        <div className="mm-film-head">
          <span className="mm-film-tag">Cohort pipeline</span>
          <span className="mm-film-meta mm-film-meta-full">
            One cohort · eight stations · 50 seconds
          </span>
          <span className="mm-film-meta mm-film-meta-short">8 stations · 50s</span>
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

            <section className="cp-station" data-station="inputs" style={vars({ "--i": 0, "--on": 1 })} ref={(node) => { stationRefs.current[0] = node; }}>
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

            <section className="cp-station" data-station="form" style={vars({ "--i": 1, "--on": 0 })} ref={(node) => { stationRefs.current[1] = node; }}>
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

            <section className="cp-station" data-station="boundaries" style={vars({ "--i": 2, "--on": 0 })} ref={(node) => { stationRefs.current[2] = node; }}>
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
                            <span className="cp-folder-count">
                              {segment.rooms.length}
                              <small>rooms</small>
                            </span>
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
                              <span className="cp-mono">
                                Open · {risk.room.id} · {risk.segment.rooms.length} rooms
                              </span>
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

            <section className="cp-station" data-station="score" style={vars({ "--i": 3, "--on": 0 })} ref={(node) => { stationRefs.current[3] = node; }}>
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

                  <div className="cp-factor-head" aria-hidden="true">
                    <span>Factor</span>
                    <span>Wt</span>
                    <span>Score</span>
                  </div>
                  <div className="cp-factor-list">
                    {risk.pair.factors.map((factor) => {
                      const missing = factor.missing;
                      const zero = !missing && factor.raw === 0;
                      return (
                        <div
                          className={`cp-factor ${missing ? "is-missing" : ""} ${
                            zero ? "is-zero" : ""
                          }`}
                          key={factor.key}
                        >
                          <span className="cp-factor-name">
                            {factor.label}
                            {missing ? <em>blank</em> : null}
                          </span>
                          <span className="cp-factor-weight">
                            {missing ? "—" : `${Math.round(factor.effectiveWeight * 100)}%`}
                          </span>
                          <span className="cp-factor-score">
                            <b>{missing ? "—" : factor.raw.toFixed(2)}</b>
                            <span className="cp-factor-track">
                              <span
                                className="cp-factor-fill"
                                style={vars({ "--w": missing ? 0 : factor.raw })}
                              />
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="cp-score-evidence">
                    Bar = raw factor score · weights are effective.
                  </p>
                </article>
              </div>
            </section>

            <section className="cp-station" data-station="match" style={vars({ "--i": 4, "--on": 0 })} ref={(node) => { stationRefs.current[4] = node; }}>
              <header className="cp-bay-head">
                <span className="cp-bay-num">05</span>
                <h2 className="cp-bay-name">Match</h2>
                <span className="cp-bay-note">chosen pairs</span>
              </header>
              <div className="cp-bay-body">
                <div className="cp-match-layout" ref={matchRef}>
                  <article className="cp-paper cp-pair-graph">
                    <header className="cp-graph-head">
                      <span className="cp-mono">2-bed segment · M · 1st · AC</span>
                      <span>{risk.segment.rooms.length} rooms · one of two</span>
                    </header>
                    <div className="cp-graph-grid">
                      {risk.segment.rooms.map((room) => (
                        <div
                          className={`cp-graph-room ${
                            room.id === risk.room.id ? "is-risk" : ""
                          }`}
                          key={room.id}
                        >
                          <span className="cp-graph-node is-top" />
                          <span className="cp-graph-line" />
                          <span className="cp-graph-node is-bottom" />
                          <span className="cp-graph-id">{room.id}</span>
                        </div>
                      ))}
                    </div>
                    <p className="cp-graph-note">
                      One line = one chosen pair · R-12 marked.
                    </p>
                  </article>

                  <div className="cp-match-side">
                    <div className="cp-rooms-proposed">
                      <strong>{data.boundary.rooms}</strong>
                      <span>rooms proposed</span>
                    </div>
                    <div className="cp-strategy-list">
                      {[
                        {
                          beds: 2 as const,
                          label: "2-bed · two segments",
                          detail: "maximum weight",
                          count: strategyCounts[2],
                        },
                        {
                          beds: 3 as const,
                          label: "3-bed · one segment",
                          detail: "seed and grow",
                          count: strategyCounts[3],
                        },
                        {
                          beds: 4 as const,
                          label: "4-bed · one segment",
                          detail: "pair, then merge",
                          count: strategyCounts[4],
                        },
                      ].map((strategy) => (
                        <div className="cp-strategy" key={strategy.beds}>
                          <StrategyDiagram beds={strategy.beds} />
                          <div>
                            <b>{strategy.label}</b>
                            <span>{strategy.detail}</span>
                          </div>
                          <strong>
                            {strategy.count}
                            <small>rooms</small>
                          </strong>
                        </div>
                      ))}
                    </div>
                    <p className="cp-strategy-sum">
                      {strategyCounts[2]} + {strategyCounts[3]} + {strategyCounts[4]} ={" "}
                      {data.boundary.rooms} rooms
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="cp-station" data-station="fairness" style={vars({ "--i": 5, "--on": 0 })} ref={(node) => { stationRefs.current[5] = node; }}>
              <header className="cp-bay-head">
                <span className="cp-bay-num">06</span>
                <h2 className="cp-bay-name">Fairness</h2>
                <span className="cp-bay-note">the floor</span>
              </header>
              <div className="cp-bay-body">
                <div className="cp-fair-layout" ref={fairnessRef}>
                  <article className="cp-paper cp-fair-chart">
                    <header className="cp-fair-head">
                      <span className="cp-mono">
                        Fairness statement · {risk.segment.short}
                      </span>
                      <span>{risk.atRisk.length} at risk</span>
                    </header>
                    <div className="cp-fair-plot">
                      <span
                        className="cp-fair-rule is-mean"
                        style={vars({ "--y": meanHeight })}
                      >
                        <span>mean {score3(risk.segment.mean)}</span>
                      </span>
                      <span
                        className="cp-fair-rule is-floor"
                        style={vars({ "--y": floorHeight })}
                      >
                        <span>floor 0.55</span>
                      </span>
                      <div className="cp-fair-bars">
                        {fairnessRooms.map((room) => (
                          <span
                            className={`cp-fair-bar ${
                              room.id === risk.room.id ? "is-risk" : ""
                            }`}
                            key={room.id}
                            style={vars({ "--h": chartHeight(room.score) })}
                          >
                            <span
                              className="cp-fair-fill"
                              ref={room.id === risk.room.id ? riskFillRef : undefined}
                            />
                            {room.id === risk.room.id ? (
                              <b>{score3(room.score)}</b>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="cp-fair-foot">
                      <span>12 rooms · sorted by score</span>
                      <span>mean {score3(risk.segment.mean)}</span>
                    </div>
                  </article>

                  <div className="cp-fair-side">
                    <div className="cp-risk-cards" ref={riskCardsRef}>
                      {risk.atRisk.map((student) => (
                        <div className="cp-risk-card" key={student.id}>
                          <span>{student.id}</span>
                          <strong>{score3(student.satisfaction)}</strong>
                          <span>{student.roomId} · below 0.55</span>
                        </div>
                      ))}
                    </div>
                    <article className="cp-fair-statement">
                      <span className="cp-mono">Fairness statement</span>
                      <strong>{risk.atRisk.length} at risk · review required</strong>
                      <span>
                        floor {score3(risk.room.score)} · {risk.room.id}
                      </span>
                    </article>
                  </div>

                  <div className="cp-swap-ledger">
                    <span className="cp-mono">Swap pass</span>
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

                  <svg
                    className="cp-fair-thread"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path ref={threadPathRef} pathLength={1} />
                  </svg>
                </div>
              </div>
            </section>

            <section className="cp-station" data-station="documents" style={vars({ "--i": 6, "--on": 0 })} ref={(node) => { stationRefs.current[6] = node; }}>
              <header className="cp-bay-head">
                <span className="cp-bay-num">07</span>
                <h2 className="cp-bay-name">Documents</h2>
                <span className="cp-bay-note">the run pack</span>
              </header>
              <div className="cp-bay-body">
                <div className="cp-docs-layout" ref={documentsRef}>
                  <div className="cp-doc-grid">
                    <article className="cp-paper cp-doc-card">
                      <span className="cp-mono">Assignments</span>
                      <strong>{data.boundary.rooms}</strong>
                      <span>rooms · {data.boundary.students} beds</span>
                    </article>
                    <article className="cp-paper cp-doc-card">
                      <span className="cp-mono">Reasons</span>
                      <strong>{data.boundary.students}</strong>
                      <span>notes · one per student</span>
                      <p className="cp-doc-reason">
                        <span>{notes[0]?.student.id}</span>
                        <b>{notes[0]?.reasons[0]}</b>
                      </p>
                    </article>
                    <article className="cp-paper cp-doc-card">
                      <span className="cp-mono">Fairness statement</span>
                      <strong>{score3(risk.room.score)}</strong>
                      <span>floor · {risk.atRisk.length} at risk</span>
                    </article>
                    <article className="cp-paper cp-doc-card">
                      <span className="cp-mono">Audit trail</span>
                      <strong>{data.audit.runId}</strong>
                      <span>digest {data.audit.digest}</span>
                      <span>
                        {formatCount(data.boundary.scored)} pairs · {data.audit.swapPasses}/
                        {data.audit.swapsAccepted}/{data.audit.newPoorFromSwaps}
                      </span>
                    </article>
                  </div>

                  <div className="cp-docs-sealed">
                    <span className="cp-mono">Raw answers</span>
                    <strong>Sealed</strong>
                    <span>not read on the desk</span>
                    <span className="cp-docs-wax">RM</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="cp-station" data-station="signoff" style={vars({ "--i": 7, "--on": 0 })} ref={(node) => { stationRefs.current[7] = node; }}>
              <header className="cp-bay-head">
                <span className="cp-bay-num">08</span>
                <h2 className="cp-bay-name">Sign-off</h2>
                <span className="cp-bay-note">a person signs</span>
              </header>
              <div className="cp-bay-body">
                <div className="cp-sign-layout" ref={signoffRef}>
                  <article className="cp-paper cp-sign-slip">
                    <header className="cp-sign-head">
                      <span className="cp-mono">Sign-off slip</span>
                      <span>{data.audit.runId} · sample</span>
                    </header>
                    <dl className="cp-sign-data">
                      <div>
                        <dt>Proposal</dt>
                        <dd>
                          {data.boundary.rooms} rooms · {data.boundary.students} beds
                        </dd>
                      </div>
                      <div>
                        <dt>At risk</dt>
                        <dd>
                          {risk.atRisk.length} · {risk.room.id} · review required
                        </dd>
                      </div>
                      <div>
                        <dt>Floor</dt>
                        <dd>{score3(risk.room.score)}</dd>
                      </div>
                    </dl>
                    <div className="cp-signature">
                      <span className="cp-sign-rule" />
                      <span className="cp-sign-caption">Signed by a person</span>
                      <span className="cp-wax-sign">RM</span>
                    </div>
                  </article>

                  <div className="cp-keys">
                    <span className="cp-mono">Keys</span>
                    <svg viewBox="0 0 44 24" aria-hidden="true" focusable="false">
                      <circle cx="11" cy="12" r="5" />
                      <line x1="16" y1="12" x2="36" y2="12" />
                      <line x1="30" y1="12" x2="30" y2="17" />
                      <line x1="35" y1="12" x2="35" y2="16" />
                    </svg>
                    <strong>After the signature</strong>
                    <span>not issued by the desk</span>
                    <span className="cp-key-seal">held</span>
                  </div>
                </div>
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
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`cp-rail-step ${active ? "is-active" : ""}`}
                    onClick={() => seek(item.seekAt)}
                    aria-current={active ? "step" : undefined}
                    aria-label={`${String(index + 1).padStart(2, "0")} ${item.label} · step ${
                      index + 1
                    } of 8`}
                    title={item.caption}
                  >
                    <span className="cp-rail-num">{String(index + 1).padStart(2, "0")}</span>{" "}
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
              <span ref={timecodeRef}>00:00.0</span> / 00:50
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
            aria-valuetext="00:00.0 of 00:50"
            onChange={(event) => seek(Number(event.currentTarget.value))}
          />
        </div>
      </div>

      <figcaption className="mm-film-note cp-note">
        Illustrative sample data. {formatCount(data.boundary.students)} students,{" "}
        {data.boundary.rooms} rooms, {formatCount(data.boundary.possible)} possible pairs,{" "}
        {formatCount(data.boundary.rejected)} never compared,{" "}
        {formatCount(data.boundary.scored)} scored. R-12 · {risk.students[0].id} ×{" "}
        {risk.students[1].id} · {score3(risk.pair.score)} · {risk.atRisk.length} at risk.{" "}
        {data.audit.swapPasses} swap passes · {data.audit.swapsAccepted} accepted ·{" "}
        {data.audit.newPoorFromSwaps} new Poor. {data.boundary.students} notes. No raw student
        answers appear.{" "}
        <Link className="cp-compare-link" to="/?classic=1">
          Compare the classic film
        </Link>
      </figcaption>
    </figure>
  );
}
