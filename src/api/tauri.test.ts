import { describe, expect, it, vi } from "vitest";
import { createBrowserTauriApi, createTauriApi } from "./tauri";
import { defaultSettings } from "../state/appReducer";

describe("createTauriApi", () => {
  it("opens a project folder and returns its path", async () => {
    const open = vi.fn().mockResolvedValue("/novel");
    const invoke = vi.fn();
    const api = createTauriApi({
      invoke,
      open,
      writeText: vi.fn(),
    });

    const result = await api.pickProjectFolder();

    expect(open).toHaveBeenCalledWith({ directory: true, multiple: false });
    expect(invoke).not.toHaveBeenCalled();
    expect(result).toBe("/novel");
  });

  it("invokes file operation commands with typed arguments", async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    const api = createTauriApi({
      invoke,
      open: vi.fn(),
      writeText: vi.fn(),
    });

    await api.createFile("/novel", "chapter.md");
    await api.createFolder("/novel", "drafts");
    await api.renameEntry("/novel", "chapter.md", "chapter-1.md");
    await api.moveEntry("/novel", "chapter-1.md", "drafts/chapter-1.md");
    await api.deleteEntry("/novel", "drafts/chapter-1.md");

    expect(invoke).toHaveBeenNthCalledWith(1, "create_file", {
      rootPath: "/novel",
      relativePath: "chapter.md",
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "create_folder", {
      rootPath: "/novel",
      relativePath: "drafts",
    });
    expect(invoke).toHaveBeenNthCalledWith(3, "rename_entry", {
      rootPath: "/novel",
      path: "chapter.md",
      newName: "chapter-1.md",
    });
    expect(invoke).toHaveBeenNthCalledWith(4, "move_entry", {
      rootPath: "/novel",
      path: "chapter-1.md",
      newRelativePath: "drafts/chapter-1.md",
    });
    expect(invoke).toHaveBeenNthCalledWith(5, "delete_entry", {
      rootPath: "/novel",
      path: "drafts/chapter-1.md",
    });
  });

  it("invokes LM Studio requests with the OpenAI-compatible request shape", async () => {
    const invoke = vi.fn().mockResolvedValue({ content: "Local response." });
    const api = createTauriApi({
      invoke,
      open: vi.fn(),
      writeText: vi.fn(),
    });

    const result = await api.sendLmStudioRequest(
      "http://127.0.0.1:1234/v1",
      "local-model",
      "Revise this scene.",
    );

    expect(invoke).toHaveBeenCalledWith("send_lm_studio_request", {
      request: {
        baseUrl: "http://127.0.0.1:1234/v1",
        model: "local-model",
        prompt: "Revise this scene.",
      },
    });
    expect(result).toBe("Local response.");
  });

  it("invokes subscription CLI agent requests inside the opened project", async () => {
    const invoke = vi.fn().mockResolvedValue({ content: "Built-in response." });
    const api = createTauriApi({
      invoke,
      open: vi.fn(),
      writeText: vi.fn(),
    });

    const result = await api.sendCliAgentRequest(
      "openai-subscription",
      "/novel",
      "Revise this scene.",
      "gpt-5.5",
      "high",
    );

    expect(invoke).toHaveBeenCalledWith("send_cli_agent_request", {
      request: {
        provider: "openai-subscription",
        rootPath: "/novel",
        prompt: "Revise this scene.",
        model: "gpt-5.5",
        effort: "high",
      },
    });
    expect(result).toBe("Built-in response.");
  });

  it("checks provider status and starts terminal login flows", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        provider: "anthropic-subscription",
        installed: true,
        authenticated: true,
        detail: "Connected.",
      })
      .mockResolvedValueOnce(undefined);
    const api = createTauriApi({
      invoke,
      open: vi.fn(),
      writeText: vi.fn(),
    });

    await expect(
      api.checkCliAgentStatus("anthropic-subscription"),
    ).resolves.toEqual(
      expect.objectContaining({
        provider: "anthropic-subscription",
        authenticated: true,
      }),
    );
    await api.startCliAgentLogin("anthropic-subscription");

    expect(invoke).toHaveBeenNthCalledWith(1, "check_cli_agent_status", {
      provider: "anthropic-subscription",
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "start_cli_agent_login", {
      provider: "anthropic-subscription",
    });
  });

  it("loads and saves app settings with camelCase settings payloads", async () => {
    const savedSettings = {
      ...defaultSettings,
      defaultProvider: "anthropic-subscription" as const,
      editorFontSize: 20,
    };
    const invoke = vi
      .fn()
      .mockResolvedValueOnce(savedSettings)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(undefined);
    const api = createTauriApi({
      invoke,
      open: vi.fn(),
      writeText: vi.fn(),
    });

    await expect(api.loadSettings()).resolves.toEqual(savedSettings);
    await expect(api.loadProjectEnv("/novel")).resolves.toBeNull();
    await api.saveSettings(savedSettings);

    expect(invoke).toHaveBeenNthCalledWith(1, "load_settings");
    expect(invoke).toHaveBeenNthCalledWith(2, "load_project_env", {
      rootPath: "/novel",
    });
    expect(invoke).toHaveBeenNthCalledWith(3, "save_settings", {
      settings: savedSettings,
    });
  });

  it("passes tree scan options to the workspace command", async () => {
    const invoke = vi.fn().mockResolvedValue([]);
    const api = createTauriApi({
      invoke,
      open: vi.fn(),
      writeText: vi.fn(),
    });

    await api.readProjectTree("/novel", {
      ignoreHidden: false,
      ignoreLargeFiles: false,
      ignoreBinaryFiles: true,
    });

    expect(invoke).toHaveBeenCalledWith("read_project_tree", {
      rootPath: "/novel",
      options: {
        ignoreHidden: false,
        ignoreLargeFiles: false,
        ignoreBinaryFiles: true,
      },
    });
  });

  it("keeps the browser-rendered shell clean when Tauri is unavailable", async () => {
    const api = createBrowserTauriApi();

    await expect(api.loadSettings()).resolves.toBeNull();
    await expect(api.loadProjectEnv("/novel")).resolves.toBeNull();
    await expect(api.pickProjectFolder()).resolves.toBeNull();
    await expect(api.readProjectTree("/novel")).resolves.toEqual([]);
    await expect(api.readMarkdownFile("/novel", "chapter.md")).rejects.toThrow(
      "Desktop file access is available in the Scriptorium app.",
    );
  });
});
