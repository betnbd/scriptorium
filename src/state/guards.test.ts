import { describe, expect, it, vi } from "vitest";
import { shouldSwitchFile } from "./guards";

describe("unsaved change protection", () => {
  it("allows switching when the editor is clean", () => {
    const confirmDiscard = vi.fn();

    expect(shouldSwitchFile(false, confirmDiscard)).toBe(true);
    expect(confirmDiscard).not.toHaveBeenCalled();
  });

  it("blocks switching when discard is cancelled", () => {
    const confirmDiscard = vi.fn().mockReturnValue(false);

    expect(shouldSwitchFile(true, confirmDiscard)).toBe(false);
  });

  it("allows switching when discard is confirmed", () => {
    const confirmDiscard = vi.fn().mockReturnValue(true);

    expect(shouldSwitchFile(true, confirmDiscard)).toBe(true);
  });
});
