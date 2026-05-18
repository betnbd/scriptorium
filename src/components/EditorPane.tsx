import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { FileText, FolderOpen } from "lucide-react";
import type {
  ChangeEvent,
  Dispatch,
  ReactNode,
  SetStateAction,
  SyntheticEvent,
} from "react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
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
  | "clearFormat"
  | "find"
  | "findAndReplace";

export interface EditorPaneHandle {
  runCommand: (command: EditorCommand) => void;
}

interface EditorPaneProps {
  openFile: { relativePath: string; name: string } | null;
  markdown: string;
  mode: EditorMode;
  isDirty: boolean;
  isAiEditStaged?: boolean;
  stagedDiff?: {
    previousMarkdown: string;
    nextMarkdown: string;
  } | null;
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
    stagedDiff = null,
    onChange,
    onSave,
    onOpenFolder,
    onOpenFile,
    onModeChange,
    onSelectionChange,
  },
  ref,
) {
  const [findState, setFindState] = useState({
    isOpen: false,
    isReplaceOpen: false,
    query: "",
    replacement: "",
    activeIndex: 0,
  });

  useEffect(() => {
    setFindState({
      isOpen: false,
      isReplaceOpen: false,
      query: "",
      replacement: "",
      activeIndex: 0,
    });
  }, [openFile?.relativePath]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.ctrlKey) return;
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        handleFindCommand("find");
      }
      if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        handleFindCommand("findAndReplace");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const matches = findPlainTextMatches(markdown, findState.query);
  const findBar = findState.isOpen ? (
    <FindBar
      state={findState}
      matchCount={matches.length}
      onChange={setFindState}
      onReplaceCurrent={() => {
        const match = matches[findState.activeIndex];
        if (!match) return;
        onChange(replaceMatch(markdown, match, findState.replacement));
      }}
      onReplaceAll={() => {
        if (!findState.query) return;
        onChange(markdown.split(findState.query).join(findState.replacement));
      }}
    />
  ) : null;

  function handleFindCommand(command: EditorCommand) {
    if (command === "find" || command === "findAndReplace") {
      setFindState((state) => ({
        ...state,
        isOpen: true,
        isReplaceOpen: command === "findAndReplace",
      }));
      return true;
    }
    return false;
  }

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
        stagedDiff={stagedDiff}
        onChange={onChange}
        onSave={onSave}
        onModeChange={onModeChange}
        onSelectionChange={onSelectionChange}
        findBar={findBar}
        onFindCommand={handleFindCommand}
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
        stagedDiff={stagedDiff}
        onChange={onChange}
        onSave={onSave}
        onModeChange={onModeChange}
        onSelectionChange={onSelectionChange}
        findBar={findBar}
        onFindCommand={handleFindCommand}
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
      stagedDiff={stagedDiff}
      onChange={onChange}
      onSave={onSave}
      onModeChange={onModeChange}
      onSelectionChange={onSelectionChange}
      findBar={findBar}
      onFindCommand={handleFindCommand}
    />
  );
});

function FindBar({
  state,
  matchCount,
  onChange,
  onReplaceCurrent,
  onReplaceAll,
}: {
  state: {
    isOpen: boolean;
    isReplaceOpen: boolean;
    query: string;
    replacement: string;
    activeIndex: number;
  };
  matchCount: number;
  onChange: Dispatch<
    SetStateAction<{
      isOpen: boolean;
      isReplaceOpen: boolean;
      query: string;
      replacement: string;
      activeIndex: number;
    }>
  >;
  onReplaceCurrent: () => void;
  onReplaceAll: () => void;
}) {
  return (
    <div className="find-bar" role="search">
      <label>
        Find
        <input
          aria-label="Find"
          value={state.query}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onChange((current) => ({
                ...current,
                activeIndex:
                  matchCount === 0
                    ? 0
                    : event.shiftKey
                      ? (current.activeIndex - 1 + matchCount) % matchCount
                      : (current.activeIndex + 1) % matchCount,
              }));
            }
            if (event.key === "Escape") {
              onChange((current) => ({ ...current, isOpen: false }));
            }
          }}
          onChange={(event) => {
            const query = event.currentTarget.value;
            onChange((current) => ({
              ...current,
              query,
              activeIndex: 0,
            }));
          }}
        />
      </label>
      {state.isReplaceOpen ? (
        <label>
          Replace
          <input
            aria-label="Replace"
            value={state.replacement}
            onChange={(event) => {
              const replacement = event.currentTarget.value;
              onChange((current) => ({
                ...current,
                replacement,
              }));
            }}
          />
        </label>
      ) : null}
      <span>{matchCount} {matchCount === 1 ? "match" : "matches"}</span>
      <button
        type="button"
        onClick={() =>
          onChange((current) => ({
            ...current,
            activeIndex:
              matchCount === 0
                ? 0
                : (current.activeIndex - 1 + matchCount) % matchCount,
          }))
        }
        disabled={!matchCount}
      >
        Previous
      </button>
      <button
        type="button"
        onClick={() =>
          onChange((current) => ({
            ...current,
            activeIndex:
              matchCount === 0 ? 0 : (current.activeIndex + 1) % matchCount,
          }))
        }
        disabled={!matchCount}
      >
        Next
      </button>
      <button type="button" onClick={onReplaceCurrent} disabled={!matchCount || !state.isReplaceOpen}>
        Replace
      </button>
      <button type="button" onClick={onReplaceAll} disabled={!matchCount || !state.isReplaceOpen}>
        Replace all
      </button>
      <button
        type="button"
        aria-label="Close find"
        onClick={() =>
          onChange((current) => ({ ...current, isOpen: false }))
        }
      >
        Close
      </button>
    </div>
  );
}

