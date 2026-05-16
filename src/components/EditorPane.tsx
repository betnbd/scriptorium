import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { ChangeEvent, ReactNode, SyntheticEvent } from "react";
import { useEffect, useRef } from "react";

interface EditorPaneProps {
  openFile: { relativePath: string; name: string } | null;
  markdown: string;
  isDirty: boolean;
  onChange: (markdown: string) => void;
  onSave: () => void;
  onSelectionChange?: (markdown: string | null) => void;
}

const LARGE_MARKDOWN_EDITOR_LIMIT = 60_000;

export function EditorPane({
  openFile,
  markdown,
  isDirty,
  onChange,
  onSave,
  onSelectionChange,
}: EditorPaneProps) {
  if (!openFile) {
    return (
      <section className="editor-pane editor-pane-empty" aria-label="No file open" />
    );
  }

  if (shouldUseLargeFileEditor(markdown)) {
    return (
      <LargeMarkdownEditor
        openFile={openFile}
        markdown={markdown}
        isDirty={isDirty}
        onChange={onChange}
        onSave={onSave}
        onSelectionChange={onSelectionChange}
      />
    );
  }

  return (
    <RichMarkdownEditor
      openFile={openFile}
      markdown={markdown}
      isDirty={isDirty}
      onChange={onChange}
      onSave={onSave}
      onSelectionChange={onSelectionChange}
    />
  );
}

function RichMarkdownEditor({
  openFile,
  markdown,
  isDirty,
  onChange,
  onSave,
  onSelectionChange,
}: EditorPaneProps & {
  openFile: NonNullable<EditorPaneProps["openFile"]>;
}) {
  const loadedContent = useRef<{
    relativePath: string;
    markdown: string;
  } | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: markdown,
    contentType: "markdown",
    editorProps: {
      attributes: {
        "aria-label": "Manuscript editor",
      },
    },
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getMarkdown());
    },
    onSelectionUpdate: ({ editor }) => {
      const { selection, doc } = editor.state;

      if (selection.empty) {
        onSelectionChange?.(null);
        return;
      }

      const selectedText = doc.textBetween(selection.from, selection.to, "\n\n");
      onSelectionChange?.(selectedText.trim() ? selectedText : null);
    },
  });

  useEffect(() => {
    if (!editor) {
      loadedContent.current = null;
      return;
    }

    const isDifferentFile =
      loadedContent.current?.relativePath !== openFile.relativePath;
    const isExternalMarkdownChange =
      loadedContent.current?.markdown !== markdown &&
      editor.getMarkdown() !== markdown;

    if (isDifferentFile || isExternalMarkdownChange) {
      editor.commands.setContent(markdown, {
        contentType: "markdown",
        emitUpdate: false,
      });
    }

    loadedContent.current = {
      relativePath: openFile.relativePath,
      markdown,
    };
  }, [editor, markdown, openFile]);

  return (
    <section className="editor-pane">
      <EditorHeader openFile={openFile} isDirty={isDirty} onSave={onSave} />
      <EditorContent editor={editor} className="manuscript-editor" />
    </section>
  );
}

function LargeMarkdownEditor({
  openFile,
  markdown,
  isDirty,
  onChange,
  onSave,
  onSelectionChange,
}: EditorPaneProps & {
  openFile: NonNullable<EditorPaneProps["openFile"]>;
}) {
  function updateSelection(event: SyntheticEvent<HTMLTextAreaElement>) {
    const target = event.currentTarget;
    const selectedText = target.value.slice(
      target.selectionStart,
      target.selectionEnd,
    );

    onSelectionChange?.(selectedText.trim() ? selectedText : null);
  }

  return (
    <section className="editor-pane">
      <EditorHeader openFile={openFile} isDirty={isDirty} onSave={onSave}>
        <span className="status-large">Large file mode</span>
      </EditorHeader>
      <textarea
        aria-label="Large Markdown editor"
        className="large-markdown-editor"
        value={markdown}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
          onChange(event.currentTarget.value)
        }
        onKeyUp={updateSelection}
        onPointerUp={updateSelection}
        spellCheck
      />
    </section>
  );
}

function EditorHeader({
  openFile,
  isDirty,
  onSave,
  children,
}: {
  openFile: NonNullable<EditorPaneProps["openFile"]>;
  isDirty: boolean;
  onSave: () => void;
  children?: ReactNode;
}) {
  return (
    <header className="editor-header">
      <div>
        <h1>{openFile.name}</h1>
        <p>{openFile.relativePath}</p>
      </div>
      <div className="editor-actions">
        {children}
        <span className={isDirty ? "status-dirty" : "status-saved"}>
          {isDirty ? "Unsaved" : "Saved"}
        </span>
        <button type="button" onClick={onSave} disabled={!isDirty}>
          Save
        </button>
      </div>
    </header>
  );
}

function shouldUseLargeFileEditor(markdown: string): boolean {
  return markdown.length > LARGE_MARKDOWN_EDITOR_LIMIT;
}
