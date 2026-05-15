import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-dialog";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import type { AppSettings, FileNode, OpenFile } from "../types";

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type OpenDialog = (options: {
  directory: true;
  multiple: false;
}) => Promise<string | string[] | null>;
type WriteText = (text: string) => Promise<void>;
type OpenUrl = (url: string) => Promise<void>;

export interface TauriApiDeps {
  invoke: Invoke;
  open: OpenDialog;
  writeText: WriteText;
  openUrl: OpenUrl;
}

export interface TauriApi {
  pickProjectFolder(): Promise<{ rootPath: string; tree: FileNode[] } | null>;
  readProjectTree(
    rootPath: string,
    options?: Pick<
      AppSettings,
      "ignoreHidden" | "ignoreLargeFiles" | "ignoreBinaryFiles"
    >,
  ): Promise<FileNode[]>;
  readMarkdownFile(rootPath: string, filePath: string): Promise<OpenFile>;
  writeMarkdownFile(
    rootPath: string,
    filePath: string,
    markdown: string,
  ): Promise<void>;
  createFile(rootPath: string, relativePath: string): Promise<void>;
  createFolder(rootPath: string, relativePath: string): Promise<void>;
  renameEntry(rootPath: string, path: string, newName: string): Promise<void>;
  deleteEntry(rootPath: string, path: string): Promise<void>;
  moveEntry(
    rootPath: string,
    path: string,
    newRelativePath: string,
  ): Promise<void>;
  copyText(text: string): Promise<void>;
  openExternal(url: string): Promise<void>;
  loadSettings(): Promise<AppSettings | null>;
  loadProjectEnv(rootPath: string): Promise<string | null>;
  saveSettings(settings: AppSettings): Promise<void>;
  sendLmStudioRequest(
    baseUrl: string,
    model: string,
    prompt: string,
  ): Promise<string>;
  sendCliAgentRequest(
    provider: "openai-subscription" | "anthropic-subscription",
    rootPath: string,
    prompt: string,
  ): Promise<string>;
}

export function createTauriApi(deps: TauriApiDeps): TauriApi {
  const readProjectTree = (
    rootPath: string,
    options?: Pick<
      AppSettings,
      "ignoreHidden" | "ignoreLargeFiles" | "ignoreBinaryFiles"
    >,
  ) =>
    deps.invoke<FileNode[]>(
      "read_project_tree",
      options
        ? {
            rootPath,
            options: {
              ignoreHidden: options.ignoreHidden,
              ignoreLargeFiles: options.ignoreLargeFiles,
              ignoreBinaryFiles: options.ignoreBinaryFiles,
            },
          }
        : { rootPath },
    );

  return {
    async pickProjectFolder() {
      const selected = await deps.open({ directory: true, multiple: false });

      if (typeof selected !== "string") {
        return null;
      }

      const tree = await readProjectTree(selected);

      return { rootPath: selected, tree };
    },

    readProjectTree(rootPath, options) {
      return readProjectTree(rootPath, options);
    },

    readMarkdownFile(rootPath, filePath) {
      return deps.invoke<OpenFile>("read_markdown_file", { rootPath, filePath });
    },

    writeMarkdownFile(rootPath, filePath, markdown) {
      return deps.invoke<void>("write_markdown_file", {
        request: { rootPath, filePath, markdown },
      });
    },

    createFile(rootPath, relativePath) {
      return deps.invoke<void>("create_file", { rootPath, relativePath });
    },

    createFolder(rootPath, relativePath) {
      return deps.invoke<void>("create_folder", { rootPath, relativePath });
    },

    renameEntry(rootPath, path, newName) {
      return deps.invoke<void>("rename_entry", { rootPath, path, newName });
    },

    deleteEntry(rootPath, path) {
      return deps.invoke<void>("delete_entry", { rootPath, path });
    },

    moveEntry(rootPath, path, newRelativePath) {
      return deps.invoke<void>("move_entry", {
        rootPath,
        path,
        newRelativePath,
      });
    },

    copyText(text) {
      return deps.writeText(text);
    },

    openExternal(url) {
      return deps.openUrl(url);
    },

    loadSettings() {
      return deps.invoke<AppSettings | null>("load_settings");
    },

    loadProjectEnv(rootPath) {
      return deps.invoke<string | null>("load_project_env", { rootPath });
    },

    saveSettings(settings) {
      return deps.invoke<void>("save_settings", { settings });
    },

    async sendLmStudioRequest(baseUrl, model, prompt) {
      const response = await deps.invoke<{ content: string }>(
        "send_lm_studio_request",
        {
          request: { baseUrl, model, prompt },
        },
      );

      return response.content;
    },

    async sendCliAgentRequest(provider, rootPath, prompt) {
      const response = await deps.invoke<{ content: string }>(
        "send_cli_agent_request",
        {
          request: { provider, rootPath, prompt },
        },
      );

      return response.content;
    },
  };
}

export function createBrowserTauriApi(): TauriApi {
  return createTauriApi({
    async invoke<T>(command: string): Promise<T> {
      if (command === "load_settings" || command === "load_project_env") {
        return null as T;
      }

      if (command === "read_project_tree") {
        return [] as T;
      }

      throw new Error("Desktop file access is available in the DraftAgent app.");
    },
    async open() {
      return null;
    },
    async writeText(text) {
      await navigator.clipboard?.writeText(text);
    },
    async openUrl(url) {
      window.open(url, "_blank", "noopener,noreferrer");
    },
  });
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export const tauriApi = isTauriRuntime()
  ? createTauriApi({
      invoke,
      open,
      writeText,
      openUrl,
    })
  : createBrowserTauriApi();
