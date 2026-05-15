import { describe, expect, it } from "vitest";
import { parseAssistantResponse } from "./responseParser";

describe("parseAssistantResponse", () => {
  it("parses rewrite response as markdown", () => {
    const result = parseAssistantResponse("rewrite", "# Revised\n\nText.");

    expect(result).toEqual({ kind: "rewrite", markdown: "# Revised\n\nText." });
  });

  it("strips a whole markdown fence from a rewrite response", () => {
    const result = parseAssistantResponse(
      "rewrite",
      "```markdown\n# Revised\n\nText.\n```",
    );

    expect(result).toEqual({ kind: "rewrite", markdown: "# Revised\n\nText." });
  });

  it("parses diff response as a patch and strips a whole diff fence", () => {
    const result = parseAssistantResponse(
      "diff",
      "```diff\n--- a/chapter.md\n+++ b/chapter.md\n@@ -1 +1 @@\n-Old\n+New\n```",
    );

    expect(result).toEqual({
      kind: "diff",
      patch: "--- a/chapter.md\n+++ b/chapter.md\n@@ -1 +1 @@\n-Old\n+New",
    });
  });

  it("parses suggestions as notes", () => {
    const result = parseAssistantResponse("suggestions", "- Raise the stakes.");

    expect(result).toEqual({
      kind: "suggestions",
      suggestions: "- Raise the stakes.",
    });
  });

  it("does not strip an inline code fence inside a larger response", () => {
    const response = "Before\n\n```markdown\n# Title\n```\n\nAfter";
    const result = parseAssistantResponse("rewrite", response);

    expect(result).toEqual({ kind: "rewrite", markdown: response });
  });
});
