import { describe, expect, it } from "vitest";
import { parseAssistantResponse } from "./responseParser";

describe("parseAssistantResponse", () => {
  it("parses edit response as markdown", () => {
    const result = parseAssistantResponse("edit", "# Revised\n\nText.");

    expect(result).toEqual({ kind: "edit", markdown: "# Revised\n\nText." });
  });

  it("strips a whole markdown fence from an edit response", () => {
    const result = parseAssistantResponse(
      "edit",
      "```markdown\n# Revised\n\nText.\n```",
    );

    expect(result).toEqual({ kind: "edit", markdown: "# Revised\n\nText." });
  });

  it("extracts tagged edit markdown without surrounding assistant commentary", () => {
    const result = parseAssistantResponse(
      "edit",
      [
        "I tightened the scene and preserved the structure.",
        "",
        "<scriptorium_edit>",
        "## Chapter One",
        "",
        "Revised text.",
        "</scriptorium_edit>",
        "",
        "Everything else is unchanged.",
      ].join("\n"),
    );

    expect(result).toEqual({
      kind: "edit",
      markdown: "## Chapter One\n\nRevised text.",
    });
  });

  it("accepts the older rewrite tag for in-flight responses", () => {
    const result = parseAssistantResponse(
      "edit",
      "<scriptorium_rewrite>\n# Revised\n</scriptorium_rewrite>",
    );

    expect(result).toEqual({ kind: "edit", markdown: "# Revised" });
  });

  it("parses chat as conversational content", () => {
    const result = parseAssistantResponse("chat", "- Raise the stakes.");

    expect(result).toEqual({
      kind: "chat",
      content: "- Raise the stakes.",
    });
  });

  it("does not strip an inline code fence inside a larger response", () => {
    const response = "Before\n\n```markdown\n# Title\n```\n\nAfter";
    const result = parseAssistantResponse("edit", response);

    expect(result).toEqual({ kind: "edit", markdown: response });
  });
});
