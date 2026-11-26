import { Suspense, lazy, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";

import { CohortPipeline } from "../components/home/CohortPipeline";
import { StationPath } from "../components/home/StationPath";
import { BoundarySection } from "../components/home/BoundarySection";
import { CompatibilitySection } from "../components/home/CompatibilitySection";
import { ArtifactSection } from "../components/home/ArtifactSection";
import { FairnessSection } from "../components/home/FairnessSection";
import { SignOffSection } from "../components/home/SignOffSection";
import { LimitsSection } from "../components/home/LimitsSection";
import { prefersReducedMotion, useScrollThread } from "../components/home/motion";
import { run } from "../components/home/simulate";
import "../components/home/home.css";

const SampleRunFilm = lazy(() =>
  import("../components/home/SampleRunFilm").then((module) => ({
    default: module.SampleRunFilm,
  })),
);

function HeaderStation(): JSX.Element {
  const [active, setActive] = useState({ station: "01–02", label: "Inputs & Form" });

  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-home-station]"),
    );
    if (sections.length === 0) return;

    let frame = 0;
    let cancelled = false;
    const read = () => {
      if (cancelled) return;
      frame = 0;
      const marker = window.innerHeight * 0.28;
      let current = sections[0];
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= marker) current = section;
      }
      const station = current.dataset.homeStation ?? "";
      const label = current.dataset.homeLabel ?? "";
      setActive((previous) =>
        previous.station === station && previous.label === label
          ? previous
          : { station, label },
      );
    };
    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(read);
    };

    read();
    document.fonts?.ready.then(read).catch(() => undefined);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <span className="mm-header-station" aria-hidden="true">
      <span>{active.station}</span>
      {active.label}
    </span>
  );
}

export function HomePage(): JSX.Element {
  const [playKey, setPlayKey] = useState(0);
  const { progressRef } = useScrollThread();
  const location = useLocation();
  const classicPreview = new URLSearchParams(location.search).get("classic") === "1";

  useEffect(() => {
    const previous = document.title;
    document.title = "Roommate Matcher — a room-allocation desk for hostel offices";
    return () => {
      document.title = previous;
    };
  }, []);

  const replay = () => setPlayKey((key) => key + 1);

  const playSample = () => {
    replay();
    const target = document.getElementById("sample-run");
    target?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <div className="mm-home" id="top">
      <a className="mm-skip" href="#main">
        Skip to the argument
      </a>

      <header className="mm-header">
        <div className="mm-wrap mm-header-inner">
          <a className="mm-wordmark" href="#top" aria-label="Roommate Matcher, back to top">
            Roommate Matcher
          </a>
          <HeaderStation />
          <Link className="mm-header-cta" to="/login">
            Open the desk
            <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        </div>
        <div className="mm-progress" aria-hidden="true">
          <span className="mm-progress-fill" ref={progressRef} />
        </div>
      </header>

      <main id="main">
        <section
          className="mm-hero"
          aria-labelledby="hero-heading"
          data-home-station="01–02"
          data-home-label="Inputs & Form"
        >
          <div className="mm-wrap mm-hero-grid">
            <div className="mm-hero-copy">
              <p className="mm-eyebrow">Roommate Matcher · Room allocation desk</p>
              <h1 className="mm-display" id="hero-heading">
                A room list{" "}
                <br />
                you can sign.
              </h1>
              <p className="mm-lede">
                A room-allocation desk for hostel wardens, deans of student affairs and housing
                officers.
              </p>
              <p className="mm-body mm-hero-body">
                Students answer twelve questions once through a private link. The desk cuts the
                cohort with four hard boundaries, scores every eligible pair on ten weighted
                factors, and proposes rooms with a reason for each student. A person signs before
                keys are issued.
              </p>

              <div className="mm-actions">
                <Link className="mm-btn mm-btn-wax" to="/login">
                  Open the desk
                  <ArrowRight size={17} strokeWidth={1.8} aria-hidden="true" />
                </Link>
                <button type="button" className="mm-btn mm-btn-ghost" onClick={playSample}>
                  <Play size={14} strokeWidth={1.8} aria-hidden="true" />
                  Play the sample run
                </button>
              </div>

              <p className="mm-hero-note">
                Illustrative sample data. No account is needed to watch the run.
              </p>
            </div>

            {classicPreview ? (
              <Suspense
                fallback={
                  <div className="mm-classic-loading" id="sample-run">
                    Loading the classic film…
                  </div>
                }
              >
                <SampleRunFilm run={run} playKey={playKey} onReplay={replay} />
              </Suspense>
            ) : (
              <CohortPipeline run={run} playKey={playKey} />
            )}
          </div>
        </section>

        <StationPath run={run} />

        <BoundarySection run={run} />
        <CompatibilitySection run={run} />
        <FairnessSection run={run} />
        <ArtifactSection run={run} />
        <SignOffSection run={run} />
        <LimitsSection />

        <section
          className="mm-close"
          aria-labelledby="close-heading"
          data-home-station="—"
          data-home-label="The desk is ready"
        >
          <div className="mm-wrap mm-close-inner">
            <p className="mm-close-kicker">End of file · {run.audit.runId}</p>
            <h2 id="close-heading" className="mm-close-title">
              The desk is ready.
            </h2>
            <p className="mm-close-line">A run proposes. A person signs. Keys follow.</p>
            <Link className="mm-btn mm-btn-wax mm-btn-large" to="/login">
              Open the desk
              <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="mm-footer">
        <div className="mm-wrap mm-footer-inner">
          <div>
            <p className="mm-footer-word">Roommate Matcher</p>
            <p className="mm-footer-copy">A room-allocation desk for hostel offices.</p>
          </div>
          <div className="mm-footer-notes">
            <p>Sample figures on this page are illustrative.</p>
            <Link to="/login">Open the desk</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
