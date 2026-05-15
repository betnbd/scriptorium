import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { FileNode } from "./types";

const tauriApiMock = vi.hoisted(() => ({
  pickProjectFolder: vi.fn(),
  readProjectTree: vi.fn(),
  readMarkdownFile: vi.fn(),
  writeMarkdownFile: vi.fn(),
  createFile: vi.fn(),
  createFolder: vi.fn(),
  renameEntry: vi.fn(),
  deleteEntry: vi.fn(),
  moveEntry: vi.fn(),
  copyText: vi.fn(),
  openExternal: vi.fn(),
}));

vi.mock("./api/tauri", () => ({
  tauriApi: tauriApiMock,
}));

vi.mock("./components/EditorPane", () => ({
  EditorPane: ({
    openFile,
    markdown,
    isDirty,
    onChange,
    onSave,
    onSelectionChange,
  }: {
    openFile: { relativePath: string; name: string } | null;
    markdown: string;
    isDirty: boolean;
    onChange: (markdown: string) => void;
    onSave: () => void;
    onSelectionChange?: (markdown: string | null) => void;
  }) =>
    openFile ? (
      <section className="editor-pane">
        <h1>{openFile.name}</h1>
        <p>{openFile.relativePath}</p>
        <span>{isDirty ? "Unsaved" : "Saved"}</span>
        <pre aria-label="Current markdown">{markdown}</pre>
        <button
          type="button"
          onClick={() => onChange(`${markdown}\nChanged lantern.`)}
        >
          Edit Text
        </button>
        <button
          type="button"
          onClick={() => onSelectionChange?.("The house shuddered.")}
        >
          Select Text
        </button>
        <button type="button" onClick={onSave} disabled={!isDirty}>
          Save
        </button>
      </section>
    ) : (
      <section className="editor-pane">
        <div>No file open</div>
      </section>
    ),
}));

