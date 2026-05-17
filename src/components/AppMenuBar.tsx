import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { themeOptions } from "../themeOptions";
import type { EditorCommand, EditorMode } from "./EditorPane";
import type { ThemeId } from "../types";

interface AppMenuBarProps {
  canUseEditor: boolean;
  canSave: boolean;
  canUseProject: boolean;
  editorMode: EditorMode;
  onOpenFolder: () => void;
  onOpenFile: () => void;
  onOpenQuickly: () => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onCloseFile: () => void;
  onSave: () => void;
  onSettings: () => void;
  onReindex: () => void;
  onResetLayout: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  themeId: ThemeId;
  onThemeChange: (themeId: ThemeId) => void;
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
  onOpenFile,
  onOpenQuickly,
  onCreateFile,
  onCreateFolder,
  onCloseFile,
  onSave,
  onSettings,
  onReindex,
  onResetLayout,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  themeId,
  onThemeChange,
  onToggleEditorMode,
  onEditorCommand,
  onOpenAssistant,
}: AppMenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!openMenu) {
      return undefined;
    }

    function onPointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      ) {
        setOpenMenu(null);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  return (
    <header className="app-menubar">
      <nav
        className="menu-groups"
        aria-label="Application menu"
        ref={menuRef}
        role="menubar"
      >
        <Menu
          isOpen={openMenu === "File"}
          label="File"
          onOpenChange={(nextOpen) => setOpenMenu(nextOpen ? "File" : null)}
        >
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
          <MenuItem label="Open File" onClick={onOpenFile} />
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
        <Menu
          isOpen={openMenu === "Edit"}
          label="Edit"
          onOpenChange={(nextOpen) => setOpenMenu(nextOpen ? "Edit" : null)}
        >
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
        <Menu
          isOpen={openMenu === "Paragraph"}
          label="Paragraph"
          onOpenChange={(nextOpen) => setOpenMenu(nextOpen ? "Paragraph" : null)}
        >
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
            label="Code Block"
            shortcut="Ctrl+Shift+K"
            onClick={() => onEditorCommand("codeBlock")}
          />
        </Menu>
        <Menu
          isOpen={openMenu === "Format"}
          label="Format"
          onOpenChange={(nextOpen) => setOpenMenu(nextOpen ? "Format" : null)}
        >
          <MenuItem
            disabled={!canUseEditor}
            label="Bold"
            shortcut="Ctrl+B"
            onClick={() => onEditorCommand("bold")}
          />
          <MenuItem
            disabled={!canUseEditor}
            label="Italic"
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
        <Menu
          isOpen={openMenu === "View"}
          label="View"
          onOpenChange={(nextOpen) => setOpenMenu(nextOpen ? "View" : null)}
        >
          <MenuItem
            disabled={!canUseEditor}
            label={
              editorMode === "markdown"
                ? "Exit Markdown Source"
                : "Markdown Source"
            }
            shortcut="Ctrl+/"
            onClick={onToggleEditorMode}
          />
          <MenuDivider />
          <MenuItem label="Zoom In" shortcut="Ctrl++" onClick={onZoomIn} />
          <MenuItem label="Zoom Out" shortcut="Ctrl+-" onClick={onZoomOut} />
          <MenuItem label="Reset Zoom" shortcut="Ctrl+0" onClick={onResetZoom} />
          <MenuDivider />
          <MenuItem label="Reset Layout" onClick={onResetLayout} />
          <MenuItem
            disabled={!canUseProject}
            label="Refresh File Tree"
            onClick={onReindex}
          />
        </Menu>
        <Menu
          isOpen={openMenu === "Themes"}
          label="Themes"
          onOpenChange={(nextOpen) => setOpenMenu(nextOpen ? "Themes" : null)}
        >
          {themeOptions.map((theme) => (
            <ThemeMenuItem
              isSelected={theme.id === themeId}
              key={theme.id}
              label={theme.label}
              themeId={theme.id}
              onClick={() => onThemeChange(theme.id)}
            />
          ))}
        </Menu>
        <Menu
          isOpen={openMenu === "AI"}
          label="AI"
          onOpenChange={(nextOpen) => setOpenMenu(nextOpen ? "AI" : null)}
        >
          <MenuItem label="New Conversation" onClick={onOpenAssistant} />
          <MenuItem label="AI Settings" onClick={onSettings} />
        </Menu>
        <Menu
          isOpen={openMenu === "Help"}
          label="Help"
          onOpenChange={(nextOpen) => setOpenMenu(nextOpen ? "Help" : null)}
        >
          <MenuItem disabled label="Scriptorium" />
        </Menu>
      </nav>
    </header>
  );
}

function ThemeMenuItem({
  isSelected,
  label,
  themeId,
  onClick,
}: {
  isSelected: boolean;
  label: string;
  themeId: ThemeId;
  onClick: () => void;
}) {
  return (
    <button
      aria-current={isSelected ? "true" : undefined}
      className="theme-menu-item"
      type="button"
      onClick={onClick}
    >
      <span className="theme-menu-item-label">
        <span aria-hidden="true" className="theme-swatch" data-theme-swatch={themeId} />
        {label}
      </span>
      <span aria-hidden="true">{isSelected ? "✓" : ""}</span>
    </button>
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
  isOpen,
  label,
  children,
  onOpenChange,
}: {
  isOpen: boolean;
  label: string;
  children: ReactNode;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <div className={isOpen ? "menu-group is-open" : "menu-group"}>
      <button
        aria-expanded={isOpen}
        className="menu-trigger"
        type="button"
        onClick={() => onOpenChange(!isOpen)}
      >
        {label}
        <ChevronDown aria-hidden="true" size={14} />
      </button>
      {isOpen ? (
        <div
          className="menu-popover"
          role="menu"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("button")) {
              onOpenChange(false);
            }
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
