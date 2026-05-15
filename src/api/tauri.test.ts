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
});
