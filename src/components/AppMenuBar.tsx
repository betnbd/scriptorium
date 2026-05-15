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
  onOpenChatGpt: () => void;
  onOpenClaude: () => void;
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
  onOpenChatGpt,
  onOpenClaude,
}: AppMenuBarProps) {
  return (
    <header className="app-menubar">
      <div className="app-title">DraftAgent</div>
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
        </Menu>
        <Menu label="View">
          <button type="button" onClick={onResetLayout}>
            Reset Panes
          </button>
          <button type="button" disabled={!canUseProject} onClick={onReindex}>
            Reindex
          </button>
        </Menu>
        <Menu label="Assistant">
          <button type="button" onClick={onOpenChatGpt}>
            Open ChatGPT
          </button>
          <button type="button" onClick={onOpenClaude}>
            Open Claude
          </button>
        </Menu>
      </nav>
      <button className="menubar-settings" type="button" onClick={onSettings}>
        Settings
      </button>
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
      {isOpen ? <div className="menu-popover">{children}</div> : null}
    </div>
  );
}
