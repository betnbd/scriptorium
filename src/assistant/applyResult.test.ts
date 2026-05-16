import { describe, expect, it } from "vitest";
import { applyAssistantResult } from "./applyResult";

describe("applyAssistantResult", () => {
  it("applies an edit", () => {
    const result = applyAssistantResult("# Old", {
      kind: "edit",
      markdown: "# New",
    });

    expect(result).toBe("# New");
  });

  it("leaves chat responses out of the document", () => {
    const result = applyAssistantResult("# Old", {
      kind: "chat",
      content: "Improve pacing.",
    });

    expect(result).toBe("# Old");
  });
});
