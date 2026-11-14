import { useEffect, useRef, useState } from "react";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  return reduced;
}

export function useInView<T extends HTMLElement>(): {
  ref: React.RefObject<T>;
  inView: boolean;
} {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(prefersReducedMotion);

  useEffect(() => {
    if (inView) return;
    const node = ref.current;
    if (!node) return;

    const onLite = () => setInView(true);
    window.addEventListener("mm-motion-lite", onLite);

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return () => window.removeEventListener("mm-motion-lite", onLite);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.16, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.removeEventListener("mm-motion-lite", onLite);
    };
  }, [inView]);

  return { ref, inView };
}

/**
 * The margin thread follows scroll with weight. The header rule is direct;
 * the wax tick eases toward it. The loop is finite and pauses when hidden.
 */
export function useScrollThread(): {
  progressRef: React.RefObject<HTMLSpanElement>;
  railRef: React.RefObject<HTMLDivElement>;
} {
  const progressRef = useRef<HTMLSpanElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    let target = 0;
    let current = 0;
    let lastTime = 0;
    const reduced = prefersReducedMotion();

    const readTarget = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };

    const write = () => {
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${target})`;
      }
      railRef.current?.style.setProperty("--thread", String(current));
    };

    const tick = (time: number) => {
      const delta = lastTime === 0 ? 16 : Math.min(64, time - lastTime);
      lastTime = time;
      current += (target - current) * (1 - Math.exp(-delta / 90));

      if (Math.abs(target - current) < 0.0005) {
        current = target;
        write();
        frame = 0;
        return;
      }

      write();
      frame = window.requestAnimationFrame(tick);
    };

    const start = () => {
      if (reduced || document.visibilityState === "hidden") {
        current = target;
        write();
        return;
      }
      if (frame === 0) {
        lastTime = 0;
        frame = window.requestAnimationFrame(tick);
      }
    };

    const update = () => {
      readTarget();
      if (reduced) {
        current = target;
        write();
        return;
      }
      start();
    };

    const onScroll = () => {
      readTarget();
      // The header rule stays crisp; only the wax tick carries weight.
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${target})`;
      }
      start();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        window.cancelAnimationFrame(frame);
        frame = 0;
      } else {
        update();
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return { progressRef, railRef };
}
