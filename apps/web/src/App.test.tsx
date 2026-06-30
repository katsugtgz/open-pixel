// @vitest-environment happy-dom
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  beforeAll,
} from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import App, {
  appReducer,
  initialState,
  buildQuestRunFromState,
  canClaimGuestBadge,
  makeVillageBridgeHandler,
  type AppState,
  type AppAction,
} from "./App";

// happy-dom v18 does not auto-provide localStorage; install a minimal Map-backed
// stub on the global so getGuestId()/App render behave the same as in the browser.
beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  if (typeof globalThis.localStorage === "undefined") {
    const store = new Map<string, string>();
    const stub: Storage = {
      get length() {
        return store.size;
      },
      clear() {
        store.clear();
      },
      getItem(key) {
        return store.has(key) ? (store.get(key) as string) : null;
      },
      key(index) {
        return Array.from(store.keys())[index] ?? null;
      },
      removeItem(key) {
        store.delete(key);
      },
      setItem(key, value) {
        store.set(key, String(value));
      },
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: stub,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, "localStorage", {
      value: stub,
      configurable: true,
      writable: true,
    });
  }
});

const baseInitialState: AppState = {
  guestId: "guest_test1234",
  displayName: "Pixel Runner",
  walletAddress: "",
  signature: "",
  status: "Ready. Play as guest; wallet proof is optional.",
};

describe("appReducer — villageProgress action (RED→GREEN FIX 1)", () => {
  it("applies villageProgress value to state", () => {
    const next = appReducer(baseInitialState, {
      type: "villageProgress",
      value: {
        points: 42,
        resources: { popberry: 1, whittlewood_log: 2, ochrux_matrix: 3 },
        completedAt: "2026-06-29T00:00:00Z",
      },
    } as AppAction);

    expect(next.villageProgress?.points).toBe(42);
    expect(next.villageProgress?.resources.popberry).toBe(1);
    expect(next.villageProgress?.resources.whittlewood_log).toBe(2);
    expect(next.villageProgress?.resources.ochrux_matrix).toBe(3);
    expect(next.villageProgress?.completedAt).toBe("2026-06-29T00:00:00Z");
  });

  it("preserves other fields when applying villageProgress", () => {
    const next = appReducer({ ...baseInitialState, displayName: "Frost" }, {
      type: "villageProgress",
      value: {
        points: 7,
        resources: { popberry: 1, whittlewood_log: 1, ochrux_matrix: 1 },
        completedAt: "2026-06-29T00:00:00Z",
      },
    } as AppAction);
    expect(next.displayName).toBe("Frost");
    expect(next.guestId).toBe(baseInitialState.guestId);
  });

  it("initialState has no villageProgress (gate starts closed)", () => {
    const s = initialState();
    expect(s.villageProgress).toBeUndefined();
  });
});

describe("buildQuestRunFromState — reflects state, not literals (RED→GREEN FIX 1)", () => {
  it("returns zeros when no villageProgress", () => {
    const q = buildQuestRunFromState(baseInitialState);
    expect(q.points).toBe(0);
    expect(q.resources.popberry).toBe(0);
    expect(q.resources.whittlewood_log).toBe(0);
    expect(q.resources.ochrux_matrix).toBe(0);
    expect(q.shards).toBe(0);
  });

  it("mirrors villageProgress values when set", () => {
    const state: AppState = {
      ...baseInitialState,
      villageProgress: {
        points: 99,
        resources: { popberry: 7, whittlewood_log: 7, ochrux_matrix: 7 },
        completedAt: "2026-06-29T01:00:00Z",
      },
    };
    const q = buildQuestRunFromState(state);
    expect(q.points).toBe(99);
    expect(q.resources.popberry).toBe(7);
    expect(q.resources.whittlewood_log).toBe(7);
    expect(q.resources.ochrux_matrix).toBe(7);
    expect(q.shards).toBe(3);
    expect(q.completedAt).toBe("2026-06-29T01:00:00Z");
  });

  it("shards stays 0 until villageProgress completedAt present", () => {
    const state: AppState = {
      ...baseInitialState,
      villageProgress: {
        points: 5,
        resources: { popberry: 1, whittlewood_log: 1, ochrux_matrix: 1 },
      },
    };
    expect(buildQuestRunFromState(state).shards).toBe(0);
  });
});

