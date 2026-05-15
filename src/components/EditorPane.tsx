import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";

interface EditorPaneProps {
  openFile: { relativePath: string; name: string } | null;
  markdown: string;
  isDirty: boolean;
  onChange: (markdown: string) => void;
  onSave: () => void;
}

export function EditorPane({
  openFile,
  markdown,
  isDirty,
  onChange,
  onSave,
}: EditorPaneProps) {
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
  });

  useEffect(() => {
    if (!editor || !openFile) {
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

  if (!openFile) {
    return (
      <section className="editor-pane">
        <div className="editor-empty">No file open</div>
      </section>
    );
  }

  return (
    <section className="editor-pane">
      <header className="editor-header">
        <div>
          <h1>{openFile.name}</h1>
          <p>{openFile.relativePath}</p>
        </div>
        <div className="editor-actions">
          <span className={isDirty ? "status-dirty" : "status-saved"}>
            {isDirty ? "Unsaved" : "Saved"}
          </span>
          <button type="button" onClick={onSave} disabled={!isDirty}>
            Save
          </button>
        </div>
      </header>
      <EditorContent editor={editor} className="manuscript-editor" />
    </section>
  );
}
