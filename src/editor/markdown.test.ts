import { describe, expect, it } from "vitest";
import { normalizeMarkdownForSave } from "./markdown";

describe("normalizeMarkdownForSave", () => {
  it("normalizes line endings, trims trailing whitespace, and returns one trailing newline", () => {
    const markdown = "# Chapter 1  \r\n\r\nText.   \r\n";

    expect(normalizeMarkdownForSave(markdown)).toBe("# Chapter 1\n\nText.\n");
  });
});
