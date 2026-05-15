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
  sendCliAgentRequest: vi.fn(),
  sendLmStudioRequest: vi.fn(),
  loadSettings: vi.fn(),
  loadProjectEnv: vi.fn(),
  saveSettings: vi.fn(),
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
    tauriApiMock.sendCliAgentRequest.mockReset();
    tauriApiMock.sendLmStudioRequest.mockReset();
    tauriApiMock.loadSettings.mockReset();
    tauriApiMock.loadProjectEnv.mockReset();
    tauriApiMock.saveSettings.mockReset();
    tauriApiMock.loadSettings.mockResolvedValue(null);
    tauriApiMock.loadProjectEnv.mockResolvedValue(null);
    tauriApiMock.saveSettings.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the main writing workspace panes", () => {
    render(<App />);

    expect(screen.getByText("DraftAgent")).toBeInTheDocument();
    expect(screen.getByText("No file open")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Assistant" })).toBeInTheDocument();
  });

  it("describes subscription providers as built-in CLI routes", () => {
    render(<App />);

    expect(screen.getByText(/OpenAI uses Codex CLI/)).toBeInTheDocument();
    expect(screen.getAllByText(/Claude Code/).length).toBeGreaterThan(0);
  });

  it("opens settings, saves changes, and updates provider workflow", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.selectOptions(
      screen.getByLabelText("Default provider"),
      "anthropic-subscription",
    );
    expect(screen.getByText("codex login")).toBeInTheDocument();
    expect(screen.getByText("claude auth login")).toBeInTheDocument();
    await user.click(screen.getByText("Save settings"));

    expect(tauriApiMock.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultProvider: "anthropic-subscription",
      }),
    );
    expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Provider")).toHaveValue("anthropic-subscription");
  });

  it("loads project env preferences when opening a folder", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    mockProjectFolder([chapter]);
    tauriApiMock.loadProjectEnv.mockResolvedValueOnce(
      [
        "DRAFTAGENT_DEFAULT_PROVIDER=anthropic-subscription",
        "DRAFTAGENT_ANTHROPIC_URL=https://claude.example/new",
      ].join("\n"),
    );
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1",
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));

    expect(tauriApiMock.loadProjectEnv).toHaveBeenCalledWith("/novel");
    expect(screen.getByLabelText("Provider")).toHaveValue("anthropic-subscription");
  });

  it("keeps saved app-local settings ahead of project env preferences", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    tauriApiMock.loadSettings.mockResolvedValueOnce({
      defaultProvider: "openai-subscription",
      openaiUrl: "https://chatgpt.local/",
      anthropicUrl: "https://claude.local/",
      lmStudioBaseUrl: "http://127.0.0.1:1234/v1",
      lmStudioModel: "local-model",
      editorFontSize: 18,
      editorLineWidth: 760,
      ignoreHidden: true,
      ignoreLargeFiles: true,
      ignoreBinaryFiles: true,
      projectEnvEnabled: true,
    });
    mockProjectFolder([chapter]);
    tauriApiMock.loadProjectEnv.mockResolvedValueOnce(
      "DRAFTAGENT_DEFAULT_PROVIDER=anthropic-subscription",
    );
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1",
    });

    render(<App />);

    await screen.findByText("DraftAgent");
    await user.click(screen.getByRole("button", { name: "Open Folder" }));

    expect(screen.getByLabelText("Provider")).toHaveValue("openai-subscription");
  });

  it("asks before opening a different folder while the current file is dirty", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    mockProjectFolder([chapter]);
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
    mockProjectFolder([original]);
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
    mockProjectFolder([chapter]);
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

  it("sends OpenAI subscription requests in-pane with current selection and indexed context", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    const notes = fileNode("notes.md");
    mockProjectFolder([chapter, notes]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nThe house shuddered.\n\nOther line.",
      "notes.md": "# Notes\n\nThe house is haunted.",
    });
    tauriApiMock.sendCliAgentRequest.mockResolvedValueOnce(
      "# Chapter 1\n\nThe old house shuddered harder.",
    );

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await user.click(screen.getByRole("button", { name: "Select Text" }));
    await user.type(screen.getByLabelText("Instruction"), "Make this more tense");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(tauriApiMock.sendCliAgentRequest).toHaveBeenCalledWith(
      "openai-subscription",
      "/novel",
      expect.stringContaining("The house shuddered."),
    );
    expect(tauriApiMock.sendCliAgentRequest).toHaveBeenCalledWith(
      "openai-subscription",
      "/novel",
      expect.not.stringContaining("Other line."),
    );
    expect(tauriApiMock.sendCliAgentRequest).toHaveBeenCalledWith(
      "openai-subscription",
      "/novel",
      expect.stringContaining("The house is haunted."),
    );
    expect(tauriApiMock.sendCliAgentRequest).toHaveBeenCalledWith(
      "openai-subscription",
      "/novel",
      expect.stringContaining("- notes.md"),
    );
    expect(tauriApiMock.copyText).not.toHaveBeenCalled();
    expect(tauriApiMock.openExternal).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "# Chapter 1 The old house shuddered harder.",
    );
    expect(screen.getByText(/OpenAI via Codex/)).toBeInTheDocument();
    expect(screen.getByText("Applied rewrite to the open file.")).toBeInTheDocument();
  });

  it("sends LM Studio requests directly and imports the response", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    const notes = fileNode("notes.md");
    mockProjectFolder([chapter, notes]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
      "notes.md": "# Notes\n\nThe house is haunted.",
    });
    tauriApiMock.sendLmStudioRequest.mockResolvedValueOnce(
      "# Chapter 1\n\nNew local text.",
    );

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await user.selectOptions(screen.getByLabelText("Provider"), "lm-studio");
    await user.type(screen.getByLabelText("Instruction"), "Rewrite locally");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(tauriApiMock.sendLmStudioRequest).toHaveBeenCalledWith(
      "http://127.0.0.1:1234/v1",
      "local-model",
      expect.stringContaining("Rewrite locally"),
    );
    expect(tauriApiMock.sendLmStudioRequest).toHaveBeenCalledWith(
      "http://127.0.0.1:1234/v1",
      "local-model",
      expect.stringContaining("Old text."),
    );
    expect(tauriApiMock.copyText).not.toHaveBeenCalled();
    expect(tauriApiMock.openExternal).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "# Chapter 1 New local text.",
    );
    expect(screen.getByText("Applied rewrite to the open file.")).toBeInTheDocument();
  });

  it("does not import a stale LM Studio response after switching files", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    const scene = fileNode("scene.md");
    let resolveLocalResponse: (value: string) => void = () => undefined;
    mockProjectFolder([chapter, scene]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
      "scene.md": "# Scene\n\nDifferent text.",
    });
    tauriApiMock.sendLmStudioRequest.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLocalResponse = resolve;
      }),
    );

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await user.selectOptions(screen.getByLabelText("Provider"), "lm-studio");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.click(await screen.findByRole("button", { name: "Open scene.md" }));
    resolveLocalResponse("# Chapter 1\n\nLate response.");

    expect(await screen.findByRole("heading", { name: "scene.md" })).toBeInTheDocument();
    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "# Scene Different text.",
    );
    expect(
      screen.queryByText("Applied rewrite to the open file."),
    ).not.toBeInTheDocument();
  });

  it("shows an error banner when LM Studio requests fail", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    mockProjectFolder([chapter]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
    });
    tauriApiMock.sendLmStudioRequest.mockRejectedValueOnce(
      new Error("LM Studio is unavailable."),
    );

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await user.selectOptions(screen.getByLabelText("Provider"), "lm-studio");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("LM Studio is unavailable.")).toBeInTheDocument();
    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "# Chapter 1 Old text.",
    );
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("LM Studio is unavailable.")).not.toBeInTheDocument();
  });

  it("shows an error banner when saving fails and keeps unsaved edits", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    mockProjectFolder([chapter]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
    });
    tauriApiMock.writeMarkdownFile.mockRejectedValueOnce(
      new Error("Disk write failed."),
    );

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await user.click(screen.getByRole("button", { name: "Edit Text" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Disk write failed.")).toBeInTheDocument();
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "Changed lantern.",
    );
  });

  it("uses saved Markdown edits in later assistant context", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    const notes = fileNode("notes.md");
    mockProjectFolder([chapter, notes]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nThe lantern flickered.",
      "notes.md": "# Notes\n\nOld clue.",
    });
    tauriApiMock.sendCliAgentRequest.mockResolvedValueOnce(
      "# Chapter 1\n\nTighter text.",
    );

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(await screen.findByRole("button", { name: "Open notes.md" }));
    await user.click(screen.getByRole("button", { name: "Edit Text" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Open chapter-1.md" }));
    await user.type(screen.getByLabelText("Instruction"), "Tighten this");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(tauriApiMock.sendCliAgentRequest).toHaveBeenCalledWith(
      "openai-subscription",
      "/novel",
      expect.stringContaining("Changed lantern."),
    );
  });

  it("imports a rewrite into the editor without saving to disk", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    mockProjectFolder([chapter]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(await screen.findByRole("button", { name: "Open chapter-1.md" }));
    await user.click(screen.getByText("Manual import"));
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
    expect(screen.getByText("Applied rewrite to the open file.")).toBeInTheDocument();
    expect(tauriApiMock.writeMarkdownFile).not.toHaveBeenCalled();
  });

  it("imports a unified diff into the editor without saving to disk", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    mockProjectFolder([chapter]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await user.selectOptions(screen.getByLabelText("Mode"), "diff");
    await user.click(screen.getByText("Manual import"));
    await user.type(
      screen.getByLabelText("Import response"),
      "```diff\n--- a/chapter-1.md\n+++ b/chapter-1.md\n@@ -1,3 +1,3 @@\n # Chapter 1\n \n-Old text.\n+New text.\n```",
    );
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "# Chapter 1 New text.",
    );
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    expect(screen.getByText("Applied proposed edits to the open file.")).toBeInTheDocument();
    expect(tauriApiMock.writeMarkdownFile).not.toHaveBeenCalled();
  });

  it("imports suggestions into assistant history without changing the document", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    mockProjectFolder([chapter]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await user.selectOptions(screen.getByLabelText("Mode"), "suggestions");
    await user.click(screen.getByText("Manual import"));
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

  it("shows an error banner and keeps the document unchanged when an imported diff fails", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    mockProjectFolder([chapter]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await user.selectOptions(screen.getByLabelText("Mode"), "diff");
    await user.click(screen.getByText("Manual import"));
    await user.type(
      screen.getByLabelText("Import response"),
      "```diff\n--- a/chapter-1.md\n+++ b/chapter-1.md\n@@ -1,3 +1,3 @@\n # Chapter 1\n \n-Missing text.\n+New text.\n```",
    );
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(
      await screen.findByText("Diff could not be applied to the current document."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "# Chapter 1 Old text.",
    );
    expect(
      screen.queryByText("Applied proposed edits to the open file."),
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

function mockProjectFolder(tree: FileNode[]) {
  tauriApiMock.pickProjectFolder.mockResolvedValueOnce({
    rootPath: "/novel",
    tree,
  });
  tauriApiMock.readProjectTree.mockResolvedValueOnce(tree);
}