describe("canClaimGuestBadge — gate on village completion (RED→GREEN FIX 1)", () => {
  it("false on default initial state", () => {
    expect(canClaimGuestBadge(baseInitialState)).toBe(false);
  });

  it("false when villageProgress has no completedAt", () => {
    const state: AppState = {
      ...baseInitialState,
      villageProgress: {
        points: 50,
        resources: { popberry: 1, whittlewood_log: 1, ochrux_matrix: 1 },
      },
    };
    expect(canClaimGuestBadge(state)).toBe(false);
  });

  it("true once villageProgress.completedAt is set", () => {
    const state: AppState = {
      ...baseInitialState,
      villageProgress: {
        points: 50,
        resources: { popberry: 1, whittlewood_log: 1, ochrux_matrix: 1 },
        completedAt: "2026-06-29T00:00:00Z",
      },
    };
    expect(canClaimGuestBadge(state)).toBe(true);
  });
});

describe("makeVillageBridgeHandler — synthetic message event (RED→GREEN FIX 2)", () => {
  it("dispatches villageProgress when message event has type=village:complete", () => {
    const dispatch = vi.fn();
    const handler = makeVillageBridgeHandler(dispatch);
    const event = {
      data: {
        type: "village:complete",
        payload: {
          points: 12,
          resources: { popberry: 2, whittlewood_log: 3, ochrux_matrix: 4 },
          completedAt: "2026-06-29T02:00:00Z",
        },
      },
    } as MessageEvent;
    handler(event);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "villageProgress",
      value: {
        points: 12,
        resources: { popberry: 2, whittlewood_log: 3, ochrux_matrix: 4 },
        completedAt: "2026-06-29T02:00:00Z",
      },
    });
  });

  it("ignores messages with wrong type", () => {
    const dispatch = vi.fn();
    const handler = makeVillageBridgeHandler(dispatch);
    handler({ data: { type: "something-else" } } as MessageEvent);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("ignores messages with no data", () => {
    const dispatch = vi.fn();
    const handler = makeVillageBridgeHandler(dispatch);
    handler({} as MessageEvent);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("accepts a CustomEvent<detail.payload> shape for same-page embedding", () => {
    const dispatch = vi.fn();
    const handler = makeVillageBridgeHandler(dispatch);
    const event = {
      detail: {
        type: "village:complete",
        payload: {
          points: 1,
          resources: { popberry: 1, whittlewood_log: 1, ochrux_matrix: 1 },
          completedAt: "2026-06-29T03:00:00Z",
        },
      },
    } as CustomEvent;
    handler(event);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});

describe("village bridge handler origin security (RED→GREEN FIX 3)", () => {
  const payload = {
    points: 5,
    resources: { popberry: 1, whittlewood_log: 1, ochrux_matrix: 1 },
    completedAt: "2026-06-29T04:00:00Z",
  };

  it("rejects message from unexpected origin", () => {
    const dispatch = vi.fn();
    const handler = makeVillageBridgeHandler(dispatch);
    const event = new MessageEvent("message", {
      data: { type: "village:complete", payload },
      origin: "https://evil.example",
    });
    handler(event);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("accepts message from expected game origin", () => {
    const dispatch = vi.fn();
    const handler = makeVillageBridgeHandler(dispatch);
    const event = new MessageEvent("message", {
      data: { type: "village:complete", payload },
      origin: window.location.origin,
    });
    handler(event);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("accepts same-origin message (default)", () => {
    const dispatch = vi.fn();
    const handler = makeVillageBridgeHandler(dispatch);
    const event = new MessageEvent("message", {
      data: { type: "village:complete", payload },
      origin: window.location.origin,
    });
    handler(event);
    expect(dispatch).toHaveBeenCalledWith({
      type: "villageProgress",
      value: payload,
    });
  });
});

describe("<App /> bridge integration via window.postMessage (RED→GREEN FIX 2)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("updates questRun display after a window message village:complete", async () => {
    await act(async () => {
      root.render(<App />);
    });

    const readResources = () => {
      const nodes = Array.from(
        container.querySelectorAll(".claim-stats strong"),
      );
      return nodes.map((n) => (n.textContent ?? "").trim());
    };

    // Initial state — no villageProgress → zeros (FIX 1 contract).
    expect(readResources().join("|")).toMatch(/0 Popberry/);

    await act(async () => {
      window.postMessage(
        {
          type: "village:complete",
          payload: {
            points: 99,
            resources: { popberry: 7, whittlewood_log: 7, ochrux_matrix: 7 },
            completedAt: "2026-06-29T10:00:00Z",
          },
        },
        "*",
      );
      // window.postMessage to self is dispatched as a macro task; let it fire
      // and the resulting React state update flush before act() returns.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const after = readResources().join("|");
    expect(after).toMatch(/7 Popberry/);
    expect(after).toMatch(/7 WhittlewoodLog/);
    expect(after).toMatch(/7 OchruxMatrix/);
    expect(after).toMatch(/99 pts/);
  });
});
