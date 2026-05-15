import { describe, expect, it } from "vitest";
import { applyAssistantResult } from "./applyResult";

describe("applyAssistantResult", () => {
  it("applies full rewrite", () => {
    const result = applyAssistantResult("# Old", {
      kind: "rewrite",
      markdown: "# New",
    });

    expect(result).toBe("# New");
  });

  it("leaves suggestions out of the document", () => {
    const result = applyAssistantResult("# Old", {
      kind: "suggestions",
      suggestions: "Improve pacing.",
    });

    expect(result).toBe("# Old");
  });

  it("applies a simple unified diff", () => {
    const result = applyAssistantResult("First line\nOld line\nLast line", {
      kind: "diff",
      patch: [
        "--- a/chapter.md",
        "+++ b/chapter.md",
        "@@ -1,3 +1,3 @@",
        " First line",
        "-Old line",
        "+New line",
        " Last line",
      ].join("\n"),
    });

    expect(result).toBe("First line\nNew line\nLast line");
  });

  it("throws a clear error when a unified diff cannot be applied", () => {
    expect(() =>
      applyAssistantResult("First line\nDifferent line\nLast line", {
        kind: "diff",
        patch: [
          "--- a/chapter.md",
          "+++ b/chapter.md",
          "@@ -1,3 +1,3 @@",
          " First line",
          "-Old line",
          "+New line",
          " Last line",
        ].join("\n"),
      }),
    ).toThrow("Diff could not be applied to the current document.");
  });
});
