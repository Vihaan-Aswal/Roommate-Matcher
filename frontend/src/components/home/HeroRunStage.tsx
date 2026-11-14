import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { RotateCcw } from "lucide-react";

import { formatScore, type Run } from "./simulate";
import { usePrefersReducedMotion } from "./motion";

const STAGE_AT = [0, 500, 1150, 3600, 4500, 5400];
const MARKS = 96;

type Stage = 0 | 1 | 2 | 3 | 4 | 5;

interface Slot {
  x: number;
  y: number;
  lane: number;
}

interface RoomBox {
  x: number;
  y: number;
  width: number;
  height: number;
  roomId: string;
  risk: boolean;
  members: number[];
}

interface LaneBox {
  x: number;
  y: number;
  width: number;
  height: number;
  labelWidth: number;
  labelHeight: number;
}

interface Layout {
  slots: Slot[];
  rooms: RoomBox[];
  lanes: LaneBox[];
  width: number;
  height: number;
  markSize: number;
  roomArea: { top: number; height: number };
}

function formatCount(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function scatterPosition(
  index: number,
  left: number,
  top: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const seed = Math.sin((index + 1) * 12.9898) * 43758.5453;
  const nx = seed - Math.floor(seed);
  const seed2 = Math.sin((index + 1) * 78.233) * 12345.6789;
  const ny = seed2 - Math.floor(seed2);
  return {
    x: left + 4 + nx * Math.max(1, width - 22),
    y: top + 6 + ny * Math.max(1, height - 20),
  };
}

function buildLayout(run: Run, width: number, height: number): Layout {
  const narrow = width < 560;
  const pad = narrow ? 12 : 18;
  const chromeHeight = 38;
  const docsHeight = narrow ? 150 : 118;
  const ledgerHeight = narrow ? 26 : 28;
  const roomAreaTop = chromeHeight + 15;
  const roomAreaHeight = Math.max(
    140,
    height - roomAreaTop - docsHeight - ledgerHeight - 10,
  );
  const laneGap = narrow ? 5 : 7;
  const laneHeight = (roomAreaHeight - laneGap * 3) / 4;
  const labelWidth = narrow ? 0 : 124;
  const labelHeight = narrow ? 25 : 0;
  const markSize = narrow ? 8 : 11;
  const markGap = narrow ? 2 : 3;

  const lanes: LaneBox[] = run.segments.map((_, index) => ({
    x: pad,
    y: roomAreaTop + index * (laneHeight + laneGap),
    width: width - pad * 2,
    height: laneHeight,
    labelWidth,
    labelHeight,
  }));

  const slots: Slot[] = new Array(MARKS);
  const rooms: RoomBox[] = [];
  const cols = narrow ? 4 : 5;

  for (const segment of run.segments) {
    const lane = lanes[segment.index];
    const gridLeft = lane.x + lane.labelWidth + (narrow ? 0 : 10);
    const gridTop = lane.y + lane.labelHeight + (narrow ? 3 : 3);
    const gridWidth = lane.width - lane.labelWidth - (narrow ? 0 : 10) - 2;
    const rows = Math.max(1, Math.ceil(segment.rooms.length / cols));
    const cellWidth = gridWidth / cols;
    const cellHeight = (lane.height - lane.labelHeight - 3) / rows;

    segment.rooms.forEach((room, roomIndex) => {
      const col = roomIndex % cols;
      const row = Math.floor(roomIndex / cols);
      const rowCount = Math.min(cols, segment.rooms.length - row * cols);
      const rowOffset = ((cols - rowCount) * cellWidth) / 2;
      const boxWidth = cellWidth - (narrow ? 4 : 6);
      const boxHeight = Math.min(narrow ? 27 : 38, cellHeight - 2);
      const x =
        gridLeft + rowOffset + col * cellWidth + (cellWidth - boxWidth) / 2;
      const y = gridTop + row * cellHeight + (cellHeight - boxHeight) / 2;

      rooms.push({
        x,
        y,
        width: boxWidth,
        height: boxHeight,
        roomId: room.id,
        risk: room.atRisk.length > 0,
        members: room.members,
      });

      const membersWidth =
        room.members.length * markSize + (room.members.length - 1) * markGap;
      const startX = x + (boxWidth - membersWidth) / 2;
      const markTop = narrow
        ? Math.min(16, boxHeight - markSize - 1)
        : Math.max(16, (boxHeight - markSize) / 2 + 5);
      room.members.forEach((member, memberIndex) => {
        slots[member] = {
          x: startX + memberIndex * (markSize + markGap),
          y: y + markTop,
          lane: segment.index,
        };
      });
    });
  }

  return {
    slots,
    rooms,
    lanes,
    width,
    height,
    markSize,
    roomArea: { top: roomAreaTop, height: roomAreaHeight },
  };
}

function labelForStudent(run: Run, index: number): string {
  return run.students[index].label;
}

interface HeroRunStageProps {
  run: Run;
  playKey: number;
  onReplay: () => void;
}

export function HeroRunStage({ run, playKey, onReplay }: HeroRunStageProps): JSX.Element {
  const reduced = usePrefersReducedMotion();
  const [stage, setStage] = useState<Stage>(reduced ? 5 : 0);
  const [lite, setLite] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 600, height: 560 });

  useEffect(() => {
    if (!lite) return;
    const root = hostRef.current?.closest(".mm-home");
    root?.classList.add("mm-motion-lite");
    window.dispatchEvent(new Event("mm-motion-lite"));
    return () => root?.classList.remove("mm-motion-lite");
  }, [lite]);

  useEffect(() => {
    if (reduced || lite) {
      setStage(5);
      return;
    }

    setStage(0);
    let currentStage: Stage = 0;
    let timer: number | undefined;
    let probeFrame = 0;
    let cancelled = false;

    const stopProbe = () => {
      if (probeFrame !== 0) window.cancelAnimationFrame(probeFrame);
      probeFrame = 0;
    };

    const startProbe = () => {
      let firstFrame = 0;
      let frames = 0;
      const probe = (time: number) => {
        if (cancelled) return;
        if (firstFrame === 0) firstFrame = time;
        frames += 1;
        if (frames >= 10) {
          const average = (time - firstFrame) / (frames - 1);
          // A deliberate fallback for low-end devices: if the boundary beat
          // cannot hold a useful frame rate, resolve to the finished run.
          if (average > 28) {
            cancelled = true;
            setLite(true);
            return;
          }
          return;
        }
        probeFrame = window.requestAnimationFrame(probe);
      };
      probeFrame = window.requestAnimationFrame(probe);
    };

    const schedule = (from: Stage) => {
      if (from >= 5) return;
      const delay = STAGE_AT[from + 1] - STAGE_AT[from];
      timer = window.setTimeout(() => {
        if (cancelled) return;
        const next = (from + 1) as Stage;
        currentStage = next;
        setStage(next);
        if (next === 2) startProbe();
        schedule(next);
      }, delay);
    };

    if (document.visibilityState !== "hidden") schedule(0);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (timer !== undefined) window.clearTimeout(timer);
        timer = undefined;
        stopProbe();
        return;
      }
      if (!cancelled && timer === undefined && currentStage < 5) {
        if (currentStage === 2 && probeFrame === 0) startProbe();
        timer = window.setTimeout(() => {
          if (cancelled) return;
          const next = (currentStage + 1) as Stage;
          currentStage = next;
          setStage(next);
          if (next === 2) startProbe();
          schedule(next);
        }, 350);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      stopProbe();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [playKey, reduced, lite]);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;

    const measure = () => {
      const width = node.clientWidth;
      const height = node.clientHeight;
      if (width > 0 && height > 0) setSize({ width, height });
    };
    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [hostRef]);

  const layout = useMemo(
    () => buildLayout(run, size.width, size.height),
    [run, size.height, size.width],
  );

  const scored = stage >= 3;
  const paired = stage >= 3;
  const documented = stage >= 4;
  const lanesCut = stage >= 2;
  const uniqueRiskRooms = [...new Set(run.atRiskStudents.map((student) => student.roomId))].join(", ");

  const status =
    stage === 0
      ? "Responses arriving."
      : stage === 1
        ? `${run.students.length} responses validated against the roster.`
        : stage === 2
          ? `Four hard boundaries cut the cohort into ${run.segments.length} segments.`
          : stage === 3
            ? `${formatCount(run.pairsScored)} pairs scored. ${run.rooms.length} rooms proposed.`
            : stage === 4
              ? "Assignments, reasons, fairness and audit written."
              : `Run complete. ${run.atRiskStudents.length} students at risk in ${uniqueRiskRooms}, flagged for review. A person signs before keys are issued.`;

  const docValues = [
    { title: "Assignments", value: `${run.rooms.length} rooms`, note: `${run.rooms[0].id} to ${run.rooms[run.rooms.length - 1].id}` },
    { title: "Reasons", value: `${run.students.length} notes`, note: "privacy-safe" },
    { title: "Fairness", value: `${run.atRiskStudents.length} at risk`, note: `floor ${formatScore(run.floor)}` },
    { title: "Audit trail", value: `${run.audit.swapPasses} swap passes`, note: `${run.audit.newPoorFromSwaps} new Poor` },
  ];

  return (
    <figure className="mm-stage-figure" id="sample-run">
      <div
        ref={hostRef}
        className={[
          "mm-stage",
          stage === 0 ? "is-arrival" : "",
          lite ? "is-lite" : "",
          scored ? "is-scored" : "",
          paired ? "is-paired" : "",
          documented ? "is-documented" : "",
          lanesCut ? "is-cut" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden="true"
      >
        <div className="mm-stage-chrome">
          <span className="mm-stage-seal">Sample run</span>
          <span className="mm-stage-meta">sample cohort</span>
          <span className="mm-stage-meta mm-stage-meta-right">
            {run.students.length} students · {run.rooms.length} rooms
          </span>
        </div>

        <div className="mm-stage-field">
          <div className="mm-lanes" key={`lanes-${playKey}`}>
            {layout.lanes.map((lane, index) => {
              const segment = run.segments[index];
              return (
                <div
                  key={`lane-${segment.key}`}
                  className="mm-shelf"
                  style={{
                    left: lane.x,
                    top: lane.y,
                    width: lane.width,
                    height: lane.height,
                    opacity: lanesCut ? 1 : 0.45,
                    transitionDelay: `${index * 60}ms`,
                  }}
                >
                  <span
                    className="mm-shelf-cut"
                    style={{ transitionDelay: `${index * 120}ms` }}
                    aria-hidden="true"
                  />
                  <span className="mm-shelf-label">
                    <span>
                      {segment.gender} ·{" "}
                      {segment.year === "1st year" ? "1st" : "2nd–4th"}
                    </span>
                    <span>
                      {segment.ac} · {segment.size}-bed
                    </span>
                  </span>
                </div>
              );
            })}

            {layout.rooms.map((room) => (
              <div
                key={`room-${room.roomId}`}
                className={`mm-room-box ${room.risk ? "is-risk" : ""} ${paired ? "" : "is-ghost"}`}
                style={{
                  left: room.x,
                  top: room.y,
                  width: room.width,
                  height: room.height,
                  opacity: paired ? 1 : lanesCut ? 0.55 : 0.32,
                  transform: paired ? "scale(1)" : "scale(0.98)",
                }}
              >
                <span className="mm-room-id">{room.roomId}</span>
              </div>
            ))}

            {layout.slots.map((slot, index) => {
              const student = run.students[index];
              const position = lanesCut
                ? { x: slot.x, y: slot.y }
                : scatterPosition(
                    index,
                    layout.roomArea.top - 10,
                    layout.roomArea.top,
                    layout.width,
                    Math.max(120, layout.roomArea.height - 8),
                  );
              return (
                <span
                  key={`mark-${student.id}-${playKey}`}
                  className="mm-mark"
                  data-label={labelForStudent(run, index)}
                  style={{
                    width: layout.markSize,
                    height: layout.markSize,
                    transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
                    transitionDelay: lanesCut
                      ? `${student.segmentIndex * 600 + (index % 24) * 3}ms`
                      : "0ms",
                  }}
                />
              );
            })}

            {paired ? (
              <svg
                className="mm-edges"
                width={layout.width}
                height={layout.height}
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                focusable="false"
              >
                <path
                  className="mm-edge"
                  d={run.rooms
                    .flatMap((room) => room.edges)
                    .map((edge) => {
                      const a = layout.slots[edge.a];
                      const b = layout.slots[edge.b];
                      if (!a || !b) return "";
                      return `M${a.x + layout.markSize / 2} ${a.y + layout.markSize / 2} L${b.x + layout.markSize / 2} ${b.y + layout.markSize / 2}`;
                    })
                    .filter(Boolean)
                    .join(" ")}
                />
              </svg>
            ) : null}
          </div>

          <div
            className="mm-stage-ledger"
            style={{ opacity: documented ? 1 : 0, transform: documented ? "none" : "translateY(6px)" }}
          >
            <span>{formatCount(run.pairsScored)} pairs scored</span>
            <span>{run.rooms.length} rooms</span>
            <span>{run.atRiskStudents.length} at risk</span>
          </div>

          <div
            className="mm-stage-docs"
            style={{
              opacity: documented ? 1 : 0,
              transition: "opacity var(--m-dur-scene) ease",
            }}
          >
            <div className="mm-folder-back" aria-hidden="true">
              <span className="mm-doc-tab" />
            </div>
            <div className="mm-doc-row">
              {docValues.map((doc, index) => (
                <div
                  key={doc.title}
                  className="mm-doc"
                  style={{
                    opacity: documented ? 1 : 0,
                    transform: documented
                      ? `translate3d(0, 0, 0) rotate(${(index - 1.5) * 1.4}deg)`
                      : "translate3d(0, 24px, 0) rotate(0deg)",
                    transitionDelay: `${220 + index * 90}ms`,
                  }}
                >
                  <span className="mm-doc-title">{doc.title}</span>
                  <span className="mm-doc-value">{doc.value}</span>
                  <span className="mm-doc-note">{doc.note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mm-stage-foot">
        <p className="mm-stage-status" aria-live="polite" aria-atomic="true">
          <span className={`mm-stage-dot ${stage === 5 ? "is-rest" : ""}`} aria-hidden="true" />
          {status}
        </p>
        <button type="button" className="mm-replay" onClick={onReplay}>
          <RotateCcw aria-hidden="true" size={13} strokeWidth={1.7} />
          Replay the sample run
        </button>
      </div>
      <figcaption className="mm-stage-caption">
        Illustrative sample data. The same inputs produce the same rooms on every load from this page:
        {` ${run.students.length} students, ${run.rooms.length} rooms, ${formatCount(run.pairsScored)} pair scores.`}
      </figcaption>
    </figure>
  );
}












