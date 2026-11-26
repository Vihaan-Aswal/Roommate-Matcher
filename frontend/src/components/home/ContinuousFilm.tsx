import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Link } from "react-router-dom";
import { Pause, Play, RotateCcw } from "lucide-react";

import {
  formatCount,
  selectSampleCase,
  type Run,
  type SampleCasePair,
} from "./simulate";
import {
  CAPTIONS,
  DESKTOP_CAMERA,
  FILM_DURATION,
  MOBILE_BREAKPOINT,
  MOBILE_CAMERA,
  cameraAt,
  captionIndexAt,
  factorRevealAt,
  formatFilmTime,
  formatMarker,
  lampAt,
  scorePressAt,
  threadAt,
} from "./continuousTimeline";
import "./sample-film.css";
import "./continuous-film.css";

const FAN_CARDS = 12;
const FOLDER_CARDS = 7;

function score3(value: number): string {
  return value.toFixed(3);
}

function vars(values: Record<string, string | number>): CSSProperties {
  return values as CSSProperties;
}

function FactorRow({
  factor,
  other,
}: {
  factor: SampleCasePair["pair"]["factors"][number];
  other: SampleCasePair["pair"]["factors"][number] | undefined;
}): JSX.Element {
  const otherRaw = other && !other.missing ? other.raw : 0;
  return (
    <div
      className={`cf-factor-row ${factor.missing ? "is-missing" : ""} ${
        !factor.missing && factor.raw === 0 ? "is-zero" : ""
      }`}
    >
      <span className="cf-factor-name">
        {factor.label}
        {factor.missing ? <em>blank</em> : null}
      </span>
      <span className="cf-factor-weight">
        {Math.round(factor.weight * 100)}%
      </span>
      <span className="cf-factor-cell is-risk">
        <span className="cf-factor-bar">
          <span
            className="cf-factor-fill"
            style={vars({ "--raw": factor.missing ? 0 : factor.raw })}
          />
        </span>
        <b>{factor.missing ? "—" : factor.raw.toFixed(2)}</b>
      </span>
      <span className="cf-factor-cell">
        <span className="cf-factor-bar">
          <span className="cf-factor-fill" style={vars({ "--raw": otherRaw })} />
        </span>
        <b>{other && !other.missing ? other.raw.toFixed(2) : "—"}</b>
      </span>
    </div>
  );
}

interface ContinuousFilmProps {
  run: Run;
  playKey: number;
}

