import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

interface AppMenuBarProps {
  canSave: boolean;
  canUseProject: boolean;
  onOpenFolder: () => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onSave: () => void;
  onSettings: () => void;
  onReindex: () => void;
  onResetLayout: () => void;
  onOpenAssistant: () => void;
}

export function AppMenuBar({
  canSave,
  canUseProject,
  onOpenFolder,
  onCreateFile,
  onCreateFolder,
  onSave,
  onSettings,
  onReindex,
  onResetLayout,
  onOpenAssistant,
}: AppMenuBarProps) {
  return (
    <header className="app-menubar">
      <nav className="menu-groups" aria-label="Application menu">
        <Menu label="File">
          <button type="button" onClick={onOpenFolder}>
            Open Folder
          </button>
          <button type="button" disabled={!canUseProject} onClick={onCreateFile}>
            New File
          </button>
          <button
            type="button"
            disabled={!canUseProject}
            onClick={onCreateFolder}
          >
            New Folder
          </button>
          <button type="button" disabled={!canSave} onClick={onSave}>
            Save
          </button>
          <button type="button" onClick={onSettings}>
            Settings
          </button>
        </Menu>
        <Menu label="Edit">
          <button type="button" disabled>
            Undo
          </button>
          <button type="button" disabled>
            Redo
          </button>
        </Menu>
        <Menu label="Paragraph">
          <button type="button" disabled>
            Heading
          </button>
          <button type="button" disabled>
            Body Text
          </button>
        </Menu>
        <Menu label="Format">
          <button type="button" disabled>
            Strong
          </button>
          <button type="button" disabled>
            Emphasis
          </button>
        </Menu>
        <Menu label="View">
          <button type="button" onClick={onResetLayout}>
            Reset Layout
          </button>
          <button type="button" disabled={!canUseProject} onClick={onReindex}>
            Reindex
          </button>
        </Menu>
        <Menu label="Themes">
          <button type="button" disabled>
            Light
          </button>
        </Menu>
        <Menu label="AI">
          <button type="button" onClick={onOpenAssistant}>
            New Conversation
          </button>
          <button type="button" onClick={onSettings}>
            Provider Settings
          </button>
        </Menu>
        <Menu label="Help">
          <button type="button" disabled>
            DraftAgent
          </button>
        </Menu>
      </nav>
    </header>
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
