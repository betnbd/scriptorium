import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-dialog";
import type { AppSettings, FileNode, OpenFile, ProviderStatus } from "../types";

const DEFAULT_PROJECT_FOLDER = "/home/ben/Personal/03_Creative";

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type OpenDialog = (options: {
  directory?: boolean;
  multiple: false;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}) => Promise<string | string[] | null>;
type WriteText = (text: string) => Promise<void>;

export interface PickedMarkdownFile {
  rootPath: string;
  filePath: string;
}

export interface TauriApiDeps {
  invoke: Invoke;
  open: OpenDialog;
  writeText: WriteText;
}

export interface TauriApi {
  pickProjectFolder(): Promise<string | null>;
  pickMarkdownFile(): Promise<PickedMarkdownFile | null>;
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
    model: string,
    effort?: string,
  ): Promise<string>;
  checkCliAgentStatus(
    provider: "openai-subscription" | "anthropic-subscription",
  ): Promise<ProviderStatus>;
  startCliAgentLogin(
    provider: "openai-subscription" | "anthropic-subscription",
  ): Promise<void>;
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
      const selected = await deps.open({
        directory: true,
        multiple: false,
        defaultPath: DEFAULT_PROJECT_FOLDER,
      });

      if (typeof selected !== "string") {
        return null;
      }

      return selected;
    },

    async pickMarkdownFile() {
      const selected = await deps.open({
        multiple: false,
        defaultPath: DEFAULT_PROJECT_FOLDER,
        filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
      });

      if (typeof selected !== "string") {
        return null;
      }

      const separatorIndex = Math.max(
        selected.lastIndexOf("/"),
        selected.lastIndexOf("\\"),
      );

      if (separatorIndex <= 0 || separatorIndex === selected.length - 1) {
        return null;
      }

      return {
        rootPath: selected.slice(0, separatorIndex),
        filePath: selected.slice(separatorIndex + 1),
      };
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

    async sendCliAgentRequest(provider, rootPath, prompt, model, effort) {
      const response = await deps.invoke<{ content: string }>(
        "send_cli_agent_request",
        {
          request: { provider, rootPath, prompt, model, effort },
        },
      );

      return response.content;
    },

    checkCliAgentStatus(provider) {
      return deps.invoke<ProviderStatus>("check_cli_agent_status", {
        provider,
      });
    },

    startCliAgentLogin(provider) {
      return deps.invoke<void>("start_cli_agent_login", {
        provider,
      });
    },
  };
}

export function createBrowserTauriApi(): TauriApi {
  return createTauriApi({
    async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
      if (command === "load_settings" || command === "load_project_env") {
        return null as T;
      }

      if (command === "save_settings") {
        return undefined as T;
      }

      if (command === "read_project_tree") {
        return [] as T;
      }

      if (command === "check_cli_agent_status") {
        return {
          provider: args?.provider,
          installed: false,
          authenticated: false,
          detail: "Provider status is available in the desktop app.",
        } as T;
      }

      throw new Error("Desktop file access is available in the Scriptorium app.");
    },
    async open() {
      return null;
    },
    async writeText(text) {
      await navigator.clipboard?.writeText(text);
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
    })
  : createBrowserTauriApi();
