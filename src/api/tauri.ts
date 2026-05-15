import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-dialog";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import type { FileNode, OpenFile } from "../types";

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
  readProjectTree(rootPath: string): Promise<FileNode[]>;
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
}

export function createTauriApi(deps: TauriApiDeps): TauriApi {
  const readProjectTree = (rootPath: string) =>
    deps.invoke<FileNode[]>("read_project_tree", { rootPath });

  return {
    async pickProjectFolder() {
      const selected = await deps.open({ directory: true, multiple: false });

      if (typeof selected !== "string") {
        return null;
      }

      const tree = await readProjectTree(selected);

      return { rootPath: selected, tree };
    },

    readProjectTree(rootPath) {
      return readProjectTree(rootPath);
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
  };
}

export const tauriApi = createTauriApi({
  invoke,
  open,
  writeText,
  openUrl,
});
