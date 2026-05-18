import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { FileNode } from "./types";

const tauriApiMock = vi.hoisted(() => ({
  pickProjectFolder: vi.fn(),
  pickMarkdownFile: vi.fn(),
  readProjectTree: vi.fn(),
  readMarkdownFile: vi.fn(),
  writeMarkdownFile: vi.fn(),
  createFile: vi.fn(),
  createFolder: vi.fn(),
  renameEntry: vi.fn(),
  deleteEntry: vi.fn(),
  moveEntry: vi.fn(),
  copyText: vi.fn(),
  sendCliAgentRequest: vi.fn(),
  checkCliAgentStatus: vi.fn(),
  startCliAgentLogin: vi.fn(),
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
    mode,
    isDirty,
    isAiEditStaged,
    onChange,
    onSave,
    onSelectionChange,
  }: {
    openFile: { relativePath: string; name: string } | null;
    markdown: string;
    mode: "visual" | "markdown";
    isDirty: boolean;
    isAiEditStaged?: boolean;
    onChange: (markdown: string) => void;
    onSave: () => void;
    onSelectionChange?: (markdown: string | null) => void;
  }) =>
    openFile ? (
      <section className="editor-pane">
        <h1>{openFile.name}</h1>
        <p>{openFile.relativePath}</p>
        <span>Mode: {mode}</span>
        {isAiEditStaged ? <span>AI edit staged</span> : null}
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
    tauriApiMock.pickMarkdownFile.mockReset();
    tauriApiMock.readProjectTree.mockReset();
    tauriApiMock.readMarkdownFile.mockReset();
    tauriApiMock.writeMarkdownFile.mockReset();
    tauriApiMock.createFile.mockReset();
    tauriApiMock.createFolder.mockReset();
    tauriApiMock.renameEntry.mockReset();
    tauriApiMock.deleteEntry.mockReset();
    tauriApiMock.moveEntry.mockReset();
    tauriApiMock.copyText.mockReset();
    tauriApiMock.sendCliAgentRequest.mockReset();
    tauriApiMock.checkCliAgentStatus.mockReset();
    tauriApiMock.startCliAgentLogin.mockReset();
    tauriApiMock.sendLmStudioRequest.mockReset();
    tauriApiMock.loadSettings.mockReset();
    tauriApiMock.loadProjectEnv.mockReset();
    tauriApiMock.saveSettings.mockReset();
    tauriApiMock.loadSettings.mockResolvedValue(null);
    tauriApiMock.loadProjectEnv.mockResolvedValue(null);
    tauriApiMock.saveSettings.mockResolvedValue(undefined);
    tauriApiMock.checkCliAgentStatus.mockImplementation(async (provider) => ({
      provider,
      installed: true,
      authenticated: true,
      detail: "Connected.",
    }));
    tauriApiMock.startCliAgentLogin.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the main writing workspace panes", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "File" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI" })).toBeInTheDocument();
    expect(screen.getByText("No file open")).toBeInTheDocument();
    expect(screen.getByLabelText("AI conversation")).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize file pane" })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize AI pane" })).toBeInTheDocument();
  });

  it("opens a fresh AI conversation from the menu", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    mockProjectFolder([chapter]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1",
    });

    render(<App />);

    await waitFor(() => expect(tauriApiMock.loadSettings).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await openAssistant(user);

    expect(screen.getByLabelText("AI conversation")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Edit" })).toBeChecked();
    expect(screen.queryByText("Terminal-backed conversation")).not.toBeInTheDocument();
  });

  it("opens settings, saves changes, and updates provider workflow", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: "File" }));
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.selectOptions(
      screen.getByLabelText("Default provider"),
      "anthropic-subscription",
    );
    expect(screen.getByText("Provider connections")).toBeInTheDocument();
    expect(screen.getByText("codex login")).toBeInTheDocument();
    expect(screen.getByText("claude auth login")).toBeInTheDocument();
    await user.click(screen.getByText("Save settings"));

    expect(tauriApiMock.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultProvider: "anthropic-subscription",
      }),
    );
    expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("refreshes provider status after a terminal login flow completes", async () => {
    const user = userEvent.setup();
    tauriApiMock.checkCliAgentStatus.mockImplementation(async (provider) => ({
      provider,
      installed: true,
      authenticated: provider !== "openai-subscription",
      detail:
        provider === "openai-subscription"
          ? "Codex is installed but not signed in."
          : "Connected.",
    }));
    tauriApiMock.startCliAgentLogin.mockImplementation(async () => {
      tauriApiMock.checkCliAgentStatus.mockImplementation(async (provider) => ({
        provider,
        installed: true,
        authenticated: true,
        detail:
          provider === "openai-subscription"
            ? "Logged in using ChatGPT"
            : "Connected.",
      }));
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "File" }));
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(
      await screen.findByText("Codex is installed but not signed in."),
    ).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Sign in" })[0]);

    expect(tauriApiMock.startCliAgentLogin).toHaveBeenCalledWith(
      "openai-subscription",
    );
    expect(await screen.findByText("Logged in using ChatGPT")).toBeInTheDocument();
  });

  it("loads project env preferences when opening a folder", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    mockProjectFolder([chapter]);
    tauriApiMock.loadSettings.mockResolvedValueOnce({
      projectEnvEnabled: true,
    });
    tauriApiMock.loadProjectEnv.mockResolvedValueOnce(
      [
        "SCRIPTORIUM_DEFAULT_PROVIDER=anthropic-subscription",
        "SCRIPTORIUM_ANTHROPIC_URL=https://claude.example/new",
      ].join("\n"),
    );
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1",
    });

    render(<App />);

    await waitFor(() => expect(tauriApiMock.loadSettings).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Open Folder" }));

    expect(tauriApiMock.loadProjectEnv).toHaveBeenCalledWith("/novel");
    await openAssistant(user);
    expect(screen.getByLabelText("Provider")).toHaveValue("anthropic-subscription");
  });

  it("does not read project override files unless the setting is enabled", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    mockProjectFolder([chapter]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1",
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));

    expect(tauriApiMock.loadProjectEnv).not.toHaveBeenCalled();
    expect(tauriApiMock.readProjectTree).toHaveBeenCalledTimes(1);
  });

  it("opens a markdown file directly and loads its parent folder", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    const notes = fileNode("notes.md");
    tauriApiMock.pickMarkdownFile.mockResolvedValueOnce({
      rootPath: "/novel",
      filePath: "chapter-1.md",
    });
    tauriApiMock.readProjectTree.mockResolvedValueOnce([chapter, notes]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1",
      "notes.md": "# Notes",
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "File" }));
    await user.click(screen.getByRole("button", { name: "Open File" }));

    expect(tauriApiMock.pickMarkdownFile).toHaveBeenCalledOnce();
    expect(tauriApiMock.readProjectTree).toHaveBeenCalledWith(
      "/novel",
      expect.objectContaining({ ignoreHidden: true }),
    );
    expect(tauriApiMock.readMarkdownFile).toHaveBeenCalledWith(
      "/novel",
      "chapter-1.md",
    );
    expect(await screen.findByRole("heading", { name: "chapter-1.md" })).toBeInTheDocument();
    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "# Chapter 1",
    );
    expect(screen.getByRole("button", { name: "Open notes.md" })).toBeInTheDocument();
  });

  it("loads project env model and effort preferences when no local settings exist", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    mockProjectFolder([chapter]);
    tauriApiMock.loadSettings.mockResolvedValueOnce({
      projectEnvEnabled: true,
    });
    tauriApiMock.loadProjectEnv.mockResolvedValueOnce(
      [
        "SCRIPTORIUM_DEFAULT_PROVIDER=anthropic-subscription",
        "SCRIPTORIUM_ANTHROPIC_MODEL=opus",
        "SCRIPTORIUM_ANTHROPIC_EFFORT=max",
      ].join("\n"),
    );
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1",
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await openAssistant(user);

    expect(screen.getByLabelText("Provider")).toHaveValue("anthropic-subscription");
    expect(screen.getByLabelText("Model")).toHaveValue("opus");
    expect(screen.getByLabelText("Effort")).toHaveValue("max");
  });

  it("can reopen the default AI pane before a project is loaded", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.queryByLabelText("AI conversation")).not.toBeInTheDocument();
    await openAssistant(user);

    expect(screen.getByLabelText("AI conversation")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open a file to send" }),
    ).toBeDisabled();
  });

  it("applies opted-in project env preferences", async () => {
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
      "SCRIPTORIUM_DEFAULT_PROVIDER=anthropic-subscription",
    );
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1",
    });

    render(<App />);

    await screen.findByRole("button", { name: "File" });
    await user.click(screen.getByRole("button", { name: "Open Folder" }));

    await openAssistant(user);
    expect(screen.getByLabelText("Provider")).toHaveValue("anthropic-subscription");
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
    await user.click(screen.getByRole("button", { name: "Open Folder" }));

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

  it("saves the current document with the standard save shortcut", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    mockProjectFolder([chapter]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1",
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await user.click(screen.getByRole("button", { name: "Edit Text" }));
    await user.keyboard("{Control>}s{/Control}");

    await waitFor(() => {
      expect(tauriApiMock.writeMarkdownFile).toHaveBeenCalledWith(
        "/novel",
        "chapter-1.md",
        expect.stringContaining("Changed lantern."),
      );
    });
  });

  it("zooms the app and editor text from separate keyboard shortcuts", async () => {
    const user = userEvent.setup();

    render(<App />);

    await waitFor(() => expect(tauriApiMock.loadSettings).toHaveBeenCalled());
    await user.keyboard("{Control>}= {/Control}");

    expect(tauriApiMock.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ appZoomLevel: 1 }),
    );
    expect(document.querySelector(".app-shell")).toHaveStyle({
      "--editor-font-size": "19px",
    });

    tauriApiMock.saveSettings.mockClear();
    await user.keyboard("{Control>}-{/Control}");

    expect(tauriApiMock.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ appZoomLevel: 0 }),
    );

    tauriApiMock.saveSettings.mockClear();
    await user.keyboard("{Control>}{Shift>}= {/Shift}{/Control}");

    expect(tauriApiMock.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ editorFontSize: 19 }),
    );

    tauriApiMock.saveSettings.mockClear();
    await user.keyboard("{Control>}{Shift>}-{/Shift}{/Control}");

    expect(tauriApiMock.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ editorFontSize: 18 }),
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

  it("sends OpenAI chat requests with current selection and indexed context without editing the file", async () => {
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
    await openAssistant(user);
    await user.click(screen.getByRole("radio", { name: "Chat" }));
    await user.selectOptions(
      screen.getByLabelText("Provider"),
      "openai-subscription",
    );
    await user.click(screen.getByRole("button", { name: "Select Text" }));
    await user.type(screen.getByLabelText("Message"), "Make this more tense");
    await user.click(screen.getByRole("button", { name: "Send to OpenAI" }));

    expect(tauriApiMock.sendCliAgentRequest).toHaveBeenCalledWith(
      "openai-subscription",
      "/novel",
      expect.stringContaining("The house shuddered."),
      "gpt-5.5",
      "medium",
    );
    expect(tauriApiMock.sendCliAgentRequest).toHaveBeenCalledWith(
      "openai-subscription",
      "/novel",
      expect.not.stringContaining("Other line."),
      "gpt-5.5",
      "medium",
    );
    expect(tauriApiMock.sendCliAgentRequest).toHaveBeenCalledWith(
      "openai-subscription",
      "/novel",
      expect.stringContaining("The house is haunted."),
      "gpt-5.5",
      "medium",
    );
    expect(tauriApiMock.sendCliAgentRequest).toHaveBeenCalledWith(
      "openai-subscription",
      "/novel",
      expect.stringContaining("- notes.md"),
      "gpt-5.5",
      "medium",
    );
    expect(tauriApiMock.copyText).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "# Chapter 1 The house shuddered. Other line.",
    );
    expect(screen.getByText("Make this more tense")).toBeInTheDocument();
    expect(
      screen.queryByText("Kept edit in the open file."),
    ).not.toBeInTheDocument();
  });

  it("stages LM Studio edits in the editor until the user keeps them", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    const notes = fileNode("notes.md");
    mockProjectFolder([chapter, notes]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
      "notes.md": "# Notes\n\nThe house is haunted.",
    });
    tauriApiMock.sendLmStudioRequest.mockResolvedValueOnce(
      [
        "I tightened the chapter.",
        "",
        "<scriptorium_edit>",
        "# Chapter 1",
        "",
        "New local text.",
        "</scriptorium_edit>",
        "",
        "The structure is preserved.",
      ].join("\n"),
    );

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await openAssistant(user);
    await user.selectOptions(screen.getByLabelText("Provider"), "lm-studio");
    await user.click(screen.getByRole("radio", { name: "Edit" }));
    await user.type(screen.getByLabelText("Message"), "Revise locally");
    await user.click(screen.getByRole("button", { name: "Send to LM Studio" }));

    expect(tauriApiMock.sendLmStudioRequest).toHaveBeenCalledWith(
      "http://127.0.0.1:1234/v1",
      "local-model",
      expect.stringContaining("Revise locally"),
    );
    expect(tauriApiMock.sendLmStudioRequest).toHaveBeenCalledWith(
      "http://127.0.0.1:1234/v1",
      "local-model",
      expect.stringContaining("Old text."),
    );
    expect(tauriApiMock.copyText).not.toHaveBeenCalled();
    expect(screen.getByText("Edit ready")).toBeInTheDocument();
    expect(
      screen.getAllByText("Review the staged edit before saving.").length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "# Chapter 1 New local text.",
    );
    expect(screen.getByText("Mode: visual")).toBeInTheDocument();
    expect(screen.queryByLabelText("Current markdown")).not.toHaveTextContent(
      "I tightened the chapter.",
    );
    expect(screen.queryByLabelText("Current markdown")).not.toHaveTextContent(
      "The structure is preserved.",
    );
    expect(tauriApiMock.writeMarkdownFile).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Keep edits" }));
    expect(await screen.findByText("Kept edit and saved it to disk.")).toBeInTheDocument();
    expect(tauriApiMock.writeMarkdownFile).toHaveBeenCalledWith(
      "/novel",
      "chapter-1.md",
      "# Chapter 1\n\nNew local text.\n",
    );
  });

  it("keeps a drafted message when starting a new chat", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    mockProjectFolder([chapter]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(await screen.findByRole("button", { name: "Open chapter-1.md" }));
    await openAssistant(user);
    await user.type(screen.getByLabelText("Message"), "Keep this draft");
    await user.click(screen.getByRole("button", { name: "New chat" }));

    expect(screen.getByLabelText("Message")).toHaveValue("Keep this draft");
  });

  it("keeps chat responses when the user keeps writing while the agent works", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    let resolveResponse: (value: string) => void = () => undefined;
    mockProjectFolder([chapter]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
    });
    tauriApiMock.sendCliAgentRequest.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveResponse = resolve;
      }),
    );

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await openAssistant(user);
    await user.click(screen.getByRole("radio", { name: "Chat" }));
    await user.type(screen.getByLabelText("Message"), "Can you read this?");
    await user.click(screen.getByRole("button", { name: "Send to Claude" }));
    await user.click(screen.getByRole("button", { name: "Edit Text" }));
    resolveResponse("Yes, I can read it.");

    expect(await screen.findByText("Yes, I can read it.")).toBeInTheDocument();
    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "Changed lantern.",
    );
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
    await openAssistant(user);
    await user.selectOptions(screen.getByLabelText("Provider"), "lm-studio");
    await user.type(screen.getByLabelText("Message"), "Read this");
    await user.click(screen.getByRole("button", { name: "Send to LM Studio" }));
    await user.click(await screen.findByRole("button", { name: "Open scene.md" }));
    resolveLocalResponse("# Chapter 1\n\nLate response.");

    expect(await screen.findByRole("heading", { name: "scene.md" })).toBeInTheDocument();
    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "# Scene Different text.",
    );
    expect(
      screen.queryByText("Kept edit in the open file."),
    ).not.toBeInTheDocument();
  });

  it("keeps a hidden edit request alive while another file is being revised", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    const scene = fileNode("scene.md");
    let resolveEditResponse: (value: string) => void = () => undefined;
    mockProjectFolder([chapter, scene]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
      "scene.md": "# Scene\n\nDifferent text.",
    });
    tauriApiMock.sendCliAgentRequest.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveEditResponse = resolve;
      }),
    );

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await openAssistant(user);
    await user.click(screen.getByRole("radio", { name: "Edit" }));
    await user.type(screen.getByLabelText("Message"), "Revise this chapter");
    await user.click(screen.getByRole("button", { name: "Send to Claude" }));

    await user.click(await screen.findByRole("button", { name: "Open scene.md" }));
    await user.click(screen.getByRole("button", { name: "Edit Text" }));
    resolveEditResponse("# Chapter 1\n\nImproved text.");

    await waitFor(() => {
      expect(screen.queryByText("The open file changed before the assistant response returned.")).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "# Scene Different text. Changed lantern.",
    );
    expect(await screen.findByText("Edit ready")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    expect(screen.getByText("AI edit staged")).toBeInTheDocument();
    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "# Chapter 1 Old text.",
    );
  });

  it("starts each file with its own assistant controls when switching files", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    const scene = fileNode("scene.md");
    mockProjectFolder([chapter, scene]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
      "scene.md": "# Scene\n\nDifferent text.",
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await openAssistant(user);
    await user.selectOptions(
      screen.getByLabelText("Provider"),
      "anthropic-subscription",
    );
    await user.selectOptions(screen.getByLabelText("Model"), "opus");
    await user.selectOptions(screen.getByLabelText("Effort"), "xhigh");
    await user.click(await screen.findByRole("button", { name: "Open scene.md" }));

    expect(screen.getByLabelText("Provider")).toHaveValue(
      "anthropic-subscription",
    );
    expect(screen.getByLabelText("Model")).toHaveValue("opus");
    expect(screen.getByLabelText("Effort")).toHaveValue("medium");
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
    await openAssistant(user);
    await user.selectOptions(screen.getByLabelText("Provider"), "lm-studio");
    await user.type(screen.getByLabelText("Message"), "Read this");
    await user.click(screen.getByRole("button", { name: "Send to LM Studio" }));

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
    await openAssistant(user);
    await user.click(screen.getByRole("radio", { name: "Chat" }));
    await user.type(screen.getByLabelText("Message"), "Tighten this");
    await user.click(screen.getByRole("button", { name: "Send to Claude" }));

    expect(tauriApiMock.sendCliAgentRequest).toHaveBeenCalledWith(
      "anthropic-subscription",
      "/novel",
      expect.stringContaining("Changed lantern."),
      "opus",
      "medium",
    );
  });

  it("sends follow-up CLI turns with prior conversation history", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    mockProjectFolder([chapter]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
    });
    tauriApiMock.sendCliAgentRequest
      .mockResolvedValueOnce("The chapter is readable.")
      .mockResolvedValueOnce("The opening image is the strongest part.");

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await openAssistant(user);
    await user.click(screen.getByRole("radio", { name: "Chat" }));
    await user.type(screen.getByLabelText("Message"), "Can you read this?");
    await user.click(screen.getByRole("button", { name: "Send to Claude" }));
    await screen.findByText("The chapter is readable.");
    await user.type(screen.getByLabelText("Message"), "What is strongest?");
    await user.click(screen.getByRole("button", { name: "Send to Claude" }));

    expect(tauriApiMock.sendCliAgentRequest).toHaveBeenLastCalledWith(
      "anthropic-subscription",
      "/novel",
      expect.stringContaining("Conversation so far:"),
      "opus",
      "medium",
    );
    expect(tauriApiMock.sendCliAgentRequest).toHaveBeenLastCalledWith(
      "anthropic-subscription",
      "/novel",
      expect.stringContaining("User: Can you read this?"),
      "opus",
      "medium",
    );
    expect(tauriApiMock.sendCliAgentRequest).toHaveBeenLastCalledWith(
      "anthropic-subscription",
      "/novel",
      expect.stringContaining("Assistant: The chapter is readable."),
      "opus",
      "medium",
    );
  });

  it("restores the open file conversation when the drawer is reopened", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    mockProjectFolder([chapter]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
    });
    tauriApiMock.sendCliAgentRequest.mockResolvedValueOnce("Readable.");

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await openAssistant(user);
    await user.click(screen.getByRole("radio", { name: "Chat" }));
    await user.type(screen.getByLabelText("Message"), "Can you read this?");
    await user.click(screen.getByRole("button", { name: "Send to Claude" }));
    await screen.findByText("Readable.");
    await user.click(screen.getByRole("button", { name: "Hide" }));
    await openAssistant(user);

    expect(screen.getByText("Readable.")).toBeInTheDocument();
  });

  it("restores the prior conversation when switching back to a markdown file", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    const notes = fileNode("notes.md");
    mockProjectFolder([chapter, notes]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
      "notes.md": "# Notes\n\nOld clue.",
    });
    tauriApiMock.sendCliAgentRequest
      .mockResolvedValueOnce("Chapter response.")
      .mockResolvedValueOnce("Notes response.");

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await openAssistant(user);
    await user.click(screen.getByRole("radio", { name: "Chat" }));
    await user.type(screen.getByLabelText("Message"), "Read chapter");
    await user.click(screen.getByRole("button", { name: "Send to Claude" }));
    await screen.findByText("Chapter response.");

    await user.click(await screen.findByRole("button", { name: "Open notes.md" }));
    expect(screen.queryByText("Chapter response.")).not.toBeInTheDocument();
    expect(
      screen.getByText("Start a conversation about the open file."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Chat" }));
    await user.type(screen.getByLabelText("Message"), "Read notes");
    await user.click(screen.getByRole("button", { name: "Send to Claude" }));
    await screen.findByText("Notes response.");

    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    expect(screen.getByText("Chapter response.")).toBeInTheDocument();
    expect(screen.queryByText("Notes response.")).not.toBeInTheDocument();
  });

  it("restores unsaved edits after switching away and back within a project session", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    const notes = fileNode("notes.md");
    mockProjectFolder([chapter, notes]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
      "notes.md": "# Notes\n\nOld clue.",
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );
    await user.click(screen.getByRole("button", { name: "Edit Text" }));
    await user.click(await screen.findByRole("button", { name: "Open notes.md" }));
    await user.click(
      await screen.findByRole("button", { name: "Open chapter-1.md" }),
    );

    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "# Chapter 1 Old text. Changed lantern.",
    );
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
  });

  it("imports an edit into the editor and can reject it before saving", async () => {
    const user = userEvent.setup();
    const chapter = fileNode("chapter-1.md");
    mockProjectFolder([chapter]);
    mockMarkdownReads({
      "chapter-1.md": "# Chapter 1\n\nOld text.",
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open Folder" }));
    await user.click(await screen.findByRole("button", { name: "Open chapter-1.md" }));
    await openAssistant(user);
    await user.click(screen.getByRole("radio", { name: "Edit" }));
    await user.click(screen.getByText("Paste response"));
    await user.clear(screen.getByLabelText("Import response"));
    await user.type(
      screen.getByLabelText("Import response"),
      "# Chapter 1\n\nNew text.\n",
    );
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByText("Edit ready")).toBeInTheDocument();
    expect(screen.getByText("AI edit staged")).toBeInTheDocument();
    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "# Chapter 1 New text.",
    );
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reject edits" }));
    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "# Chapter 1 Old text.",
    );
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Rejected edit and restored the previous text.")).toBeInTheDocument();
    expect(tauriApiMock.writeMarkdownFile).not.toHaveBeenCalled();
  });

  it("imports an edit into the editor and can keep it before saving", async () => {
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
    await openAssistant(user);
    await user.click(screen.getByRole("radio", { name: "Edit" }));
    await user.click(screen.getByText("Paste response"));
    await user.type(
      screen.getByLabelText("Import response"),
      "# Chapter 1\n\nNew text.\n",
    );
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByText("Edit ready")).toBeInTheDocument();
    expect(screen.getByText("AI edit staged")).toBeInTheDocument();
    expect(screen.getByLabelText("Current markdown")).toHaveTextContent(
      "# Chapter 1 New text.",
    );
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep edits" }));
    expect(await screen.findByText("Kept edit and saved it to disk.")).toBeInTheDocument();
    expect(tauriApiMock.writeMarkdownFile).toHaveBeenCalledWith(
      "/novel",
      "chapter-1.md",
      "# Chapter 1\n\nNew text.\n",
    );
  });

  it("imports chat suggestions into assistant history without changing the document", async () => {
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
    await openAssistant(user);
    await user.click(screen.getByRole("radio", { name: "Chat" }));
    await user.click(screen.getByText("Paste response"));
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
  tauriApiMock.pickProjectFolder.mockResolvedValueOnce("/novel");
  tauriApiMock.readProjectTree.mockResolvedValueOnce(tree);
}

async function openAssistant(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "AI" }));
  await user.click(screen.getByRole("button", { name: "New Conversation" }));
}
