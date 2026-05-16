import { describe, expect, it } from "vitest";
import { formatLocalDiff } from "./localDiff";

describe("formatLocalDiff", () => {
  it("marks changed words inside changed lines", () => {
    expect(formatLocalDiff("The old door opened.", "The red door opened.")).toBe(
      "- The [old] door opened.\n+ The [red] door opened.",
    );
  });

  it("keeps unchanged lines and marks inserted lines", () => {
    expect(formatLocalDiff("First line", "First line\nSecond line")).toBe(
      "  First line\n+ Second line",
    );
  });
});
