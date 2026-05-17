import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { FileText, FolderOpen } from "lucide-react";
import type { ChangeEvent, ReactNode, SyntheticEvent } from "react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

export type EditorMode = "visual" | "markdown";

export type EditorCommand =
  | "undo"
  | "redo"
  | "cut"
  | "copy"
  | "paste"
  | "selectAll"
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "heading4"
  | "heading5"
  | "heading6"
  | "blockquote"
  | "orderedList"
  | "bulletList"
  | "codeBlock"
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "inlineCode"
  | "link"
  | "clearFormat";

export interface EditorPaneHandle {
  runCommand: (command: EditorCommand) => void;
}

interface EditorPaneProps {
  openFile: { relativePath: string; name: string } | null;
  markdown: string;
  mode: EditorMode;
  isDirty: boolean;
  isAiEditStaged?: boolean;
  onChange: (markdown: string) => void;
  onSave: () => void;
  onOpenFolder?: () => void;
  onOpenFile?: () => void;
  onModeChange: (mode: EditorMode) => void;
  onSelectionChange?: (markdown: string | null) => void;
}

const LARGE_MARKDOWN_EDITOR_LIMIT = 60_000;

export const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(function EditorPane(
  {
    openFile,
    markdown,
    mode,
    isDirty,
    isAiEditStaged = false,
    onChange,
    onSave,
    onOpenFolder,
    onOpenFile,
    onModeChange,
    onSelectionChange,
  },
  ref,
) {
  if (!openFile) {
    return (
      <section className="editor-pane editor-pane-empty" aria-label="No file open">
        {onOpenFolder ? (
          <button
            type="button"
            aria-label="Open manuscript folder"
            onClick={onOpenFolder}
          >
            <FolderOpen aria-hidden="true" size={16} />
            Open Folder
          </button>
        ) : null}
        {onOpenFile ? (
          <button
            type="button"
            aria-label="Open markdown file"
            onClick={onOpenFile}
          >
            <FileText aria-hidden="true" size={16} />
            Open File
          </button>
        ) : null}
      </section>
    );
  }

  if (shouldUseLargeFileEditor(markdown)) {
    return (
      <LargeMarkdownEditor
        ref={ref}
        openFile={openFile}
        markdown={markdown}
        mode={mode}
        isDirty={isDirty}
        isAiEditStaged={isAiEditStaged}
        onChange={onChange}
        onSave={onSave}
        onModeChange={onModeChange}
        onSelectionChange={onSelectionChange}
      />
    );
  }

  if (mode === "markdown") {
    return (
      <SourceMarkdownEditor
        ref={ref}
        openFile={openFile}
        markdown={markdown}
        mode={mode}
        isDirty={isDirty}
        isAiEditStaged={isAiEditStaged}
        onChange={onChange}
        onSave={onSave}
        onModeChange={onModeChange}
        onSelectionChange={onSelectionChange}
      />
    );
  }

  return (
    <RichMarkdownEditor
      ref={ref}
      openFile={openFile}
      markdown={markdown}
      mode={mode}
      isDirty={isDirty}
      isAiEditStaged={isAiEditStaged}
      onChange={onChange}
      onSave={onSave}
      onModeChange={onModeChange}
      onSelectionChange={onSelectionChange}
    />
  );
});

const RichMarkdownEditor = forwardRef<EditorPaneHandle, EditorPaneProps & {
  openFile: NonNullable<EditorPaneProps["openFile"]>;
}>(function RichMarkdownEditor({
  openFile,
  markdown,
  mode,
  isDirty,
  isAiEditStaged,
  onChange,
  onSave,
  onModeChange,
  onSelectionChange,
}, ref) {
  const loadedContent = useRef<{
    relativePath: string;
    markdown: string;
  } | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Underline, Markdown],
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

  useImperativeHandle(
    ref,
    () => ({
      runCommand(command) {
        if (!editor) {
          return;
        }

        runRichEditorCommand(editor, command);
      },
    }),
    [editor],
  );

  return (
    <section className="editor-pane">
      <EditorHeader
        markdown={markdown}
        mode={mode}
        openFile={openFile}
        isDirty={isDirty}
        isAiEditStaged={isAiEditStaged}
        onSave={onSave}
        onModeChange={onModeChange}
      />
      <EditorContent editor={editor} className="manuscript-editor" />
    </section>
  );
});

