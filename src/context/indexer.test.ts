import { describe, expect, it } from "vitest";
import { buildIndex, selectRelevantContext } from "./indexer";

describe("indexer", () => {
  it("extracts headings, links, and chunks from Markdown files", () => {
    const docs = buildIndex([
      {
        path: "/novel/chapter.md",
        relativePath: "chapter.md",
        markdown:
          "# Chapter\n\nMara entered the observatory.\n\nSee [[Mara]] and [the atlas](atlas.md).",
        modifiedAt: 10,
      },
    ]);

    expect(docs[0].title).toBe("Chapter");
    expect(docs[0].headings).toEqual(["Chapter"]);
    expect(docs[0].links).toContain("Mara");
    expect(docs[0].links).toContain("the atlas");
    expect(docs[0].chunks.some((chunk) => chunk.includes("Mara entered"))).toBe(
      true,
    );
  });

  it("selects relevant context without returning the target file", () => {
    const docs = buildIndex([
      {
        path: "/novel/chapter.md",
        relativePath: "chapter.md",
        markdown: "# Chapter\n\nMara sees a lighthouse.",
        modifiedAt: 10,
      },
      {
        path: "/novel/notes.md",
        relativePath: "notes.md",
        markdown: "# Lighthouse\n\nThe lighthouse hides the signal.",
        modifiedAt: 20,
      },
    ]);

    const context = selectRelevantContext({
      documents: docs,
      targetPath: "/novel/chapter.md",
      instruction: "Strengthen the lighthouse scene",
      limit: 3,
    });

    expect(context.map((doc) => doc.relativePath)).toEqual(["notes.md"]);
  });

  it("does not score substring matches as relevant terms", () => {
    const docs = buildIndex([
      {
        path: "/novel/chapter.md",
        relativePath: "chapter.md",
        markdown: "# Chapter\n\nMara waits.",
        modifiedAt: 10,
      },
      {
        path: "/novel/notes.md",
        relativePath: "notes.md",
        markdown: "# Notes\n\nMara entered the observatory.",
        modifiedAt: 20,
      },
    ]);

    const context = selectRelevantContext({
      documents: docs,
      targetPath: "/novel/chapter.md",
      instruction: "Tighten Red dialogue",
      limit: 3,
    });

    expect(context).toEqual([]);
  });

  it("uses relative path as a stable tie-breaker for equal relevance and time", () => {
    const docs = buildIndex([
      {
        path: "/novel/zeta.md",
        relativePath: "zeta.md",
        markdown: "# Zeta\n\nThe lighthouse signal is faint.",
        modifiedAt: 20,
      },
      {
        path: "/novel/alpha.md",
        relativePath: "alpha.md",
        markdown: "# Alpha\n\nThe lighthouse signal is bright.",
        modifiedAt: 20,
      },
      {
        path: "/novel/chapter.md",
        relativePath: "chapter.md",
        markdown: "# Chapter\n\nMara sees the coast.",
        modifiedAt: 10,
      },
    ]);

    const context = selectRelevantContext({
      documents: docs,
      targetPath: "/novel/chapter.md",
      instruction: "Strengthen lighthouse signal",
      limit: 3,
    });

    expect(context.map((doc) => doc.relativePath)).toEqual([
      "alpha.md",
      "zeta.md",
    ]);
  });
});
