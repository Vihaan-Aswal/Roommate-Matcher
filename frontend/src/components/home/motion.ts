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

/** The header rule follows the page directly; no eased loop. */
export function useScrollThread(): {
  progressRef: React.RefObject<HTMLSpanElement>;
} {
  const progressRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${progress})`;
      }
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return { progressRef };
}
