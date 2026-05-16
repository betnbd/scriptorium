import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import type { EditorCommand, EditorMode } from "./EditorPane";

interface AppMenuBarProps {
  canUseEditor: boolean;
  canSave: boolean;
  canUseProject: boolean;
  editorMode: EditorMode;
  onOpenFolder: () => void;
  onOpenQuickly: () => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onCloseFile: () => void;
  onSave: () => void;
  onSettings: () => void;
  onReindex: () => void;
  onResetLayout: () => void;
  onToggleEditorMode: () => void;
  onEditorCommand: (command: EditorCommand) => void;
  onOpenAssistant: () => void;
}

export function AppMenuBar({
  canUseEditor,
  canSave,
  canUseProject,
  editorMode,
  onOpenFolder,
  onOpenQuickly,
  onCreateFile,
  onCreateFolder,
  onCloseFile,
  onSave,
  onSettings,
  onReindex,
  onResetLayout,
  onToggleEditorMode,
  onEditorCommand,
  onOpenAssistant,
}: AppMenuBarProps) {
  return (
    <header className="app-menubar">
      <nav className="menu-groups" aria-label="Application menu">
        <Menu label="File">
          <MenuItem
            disabled={!canUseProject}
            label="New File"
            shortcut="Ctrl+N"
            onClick={onCreateFile}
          />
          <MenuItem
            disabled={!canUseProject}
            label="New Folder"
            shortcut="Ctrl+Shift+N"
            onClick={onCreateFolder}
          />
          <MenuDivider />
          <MenuItem label="Open Folder" shortcut="Ctrl+O" onClick={onOpenFolder} />
          <MenuItem
            disabled={!canUseProject}
            label="Open Quickly"
            shortcut="Ctrl+P"
            onClick={onOpenQuickly}
          />
          <MenuDivider />
          <MenuItem
            disabled={!canSave}
            label="Save"
            shortcut="Ctrl+S"
            onClick={onSave}
          />
          <MenuItem
            disabled={!canUseEditor}
            label="Close File"
            shortcut="Ctrl+W"
            onClick={onCloseFile}
          />
          <MenuDivider />
          <MenuItem label="Settings" shortcut="Ctrl+," onClick={onSettings} />
        </Menu>
        <Menu label="Edit">
          <MenuItem
            disabled={!canUseEditor}
            label="Undo"
            shortcut="Ctrl+Z"
            onClick={() => onEditorCommand("undo")}
          />
          <MenuItem
            disabled={!canUseEditor}
            label="Redo"
            shortcut="Ctrl+Y"
            onClick={() => onEditorCommand("redo")}
          />
          <MenuDivider />
          <MenuItem
            disabled={!canUseEditor}
            label="Cut"
            shortcut="Ctrl+X"
            onClick={() => onEditorCommand("cut")}
          />
          <MenuItem
            disabled={!canUseEditor}
            label="Copy"
            shortcut="Ctrl+C"
            onClick={() => onEditorCommand("copy")}
          />
          <MenuItem
            disabled={!canUseEditor}
            label="Paste"
            shortcut="Ctrl+V"
            onClick={() => onEditorCommand("paste")}
          />
          <MenuItem
            disabled={!canUseEditor}
            label="Select All"
            shortcut="Ctrl+A"
            onClick={() => onEditorCommand("selectAll")}
          />
        </Menu>
        <Menu label="Paragraph">
          {([1, 2, 3, 4, 5, 6] as const).map((level) => (
            <MenuItem
              disabled={!canUseEditor}
              key={level}
              label={`Heading ${level}`}
              shortcut={`Ctrl+${level}`}
              onClick={() => onEditorCommand(`heading${level}` as EditorCommand)}
            />
          ))}
          <MenuItem
            disabled={!canUseEditor}
            label="Paragraph"
            shortcut="Ctrl+0"
            onClick={() => onEditorCommand("paragraph")}
          />
          <MenuDivider />
          <MenuItem
            disabled={!canUseEditor}
            label="Quote"
            shortcut="Ctrl+Shift+Q"
            onClick={() => onEditorCommand("blockquote")}
          />
          <MenuItem
            disabled={!canUseEditor}
            label="Ordered List"
            shortcut="Ctrl+Shift+["
            onClick={() => onEditorCommand("orderedList")}
          />
          <MenuItem
            disabled={!canUseEditor}
            label="Unordered List"
            shortcut="Ctrl+Shift+]"
            onClick={() => onEditorCommand("bulletList")}
          />
          <MenuItem
            disabled={!canUseEditor}
            label="Code Fences"
            shortcut="Ctrl+Shift+K"
            onClick={() => onEditorCommand("codeBlock")}
          />
        </Menu>
        <Menu label="Format">
          <MenuItem
            disabled={!canUseEditor}
            label="Strong"
            shortcut="Ctrl+B"
            onClick={() => onEditorCommand("bold")}
          />
          <MenuItem
            disabled={!canUseEditor}
            label="Emphasis"
            shortcut="Ctrl+I"
            onClick={() => onEditorCommand("italic")}
          />
          <MenuItem
            disabled={!canUseEditor}
            label="Underline"
            shortcut="Ctrl+U"
            onClick={() => onEditorCommand("underline")}
          />
          <MenuItem
            disabled={!canUseEditor}
            label="Code"
            shortcut="Ctrl+Shift+`"
            onClick={() => onEditorCommand("inlineCode")}
          />
          <MenuItem
            disabled={!canUseEditor}
            label="Strike"
            shortcut="Alt+Shift+5"
            onClick={() => onEditorCommand("strike")}
          />
          <MenuDivider />
          <MenuItem
            disabled={!canUseEditor}
            label="Hyperlink"
            shortcut="Ctrl+K"
            onClick={() => onEditorCommand("link")}
          />
          <MenuItem
            disabled={!canUseEditor}
            label="Clear Format"
            shortcut="Ctrl+\\"
            onClick={() => onEditorCommand("clearFormat")}
          />
        </Menu>
        <Menu label="View">
          <MenuItem
            disabled={!canUseEditor}
            label={
              editorMode === "markdown"
                ? "Exit Source Code Mode"
                : "Source Code Mode"
            }
            shortcut="Ctrl+/"
            onClick={onToggleEditorMode}
          />
          <MenuItem label="Reset Layout" onClick={onResetLayout} />
          <MenuItem
            disabled={!canUseProject}
            label="Refresh File Tree"
            onClick={onReindex}
          />
        </Menu>
        <Menu label="Themes">
          <MenuItem disabled label="Light" />
        </Menu>
        <Menu label="AI">
          <MenuItem label="New Conversation" onClick={onOpenAssistant} />
          <MenuItem label="Provider Settings" onClick={onSettings} />
        </Menu>
        <Menu label="Help">
          <MenuItem disabled label="DraftAgent" />
        </Menu>
      </nav>
    </header>
  );
}

function MenuDivider() {
  return <div aria-hidden="true" className="menu-divider" />;
}

function MenuItem({
  disabled = false,
  label,
  shortcut,
  onClick,
}: {
  disabled?: boolean;
  label: string;
  shortcut?: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}>
      <span>{label}</span>
      {shortcut ? <kbd aria-hidden="true">{shortcut}</kbd> : null}
    </button>
  );
}

function Menu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={isOpen ? "menu-group is-open" : "menu-group"}>
      <button
        aria-expanded={isOpen}
        className="menu-trigger"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        {label}
        <ChevronDown aria-hidden="true" size={14} />
      </button>
      {isOpen ? (
        <div
          className="menu-popover"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("button")) {
              setIsOpen(false);
            }
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
