import { render, screen } from "@testing-library/react";
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
  }: {
    openFile: { relativePath: string; name: string } | null;
    markdown: string;
    isDirty: boolean;
    onChange: (markdown: string) => void;
    onSave: () => void;
  }) =>
    openFile ? (
      <section className="editor-pane">
        <h1>{openFile.name}</h1>
        <p>{openFile.relativePath}</p>
        <span>{isDirty ? "Unsaved" : "Saved"}</span>
        <button type="button" onClick={() => onChange(`${markdown}\nChanged.`)}>
          Edit Text
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
    vi.clearAllMocks();
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
    tauriApiMock.readMarkdownFile.mockResolvedValueOnce({
      file: chapter,
      markdown: "# Chapter 1",
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(await screen.findByRole("button", { name: "Open chapter-1.md" }));
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
    tauriApiMock.readMarkdownFile.mockResolvedValueOnce({
      file: original,
      markdown: "# Chapter 1",
    });
    tauriApiMock.readProjectTree.mockResolvedValueOnce([renamed]);
    vi.spyOn(window, "prompt").mockReturnValue("chapter-one.md");

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(await screen.findByRole("button", { name: "Open chapter-1.md" }));
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
      expect.stringContaining("Changed."),
    );
  });

  it("closes the editor when the open file is deleted", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    tauriApiMock.pickProjectFolder.mockResolvedValueOnce({
      rootPath: "/novel",
      tree: [chapter],
    });
    tauriApiMock.readMarkdownFile.mockResolvedValueOnce({
      file: chapter,
      markdown: "# Chapter 1",
    });
    tauriApiMock.readProjectTree.mockResolvedValueOnce([]);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(await screen.findByRole("button", { name: "Open chapter-1.md" }));
    await user.click(screen.getByRole("button", { name: "Delete chapter-1.md" }));

    expect(tauriApiMock.deleteEntry).toHaveBeenCalledWith("/novel", "chapter-1.md");
    expect(await screen.findByText("No file open")).toBeInTheDocument();
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
