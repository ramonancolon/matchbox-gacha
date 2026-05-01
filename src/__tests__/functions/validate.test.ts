import { describe, it, expect } from "vitest";
import {
  HintValidationError,
  validateHintRequest,
} from "../../../functions/src/validate";

const validBody = () => ({
  boardSnapshot: [
    { index: 0, iconName: "Heart" },
    { index: 1, iconName: "Star" },
  ],
  flippedIndices: [0],
  gridSize: 2,
  cardCount: 4,
});

describe("validateHintRequest (server-side payload guards)", () => {
  it("accepts a well-formed payload", () => {
    expect(() => validateHintRequest(validBody())).not.toThrow();
  });

  it("rejects undefined payload", () => {
    expect(() => validateHintRequest(undefined)).toThrow(HintValidationError);
  });

  it("rejects oversized gridSize", () => {
    const body = validBody();
    body.gridSize = 999;
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  it("rejects undersized gridSize", () => {
    const body = validBody();
    body.gridSize = 1;
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  it("rejects oversized cardCount", () => {
    const body = validBody();
    body.cardCount = 99999;
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  it("rejects boardSnapshot longer than cardCount", () => {
    const body = validBody();
    body.boardSnapshot = Array.from({ length: 10 }, (_, i) => ({
      index: i,
      iconName: "Star",
    }));
    body.cardCount = 4;
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  it("rejects too many flipped indices", () => {
    const body = validBody();
    body.flippedIndices = [0, 1, 2, 3, 0];
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  it("rejects iconName that is too long", () => {
    const body = validBody();
    body.boardSnapshot[0].iconName = "x".repeat(500);
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  it("rejects empty iconName", () => {
    const body = validBody();
    body.boardSnapshot[0].iconName = "";
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  it("rejects out-of-range board entry index", () => {
    const body = validBody();
    body.boardSnapshot[0].index = 9999;
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  it("rejects flipped index outside cardCount", () => {
    const body = validBody();
    body.flippedIndices = [9999];
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  // ─── boundary values ────────────────────────────────────────────────────────

  it("accepts the maximum allowed gridSize (12×12 = 144 cards)", () => {
    expect(() =>
      validateHintRequest({
        boardSnapshot: [{ index: 0, iconName: "Heart" }],
        flippedIndices: [],
        gridSize: 12,
        cardCount: 144,
      })
    ).not.toThrow();
  });

  it("rejects gridSize one above the maximum", () => {
    const body = validBody();
    body.gridSize = 13;
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  it("rejects cardCount below the minimum (gridSize=2 needs ≥ 4 cards)", () => {
    const body = validBody();
    body.cardCount = 3;
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  // ─── type guards ────────────────────────────────────────────────────────────

  it("rejects non-array boardSnapshot", () => {
    const body = validBody() as any;
    body.boardSnapshot = "not-an-array";
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  it("rejects non-array flippedIndices", () => {
    const body = validBody() as any;
    body.flippedIndices = "not-an-array";
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  it("rejects non-numeric gridSize", () => {
    const body = validBody() as any;
    body.gridSize = "4";
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  it("rejects non-integer (fractional) gridSize", () => {
    const body = validBody();
    body.gridSize = 2.5;
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  it("rejects non-integer (fractional) cardCount", () => {
    const body = validBody();
    body.cardCount = 4.5;
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  it("rejects null entry inside boardSnapshot", () => {
    const body = validBody() as any;
    body.boardSnapshot = [null, { index: 1, iconName: "Star" }];
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  it("rejects negative boardSnapshot index", () => {
    const body = validBody();
    body.boardSnapshot[0].index = -1;
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  it("rejects non-integer (fractional) boardSnapshot index", () => {
    const body = validBody();
    body.boardSnapshot[0].index = 1.5;
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  it("rejects non-string iconName", () => {
    const body = validBody() as any;
    body.boardSnapshot[0].iconName = 123;
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  it("rejects negative flipped index", () => {
    const body = validBody();
    body.flippedIndices = [-1];
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  it("rejects non-integer (fractional) flipped index", () => {
    const body = validBody();
    body.flippedIndices = [1.5];
    expect(() => validateHintRequest(body)).toThrow(HintValidationError);
  });

  // ─── error semantics ────────────────────────────────────────────────────────

  it("returns the validated payload unchanged on success", () => {
    const body = validBody();
    const result = validateHintRequest(body);
    expect(result).toBe(body);
  });

  it("uses the HintValidationError name on the thrown error", () => {
    try {
      validateHintRequest(undefined);
    } catch (err) {
      expect((err as Error).name).toBe("HintValidationError");
    }
  });
});