describe("App", () => {
  beforeEach(() => {
    tauriApiMock.pickProjectFolder.mockReset();
    tauriApiMock.readProjectTree.mockReset();
    tauriApiMock.readMarkdownFile.mockReset();
    tauriApiMock.writeMarkdownFile.mockReset();
    tauriApiMock.createFile.mockReset();
    tauriApiMock.createFolder.mockReset();
    tauriApiMock.renameEntry.mockReset();
    tauriApiMock.deleteEntry.mockReset();
    tauriApiMock.moveEntry.mockReset();
    tauriApiMock.copyText.mockReset();
    tauriApiMock.openExternal.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the main writing workspace panes", () => {
    render(<App />);

    expect(screen.getByText("DraftAgent")).toBeInTheDocument();
    expect(screen.getByText("No file open")).toBeInTheDocument();
    expect(screen.getByText("Assistant")).toBeInTheDocument();
  });

  it("asks before opening a different folder while the current file is dirty", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    tauriApiMock.pickProjectFolder.mockResolvedValueOnce({
      rootPath: "/novel",
      tree: [chapter],
    });
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1",
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await user.click(await screen.findByRole("button", { name: "Edit Text" }));
    await screen.findByText("Unsaved");
    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(confirm).toHaveBeenCalledWith("Discard unsaved changes?");
    expect(tauriApiMock.pickProjectFolder).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
  });

  it("keeps the open file path in sync after renaming it", async () => {
    const user = userEvent.setup();
    const original = fileNode("chapter-1.md");
    const renamed = fileNode("chapter-one.md");
    tauriApiMock.pickProjectFolder.mockResolvedValueOnce({
      rootPath: "/novel",
      tree: [original],
    });
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1",
      "chapter-one.md": "# Chapter 1",
    });
    tauriApiMock.readProjectTree.mockResolvedValueOnce([renamed]);
    vi.spyOn(window, "prompt").mockReturnValue("chapter-one.md");

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await user.click(screen.getByRole("button", { name: "Rename chapter-1.md" }));
    await screen.findByRole("heading", { name: "chapter-one.md" });
    await user.click(screen.getByRole("button", { name: "Edit Text" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(tauriApiMock.renameEntry).toHaveBeenCalledWith(
      "/novel",
      "chapter-1.md",
      "chapter-one.md",
    );
    expect(tauriApiMock.writeMarkdownFile).toHaveBeenCalledWith(
      "/novel",
      "chapter-one.md",
      expect.stringContaining("Changed lantern."),
    );
  });

  it("closes the editor when the open file is deleted", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    tauriApiMock.pickProjectFolder.mockResolvedValueOnce({
      rootPath: "/novel",
      tree: [chapter],
    });
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1",
    });
    tauriApiMock.readProjectTree.mockResolvedValueOnce([]);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete chapter-1.md" }));

    expect(tauriApiMock.deleteEntry).toHaveBeenCalledWith("/novel", "chapter-1.md");
    expect(await screen.findByText("No file open")).toBeInTheDocument();
  });

  it("prepares a subscription handoff prompt from the current selection and indexed context", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    const notes = fileNode("notes.md");
    tauriApiMock.pickProjectFolder.mockResolvedValueOnce({
      rootPath: "/novel",
      tree: [chapter, notes],
    });
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nThe house shuddered.\n\nOther line.",
      "notes.md": "# Notes\n\nThe house is haunted.",
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await user.click(screen.getByRole("button", { name: "Select Text" }));
    await user.type(screen.getByLabelText("Instruction"), "Make this more tense");
    await user.click(screen.getByRole("button", { name: "Prepare" }));

    expect(tauriApiMock.copyText).toHaveBeenCalledWith(
      expect.stringContaining("The house shuddered."),
    );
    expect(tauriApiMock.copyText).toHaveBeenCalledWith(
      expect.not.stringContaining("Other line."),
    );
    expect(tauriApiMock.copyText).toHaveBeenCalledWith(
      expect.stringContaining("The house is haunted."),
    );
    expect(tauriApiMock.openExternal).toHaveBeenCalledWith("https://chatgpt.com/");
  });

  it("uses saved Markdown edits in later assistant context", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    const notes = fileNode("notes.md");
    tauriApiMock.pickProjectFolder.mockResolvedValueOnce({
      rootPath: "/novel",
      tree: [chapter, notes],
    });
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nThe lantern flickered.",
      "notes.md": "# Notes\n\nOld clue.",
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(await screen.findByRole("button", { name: "Open notes.md" }));
    await user.click(screen.getByRole("button", { name: "Edit Text" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Open chapter-1.md" }));
    await user.type(screen.getByLabelText("Instruction"), "Tighten this");
    await user.click(screen.getByRole("button", { name: "Prepare" }));

    expect(tauriApiMock.copyText).toHaveBeenCalledWith(
      expect.stringContaining("Changed lantern."),
    );
  });

  it("imports a rewrite into the editor without saving to disk", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    tauriApiMock.pickProjectFolder.mockResolvedValueOnce({
      rootPath: "/novel",
      tree: [chapter],
    });
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(await screen.findByRole("button", { name: "Open chapter-1.md" }));
    await user.clear(screen.getByLabelText("Import response"));
    await user.type(
      screen.getByLabelText("Import response"),
      "# Chapter 1\n\nNew text.",
    );
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "# Chapter 1 New text.",
    );
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    expect(screen.getByText("Imported assistant result.")).toBeInTheDocument();
    expect(tauriApiMock.writeMarkdownFile).not.toHaveBeenCalled();
  });

  it("imports a unified diff into the editor without saving to disk", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    tauriApiMock.pickProjectFolder.mockResolvedValueOnce({
      rootPath: "/novel",
      tree: [chapter],
    });
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await user.selectOptions(screen.getByLabelText("Mode"), "diff");
    await user.type(
      screen.getByLabelText("Import response"),
      "```diff\n--- a/chapter-1.md\n+++ b/chapter-1.md\n@@ -1,3 +1,3 @@\n # Chapter 1\n \n-Old text.\n+New text.\n```",
    );
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "# Chapter 1 New text.",
    );
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    expect(screen.getByText("Imported assistant result.")).toBeInTheDocument();
    expect(tauriApiMock.writeMarkdownFile).not.toHaveBeenCalled();
  });

  it("imports suggestions into assistant history without changing the document", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    tauriApiMock.pickProjectFolder.mockResolvedValueOnce({
      rootPath: "/novel",
      tree: [chapter],
    });
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await user.selectOptions(screen.getByLabelText("Mode"), "suggestions");
    await user.type(screen.getByLabelText("Import response"), "- Raise the stakes.");
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "# Chapter 1 Old text.",
    );
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Assistant history")).getByText(
        "- Raise the stakes.",
      ),
    ).toBeInTheDocument();
  });

  it("alerts and keeps the document unchanged when an imported diff fails", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    tauriApiMock.pickProjectFolder.mockResolvedValueOnce({
      rootPath: "/novel",
      tree: [chapter],
    });
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await user.selectOptions(screen.getByLabelText("Mode"), "diff");
    await user.type(
      screen.getByLabelText("Import response"),
      "```diff\n--- a/chapter-1.md\n+++ b/chapter-1.md\n@@ -1,3 +1,3 @@\n # Chapter 1\n \n-Missing text.\n+New text.\n```",
    );
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(alert).toHaveBeenCalledWith(
      "Diff could not be applied to the current document.",
    );
    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "# Chapter 1 Old text.",
    );
    expect(
      screen.queryByText("Imported assistant result."),
    ).not.toBeInTheDocument();
  });
});

function fileNode(relativePath: string): FileNode {
  const pathParts = relativePath.split("/");
  const extensionParts = relativePath.split(".");

  return {
    path: `/novel/${relativePath}`,
    relativePath,
    name: pathParts[pathParts.length - 1] ?? relativePath,
    extension: extensionParts[extensionParts.length - 1] ?? "",
    kind: "file",
    isMarkdown: relativePath.endsWith(".md"),
    modifiedAt: 10,
    size: 42,
  };
}

function mockMarkdownReads(markdownByPath: Record<string, string>) {
  tauriApiMock.readMarkdownFile.mockImplementation(
    async (_rootPath: string, filePath: string) => {
      const markdown = markdownByPath[filePath];

      if (markdown === undefined) {
        throw new Error(`Unexpected markdown read: ${filePath}`);
      }

      return { file: fileNode(filePath), markdown };
    },
  );
}
