import {
  ChevronDown,
  ChevronRight,
  Edit3,
  File,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { FileNode } from "../types";

export interface FileTreeProps {
  rootPath: string | null;
  nodes: FileNode[];
  onOpenFolder: () => void;
  onOpenFile: (path: string) => void;
  onCreateFile?: (parentPath: string) => void;
  onCreateFolder?: (parentPath: string) => void;
  onRename?: (path: string) => void;
  onDelete?: (path: string) => void;
  onMove?: (path: string) => void;
  activePath?: string | null;
}

export function FileTree({
  rootPath,
  nodes,
  onOpenFolder,
  onOpenFile,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  onMove,
  activePath,
}: FileTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(collectDirectoryPaths(nodes)),
  );

  useEffect(() => {
    setExpandedPaths(new Set(collectDirectoryPaths(nodes)));
  }, [nodes, rootPath]);

  function toggleDirectory(path: string) {
    setExpandedPaths((current) => {
      const next = new Set(current);

      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      return next;
    });
  }

  if (!rootPath) {
    return (
      <section className="file-tree file-tree-empty">
        <FileTreeTabs />
        <button type="button" onClick={onOpenFolder}>
          <FolderOpen aria-hidden="true" size={16} />
          Open Folder
        </button>
      </section>
    );
  }

  return (
    <section className="file-tree" aria-label="Project files">
      <FileTreeTabs />
      <header className="file-tree-header">
        <div>
          <p title={rootPath}>{rootPath}</p>
        </div>
        <div className="file-tree-toolbar" aria-label="File operations">
          <button
            type="button"
            aria-label="New File"
            title="New File"
            onClick={() => onCreateFile?.("")}
          >
            <Plus aria-hidden="true" size={16} />
          </button>
          <button
            type="button"
            aria-label="New Folder"
            title="New Folder"
            onClick={() => onCreateFolder?.("")}
          >
            <FolderPlus aria-hidden="true" size={16} />
          </button>
          <button
            type="button"
            aria-label="Open Folder"
            title="Open Folder"
            onClick={onOpenFolder}
          >
            <FolderOpen aria-hidden="true" size={16} />
          </button>
        </div>
      </header>
      <div className="file-tree-list">
        {nodes.length === 0 ? (
          <p className="file-tree-muted">This folder is empty.</p>
        ) : (
          <FileTreeNodes
            nodes={nodes}
            depth={0}
            onOpenFile={onOpenFile}
            onCreateFile={onCreateFile}
            onCreateFolder={onCreateFolder}
            onRename={onRename}
            onDelete={onDelete}
            onMove={onMove}
            activePath={activePath}
            expandedPaths={expandedPaths}
            onToggleDirectory={toggleDirectory}
          />
        )}
      </div>
    </section>
  );
}

function FileTreeTabs() {
  return (
    <div className="file-tree-tabs" role="tablist" aria-label="Sidebar views">
      <button type="button" className="is-active" role="tab" aria-selected="true">
        Files
      </button>
      <button type="button" role="tab" aria-selected="false" disabled>
        Outline
      </button>
    </div>
  );
}

interface FileTreeNodesProps
  extends Pick<
    FileTreeProps,
    | "onOpenFile"
    | "onCreateFile"
    | "onCreateFolder"
    | "onRename"
    | "onDelete"
    | "onMove"
    | "activePath"
  > {
  nodes: FileNode[];
  depth: number;
  expandedPaths: Set<string>;
  onToggleDirectory: (path: string) => void;
}

function FileTreeNodes({ nodes, depth, ...props }: FileTreeNodesProps) {
  return (
    <ul className="file-tree-nodes">
      {nodes.map((node) => (
        <FileTreeNode
          key={node.relativePath}
          node={node}
          depth={depth}
          {...props}
        />
      ))}
    </ul>
  );
}

interface FileTreeNodeProps
  extends Omit<FileTreeNodesProps, "nodes"> {
  node: FileNode;
}

