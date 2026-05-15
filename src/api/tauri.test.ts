import { describe, expect, it, vi } from "vitest";
import { createTauriApi } from "./tauri";
import type { FileNode } from "../types";

describe("createTauriApi", () => {
  it("opens a project folder and reads its project tree", async () => {
    const tree: FileNode[] = [
      {
        path: "/novel/chapter-1.md",
        relativePath: "chapter-1.md",
        name: "chapter-1.md",
        extension: "md",
        kind: "file",
        isMarkdown: true,
        modifiedAt: 10,
        size: 42,
      },
    ];
    const open = vi.fn().mockResolvedValue("/novel");
    const invoke = vi.fn().mockResolvedValue(tree);
    const api = createTauriApi({
      invoke,
      open,
      writeText: vi.fn(),
      openUrl: vi.fn(),
    });

    const result = await api.pickProjectFolder();

    expect(open).toHaveBeenCalledWith({ directory: true, multiple: false });
    expect(invoke).toHaveBeenCalledWith("read_project_tree", {
      rootPath: "/novel",
    });
    expect(result).toEqual({ rootPath: "/novel", tree });
  });

  it("invokes file operation commands with typed arguments", async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    const api = createTauriApi({
      invoke,
      open: vi.fn(),
      writeText: vi.fn(),
      openUrl: vi.fn(),
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
});
