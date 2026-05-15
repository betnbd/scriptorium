import { describe, expect, it } from "vitest";
import { appReducer, initialAppState } from "./appReducer";

describe("appReducer", () => {
  it("opens one file at a time and clears dirty state", () => {
    const state = appReducer(initialAppState, {
      type: "fileOpened",
      file: {
        path: "/novel/chapter-1.md",
        relativePath: "chapter-1.md",
        name: "chapter-1.md",
        extension: "md",
        kind: "file",
        isMarkdown: true,
        modifiedAt: 10,
        size: 42,
      },
      markdown: "# Chapter 1",
    });

    expect(state.openFile?.relativePath).toBe("chapter-1.md");
    expect(state.openMarkdown).toBe("# Chapter 1");
    expect(state.isDirty).toBe(false);
  });

  it("marks editor dirty on content changes", () => {
    const opened = appReducer(initialAppState, {
      type: "fileOpened",
      file: {
        path: "/novel/chapter-1.md",
        relativePath: "chapter-1.md",
        name: "chapter-1.md",
        extension: "md",
        kind: "file",
        isMarkdown: true,
        modifiedAt: 10,
        size: 42,
      },
      markdown: "# Chapter 1",
    });

    const changed = appReducer(opened, {
      type: "editorChanged",
      markdown: "# Chapter 1\n\nChanged.",
    });

    expect(changed.isDirty).toBe(true);
    expect(changed.openMarkdown).toContain("Changed.");
  });

  it("resets assistant messages when a project opens", () => {
    const withMessage = {
      ...initialAppState,
      assistantMessages: [{ role: "assistant" as const, content: "Old session" }],
    };

    const state = appReducer(withMessage, {
      type: "projectOpened",
      rootPath: "/novel",
      tree: [],
      indexedDocuments: [],
    });

    expect(state.assistantMessages).toEqual([]);
  });

  it("replaces indexed document content after a file save", () => {
    const state = appReducer(
      {
        ...initialAppState,
        indexedDocuments: [
          {
            path: "/novel/notes.md",
            relativePath: "notes.md",
            title: "Notes",
            headings: ["Notes"],
            links: [],
            chunks: ["Old clue."],
            modifiedAt: 10,
          },
        ],
      },
      {
        type: "indexedDocumentUpdated",
        document: {
          path: "/novel/notes.md",
          relativePath: "notes.md",
          title: "Notes",
          headings: ["Notes"],
          links: [],
          chunks: ["Changed lantern."],
          modifiedAt: 20,
        },
      },
    );

    expect(state.indexedDocuments).toHaveLength(1);
    expect(state.indexedDocuments[0]?.chunks).toEqual(["Changed lantern."]);
  });
});
