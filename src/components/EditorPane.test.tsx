import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { EditorPane } from "./EditorPane";

const tiptap = vi.hoisted(() => ({
  lastOptions: undefined as
    | {
        editorProps?: { attributes?: Record<string, string> };
        onUpdate?: (props: { editor: { getMarkdown: () => string } }) => void;
      }
    | undefined,
}));

vi.mock("@tiptap/react", () => ({
  useEditor: vi.fn((options) => {
    tiptap.lastOptions = options;

    return {
      commands: {
        setContent: vi.fn(),
      },
      editorProps: options.editorProps,
      getMarkdown: vi.fn(() => ""),
    };
  }),
  EditorContent: ({
    editor,
    className,
  }: {
    editor: {
      editorProps?: { attributes?: Record<string, string> };
    } | null;
    className?: string;
    children?: ReactNode;
  }) => (
    <div className={className}>
      <div
        aria-label={editor?.editorProps?.attributes?.["aria-label"]}
        contentEditable="true"
        role="textbox"
      />
    </div>
  ),
}));

describe("EditorPane", () => {
  it("renders an empty state when no file is open", () => {
    render(
      <EditorPane
        openFile={null}
        markdown=""
        isDirty={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText("No file open")).toBeInTheDocument();
  });

  it("renders dirty status and file metadata", () => {
    render(
      <EditorPane
        openFile={{ relativePath: "chapters/chapter-1.md", name: "chapter-1.md" }}
        markdown="# Chapter 1"
        isDirty={true}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText("chapter-1.md")).toBeInTheDocument();
    expect(screen.getByText("chapters/chapter-1.md")).toBeInTheDocument();
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("gives the editor surface an accessible name", () => {
    render(
      <EditorPane
        openFile={{ relativePath: "chapters/chapter-1.md", name: "chapter-1.md" }}
        markdown="# Chapter 1"
        isDirty={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("textbox", { name: "Manuscript editor" }),
    ).toBeInTheDocument();
  });

  it("emits live markdown changes without save-time normalization", () => {
    const onChange = vi.fn();
    render(
      <EditorPane
        openFile={{ relativePath: "chapters/chapter-1.md", name: "chapter-1.md" }}
        markdown="# Chapter 1"
        isDirty={false}
        onChange={onChange}
        onSave={vi.fn()}
      />,
    );

    act(() => {
      tiptap.lastOptions?.onUpdate?.({
        editor: { getMarkdown: () => "# Chapter 1  " },
      });
    });

    expect(onChange).toHaveBeenCalledWith("# Chapter 1  ");
  });
});
