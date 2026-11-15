import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reducer, toast, useToast } from "../../hooks/use-toast";

// Mirrors TOAST_REMOVE_DELAY: dismissal only schedules the removal.
const REMOVE_DELAY = 1_000_000;

const first = { id: "reducer-a", title: "First", open: true };
const second = { id: "reducer-b", title: "Second", open: true };

beforeEach(() => {
  vi.useFakeTimers();
  // Toast state is module-level: drain whatever a previous test left behind.
  const previous = renderHook(() => useToast());
  act(() => {
    previous.result.current.dismiss();
    vi.advanceTimersByTime(REMOVE_DELAY);
  });
  previous.unmount();
});

afterEach(() => {
  // Fire queued removals while the hooks are still mounted, so the module-level
  // state and its timeout map are empty for the next test.
  act(() => {
    vi.runOnlyPendingTimers();
  });
  vi.useRealTimers();
});

describe("toast reducer", () => {
  it("prepends a new toast and keeps only the newest one", () => {
    const one = reducer({ toasts: [] }, { type: "ADD_TOAST", toast: first });
    expect(one.toasts).toHaveLength(1);
    expect(one.toasts[0].id).toBe("reducer-a");

    const two = reducer(one, { type: "ADD_TOAST", toast: second });
    expect(two.toasts.map((item) => item.id)).toEqual(["reducer-b"]);
  });

  it("updates the matching toast and leaves the others alone", () => {
    const state = { toasts: [first, second] };

    const updated = reducer(state, {
      type: "UPDATE_TOAST",
      toast: { id: "reducer-a", title: "Renamed" },
    });

    expect(updated.toasts[0]).toMatchObject({ id: "reducer-a", title: "Renamed" });
    expect(updated.toasts[1]).toEqual(second);
  });

  it("ignores an update for an unknown toast", () => {
    const updated = reducer(
      { toasts: [first] },
      { type: "UPDATE_TOAST", toast: { id: "missing", title: "Nope" } },
    );

    expect(updated.toasts).toEqual([first]);
  });

  it("closes only the named toast when an id is given", () => {
    const updated = reducer(
      { toasts: [first, second] },
      { type: "DISMISS_TOAST", toastId: "reducer-b" },
    );

    expect(updated.toasts[0].open).toBe(true);
    expect(updated.toasts[1].open).toBe(false);
  });

  it("closes every toast when no id is given", () => {
    const updated = reducer({ toasts: [first, second] }, { type: "DISMISS_TOAST" });

    expect(updated.toasts.map((item) => item.open)).toEqual([false, false]);
  });

  it("removes one toast by id or empties the queue", () => {
    const one = reducer({ toasts: [first, second] }, { type: "REMOVE_TOAST", toastId: "reducer-a" });
    expect(one.toasts.map((item) => item.id)).toEqual(["reducer-b"]);

    const all = reducer({ toasts: [first, second] }, { type: "REMOVE_TOAST" });
    expect(all.toasts).toEqual([]);
  });
});

describe("useToast with the toast() trigger", () => {
  it("adds a toast, updates it, then removes it after the delay", () => {
    const hook = renderHook(() => useToast());
    let created: ReturnType<typeof toast> | undefined;

    act(() => {
      created = toast({ title: "Saved", description: "Workspace created" });
    });

    expect(hook.result.current.toasts).toHaveLength(1);
    expect(hook.result.current.toasts[0]).toMatchObject({
      id: created?.id,
      title: "Saved",
      description: "Workspace created",
      open: true,
    });

    act(() => {
      created?.update({ ...hook.result.current.toasts[0], title: "Updated" });
    });
    expect(hook.result.current.toasts[0].title).toBe("Updated");

    act(() => {
      created?.dismiss();
    });
    expect(hook.result.current.toasts[0].open).toBe(false);
    // Still present until the removal delay elapses.
    act(() => {
      vi.advanceTimersByTime(REMOVE_DELAY - 1);
    });
    expect(hook.result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(hook.result.current.toasts).toEqual([]);
  });

  it("keeps one toast at a time", () => {
    const hook = renderHook(() => useToast());

    act(() => {
      toast({ title: "First" });
    });
    act(() => {
      toast({ title: "Second" });
    });

    expect(hook.result.current.toasts).toHaveLength(1);
    expect(hook.result.current.toasts[0].title).toBe("Second");
  });

  it("dismisses through the returned onOpenChange callback", () => {
    const hook = renderHook(() => useToast());

    act(() => {
      toast({ title: "Closable" });
    });
    act(() => {
      hook.result.current.toasts[0].onOpenChange?.(false);
    });

    expect(hook.result.current.toasts[0].open).toBe(false);
  });

  it("dismisses everything through the hook and queues each removal once", () => {
    const hook = renderHook(() => useToast());

    act(() => {
      toast({ title: "One" });
    });
    act(() => {
      toast({ title: "Two" });
    });

    act(() => {
      hook.result.current.dismiss();
      // A second dismiss must not throw or double-queue the same toast.
      hook.result.current.dismiss();
    });

    expect(hook.result.current.toasts.every((item) => item.open === false)).toBe(true);

    act(() => {
      vi.advanceTimersByTime(REMOVE_DELAY);
    });
    expect(hook.result.current.toasts).toEqual([]);
  });
});
