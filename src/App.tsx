import { useReducer } from "react";
import { tauriApi } from "./api/tauri";
import { FileTree } from "./components/FileTree";
import { EditorPane } from "./components/EditorPane";
import { buildIndex } from "./context/indexer";
import { normalizeMarkdownForSave } from "./editor/markdown";
import { appReducer, initialAppState } from "./state/appReducer";
import type { FileNode } from "./types";
import "./styles.css";

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);

  async function refreshTree(rootPath = state.rootPath) {
    if (!rootPath) {
      return [];
    }

    const tree = await tauriApi.readProjectTree(rootPath);

    dispatch({
      type: "treeUpdated",
      tree,
      indexedDocuments: buildIndex([]),
    });

    return tree;
  }

  async function openFolder() {
    if (!confirmDiscardChanges()) {
      return;
    }

    const project = await tauriApi.pickProjectFolder();

    if (!project) {
      return;
    }

    dispatch({
      type: "projectOpened",
      rootPath: project.rootPath,
      tree: project.tree,
      indexedDocuments: buildIndex([]),
    });
  }

  async function openFile(path: string) {
    if (!state.rootPath) {
      return;
    }

    if (!confirmDiscardChanges()) {
      return;
    }

    const opened = await tauriApi.readMarkdownFile(state.rootPath, path);

    dispatch({
      type: "fileOpened",
      file: opened.file,
      markdown: opened.markdown,
    });
  }

  async function saveFile() {
    if (!state.rootPath || !state.openFile) {
      return;
    }

    const markdown = normalizeMarkdownForSave(state.openMarkdown);

    await tauriApi.writeMarkdownFile(
      state.rootPath,
      state.openFile.relativePath,
      markdown,
    );

    dispatch({ type: "fileSaved", markdown });
  }

  async function createFile(parentPath: string) {
    if (!state.rootPath) {
      return;
    }

    const name = window.prompt("New file path");

    if (!name?.trim()) {
      return;
    }

    await tauriApi.createFile(state.rootPath, joinRelativePath(parentPath, name));
    await refreshTree();
  }

  async function createFolder(parentPath: string) {
    if (!state.rootPath) {
      return;
    }

    const name = window.prompt("New folder path");

    if (!name?.trim()) {
      return;
    }

    await tauriApi.createFolder(
      state.rootPath,
      joinRelativePath(parentPath, name),
    );
    await refreshTree();
  }

  async function renameEntry(path: string) {
    if (!state.rootPath) {
      return;
    }

    const newName = window.prompt("New name", basename(path));

    if (!newName?.trim()) {
      return;
    }

    const trimmedName = newName.trim();
    const nextPath = renameRelativePath(path, trimmedName);

    await tauriApi.renameEntry(state.rootPath, path, trimmedName);

    const tree = await refreshTree();
    syncOpenFileAfterPathChange(path, nextPath, tree);
  }

  async function deleteEntry(path: string) {
    if (!state.rootPath) {
      return;
    }

    const isOpenEntry = pathAffectsOpenFile(path);
    const message =
      isOpenEntry && state.isDirty
        ? `Delete ${path} and discard unsaved changes?`
        : `Delete ${path}?`;

    if (!window.confirm(message)) {
      return;
    }

    await tauriApi.deleteEntry(state.rootPath, path);
    await refreshTree();

    if (isOpenEntry) {
      dispatch({ type: "fileClosed" });
    }
  }

  async function moveEntry(path: string) {
    if (!state.rootPath) {
      return;
    }

    const newPath = window.prompt("Move to path", path);

    if (!newPath?.trim()) {
      return;
    }

    const nextPath = trimRelativePath(newPath);

    await tauriApi.moveEntry(state.rootPath, path, nextPath);

    const tree = await refreshTree();
    syncOpenFileAfterPathChange(path, nextPath, tree);
  }

  function confirmDiscardChanges() {
    return !state.isDirty || window.confirm("Discard unsaved changes?");
  }

  function pathAffectsOpenFile(path: string) {
    return state.openFile
      ? isSamePathOrDescendant(state.openFile.relativePath, path)
      : false;
  }

  function syncOpenFileAfterPathChange(
    oldPath: string,
    newPath: string,
    tree: FileNode[],
  ) {
    if (!state.openFile) {
      return;
    }

    const nextOpenPath = replacePathPrefix(
      state.openFile.relativePath,
      oldPath,
      newPath,
    );

    if (!nextOpenPath) {
      return;
    }

    const file = findFileNode(tree, nextOpenPath);

    dispatch(file ? { type: "openFileMetadataUpdated", file } : { type: "fileClosed" });
  }

  return (
    <main className="app-shell">
      <aside className="file-pane">
        <header className="app-brand">
          <h1>DraftAgent</h1>
        </header>
        <FileTree
          rootPath={state.rootPath}
          nodes={state.tree}
          onOpenFolder={openFolder}
          onOpenFile={openFile}
          onCreateFile={createFile}
          onCreateFolder={createFolder}
          onRename={renameEntry}
          onDelete={deleteEntry}
          onMove={moveEntry}
          activePath={state.openFile?.relativePath}
        />
      </aside>
      <EditorPane
        openFile={state.openFile}
        markdown={state.openMarkdown}
        isDirty={state.isDirty}
        onChange={(markdown) =>
          dispatch({ type: "editorChanged", markdown })
        }
        onSave={saveFile}
      />
      <aside className="assistant-pane">
        <h2>Assistant</h2>
      </aside>
    </main>
  );
}

function joinRelativePath(parentPath: string, childPath: string): string {
  const parent = parentPath.replace(/\/+$/g, "");
  const child = childPath.trim().replace(/^\/+/g, "");

  return parent ? `${parent}/${child}` : child;
}

function trimRelativePath(path: string): string {
  return path.trim().replace(/^\/+/g, "").replace(/\/+$/g, "");
}

function basename(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function dirname(path: string): string {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

function renameRelativePath(path: string, newName: string): string {
  return joinRelativePath(dirname(path), newName);
}

function replacePathPrefix(
  relativePath: string,
  oldPath: string,
  newPath: string,
): string | null {
  if (relativePath === oldPath) {
    return newPath;
  }

  if (relativePath.startsWith(`${oldPath}/`)) {
    return joinRelativePath(newPath, relativePath.slice(oldPath.length + 1));
  }

  return null;
}

function isSamePathOrDescendant(relativePath: string, candidatePath: string) {
  return (
    relativePath === candidatePath || relativePath.startsWith(`${candidatePath}/`)
  );
}

function findFileNode(nodes: FileNode[], relativePath: string): FileNode | null {
  for (const node of nodes) {
    if (node.relativePath === relativePath && node.kind === "file") {
      return node;
    }

    const child = findFileNode(node.children ?? [], relativePath);

    if (child) {
      return child;
    }
  }

  return null;
}