export function ContinuousFilm({ run, playKey }: ContinuousFilmProps): JSX.Element {
  const data = useMemo(() => selectSampleCase(run), [run]);
  const healthyFactors = useMemo(
    () => new Map(data.healthy.pair.factors.map((factor) => [factor.key, factor])),
    [data],
  );
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [captionIndex, setCaptionIndex] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<HTMLDivElement>(null);
  const timecodeRef = useRef<HTMLSpanElement>(null);

  const timeRef = useRef(0);
  const sizeRef = useRef({ width: 0, height: 0 });
  const mobileRef = useRef(false);
  const startedRef = useRef(false);
  const playingRef = useRef(false);
  const endedRef = useRef(false);
  const captionRef = useRef(0);
  const resumeRef = useRef(false);

  const caption = CAPTIONS[captionIndex];

  const render = useCallback((time: number) => {
    const world = worldRef.current;
    const stage = stageRef.current;
    if (!world || !stage) return;

    const width = sizeRef.current.width || stage.clientWidth;
    const height = sizeRef.current.height || stage.clientHeight;
    if (width > 0 && height > 0 && world.offsetWidth > 0) {
      const camera = cameraAt(
        time,
        mobileRef.current ? MOBILE_CAMERA : DESKTOP_CAMERA,
      );
      const worldWidth = world.offsetWidth;
      const worldHeight = world.offsetHeight;
      const x = width / 2 - camera.x * worldWidth * camera.scale;
      const y = height / 2 - camera.y * worldHeight * camera.scale;
      world.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${camera.scale})`;
    }

    world.style.setProperty("--lamp", lampAt(time).toFixed(4));
    world.style.setProperty("--thread", threadAt(time).toFixed(4));
    world.style.setProperty("--reveal", factorRevealAt(time).toFixed(4));
    world.style.setProperty("--press-r12", scorePressAt(time, 4.9).toFixed(4));
    world.style.setProperty("--press-r15", scorePressAt(time, 7.5).toFixed(4));

    if (scrubRef.current) {
      scrubRef.current.style.setProperty(
        "--p",
        (time / FILM_DURATION).toFixed(5),
      );
      scrubRef.current.setAttribute("aria-valuenow", time.toFixed(1));
      scrubRef.current.setAttribute(
        "aria-valuetext",
        `${formatFilmTime(time)} of 00:10`,
      );
    }
    if (timecodeRef.current) {
      timecodeRef.current.textContent = formatFilmTime(time);
    }

    const next = captionIndexAt(time);
    if (next !== captionRef.current) {
      captionRef.current = next;
      setCaptionIndex(next);
    }
  }, []);

  const play = useCallback(() => {
    if (endedRef.current || timeRef.current >= FILM_DURATION) {
      timeRef.current = 0;
      endedRef.current = false;
      setEnded(false);
      render(0);
    }
    startedRef.current = true;
    playingRef.current = true;
    setPlaying(true);
  }, [render]);

  const pause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
  }, []);

  const restart = useCallback(() => {
    timeRef.current = 0;
    endedRef.current = false;
    setEnded(false);
    render(0);
    startedRef.current = true;
    playingRef.current = true;
    setPlaying(true);
  }, [render]);

  const seek = useCallback(
    (time: number) => {
      const next = Math.min(FILM_DURATION, Math.max(0, time));
      timeRef.current = next;
      endedRef.current = next >= FILM_DURATION;
      setEnded(next >= FILM_DURATION);
      playingRef.current = false;
      setPlaying(false);
      render(next);
    },
    [render],
  );

  useEffect(() => {
    if (playKey === 0) return;
    restart();
  }, [playKey, restart]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const update = () => {
      mobileRef.current = query.matches;
      render(timeRef.current);
    };
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, [render]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      sizeRef.current = { width: rect.width, height: rect.height };
      render(timeRef.current);
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [render]);

  // The film is the hero: start on mount when the page is visible. There is
  // deliberately no intersection gate, so a short laptop viewport cannot leave
  // it frozen at 00:00. Tab hiding still pauses and resumes it below.
  useEffect(() => {
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
    start();
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const delta = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const next = Math.min(FILM_DURATION, timeRef.current + delta);
      timeRef.current = next;
      render(next);
      if (next >= FILM_DURATION) {
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

  const toggle = () => {
    if (playingRef.current) pause();
    else play();
  };

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
      seek(timeRef.current + (event.key === "ArrowRight" ? 1 : -1));
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      seek(0);
    }
  };

  const onScrub = (event: ReactMouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    seek(((event.clientX - rect.left) / rect.width) * FILM_DURATION);
  };

  const onScrubKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Home") {
      event.preventDefault();
      seek(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      seek(FILM_DURATION);
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    seek(timeRef.current + (event.key === "ArrowRight" ? 0.5 : -0.5));
  };

  const toggleLabel = playing ? "Pause film" : "Play film";

  return (
    <figure className="mm-film mm-continuous" id="sample-run">
      <div className="mm-film-frame">
        <div className="mm-film-head">
          <span className="mm-film-tag">Continuous take</span>
          <span className="mm-film-meta mm-film-meta-full">
            One desk · one camera · ten seconds
          </span>
          <span className="mm-film-meta mm-film-meta-short">10-second take</span>
          <span className="mm-film-run">{data.audit.runId}</span>
        </div>

        <div
          className="cf-stage"
          ref={stageRef}
          role="group"
          aria-label="Continuous sample run film"
          tabIndex={0}
          onKeyDown={onStageKeyDown}
        >
          <div className="cf-world" ref={worldRef} aria-hidden="true">
            <div className="cf-desk" />

            <div className="cf-lamp">
              <span className="cf-lamp-glow" />
              <span className="cf-lamp-shade" />
              <span className="cf-lamp-arm" />
            </div>

            <svg
              className="cf-thread"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              focusable="false"
            >
              <path
                className="cf-thread-desk"
                d="M 14 76 C 22 88, 33 87, 38 82 C 45 77, 48 89, 55 84 C 61 80, 63 68, 68 58"
                pathLength={1}
              />
              <path
                className="cf-thread-mobile"
                d="M 22 16 C 32 20, 60 21, 60 26 C 60 31, 34 31, 38 38 C 42 45, 62 45, 58 52 C 54 59, 40 57, 48 63"
                pathLength={1}
              />
            </svg>
            <span className="cf-thread-tack is-start" />
            <span className="cf-thread-tack is-end" />

            <div className="cf-roster">
              <span className="cf-mono">Room roster · sample</span>
              <div className="cf-roster-lines">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="cf-roster-foot">
                <strong>{data.boundary.students}</strong>
                <span className="cf-roster-unit">students</span>
                <span className="cf-roster-rooms">
                  {data.boundary.rooms} rooms
                </span>
              </div>
            </div>

            <div className="cf-envelope">
              <span className="cf-envelope-flap" />
              <span className="cf-mono">Sealed responses</span>
              <strong>{data.boundary.students}</strong>
              <span className="cf-envelope-note">one answer set each</span>
              <span className="cf-wax-seal">
                <span>RM</span>
              </span>
            </div>
            <span className="cf-wax-stick" />

            <div className="cf-fan">
              {Array.from({ length: FAN_CARDS }, (_, index) => (
                <span
                  className="cf-fan-card"
                  key={index}
                  style={vars({
                    "--i": index,
                    "--x": `${(index - (FAN_CARDS - 1) / 2) * 6.2}%`,
                    "--y": `${Math.abs(index - (FAN_CARDS - 1) / 2) * -3}px`,
                    "--r": `${(index - (FAN_CARDS - 1) / 2) * 2.6}deg`,
                  })}
                />
              ))}
              <span className="cf-fan-label">
                {data.boundary.students} response cards · one per student
              </span>
            </div>

            <div className="film-sheet cf-boundary">
              <div className="cf-boundary-head">
                <span className="cf-mono">Boundary ledger</span>
                <span className="cf-boundary-tag">
                  {data.boundary.segments} segments
                </span>
              </div>
              <div className="cf-boundary-row">
                <div className="cf-boundary-cell">
                  <strong>{formatCount(data.boundary.possible)}</strong>
                  <span>possible pairs</span>
                </div>
                <span className="cf-boundary-arrow" />
                <div className="cf-boundary-cell">
                  <strong className="is-muted">
                    {formatCount(data.boundary.rejected)}
                  </strong>
                  <span>never compared</span>
                </div>
                <span className="cf-boundary-arrow" />
                <div className="cf-boundary-cell">
                  <strong className="is-strong">
                    {formatCount(data.boundary.scored)}
                  </strong>
                  <span>scored</span>
                </div>
              </div>
            </div>

            <div className="cf-folders">
              {data.segments.map((segment) => {
                const isRisk = segment.index === data.risk.segment.index;
                return (
                  <div
                    className={`cf-folder ${isRisk ? "is-open" : ""}`}
                    key={segment.key}
                  >
                    <span className="cf-folder-back" />
                    <span className="cf-folder-cards">
                      {Array.from({ length: FOLDER_CARDS }, (_, card) => (
                        <span key={card} style={vars({ "--c": card })} />
                      ))}
                    </span>
                    <span className="cf-folder-front" />
                    <span className="cf-folder-tab">
                      <span>
                        {segment.gender} ·{" "}
                        {segment.year === "1st year" ? "1st" : "2–4"} ·{" "}
                        {segment.members.length}
                      </span>
                      <span>
                        {segment.ac} {segment.size}-bed
                      </span>
                    </span>
                    <span className="cf-folder-tack" />
                    {isRisk ? (
                      <span className="cf-open-note">
                        <span className="cf-mono">open · R-12</span>
                        <strong>{score3(data.risk.pair.score)}</strong>
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="cf-brass-stamp">
              <span className="cf-brass-grip" />
              <span className="cf-brass-face">4</span>
            </div>

            <span className="cf-ruler" />

            <div className="film-sheet cf-ledger">
              <header className="cf-ledger-head">
                <div className="cf-ledger-title">
                  <span className="cf-mono">Pair ledger · ten factors</span>
                  <span className="cf-ledger-sub">
                    same weights · missing answers excluded
                  </span>
                </div>
                <div className="cf-pairs">
                  <div
                    className="cf-pair is-risk"
                    style={vars({
                      "--press": `var(--press-r12, 0)`,
                    })}
                  >
                    <span className="cf-pair-room">R-12 · 2-bed</span>
                    <span className="cf-pair-id">
                      {data.risk.students[0].id} × {data.risk.students[1].id}
                    </span>
                    <strong>{score3(data.risk.pair.score)}</strong>
                    <span className="cf-pair-note">Poor · below 0.55</span>
                  </div>
                  <div
                    className="cf-pair"
                    style={vars({ "--press": `var(--press-r15, 0)` })}
                  >
                    <span className="cf-pair-room">R-15 · 3-bed</span>
                    <span className="cf-pair-id">
                      {data.healthy.students[0].id} ×{" "}
                      {data.healthy.students[1].id}
                    </span>
                    <strong>{score3(data.healthy.pair.score)}</strong>
                    <span className="cf-pair-note">Good</span>
                  </div>
                </div>
              </header>

              <div className="cf-weight-ribbon">
                <div className="cf-weight-label">
                  <span className="cf-mono">R-12 effective weights</span>
                  <span className="cf-weight-blank">sleep schedule blank</span>
                </div>
                <span className="cf-weight-track">
                  {data.risk.pair.factors.map((factor) => (
                    <span
                      className={factor.missing ? "is-missing" : ""}
                      key={factor.key}
                      style={vars({
                        "--w": `${factor.effectiveWeight * 100}%`,
                      })}
                    />
                  ))}
                </span>
              </div>

              <div className="cf-factor-head">
                <span>Factor</span>
                <span>Wt</span>
                <span>R-12</span>
                <span>R-15</span>
              </div>
              <div className="cf-factor-rows">
                {data.risk.pair.factors.map((factor) => (
                  <FactorRow
                    factor={factor}
                    other={healthyFactors.get(factor.key)}
                    key={factor.key}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="cf-vignette" />
          <div className="mm-film-grain" />

          <div className="cf-caption" aria-live="polite">
            <div className="cf-caption-body" key={captionIndex}>
              <span className="cf-caption-kicker">{caption.kicker}</span>
              <p className="cf-caption-line">{caption.line}</p>
              <p className="cf-caption-sub">{caption.sub}</p>
            </div>
          </div>

          <div
            className="cf-scrub"
            ref={scrubRef}
            role="slider"
            tabIndex={0}
            aria-label="Film position"
            aria-valuemin={0}
            aria-valuemax={FILM_DURATION}
            aria-valuenow={0}
            aria-valuetext="00:00.0 of 00:10"
            onClick={onScrub}
            onKeyDown={onScrubKeyDown}
          >
            <span className="cf-scrub-track">
              <span className="cf-scrub-fill" />
            </span>
            <span className="cf-scrub-knot" />
          </div>
        </div>

        <div className="mm-film-controls cf-controls">
          <div className="mm-film-transport">
            <button
              type="button"
              className="mm-film-control"
              onClick={toggle}
              aria-label={toggleLabel}
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
              aria-label="Replay film"
            >
              <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" />
              Replay
            </button>
            <span className="cf-timecode">
              <span ref={timecodeRef}>00:00.0</span> / 00:10
            </span>
            {ended ? <span className="cf-ended">End of take</span> : null}
          </div>

          <div
            className="mm-film-chapters cf-chapters"
            role="group"
            aria-label="Film chapters"
          >
            {CAPTIONS.map((item, index) => {
              const active = captionIndex === index;
              return (
                <button
                  type="button"
                  className={`mm-film-chapter ${active ? "is-active" : ""}`}
                  key={item.at}
                  onClick={() => seek(item.at)}
                  aria-current={active ? "step" : undefined}
                >
                  <span className="mm-sr">Chapter {index + 1}: </span>
                  <span className="mm-film-chapter-number">
                    {formatMarker(item.at)}
                  </span>
                  <span className="mm-film-chapter-label">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <figcaption className="mm-film-note cf-note">
        Illustrative sample data. {formatCount(data.boundary.students)} students,{" "}
        {data.boundary.rooms} rooms; {formatCount(data.boundary.possible)}{" "}
        possible pairs, {formatCount(data.boundary.rejected)} never compared,{" "}
        {formatCount(data.boundary.scored)} scored. Segment mean{" "}
        {score3(data.risk.segment.mean)}.{" "}
        <span className="cf-note-pair">
          R-12 · S-009 × S-021: {score3(data.risk.pair.score)}.
        </span>{" "}
        <span className="cf-note-pair">
          R-15 · S-035 × S-047: {score3(data.healthy.pair.score)}.
        </span>{" "}
        Factor fits, never raw answers.{" "}
        <Link className="cf-compare-link" to="/">
          Compare the classic film
        </Link>
      </figcaption>
    </figure>
  );
}