const SourceMarkdownEditor = forwardRef<
  EditorPaneHandle,
  EditorPaneProps & {
    children?: ReactNode;
    openFile: NonNullable<EditorPaneProps["openFile"]>;
  }
>(function SourceMarkdownEditor(
  {
    openFile,
    markdown,
    mode,
    isDirty,
    isAiEditStaged,
    onChange,
    onSave,
    onModeChange,
    onSelectionChange,
    children,
  },
  ref,
) {
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      runCommand(command) {
        const textarea = editorRef.current;

        if (!textarea) {
          return;
        }

        runMarkdownSourceCommand({
          command,
          markdown,
          textarea,
          onChange,
        });
      },
    }),
    [markdown, onChange],
  );

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
      <EditorHeader
        markdown={markdown}
        mode={mode}
        openFile={openFile}
        isDirty={isDirty}
        isAiEditStaged={isAiEditStaged}
        onSave={onSave}
        onModeChange={onModeChange}
      >
        {children}
      </EditorHeader>
      <textarea
        aria-label="Markdown source editor"
        className="source-markdown-editor"
        ref={editorRef}
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
});

const LargeMarkdownEditor = forwardRef<
  EditorPaneHandle,
  EditorPaneProps & {
    openFile: NonNullable<EditorPaneProps["openFile"]>;
  }
>(function LargeMarkdownEditor(props, ref) {
  if (props.mode === "markdown") {
    return (
      <SourceMarkdownEditor ref={ref} {...props}>
        <span className="status-large">Large editable source</span>
      </SourceMarkdownEditor>
    );
  }

  return <LargeVisualPreview ref={ref} {...props} />;
});

const LargeVisualPreview = forwardRef<
  EditorPaneHandle,
  EditorPaneProps & {
    openFile: NonNullable<EditorPaneProps["openFile"]>;
  }
>(function LargeVisualPreview(
  {
    openFile,
    markdown,
    mode,
    isDirty,
    isAiEditStaged,
    onSave,
    onModeChange,
    onSelectionChange,
  },
  ref,
) {
  const previewRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      runCommand(command) {
        if (command === "selectAll") {
          const preview = previewRef.current;
          if (!preview) {
            return;
          }

          const range = document.createRange();
          range.selectNodeContents(preview);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      },
    }),
    [],
  );

  function updateSelection() {
    const selectedText = window.getSelection()?.toString().trim() ?? "";
    onSelectionChange?.(selectedText || null);
  }

  return (
    <section className="editor-pane">
      <EditorHeader
        markdown={markdown}
        mode={mode}
        openFile={openFile}
        isDirty={isDirty}
        isAiEditStaged={isAiEditStaged}
        onSave={onSave}
        onModeChange={onModeChange}
      >
        <span className="status-large">Large visual preview</span>
      </EditorHeader>
      <div
        aria-label="Large file visual preview"
        className="large-visual-preview"
        onKeyUp={updateSelection}
        onPointerUp={updateSelection}
        ref={previewRef}
        tabIndex={0}
      >
        {renderLargeMarkdownPreview(markdown)}
      </div>
    </section>
  );
});

