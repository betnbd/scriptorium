import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditorPane } from "./EditorPane";

const tiptap = vi.hoisted(() => ({
  useEditorCalls: 0,
  lastOptions: undefined as
    | {
        editorProps?: { attributes?: Record<string, string> };
        onUpdate?: (props: { editor: { getMarkdown: () => string } }) => void;
        onSelectionUpdate?: (props: {
          editor: {
            state: {
              selection: { empty: boolean; from: number; to: number };
              doc: { textBetween: (from: number, to: number, separator: string) => string };
            };
          };
        }) => void;
      }
    | undefined,
}));

vi.mock("@tiptap/react", () => ({
  useEditor: vi.fn((options) => {
    tiptap.useEditorCalls += 1;
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
  beforeEach(() => {
    tiptap.useEditorCalls = 0;
    tiptap.lastOptions = undefined;
  });

  it("renders an empty state when no file is open", () => {
    const onOpenFolder = vi.fn();

    render(
      <EditorPane
        openFile={null}
        markdown=""
        mode="visual"
        isDirty={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onOpenFolder={onOpenFolder}
        onModeChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("No file open")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open manuscript folder" }),
    ).toBeInTheDocument();
  });

  it("renders dirty status and file metadata", () => {
    render(
      <EditorPane
        openFile={{ relativePath: "chapters/chapter-1.md", name: "chapter-1.md" }}
        markdown="# Chapter 1"
        mode="visual"
        isDirty={true}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onModeChange={vi.fn()}
      />,
    );

    expect(screen.getByText("chapter-1.md")).toBeInTheDocument();
    expect(screen.getByText("chapters/chapter-1.md")).toBeInTheDocument();
    expect(screen.getByText("2 words")).toBeInTheDocument();
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("shows when an AI edit is staged separately from dirty state", () => {
    render(
      <EditorPane
        openFile={{ relativePath: "chapters/chapter-1.md", name: "chapter-1.md" }}
        markdown="# Chapter 1"
        mode="visual"
        isDirty={true}
        isAiEditStaged={true}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onModeChange={vi.fn()}
      />,
    );

    expect(screen.getByText("AI edit staged")).toBeInTheDocument();
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
  });

  it("gives the editor surface an accessible name", () => {
    render(
      <EditorPane
        openFile={{ relativePath: "chapters/chapter-1.md", name: "chapter-1.md" }}
        markdown="# Chapter 1"
        mode="visual"
        isDirty={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onModeChange={vi.fn()}
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
        mode="visual"
        isDirty={false}
        onChange={onChange}
        onSave={vi.fn()}
        onModeChange={vi.fn()}
      />,
    );

    act(() => {
      tiptap.lastOptions?.onUpdate?.({
        editor: { getMarkdown: () => "# Chapter 1  " },
      });
    });

    expect(onChange).toHaveBeenCalledWith("# Chapter 1  ");
  });

  it("emits selected editor text for assistant targeting", () => {
    const onSelectionChange = vi.fn();
    render(
      <EditorPane
        openFile={{ relativePath: "chapters/chapter-1.md", name: "chapter-1.md" }}
        markdown="# Chapter 1"
        mode="visual"
        isDirty={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onModeChange={vi.fn()}
        onSelectionChange={onSelectionChange}
      />,
    );

    act(() => {
      tiptap.lastOptions?.onSelectionUpdate?.({
        editor: {
          state: {
            selection: { empty: false, from: 3, to: 16 },
            doc: {
              textBetween: vi.fn(() => "Selected line."),
            },
          },
        },
      });
    });

    expect(onSelectionChange).toHaveBeenCalledWith("Selected line.");
  });

  it("uses large-file visual preview without mounting the rich editor", () => {
    const onChange = vi.fn();
    const largeMarkdown = `# Manuscript\n\n*Opening line.*\n\n${"Long line.\n".repeat(20_000)}`;

    render(
      <EditorPane
        openFile={{ relativePath: "MANUSCRIPT.md", name: "MANUSCRIPT.md" }}
        markdown={largeMarkdown}
        mode="visual"
        isDirty={false}
        onChange={onChange}
        onSave={vi.fn()}
        onModeChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Large visual preview")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Large file visual preview"),
    ).toBeInTheDocument();
    expect(screen.getByText("Opening line.")).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Markdown source editor" }),
    ).not.toBeInTheDocument();
    expect(tiptap.useEditorCalls).toBe(0);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("uses editable markdown source mode for large files", () => {
    const onChange = vi.fn();
    const largeMarkdown = `# Manuscript\n\n${"Long line.\n".repeat(20_000)}`;

    render(
      <EditorPane
        openFile={{ relativePath: "MANUSCRIPT.md", name: "MANUSCRIPT.md" }}
        markdown={largeMarkdown}
        mode="markdown"
        isDirty={false}
        onChange={onChange}
        onSave={vi.fn()}
        onModeChange={vi.fn()}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "Markdown source editor" });

    expect(screen.getByText("Large editable source")).toBeInTheDocument();
    expect(tiptap.useEditorCalls).toBe(0);
    fireEvent.change(editor, { target: { value: "# Revised" } });

    expect(onChange).toHaveBeenCalledWith("# Revised");
  });

  it("switches between visual and markdown source modes", async () => {
    const onModeChange = vi.fn();

    render(
      <EditorPane
        openFile={{ relativePath: "chapters/chapter-1.md", name: "chapter-1.md" }}
        markdown="# Chapter 1"
        mode="visual"
        isDirty={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onModeChange={onModeChange}
      />,
    );

    expect(screen.getByRole("radio", { name: "Visual" })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "Markdown" }));

    expect(onModeChange).toHaveBeenCalledWith("markdown");
  });

  it("uses source mode for plain markdown editing", () => {
    const onChange = vi.fn();

    render(
      <EditorPane
        openFile={{ relativePath: "chapters/chapter-1.md", name: "chapter-1.md" }}
        markdown="# Chapter 1"
        mode="markdown"
        isDirty={false}
        onChange={onChange}
        onSave={vi.fn()}
        onModeChange={vi.fn()}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "Markdown source editor" });

    expect(screen.getByRole("radio", { name: "Markdown" })).toBeChecked();
    expect(tiptap.useEditorCalls).toBe(0);

    fireEvent.change(editor, { target: { value: "# Revised" } });

    expect(onChange).toHaveBeenCalledWith("# Revised");
  });
});
