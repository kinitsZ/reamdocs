import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSaveQueue } from "./save-queue";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Lets a test hold a save open and resolve/reject it on demand. */
function deferredSave() {
  const calls: string[] = [];
  let settle: { resolve: () => void; reject: () => void } | null = null;
  const save = vi.fn(async (value: string) => {
    calls.push(value);
    await new Promise<void>((resolve, reject) => {
      settle = { resolve, reject };
    });
  });
  return {
    save,
    calls,
    resolveCurrent: () => settle!.resolve(),
    rejectCurrent: () => settle!.reject(),
  };
}

describe("createSaveQueue", () => {
  it("saves after the quiet period, not immediately", async () => {
    const save = vi.fn(async () => {});
    const queue = createSaveQueue({ save, delay: 800 });

    queue.schedule("v1");
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledExactlyOnceWith("v1");
  });

  it("coalesces rapid edits into a single save of the newest value", async () => {
    const save = vi.fn(async () => {});
    const queue = createSaveQueue({ save, delay: 800 });

    queue.schedule("v1");
    await vi.advanceTimersByTimeAsync(300);
    queue.schedule("v2");
    await vi.advanceTimersByTimeAsync(300);
    queue.schedule("v3");
    await vi.advanceTimersByTimeAsync(800);

    expect(save).toHaveBeenCalledExactlyOnceWith("v3");
  });

  // Regression test: an edit made while a save was in flight used to be wiped by
  // the in-flight save's completion, and was then never persisted.
  it("does not lose an edit made while a save is in flight", async () => {
    const { save, calls, resolveCurrent } = deferredSave();
    const queue = createSaveQueue({ save, delay: 800 });

    queue.schedule("v1");
    await vi.advanceTimersByTimeAsync(800); // v1 save starts and hangs
    expect(calls).toEqual(["v1"]);

    queue.schedule("v2"); // typed while v1 is still in flight
    resolveCurrent(); // v1 completes
    await vi.advanceTimersByTimeAsync(0);

    // v1 completing must not have discarded v2 — it should now be saving it.
    expect(calls).toEqual(["v1", "v2"]);
    expect(queue.pendingValue).toBe("v2"); // in flight, not yet confirmed

    resolveCurrent(); // v2 completes
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.pendingValue).toBeNull();
  });

  it("never runs two saves concurrently", async () => {
    const { save, calls, resolveCurrent } = deferredSave();
    const queue = createSaveQueue({ save, delay: 800 });

    queue.schedule("v1");
    await vi.advanceTimersByTimeAsync(800);
    queue.schedule("v2");
    await vi.advanceTimersByTimeAsync(800); // would start a second save if unguarded

    expect(calls).toEqual(["v1"]); // still only the first, which hasn't settled

    resolveCurrent();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(["v1", "v2"]);
  });

  it("keeps the unsaved value and reports an error when saving fails", async () => {
    const states: string[] = [];
    const { save, rejectCurrent } = deferredSave();
    const queue = createSaveQueue({ save, delay: 800, onStateChange: (s) => states.push(s) });

    queue.schedule("v1");
    await vi.advanceTimersByTimeAsync(800);
    rejectCurrent();
    await vi.advanceTimersByTimeAsync(0);

    expect(states).toEqual(["saving", "error"]);
    expect(queue.pendingValue).toBe("v1"); // retained so Retry can resend it
  });

  it("does not spin retrying a failing save", async () => {
    const save = vi.fn(async () => {
      throw new Error("offline");
    });
    const queue = createSaveQueue({ save, delay: 800 });

    queue.schedule("v1");
    await vi.advanceTimersByTimeAsync(5000);

    expect(save).toHaveBeenCalledTimes(1);
  });

  it("persists the retained value when retried after a failure", async () => {
    let shouldFail = true;
    const save = vi.fn(async () => {
      if (shouldFail) throw new Error("offline");
    });
    const queue = createSaveQueue({ save, delay: 800 });

    queue.schedule("v1");
    await vi.advanceTimersByTimeAsync(800);
    expect(queue.pendingValue).toBe("v1");

    shouldFail = false;
    await queue.flushNow();

    expect(save).toHaveBeenCalledTimes(2);
    expect(queue.pendingValue).toBeNull();
  });
});