function FileTreeNode({
  node,
  depth,
  onOpenFile,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  onMove,
  activePath,
  expandedPaths,
  onToggleDirectory,
}: FileTreeNodeProps) {
  const isDirectory = node.kind === "directory";
  const children = node.children ?? [];
  const isActive = activePath === node.relativePath;
  const isExpanded = isDirectory && expandedPaths.has(node.relativePath);
  const rowClassName = [
    "file-tree-row",
    isDirectory ? "is-directory" : "is-file",
    node.isMarkdown ? "is-markdown" : "is-secondary",
    isActive ? "is-active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li>
      <div className={rowClassName} style={{ paddingLeft: 8 + depth * 16 }}>
        {isDirectory ? (
          <button
            type="button"
            aria-label={`${isExpanded ? "Collapse" : "Expand"} folder ${
              node.name
            }`}
            className="file-tree-disclosure"
            onClick={() => onToggleDirectory(node.relativePath)}
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronDown aria-hidden="true" size={14} />
            ) : (
              <ChevronRight aria-hidden="true" size={14} />
            )}
          </button>
        ) : (
          <span className="file-tree-disclosure" aria-hidden="true" />
        )}
        {isDirectory ? (
          <Folder aria-hidden="true" size={16} />
        ) : node.isMarkdown ? (
          <FileText aria-hidden="true" size={16} />
        ) : (
          <File aria-hidden="true" size={16} />
        )}
        {isDirectory ? (
          <button
            type="button"
            className="file-tree-name file-tree-open"
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.name}`}
            onClick={() => onToggleDirectory(node.relativePath)}
          >
            {node.name}
          </button>
        ) : node.isMarkdown ? (
          <button
            type="button"
            className="file-tree-name file-tree-open"
            aria-label={`Open ${node.name}`}
            onClick={() => onOpenFile(node.relativePath)}
          >
            {node.name}
          </button>
        ) : (
          <span className="file-tree-name">{node.name}</span>
        )}
        <div className="file-tree-row-actions">
          {isDirectory ? (
            <>
              <button
                type="button"
                aria-label={`New file in ${node.name}`}
                title="New file"
                onClick={() => onCreateFile?.(node.relativePath)}
              >
                <Plus aria-hidden="true" size={13} />
              </button>
              <button
                type="button"
                aria-label={`New folder in ${node.name}`}
                title="New folder"
                onClick={() => onCreateFolder?.(node.relativePath)}
              >
                <FolderPlus aria-hidden="true" size={13} />
              </button>
            </>
          ) : null}
          <button
            type="button"
            aria-label={`Rename ${node.name}`}
            title="Rename"
            onClick={() => onRename?.(node.relativePath)}
          >
            <Edit3 aria-hidden="true" size={13} />
          </button>
          {onMove ? (
            <button
              type="button"
              aria-label={`Move ${node.name}`}
              title="Move"
              onClick={() => onMove(node.relativePath)}
            >
              <FolderOpen aria-hidden="true" size={13} />
            </button>
          ) : null}
          <button
            type="button"
            aria-label={`Delete ${node.name}`}
            title="Delete"
            onClick={() => onDelete?.(node.relativePath)}
          >
            <Trash2 aria-hidden="true" size={13} />
          </button>
        </div>
      </div>
      {isDirectory && isExpanded && children.length > 0 ? (
        <FileTreeNodes
          nodes={children}
          depth={depth + 1}
          onOpenFile={onOpenFile}
          onCreateFile={onCreateFile}
          onCreateFolder={onCreateFolder}
          onRename={onRename}
          onDelete={onDelete}
          onMove={onMove}
          activePath={activePath}
          expandedPaths={expandedPaths}
          onToggleDirectory={onToggleDirectory}
        />
      ) : null}
    </li>
  );
}

function collectDirectoryPaths(nodes: FileNode[]): string[] {
  return nodes.flatMap((node) => {
    if (node.kind !== "directory") {
      return [];
    }

    return [node.relativePath, ...collectDirectoryPaths(node.children ?? [])];
  });
}
