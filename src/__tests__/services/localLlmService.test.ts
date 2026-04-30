import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CardData } from "../../types";
import type { LocalLlmInstallStatus } from "../../services/localLlmService";

const mockIsInstalledWebApp = vi.hoisted(() => vi.fn(() => true));
const mockCreateMLCEngine = vi.hoisted(() => vi.fn());

vi.mock("../../lib/installedWebApp", () => ({
  isInstalledWebApp: mockIsInstalledWebApp,
}));

vi.mock("@mlc-ai/web-llm", () => ({
  CreateMLCEngine: mockCreateMLCEngine,
}));

const cards: CardData[] = [
  { id: "a-0", iconName: "Heart", isFlipped: false, isMatched: false },
  { id: "b-1", iconName: "Star", isFlipped: false, isMatched: false },
];

const stubWebGpu = (present: boolean) => {
  if (present) {
    vi.stubGlobal("navigator", { gpu: {} });
  } else {
    vi.stubGlobal("navigator", {});
  }
};

describe("getLocalLlmHint", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockIsInstalledWebApp.mockReturnValue(true);
    stubWebGpu(true);
  });

  /** Local hints only run after install status reports progress 1 (see getLocalLlmHint). */
  const warmUntilModelReady = async () => {
    const mod = await import("../../services/localLlmService");
    mod.warmLocalLlmEngine();
    await vi.waitFor(() => {
      expect(mod.getLocalLlmInstallStatus().progress).toBe(1);
      expect(mod.getLocalLlmInstallStatus().active).toBe(false);
    });
    return mod;
  };

  it("returns null immediately when not installed (no engine init)", async () => {
    mockIsInstalledWebApp.mockReturnValue(false);
    const { getLocalLlmHint } = await import("../../services/localLlmService");
    const result = await getLocalLlmHint(cards, [], 2);
    expect(result).toBeNull();
    expect(mockCreateMLCEngine).not.toHaveBeenCalled();
  });

  it("returns null when WebGPU is unavailable", async () => {
    stubWebGpu(false);
    const { getLocalLlmHint } = await import("../../services/localLlmService");
    const result = await getLocalLlmHint(cards, [], 2);
    expect(result).toBeNull();
    expect(mockCreateMLCEngine).not.toHaveBeenCalled();
  });

  it("returns null while the local model is still loading (Gemini can run instead)", async () => {
    mockCreateMLCEngine.mockReturnValue(new Promise(() => {}));

    const { getLocalLlmHint, warmLocalLlmEngine, getLocalLlmInstallStatus } =
      await import("../../services/localLlmService");
    warmLocalLlmEngine();
    await Promise.resolve();
    expect(getLocalLlmInstallStatus().active).toBe(true);
    expect(getLocalLlmInstallStatus().progress).toBeLessThan(1);

    const result = await getLocalLlmHint(cards, [], 2);
    expect(result).toBeNull();
  });

  it("returns a parsed hint when the engine emits a clean JSON response", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{"index": 1, "message": "Try Star!"}' } }],
    });
    mockCreateMLCEngine.mockResolvedValue({
      chat: { completions: { create } },
    });

    const { getLocalLlmHint } = await warmUntilModelReady();
    const result = await getLocalLlmHint(cards, [], 2);

    expect(result).toEqual({ index: 1, message: "Try Star!" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("recovers a JSON object wrapped in code fences", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{
        message: {
          content: 'Sure! ```json\n{"index": 0, "message": "Heart"}\n```',
        },
      }],
    });
    mockCreateMLCEngine.mockResolvedValue({
      chat: { completions: { create } },
    });

    const { getLocalLlmHint } = await warmUntilModelReady();
    const result = await getLocalLlmHint(cards, [], 2);

    expect(result).toEqual({ index: 0, message: "Heart" });
  });

  it("returns null when the engine response cannot be parsed as JSON", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "I cannot help with that." } }],
    });
    mockCreateMLCEngine.mockResolvedValue({
      chat: { completions: { create } },
    });

    const { getLocalLlmHint } = await warmUntilModelReady();
    const result = await getLocalLlmHint(cards, [], 2);

    expect(result).toBeNull();
  });

  it("retries once with stricter prompt when first local output is invalid", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: "not valid json" } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: '{"index": 1, "message": "Retry fixed it"}' } }],
      });
    mockCreateMLCEngine.mockResolvedValue({
      chat: { completions: { create } },
    });

    const { getLocalLlmHint } = await warmUntilModelReady();
    const result = await getLocalLlmHint(cards, [], 2);

    expect(create).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ index: 1, message: "Retry fixed it" });
  });

  it("returns null when the engine throws during inference", async () => {
    const create = vi.fn().mockRejectedValue(new Error("GPU lost"));
    mockCreateMLCEngine.mockResolvedValue({
      chat: { completions: { create } },
    });

    const { getLocalLlmHint } = await warmUntilModelReady();
    const result = await getLocalLlmHint(cards, [], 2);

    expect(result).toBeNull();
  });

  it("re-attempts engine init on the next request after a previous init failure", async () => {
    // First warm rejects (e.g. transient WebGPU init error); second warm succeeds.
    // The service must clear its cached enginePromise so the retry actually fires.
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{"index": 1, "message": "after retry"}' } }],
    });
    mockCreateMLCEngine
      .mockRejectedValueOnce(new Error("WebGPU init failed"))
      .mockResolvedValueOnce({ chat: { completions: { create } } });

    const mod = await import("../../services/localLlmService");

    mod.warmLocalLlmEngine();
    await vi.waitFor(() => {
      // Catch handler resets install status to inactive after a failure.
      expect(mod.getLocalLlmInstallStatus().active).toBe(false);
      expect(mod.getLocalLlmInstallStatus().progress).toBe(0);
    });

    mod.warmLocalLlmEngine();
    await vi.waitFor(() => {
      expect(mod.getLocalLlmInstallStatus().progress).toBe(1);
    });

    const result = await mod.getLocalLlmHint(cards, [], 2);
    expect(result).toEqual({ index: 1, message: "after retry" });
    expect(mockCreateMLCEngine).toHaveBeenCalledTimes(2);
  });

  it("notifies subscribers on subscribe and on each install-status change", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{"index": 0, "message": "hi"}' } }],
    });
    mockCreateMLCEngine.mockResolvedValue({ chat: { completions: { create } } });

    const mod = await import("../../services/localLlmService");

    const seen: LocalLlmInstallStatus[] = [];
    const unsub = mod.subscribeLocalLlmInstallStatus((s) => seen.push({ ...s }));

    // Immediate replay of current state on subscribe.
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ active: false, progress: 0, text: "" });

    mod.warmLocalLlmEngine();
    await vi.waitFor(() => {
      expect(mod.getLocalLlmInstallStatus().progress).toBe(1);
    });

    // At least the "starting" emit and the "ready" emit on top of the initial one.
    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect(seen[seen.length - 1]).toMatchObject({ active: false, progress: 1 });

    // Unsubscribe stops further updates.
    unsub();
    const beforeCount = seen.length;
    mod.warmLocalLlmEngine(); // already warm — but any incidental emit must not reach us
    expect(seen.length).toBe(beforeCount);
  });

  it("rejects an LLM hint that points at an already-matched card", async () => {
    // Engine wants to flip card 0, but we mark it matched — validateHint must reject.
    const matchedCards: CardData[] = [
      { id: "a-0", iconName: "Heart", isFlipped: true, isMatched: true },
      { id: "b-1", iconName: "Star",  isFlipped: false, isMatched: false },
    ];
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{"index": 0, "message": "go"}' } }],
    });
    mockCreateMLCEngine.mockResolvedValue({
      chat: { completions: { create } },
    });

    const { getLocalLlmHint } = await warmUntilModelReady();
    const result = await getLocalLlmHint(matchedCards, [], 2);

    expect(result).toBeNull();
  });

  it("rejects an LLM hint that points at a currently-flipped card", async () => {
    // Both attempts return index 0, but card 0 is flipped this turn — both must reject.
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{"index": 0, "message": "go"}' } }],
    });
    mockCreateMLCEngine.mockResolvedValue({
      chat: { completions: { create } },
    });

    const { getLocalLlmHint } = await warmUntilModelReady();
    const result = await getLocalLlmHint(cards, [0], 2);

    expect(result).toBeNull();
    // First inference + retry both produce the same illegal index, so we should
    // see exactly two completions calls before giving up.
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("accepts a numeric-string index from the local model", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{"index": "1", "message": "Try Star!"}' } }],
    });
    mockCreateMLCEngine.mockResolvedValue({
      chat: { completions: { create } },
    });

    const { getLocalLlmHint } = await warmUntilModelReady();
    const result = await getLocalLlmHint(cards, [], 2);

    expect(result).toEqual({ index: 1, message: "Try Star!" });
  });

  it("coerces an output that uses 'hint' instead of 'message'", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{"index": 1, "hint": "use Star"}' } }],
    });
    mockCreateMLCEngine.mockResolvedValue({
      chat: { completions: { create } },
    });

    const { getLocalLlmHint } = await warmUntilModelReady();
    const result = await getLocalLlmHint(cards, [], 2);

    expect(result).toEqual({ index: 1, message: "use Star" });
  });

  it("coerces an output that uses 'reason' as the message field", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{"index": 1, "reason": "matches the flipped card"}' } }],
    });
    mockCreateMLCEngine.mockResolvedValue({
      chat: { completions: { create } },
    });

    const { getLocalLlmHint } = await warmUntilModelReady();
    const result = await getLocalLlmHint(cards, [], 2);

    expect(result).toEqual({ index: 1, message: "matches the flipped card" });
  });

  it("returns null when inference exceeds the timeout budget", async () => {
    const create = vi.fn().mockReturnValue(new Promise(() => {})); // hang forever
    mockCreateMLCEngine.mockResolvedValue({
      chat: { completions: { create } },
    });

    const { getLocalLlmHint } = await warmUntilModelReady();

    vi.useFakeTimers();
    try {
      const hintPromise = getLocalLlmHint(cards, [], 2);
      // INFERENCE_TIMEOUT_MS is 20s. The catch around inference returns null without
      // running the retry path, so a single advance is sufficient.
      await vi.advanceTimersByTimeAsync(20_001);
      const result = await hintPromise;
      expect(result).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns null when engine warmup exceeds ENGINE_READY_TIMEOUT_MS", async () => {
    // Fire a progress: 1 callback so install status reports "ready", but never
    // resolve the underlying engine creation. waitForEngine should give up at 5s
    // and return null so the caller falls through to the cloud path.
    mockCreateMLCEngine.mockImplementation(
      async (_id: string, options: { initProgressCallback: (p: { progress: number; text: string }) => void }) => {
        options.initProgressCallback({ progress: 1, text: "ready" });
        return await new Promise(() => {});
      }
    );

    const mod = await import("../../services/localLlmService");
    mod.warmLocalLlmEngine();
    await vi.waitFor(() => {
      expect(mod.getLocalLlmInstallStatus().progress).toBe(1);
      expect(mod.getLocalLlmInstallStatus().active).toBe(false);
    });

    vi.useFakeTimers();
    try {
      const hintPromise = mod.getLocalLlmHint(cards, [], 2);
      await vi.advanceTimersByTimeAsync(5_001);
      const result = await hintPromise;
      expect(result).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps broadcasting install status when one subscriber throws", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{"index": 0, "message": "x"}' } }],
    });
    mockCreateMLCEngine.mockResolvedValue({ chat: { completions: { create } } });

    const mod = await import("../../services/localLlmService");

    // Buggy listener throws on every emit, including the subscribe-time replay.
    // Both the replay path and the broadcast loop must catch the throw so other
    // subscribers and the caller wiring up the subscription stay healthy.
    expect(() =>
      mod.subscribeLocalLlmInstallStatus(() => {
        throw new Error("listener exploded");
      })
    ).not.toThrow();

    const goodSeen: LocalLlmInstallStatus[] = [];
    mod.subscribeLocalLlmInstallStatus((s) => goodSeen.push({ ...s }));

    mod.warmLocalLlmEngine();
    await vi.waitFor(() => {
      expect(mod.getLocalLlmInstallStatus().progress).toBe(1);
    });

    // Initial replay on subscribe + at least one progress emit + final ready emit.
    expect(goodSeen.length).toBeGreaterThanOrEqual(2);
    expect(goodSeen[goodSeen.length - 1]).toMatchObject({ active: false, progress: 1 });
  });
});