function EditorHeader({
  openFile,
  markdown,
  mode,
  isDirty,
  isAiEditStaged,
  onSave,
  onModeChange,
  children,
}: {
  openFile: NonNullable<EditorPaneProps["openFile"]>;
  markdown: string;
  mode: EditorMode;
  isDirty: boolean;
  isAiEditStaged?: boolean;
  onSave: () => void;
  onModeChange: (mode: EditorMode) => void;
  children?: ReactNode;
}) {
  const wordCount = countWords(markdown);

  return (
    <header className="editor-header">
      <div>
        <h1>{openFile.name}</h1>
        <p>{openFile.relativePath}</p>
      </div>
      <div className="editor-actions">
        <div aria-label="Editor mode" className="editor-mode-segment" role="radiogroup">
          <label className={mode === "visual" ? "is-active" : ""}>
            <input
              checked={mode === "visual"}
              name="editor-mode"
              onChange={() => onModeChange("visual")}
              type="radio"
              value="visual"
            />
            <span>Visual</span>
          </label>
          <label className={mode === "markdown" ? "is-active" : ""}>
            <input
              checked={mode === "markdown"}
              name="editor-mode"
              onChange={() => onModeChange("markdown")}
              type="radio"
              value="markdown"
            />
            <span>Markdown</span>
          </label>
        </div>
        {children}
        <span className="status-word-count">{formatWordCount(wordCount)}</span>
        {isAiEditStaged ? (
          <span className="status-ai-staged">AI edit staged</span>
        ) : null}
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

function countWords(markdown: string): number {
  return markdown.match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function formatWordCount(count: number): string {
  return count === 1 ? "1 word" : `${count.toLocaleString()} words`;
}

function renderLargeMarkdownPreview(markdown: string): ReactNode[] {
  return markdown
    .split(/\n{2,}/)
    .map((block, index) => renderLargeMarkdownBlock(block, index))
    .filter((block): block is ReactNode => block !== null);
}

function renderLargeMarkdownBlock(block: string, index: number): ReactNode | null {
  const trimmed = block.trim();
  if (!trimmed) {
    return null;
  }

  const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
  if (heading) {
    const level = Math.min(heading[1].length, 3);
    const Tag = `h${level}` as "h1" | "h2" | "h3";

    return <Tag key={index}>{cleanInlineMarkdown(heading[2])}</Tag>;
  }

  if (/^[-*_]{3,}$/.test(trimmed)) {
    return <hr key={index} />;
  }

  if (trimmed.startsWith(">")) {
    return (
      <blockquote key={index}>
        {cleanInlineMarkdown(trimmed.replace(/^>\s?/gm, ""))}
      </blockquote>
    );
  }

  return <p key={index}>{cleanInlineMarkdown(trimmed.replace(/\n/g, " "))}</p>;
}

function cleanInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1");
}

function runRichEditorCommand(
  editor: {
    chain: () => any;
    commands: { insertContent?: (value: string) => boolean };
    state?: {
      selection?: { from: number; to: number; empty: boolean };
      doc?: { textBetween: (from: number, to: number, separator: string) => string };
    };
  },
  command: EditorCommand,
) {
  const chain = editor.chain().focus();

  if (command === "undo") {
    chain.undo().run();
    return;
  }

  if (command === "redo") {
    chain.redo().run();
    return;
  }

  if (command === "cut" || command === "copy" || command === "paste") {
    chain.run();
    document.execCommand(command);
    return;
  }

  if (command === "selectAll") {
    chain.selectAll().run();
    return;
  }

  if (command.startsWith("heading")) {
    const level = Number(command.replace("heading", ""));
    chain.toggleHeading({ level }).run();
    return;
  }

  if (command === "paragraph") {
    chain.setParagraph().run();
    return;
  }

  if (command === "blockquote") {
    chain.toggleBlockquote().run();
    return;
  }

  if (command === "orderedList") {
    chain.toggleOrderedList().run();
    return;
  }

  if (command === "bulletList") {
    chain.toggleBulletList().run();
    return;
  }

  if (command === "codeBlock") {
    chain.toggleCodeBlock().run();
    return;
  }

  if (command === "bold") {
    chain.toggleBold().run();
    return;
  }

  if (command === "italic") {
    chain.toggleItalic().run();
    return;
  }

  if (command === "underline") {
    chain.toggleUnderline().run();
    return;
  }

  if (command === "strike") {
    chain.toggleStrike().run();
    return;
  }

  if (command === "inlineCode") {
    chain.toggleCode().run();
    return;
  }

  if (command === "link") {
    insertMarkdownLink(editor);
    return;
  }

  if (command === "clearFormat") {
    chain.unsetAllMarks().clearNodes().run();
  }
}

function insertMarkdownLink(editor: {
  commands: { insertContent?: (value: string) => boolean };
  state?: {
    selection?: { from: number; to: number; empty: boolean };
    doc?: { textBetween: (from: number, to: number, separator: string) => string };
  };
}) {
  const url = window.prompt("Link URL");

  if (!url?.trim()) {
    return;
  }

  const selection = editor.state?.selection;
  const selectedText =
    selection && !selection.empty
      ? editor.state?.doc?.textBetween(selection.from, selection.to, "\n")?.trim()
      : "";

  editor.commands.insertContent?.(`[${selectedText || "link"}](${url.trim()})`);
}

function runMarkdownSourceCommand({
  command,
  markdown,
  textarea,
  onChange,
}: {
  command: EditorCommand;
  markdown: string;
  textarea: HTMLTextAreaElement;
  onChange: (markdown: string) => void;
}) {
  if (command === "cut" || command === "copy" || command === "paste") {
    textarea.focus();
    document.execCommand(command);
    return;
  }

  if (command === "selectAll") {
    textarea.focus();
    textarea.select();
    return;
  }

  if (command === "undo" || command === "redo") {
    textarea.focus();
    document.execCommand(command);
    return;
  }

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = markdown.slice(start, end);
  let replacement = selected;
  let nextSelectionStart = start;
  let nextSelectionEnd = end;

  if (command.startsWith("heading")) {
    const level = Number(command.replace("heading", ""));
    applyMarkdownChange({
      ...replaceSelectedLines(markdown, start, end, `${"#".repeat(level)} `),
      textarea,
      onChange,
    });
    return;
  } else if (command === "paragraph") {
    applyMarkdownChange({
      ...replaceSelectedLines(markdown, start, end, ""),
      textarea,
      onChange,
    });
    return;
  } else if (command === "blockquote") {
    applyMarkdownChange({
      ...replaceSelectedLines(markdown, start, end, "> "),
      textarea,
      onChange,
    });
    return;
  } else if (command === "orderedList") {
    applyMarkdownChange({
      ...replaceSelectedLines(markdown, start, end, "1. "),
      textarea,
      onChange,
    });
    return;
  } else if (command === "bulletList") {
    applyMarkdownChange({
      ...replaceSelectedLines(markdown, start, end, "- "),
      textarea,
      onChange,
    });
    return;
  } else if (command === "codeBlock") {
    replacement = wrapSelection(selected, "```\n", "\n```");
    nextSelectionStart = start + 4;
    nextSelectionEnd = start + replacement.length - 4;
  } else if (command === "bold") {
    replacement = wrapSelection(selected, "**", "**");
    nextSelectionStart = start + 2;
    nextSelectionEnd = start + replacement.length - 2;
  } else if (command === "italic") {
    replacement = wrapSelection(selected, "*", "*");
    nextSelectionStart = start + 1;
    nextSelectionEnd = start + replacement.length - 1;
  } else if (command === "underline") {
    replacement = wrapSelection(selected, "<u>", "</u>");
    nextSelectionStart = start + 3;
    nextSelectionEnd = start + replacement.length - 4;
  } else if (command === "strike") {
    replacement = wrapSelection(selected, "~~", "~~");
    nextSelectionStart = start + 2;
    nextSelectionEnd = start + replacement.length - 2;
  } else if (command === "inlineCode") {
    replacement = wrapSelection(selected, "`", "`");
    nextSelectionStart = start + 1;
    nextSelectionEnd = start + replacement.length - 1;
  } else if (command === "link") {
    const url = window.prompt("Link URL");

    if (!url?.trim()) {
      return;
    }

    replacement = `[${selected || "link"}](${url.trim()})`;
    nextSelectionStart = start + 1;
    nextSelectionEnd = start + (selected || "link").length + 1;
  } else if (command === "clearFormat") {
    replacement = clearMarkdownFormatting(selected);
  }

  applyMarkdownChange({
    nextMarkdown: markdown.slice(0, start) + replacement + markdown.slice(end),
    nextSelectionStart,
    nextSelectionEnd,
    textarea,
    onChange,
  });
}

function wrapSelection(value: string, before: string, after: string): string {
  return `${before}${value || "text"}${after}`;
}

function replaceSelectedLines(
  markdown: string,
  start: number,
  end: number,
  prefix: string,
): {
  nextMarkdown: string;
  nextSelectionEnd: number;
  nextSelectionStart: number;
} {
  const lineStart = markdown.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = markdown.indexOf("\n", end);
  const blockEnd = lineEnd === -1 ? markdown.length : lineEnd;
  const block = markdown.slice(lineStart, blockEnd);
  const replaced = block
    .split("\n")
    .map((line) =>
      `${prefix}${line.replace(/^(\s*)(#{1,6}|>|[-*+]|\d+\.)\s+/, "$1")}`,
    )
    .join("\n");

  return {
    nextMarkdown: markdown.slice(0, lineStart) + replaced + markdown.slice(blockEnd),
    nextSelectionStart: lineStart,
    nextSelectionEnd: lineStart + replaced.length,
  };
}

function applyMarkdownChange({
  nextMarkdown,
  nextSelectionStart,
  nextSelectionEnd,
  textarea,
  onChange,
}: {
  nextMarkdown: string;
  nextSelectionEnd: number;
  nextSelectionStart: number;
  textarea: HTMLTextAreaElement;
  onChange: (markdown: string) => void;
}) {
  onChange(nextMarkdown);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
  });
}

function clearMarkdownFormatting(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^(\s*)(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "$1");
}
