export type SaveState = "idle" | "saving" | "saved" | "error";

interface Options<T> {
  /** Persists a value. Should reject on failure. */
  save: (value: T) => Promise<void>;
  /** Quiet period before a scheduled save fires. */
  delay?: number;
  onStateChange?: (state: SaveState) => void;
  onSaved?: (at: Date) => void;
}

/**
 * Debounced, single-flight save queue for the editor's autosave.
 *
 * The subtle part is what happens when an edit lands *while a save is in flight*:
 * the completed save must not mark the document clean (those newer edits would be
 * silently dropped), and it must chain another save rather than waiting for the
 * next keystroke to notice. Kept framework-free so that behaviour is testable —
 * see lib/save-queue.test.ts.
 */
export function createSaveQueue<T>({ save, delay = 800, onStateChange, onSaved }: Options<T>) {
  let pending: T | null = null;
  let inFlight = false;
  let lastAttemptFailed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function setState(state: SaveState) {
    onStateChange?.(state);
  }

  async function flush(): Promise<void> {
    if (inFlight) return; // a save is running; its completion chains the next one
    const value = pending;
    if (value === null) return;

    inFlight = true;
    setState("saving");
    try {
      await save(value);
      lastAttemptFailed = false;
      onSaved?.(new Date());
      // Only clean if nothing newer arrived mid-flight.
      if (pending === value) {
        pending = null;
        setState("saved");
      }
    } catch {
      lastAttemptFailed = true;
      setState("error"); // keep `pending` so retry() has something to send
    } finally {
      inFlight = false;
    }

    // Chain only after a success — retrying a failure here would spin forever.
    if (!lastAttemptFailed && pending !== null) await flush();
  }

  return {
    /** Queue a value to be saved after the quiet period. */
    schedule(value: T) {
      pending = value;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), delay);
    },
    /** Save immediately, skipping the debounce (used by Retry). */
    flushNow() {
      if (timer) clearTimeout(timer);
      return flush();
    },
    /** Whatever hasn't been persisted yet, or null when everything is saved. */
    get pendingValue() {
      return pending;
    },
    /** Drop any scheduled save without cancelling one already in flight. */
    cancelScheduled() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