function findPlainTextMatches(markdown: string, query: string) {
  if (!query) return [];
  const matches: Array<{ start: number; end: number }> = [];
  let start = markdown.indexOf(query);
  while (start !== -1) {
    matches.push({ start, end: start + query.length });
    start = markdown.indexOf(query, start + query.length);
  }
  return matches;
}

function replaceMatch(
  markdown: string,
  match: { start: number; end: number },
  replacement: string,
) {
  return markdown.slice(0, match.start) + replacement + markdown.slice(match.end);
}

const RichMarkdownEditor = forwardRef<EditorPaneHandle, EditorPaneProps & {
  openFile: NonNullable<EditorPaneProps["openFile"]>;
  findBar?: ReactNode;
  onFindCommand?: (command: EditorCommand) => boolean;
}>(function RichMarkdownEditor({
  openFile,
  markdown,
  mode,
  isDirty,
  isAiEditStaged,
  stagedDiff,
  onChange,
  onSave,
  onModeChange,
  onSelectionChange,
  findBar,
  onFindCommand,
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
        if (onFindCommand?.(command)) {
          return;
        }
        if (!editor) {
          return;
        }

        runRichEditorCommand(editor, command);
      },
    }),
    [editor, onFindCommand],
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
      {findBar}
      {stagedDiff ? (
        <StagedDiffView
          previousMarkdown={stagedDiff.previousMarkdown}
          nextMarkdown={stagedDiff.nextMarkdown}
        />
      ) : (
        <EditorContent editor={editor} className="manuscript-editor" />
      )}
    </section>
  );
});

const SourceMarkdownEditor = forwardRef<
  EditorPaneHandle,
  EditorPaneProps & {
    children?: ReactNode;
    openFile: NonNullable<EditorPaneProps["openFile"]>;
    findBar?: ReactNode;
    onFindCommand?: (command: EditorCommand) => boolean;
  }
>(function SourceMarkdownEditor(
  {
    openFile,
    markdown,
    mode,
    isDirty,
    isAiEditStaged,
    stagedDiff,
    onChange,
    onSave,
    onModeChange,
    onSelectionChange,
    children,
    findBar,
    onFindCommand,
  },
  ref,
) {
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      runCommand(command) {
        if (onFindCommand?.(command)) {
          return;
        }
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
    [markdown, onChange, onFindCommand],
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
      {findBar}
      {stagedDiff ? (
        <StagedDiffView
          previousMarkdown={stagedDiff.previousMarkdown}
          nextMarkdown={stagedDiff.nextMarkdown}
        />
      ) : (
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
      )}
    </section>
  );
});

const LargeMarkdownEditor = forwardRef<
  EditorPaneHandle,
  EditorPaneProps & {
    openFile: NonNullable<EditorPaneProps["openFile"]>;
    findBar?: ReactNode;
    onFindCommand?: (command: EditorCommand) => boolean;
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
    stagedDiff,
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
      {stagedDiff ? (
        <StagedDiffView
          previousMarkdown={stagedDiff.previousMarkdown}
          nextMarkdown={stagedDiff.nextMarkdown}
        />
      ) : (
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
      )}
    </section>
  );
});

function StagedDiffView({
  previousMarkdown,
  nextMarkdown,
}: {
  previousMarkdown: string;
  nextMarkdown: string;
}) {
  return (
    <div className="staged-diff-view" aria-label="Staged edit diff">
      <div className="staged-diff-legend" aria-hidden="true">
        <span className="diff-legend-original">Original</span>
        <span className="diff-legend-revised">Revised</span>
      </div>
      <div className="staged-diff-lines">
        {buildStagedDiffRows(previousMarkdown, nextMarkdown).map((row, index) => (
          <div className={`staged-diff-row is-${row.kind}`} key={index}>
            <span className="staged-diff-marker">{row.marker}</span>
            <span className="staged-diff-label">{row.label}</span>
            <span className="staged-diff-text">
              {row.text || "\u00a0"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildStagedDiffRows(previousMarkdown: string, nextMarkdown: string) {
  const previousLines = previousMarkdown.replace(/\r\n/g, "\n").split("\n");
  const nextLines = nextMarkdown.replace(/\r\n/g, "\n").split("\n");
  const maxLength = Math.max(previousLines.length, nextLines.length);
  const rows: Array<{
    kind: "same" | "removed" | "added";
    label: string;
    marker: string;
    text: string;
  }> = [];

  for (let index = 0; index < maxLength; index += 1) {
    const previousLine = previousLines[index];
    const nextLine = nextLines[index];

    if (previousLine === nextLine) {
      if (previousLine !== undefined) {
        rows.push({
          kind: "same",
          label: "",
          marker: "",
          text: cleanInlineMarkdown(previousLine),
        });
      }
      continue;
    }

    if (previousLine !== undefined) {
      rows.push({
        kind: "removed",
        label: "Original",
        marker: "-",
        text: cleanInlineMarkdown(previousLine),
      });
    }

    if (nextLine !== undefined) {
      rows.push({
        kind: "added",
        label: "Revised",
        marker: "+",
        text: cleanInlineMarkdown(nextLine),
      });
    }
  }

  return rows.length
    ? rows
    : [{ kind: "same" as const, label: "", marker: "", text: "No text changes." }];
}

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
