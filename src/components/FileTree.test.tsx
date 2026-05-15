import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FileTree } from "./FileTree";
import type { FileNode } from "../types";

const nodes: FileNode[] = [
  {
    path: "/novel/chapters",
    relativePath: "chapters",
    name: "chapters",
    extension: "",
    kind: "directory",
    isMarkdown: false,
    modifiedAt: 1,
    size: 0,
    children: [
      {
        path: "/novel/chapters/chapter-1.md",
        relativePath: "chapters/chapter-1.md",
        name: "chapter-1.md",
        extension: "md",
        kind: "file",
        isMarkdown: true,
        modifiedAt: 2,
        size: 120,
      },
      {
        path: "/novel/chapters/cover.png",
        relativePath: "chapters/cover.png",
        name: "cover.png",
        extension: "png",
        kind: "file",
        isMarkdown: false,
        modifiedAt: 3,
        size: 80,
      },
    ],
  },
  {
    path: "/novel/notes.md",
    relativePath: "notes.md",
    name: "notes.md",
    extension: "md",
    kind: "file",
    isMarkdown: true,
    modifiedAt: 4,
    size: 40,
  },
];

describe("FileTree", () => {
  it("renders an open-folder empty state and action", async () => {
    const onOpenFolder = vi.fn();

    render(
      <FileTree
        rootPath={null}
        nodes={[]}
        onOpenFolder={onOpenFolder}
        onOpenFile={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Open Folder" }));

    expect(screen.getByText("No folder open")).toBeInTheDocument();
    expect(onOpenFolder).toHaveBeenCalledOnce();
  });

  it("renders all files recursively", () => {
    render(
      <FileTree
        rootPath="/novel"
        nodes={nodes}
        onOpenFolder={vi.fn()}
        onOpenFile={vi.fn()}
      />,
    );

    expect(screen.getByText("chapters")).toBeInTheDocument();
    expect(screen.getByText("chapter-1.md")).toBeInTheDocument();
    expect(screen.getByText("cover.png")).toBeInTheDocument();
    expect(screen.getByText("notes.md")).toBeInTheDocument();
  });

  it("opens Markdown files when clicked", async () => {
    const onOpenFile = vi.fn();

    render(
      <FileTree
        rootPath="/novel"
        nodes={nodes}
        onOpenFolder={vi.fn()}
        onOpenFile={onOpenFile}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Open chapter-1.md" }),
    );

    expect(onOpenFile).toHaveBeenCalledWith("chapters/chapter-1.md");
  });

  it("does not open non-Markdown files", async () => {
    const onOpenFile = vi.fn();

    render(
      <FileTree
        rootPath="/novel"
        nodes={nodes}
        onOpenFolder={vi.fn()}
        onOpenFile={onOpenFile}
      />,
    );

    await userEvent.click(screen.getByText("cover.png"));

    expect(onOpenFile).not.toHaveBeenCalled();
  });

  it("emits a file operation callback", async () => {
    const onCreateFile = vi.fn();

    render(
      <FileTree
        rootPath="/novel"
        nodes={nodes}
        onOpenFolder={vi.fn()}
        onOpenFile={vi.fn()}
        onCreateFile={onCreateFile}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "New File" }));

    expect(onCreateFile).toHaveBeenCalledWith("");
  });
});
