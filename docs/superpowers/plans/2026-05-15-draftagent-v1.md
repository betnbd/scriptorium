# DraftAgent V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build DraftAgent v1 as a local Ubuntu desktop app for editing Markdown novel files beside an assistant pane.

**Architecture:** Use Tauri 2 for desktop shell, native file operations, settings, clipboard, and external app handoff. Use React, TypeScript, and TipTap for the three-column UI and rich Markdown editor. Keep OpenAI/Anthropic as subscription handoff providers and LM Studio as the optional direct local provider.

**Tech Stack:** Tauri 2, Rust, React, TypeScript, Vite, TipTap/ProseMirror, Vitest, React Testing Library, Playwright.

---

## References Checked

- Tauri create project docs: https://v2.tauri.app/start/create-project/
- Tauri command docs: https://tauri.app/es/develop/calling-rust/
- Tauri dialog plugin docs: https://v2.tauri.app/plugin/dialog/
- TipTap React docs: https://tiptap.dev/docs/editor/getting-started/install/react
- TipTap Markdown docs: https://tiptap.dev/docs/editor/markdown/getting-started/installation
- Vitest docs: https://vitest.dev/guide/

## Target File Structure

```text
.
├── docs/superpowers/specs/2026-05-15-draftagent-v1-design.md
├── docs/superpowers/plans/2026-05-15-draftagent-v1.md
├── index.html
├── package.json
├── package-lock.json
├── src
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   ├── api
│   │   └── tauri.ts
│   ├── assistant
│   │   ├── applyResult.test.ts
│   │   ├── applyResult.ts
│   │   ├── promptBuilder.test.ts
│   │   ├── promptBuilder.ts
│   │   ├── responseParser.test.ts
│   │   └── responseParser.ts
│   ├── components
│   │   ├── AssistantPane.test.tsx
│   │   ├── AssistantPane.tsx
│   │   ├── EditorPane.test.tsx
│   │   ├── EditorPane.tsx
│   │   ├── FileTree.test.tsx
│   │   ├── FileTree.tsx
│   │   ├── SettingsDialog.test.tsx
│   │   └── SettingsDialog.tsx
│   ├── context
│   │   ├── indexer.test.ts
│   │   └── indexer.ts
│   ├── editor
│   │   ├── markdown.test.ts
│   │   └── markdown.ts
│   ├── state
│   │   ├── appReducer.test.ts
│   │   └── appReducer.ts
│   ├── test
│   │   └── setup.ts
│   └── types.ts
├── src-tauri
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src
│       ├── lib.rs
│       ├── main.rs
│       ├── commands
│       │   ├── mod.rs
│       │   ├── lm_studio.rs
│       │   ├── settings.rs
│       │   └── workspace.rs
│       └── model.rs
├── tests
│   └── e2e
│       └── smoke.spec.ts
├── vite.config.ts
└── vitest.config.ts
```

## Validation Commands

```bash
npm run test:unit
npm run tauri:test
npm run build
npm run test:e2e
```

During early tasks, run the narrower command listed in each task before the full suite exists.

### Task 1: Scaffold Tauri React App and Test Harness

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src-tauri/**`
- Modify: `.gitignore`
- Modify: `README.md`

- [ ] **Step 1: Scaffold into a temporary directory**

Run:

```bash
tmpdir="$(mktemp -d)"
npm create tauri-app@latest "$tmpdir/draftagent-scaffold" -- --manager npm --template react-ts --identifier app.draftagent.local --tauri-version 2 --yes
```

Expected: `create-tauri-app` creates a React TypeScript Tauri project in the temporary directory.

- [ ] **Step 2: Copy scaffold files into the repository without overwriting docs**

Run:

```bash
cp -a "$tmpdir/draftagent-scaffold"/index.html .
cp -a "$tmpdir/draftagent-scaffold"/package.json .
cp -a "$tmpdir/draftagent-scaffold"/package-lock.json .
cp -a "$tmpdir/draftagent-scaffold"/src .
cp -a "$tmpdir/draftagent-scaffold"/src-tauri .
cp -a "$tmpdir/draftagent-scaffold"/tsconfig.json .
cp -a "$tmpdir/draftagent-scaffold"/tsconfig.node.json .
cp -a "$tmpdir/draftagent-scaffold"/vite.config.ts .
rm -rf "$tmpdir"
npm install
```

Expected: repo root contains the Tauri/Vite scaffold and existing `docs/`, `README.md`, `LICENSE`, and `.gitignore` remain present.

- [ ] **Step 3: Install app dependencies**

Run:

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/markdown diff-match-patch clsx lucide-react
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event playwright @playwright/test
npm run tauri add clipboard-manager
npm run tauri add dialog
npm run tauri add shell
```

Expected: dependencies are added to `package.json`, and Tauri plugins are added to `src-tauri/Cargo.toml`.

- [ ] **Step 4: Replace package scripts**

Update `package.json` scripts to include:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "tauri:test": "cargo test --manifest-path src-tauri/Cargo.toml",
    "test:unit": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

Preserve existing package metadata and dependencies.

- [ ] **Step 5: Configure Vitest**

Create `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: Replace starter app with a minimal shell**

Create `src/App.tsx`:

```tsx
import "./styles.css";

export default function App() {
  return (
    <main className="app-shell">
      <aside className="file-pane">Open a folder</aside>
      <section className="editor-pane">No file open</section>
      <aside className="assistant-pane">Assistant</aside>
    </main>
  );
}
```

Create `src/styles.css`:

```css
:root {
  color: #20242a;
  background: #f6f7f9;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 980px;
  min-height: 720px;
}

button,
input,
textarea,
select {
  font: inherit;
}

.app-shell {
  display: grid;
  grid-template-columns: 280px minmax(420px, 1fr) 360px;
  height: 100vh;
  overflow: hidden;
}

.file-pane,
.editor-pane,
.assistant-pane {
  min-width: 0;
  overflow: auto;
  border-right: 1px solid #d9dee7;
  background: #ffffff;
}

.file-pane,
.assistant-pane {
  padding: 16px;
  background: #f8f9fb;
}

.editor-pane {
  padding: 28px;
}
```

- [ ] **Step 7: Verify scaffold**

Run:

```bash
npm run test:unit
npm run tauri:test
npm run build
```

Expected: unit tests report no test files or pass, Rust tests pass, and the Vite build succeeds.

- [ ] **Step 8: Commit**

Run:

```bash
git add .gitignore README.md package.json package-lock.json index.html tsconfig.json tsconfig.node.json vite.config.ts vitest.config.ts src src-tauri
git commit -m "chore: scaffold tauri react app"
```

### Task 2: Define Shared Types and App Reducer

**Files:**
- Create: `src/types.ts`
- Create: `src/state/appReducer.ts`
- Create: `src/state/appReducer.test.ts`

- [ ] **Step 1: Write reducer tests**

Create `src/state/appReducer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { appReducer, initialAppState } from "./appReducer";

describe("appReducer", () => {
  it("opens one file at a time and clears dirty state", () => {
    const state = appReducer(initialAppState, {
      type: "fileOpened",
      file: {
        path: "/novel/chapter-1.md",
        relativePath: "chapter-1.md",
        name: "chapter-1.md",
        extension: "md",
        kind: "file",
        isMarkdown: true,
        modifiedAt: 10,
        size: 42,
      },
      markdown: "# Chapter 1",
    });

    expect(state.openFile?.relativePath).toBe("chapter-1.md");
    expect(state.openMarkdown).toBe("# Chapter 1");
    expect(state.isDirty).toBe(false);
  });

  it("marks editor dirty on content changes", () => {
    const opened = appReducer(initialAppState, {
      type: "fileOpened",
      file: {
        path: "/novel/chapter-1.md",
        relativePath: "chapter-1.md",
        name: "chapter-1.md",
        extension: "md",
        kind: "file",
        isMarkdown: true,
        modifiedAt: 10,
        size: 42,
      },
      markdown: "# Chapter 1",
    });

    const changed = appReducer(opened, {
      type: "editorChanged",
      markdown: "# Chapter 1\n\nChanged.",
    });

    expect(changed.isDirty).toBe(true);
    expect(changed.openMarkdown).toContain("Changed.");
  });

  it("resets assistant messages when a project opens", () => {
    const withMessage = {
      ...initialAppState,
      assistantMessages: [{ role: "assistant" as const, content: "Old session" }],
    };

    const state = appReducer(withMessage, {
      type: "projectOpened",
      rootPath: "/novel",
      tree: [],
      indexedDocuments: [],
    });

    expect(state.assistantMessages).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement shared types**

Create `src/types.ts`:

```ts
export type FileKind = "file" | "directory";

export interface FileNode {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  kind: FileKind;
  isMarkdown: boolean;
  modifiedAt: number;
  size: number;
  children?: FileNode[];
}

export interface IndexedDocument {
  path: string;
  relativePath: string;
  title: string;
  headings: string[];
  links: string[];
  chunks: string[];
  modifiedAt: number;
}

export type ProviderId = "openai-subscription" | "anthropic-subscription" | "lm-studio";
export type AssistantMode = "rewrite" | "diff" | "suggestions";

export interface AssistantMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AppSettings {
  defaultProvider: ProviderId;
  openaiUrl: string;
  anthropicUrl: string;
  lmStudioBaseUrl: string;
  lmStudioModel: string;
  editorFontSize: number;
  editorLineWidth: number;
  ignoreHidden: boolean;
  ignoreLargeFiles: boolean;
}

export interface OpenFile {
  file: FileNode;
  markdown: string;
}
```

- [ ] **Step 3: Implement reducer**

Create `src/state/appReducer.ts`:

```ts
import type { AssistantMessage, FileNode, IndexedDocument, OpenFile, AppSettings } from "../types";

export interface AppState {
  rootPath: string | null;
  tree: FileNode[];
  indexedDocuments: IndexedDocument[];
  openFile: FileNode | null;
  openMarkdown: string;
  savedMarkdown: string;
  isDirty: boolean;
  assistantMessages: AssistantMessage[];
  settings: AppSettings;
}

export type AppAction =
  | { type: "projectOpened"; rootPath: string; tree: FileNode[]; indexedDocuments: IndexedDocument[] }
  | { type: "fileOpened"; file: OpenFile["file"]; markdown: string }
  | { type: "editorChanged"; markdown: string }
  | { type: "fileSaved"; markdown: string }
  | { type: "treeUpdated"; tree: FileNode[]; indexedDocuments: IndexedDocument[] }
  | { type: "assistantMessageAdded"; message: AssistantMessage }
  | { type: "settingsLoaded"; settings: AppSettings };

export const defaultSettings: AppSettings = {
  defaultProvider: "openai-subscription",
  openaiUrl: "https://chatgpt.com/",
  anthropicUrl: "https://claude.ai/new",
  lmStudioBaseUrl: "http://127.0.0.1:1234/v1",
  lmStudioModel: "local-model",
  editorFontSize: 18,
  editorLineWidth: 760,
  ignoreHidden: true,
  ignoreLargeFiles: true,
};

export const initialAppState: AppState = {
  rootPath: null,
  tree: [],
  indexedDocuments: [],
  openFile: null,
  openMarkdown: "",
  savedMarkdown: "",
  isDirty: false,
  assistantMessages: [],
  settings: defaultSettings,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "projectOpened":
      return {
        ...state,
        rootPath: action.rootPath,
        tree: action.tree,
        indexedDocuments: action.indexedDocuments,
        openFile: null,
        openMarkdown: "",
        savedMarkdown: "",
        isDirty: false,
        assistantMessages: [],
      };
    case "fileOpened":
      return {
        ...state,
        openFile: action.file,
        openMarkdown: action.markdown,
        savedMarkdown: action.markdown,
        isDirty: false,
      };
    case "editorChanged":
      return {
        ...state,
        openMarkdown: action.markdown,
        isDirty: action.markdown !== state.savedMarkdown,
      };
    case "fileSaved":
      return {
        ...state,
        openMarkdown: action.markdown,
        savedMarkdown: action.markdown,
        isDirty: false,
      };
    case "treeUpdated":
      return {
        ...state,
        tree: action.tree,
        indexedDocuments: action.indexedDocuments,
      };
    case "assistantMessageAdded":
      return {
        ...state,
        assistantMessages: [...state.assistantMessages, action.message],
      };
    case "settingsLoaded":
      return {
        ...state,
        settings: action.settings,
      };
  }
}
```

- [ ] **Step 4: Verify reducer**

Run:

```bash
npm run test:unit -- src/state/appReducer.test.ts
```

Expected: all reducer tests pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/types.ts src/state/appReducer.ts src/state/appReducer.test.ts
git commit -m "feat: add app state model"
```

### Task 3: Build Rust Workspace Commands

**Files:**
- Create: `src-tauri/src/model.rs`
- Create: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/workspace.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write Rust workspace tests**

Create tests inside `src-tauri/src/commands/workspace.rs` under `#[cfg(test)]`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_root() -> tempfile::TempDir {
        tempfile::tempdir().expect("temp dir")
    }

    #[test]
    fn builds_tree_with_markdown_flags() {
        let root = temp_root();
        fs::write(root.path().join("chapter.md"), "# Chapter").unwrap();
        fs::write(root.path().join("cover.png"), "fake").unwrap();

        let tree = scan_tree(root.path()).unwrap();

        let chapter = tree.iter().find(|node| node.name == "chapter.md").unwrap();
        let cover = tree.iter().find(|node| node.name == "cover.png").unwrap();
        assert!(chapter.is_markdown);
        assert!(!cover.is_markdown);
    }

    #[test]
    fn refuses_paths_outside_root() {
        let root = temp_root();
        let outside = root.path().parent().unwrap().join("outside.md");
        let err = ensure_inside_root(root.path(), &outside).unwrap_err();
        assert!(err.contains("outside project root"));
    }
}
```

Add dev dependency:

```bash
cargo add tempfile --dev --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 2: Implement Rust models**

Create `src-tauri/src/model.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    pub path: String,
    pub relative_path: String,
    pub name: String,
    pub extension: String,
    pub kind: FileKind,
    pub is_markdown: bool,
    pub modified_at: u64,
    pub size: u64,
    pub children: Option<Vec<FileNode>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum FileKind {
    File,
    Directory,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenFile {
    pub file: FileNode,
    pub markdown: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteFileRequest {
    pub root_path: String,
    pub file_path: String,
    pub markdown: String,
}
```

- [ ] **Step 3: Implement workspace commands**

Create `src-tauri/src/commands/mod.rs`:

```rust
pub mod workspace;
```

Create `src-tauri/src/commands/workspace.rs`:

```rust
use crate::model::{FileKind, FileNode, OpenFile, WriteFileRequest};
use std::ffi::OsStr;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const LARGE_FILE_LIMIT_BYTES: u64 = 2_000_000;

#[tauri::command]
pub fn read_project_tree(root_path: String) -> Result<Vec<FileNode>, String> {
    scan_tree(Path::new(&root_path))
}

#[tauri::command]
pub fn read_markdown_file(root_path: String, file_path: String) -> Result<OpenFile, String> {
    let root = PathBuf::from(root_path);
    let file = PathBuf::from(file_path);
    ensure_inside_root(&root, &file)?;

    let node = node_from_path(&root, &file)?;
    if !node.is_markdown {
        return Err("only Markdown files can be opened in the editor".to_string());
    }

    let markdown = fs::read_to_string(&file).map_err(|err| err.to_string())?;
    Ok(OpenFile { file: node, markdown })
}

#[tauri::command]
pub fn write_markdown_file(request: WriteFileRequest) -> Result<(), String> {
    let root = PathBuf::from(request.root_path);
    let file = PathBuf::from(request.file_path);
    ensure_inside_root(&root, &file)?;

    if extension(&file) != "md" {
        return Err("only Markdown files can be saved by the editor".to_string());
    }

    fs::write(file, request.markdown).map_err(|err| err.to_string())
}

pub fn scan_tree(root: &Path) -> Result<Vec<FileNode>, String> {
    if !root.is_dir() {
        return Err("project root is not a directory".to_string());
    }

    let mut nodes = Vec::new();
    for entry in fs::read_dir(root).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        if should_skip(&path) {
            continue;
        }
        nodes.push(node_from_path(root, &path)?);
    }
    nodes.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(nodes)
}

pub fn ensure_inside_root(root: &Path, path: &Path) -> Result<(), String> {
    let root = root.canonicalize().map_err(|err| err.to_string())?;
    let path = path.canonicalize().map_err(|err| err.to_string())?;
    if path.starts_with(&root) {
        Ok(())
    } else {
        Err("path is outside project root".to_string())
    }
}

fn node_from_path(root: &Path, path: &Path) -> Result<FileNode, String> {
    let metadata = fs::metadata(path).map_err(|err| err.to_string())?;
    let kind = if metadata.is_dir() { FileKind::Directory } else { FileKind::File };
    let children = if metadata.is_dir() { Some(scan_tree(path)?) } else { None };
    let modified_at = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    let relative_path = path
        .strip_prefix(root)
        .map_err(|err| err.to_string())?
        .to_string_lossy()
        .to_string();

    Ok(FileNode {
        path: path.to_string_lossy().to_string(),
        relative_path,
        name: path.file_name().unwrap_or_else(|| OsStr::new("")).to_string_lossy().to_string(),
        extension: extension(path),
        kind,
        is_markdown: extension(path) == "md",
        modified_at,
        size: metadata.len(),
        children,
    })
}

fn should_skip(path: &Path) -> bool {
    let file_name = path.file_name().and_then(|name| name.to_str()).unwrap_or("");
    file_name.starts_with('.') || fs::metadata(path).map(|m| m.len() > LARGE_FILE_LIMIT_BYTES && m.is_file()).unwrap_or(false)
}

fn extension(path: &Path) -> String {
    path.extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase()
}
```

- [ ] **Step 4: Register commands**

Modify `src-tauri/src/lib.rs`:

```rust
mod commands;
mod model;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::workspace::read_project_tree,
            commands::workspace::read_markdown_file,
            commands::workspace::write_markdown_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: Verify Rust commands**

Run:

```bash
npm run tauri:test
```

Expected: Rust tests pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add src-tauri
git commit -m "feat: add workspace file commands"
```

### Task 4: Add Frontend Tauri API Wrapper

**Files:**
- Create: `src/api/tauri.ts`
- Create: `src/api/tauri.test.ts`

- [ ] **Step 1: Write API wrapper tests**

Create `src/api/tauri.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createTauriApi } from "./tauri";

describe("createTauriApi", () => {
  it("opens a folder and reads the project tree", async () => {
    const open = vi.fn().mockResolvedValue("/novel");
    const invoke = vi.fn().mockResolvedValue([{ name: "chapter.md" }]);
    const api = createTauriApi({ open, invoke, writeText: vi.fn(), openUrl: vi.fn() });

    const result = await api.pickProjectFolder();

    expect(open).toHaveBeenCalledWith({ directory: true, multiple: false });
    expect(invoke).toHaveBeenCalledWith("read_project_tree", { rootPath: "/novel" });
    expect(result.rootPath).toBe("/novel");
  });
});
```

- [ ] **Step 2: Implement API wrapper**

Create `src/api/tauri.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-dialog";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import type { FileNode, OpenFile } from "../types";

interface TauriDeps {
  open: typeof open;
  invoke: typeof invoke;
  writeText: typeof writeText;
  openUrl: typeof openUrl;
}

export function createTauriApi(deps: TauriDeps) {
  return {
    async pickProjectFolder(): Promise<{ rootPath: string; tree: FileNode[] } | null> {
      const selected = await deps.open({ directory: true, multiple: false });
      if (typeof selected !== "string") {
        return null;
      }
      const tree = await deps.invoke<FileNode[]>("read_project_tree", { rootPath: selected });
      return { rootPath: selected, tree };
    },

    async readMarkdownFile(rootPath: string, filePath: string): Promise<OpenFile> {
      return deps.invoke<OpenFile>("read_markdown_file", { rootPath, filePath });
    },

    async writeMarkdownFile(rootPath: string, filePath: string, markdown: string): Promise<void> {
      await deps.invoke("write_markdown_file", { request: { rootPath, filePath, markdown } });
    },

    async copyText(text: string): Promise<void> {
      await deps.writeText(text);
    },

    async openExternal(url: string): Promise<void> {
      await deps.openUrl(url);
    },
  };
}

export const tauriApi = createTauriApi({ open, invoke, writeText, openUrl });
```

- [ ] **Step 3: Verify API wrapper**

Run:

```bash
npm run test:unit -- src/api/tauri.test.ts
```

Expected: wrapper test passes.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/api src-tauri package.json package-lock.json
git commit -m "feat: add tauri frontend api wrapper"
```

### Task 5: Implement Markdown Context Indexer

**Files:**
- Create: `src/context/indexer.ts`
- Create: `src/context/indexer.test.ts`

- [ ] **Step 1: Write indexer tests**

Create `src/context/indexer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildIndex, selectRelevantContext } from "./indexer";

describe("indexer", () => {
  it("extracts headings, links, and chunks from markdown files", () => {
    const docs = buildIndex([
      {
        path: "/novel/chapter.md",
        relativePath: "chapter.md",
        markdown: "# Chapter\n\nMara entered the observatory.\n\nSee [[Mara]].",
        modifiedAt: 10,
      },
    ]);

    expect(docs[0].headings).toEqual(["Chapter"]);
    expect(docs[0].links).toEqual(["Mara"]);
    expect(docs[0].chunks[0]).toContain("Mara entered");
  });

  it("selects relevant context without returning the target file twice", () => {
    const docs = buildIndex([
      {
        path: "/novel/chapter.md",
        relativePath: "chapter.md",
        markdown: "# Chapter\n\nMara sees a lighthouse.",
        modifiedAt: 10,
      },
      {
        path: "/novel/notes.md",
        relativePath: "notes.md",
        markdown: "# Lighthouse\n\nThe lighthouse hides the signal.",
        modifiedAt: 20,
      },
    ]);

    const context = selectRelevantContext({
      documents: docs,
      targetPath: "/novel/chapter.md",
      instruction: "Strengthen the lighthouse scene",
      limit: 3,
    });

    expect(context.map((doc) => doc.relativePath)).toEqual(["notes.md"]);
  });
});
```

- [ ] **Step 2: Implement deterministic indexer**

Create `src/context/indexer.ts`:

```ts
import type { IndexedDocument } from "../types";

interface MarkdownInput {
  path: string;
  relativePath: string;
  markdown: string;
  modifiedAt: number;
}

interface SelectContextInput {
  documents: IndexedDocument[];
  targetPath: string;
  instruction: string;
  limit: number;
}

export function buildIndex(files: MarkdownInput[]): IndexedDocument[] {
  return files.map((file) => ({
    path: file.path,
    relativePath: file.relativePath,
    title: titleFromMarkdown(file.markdown, file.relativePath),
    headings: extractHeadings(file.markdown),
    links: extractLinks(file.markdown),
    chunks: chunkMarkdown(file.markdown),
    modifiedAt: file.modifiedAt,
  }));
}

export function selectRelevantContext(input: SelectContextInput): IndexedDocument[] {
  const terms = tokenize(input.instruction);
  return input.documents
    .filter((doc) => doc.path !== input.targetPath)
    .map((doc) => ({ doc, score: scoreDocument(doc, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.doc.modifiedAt - a.doc.modifiedAt)
    .slice(0, input.limit)
    .map((entry) => entry.doc);
}

function titleFromMarkdown(markdown: string, fallback: string): string {
  return extractHeadings(markdown)[0] ?? fallback;
}

function extractHeadings(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.match(/^#{1,6}\s+(.+)$/)?.[1]?.trim())
    .filter((heading): heading is string => Boolean(heading));
}

function extractLinks(markdown: string): string[] {
  const links = new Set<string>();
  for (const match of markdown.matchAll(/\[\[([^\]]+)\]\]|\[([^\]]+)\]\(([^)]+)\)/g)) {
    links.add((match[1] ?? match[2] ?? match[3]).trim());
  }
  return [...links];
}

function chunkMarkdown(markdown: string): string[] {
  return markdown
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function scoreDocument(doc: IndexedDocument, terms: string[]): number {
  const haystack = [doc.relativePath, doc.title, ...doc.headings, ...doc.links, ...doc.chunks]
    .join(" ")
    .toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2);
}
```

- [ ] **Step 3: Verify indexer**

Run:

```bash
npm run test:unit -- src/context/indexer.test.ts
```

Expected: indexer tests pass.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/context
git commit -m "feat: add markdown context indexer"
```

### Task 6: Implement Rich Markdown Editor Boundary

**Files:**
- Create: `src/editor/markdown.ts`
- Create: `src/editor/markdown.test.ts`
- Create: `src/components/EditorPane.tsx`
- Create: `src/components/EditorPane.test.tsx`

- [ ] **Step 1: Write Markdown adapter tests**

Create `src/editor/markdown.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeMarkdownForSave } from "./markdown";

describe("normalizeMarkdownForSave", () => {
  it("keeps markdown text stable and trims trailing whitespace", () => {
    const result = normalizeMarkdownForSave("# Chapter 1  \n\nText.   \n");
    expect(result).toBe("# Chapter 1\n\nText.\n");
  });
});
```

- [ ] **Step 2: Implement Markdown adapter**

Create `src/editor/markdown.ts`:

```ts
export function normalizeMarkdownForSave(markdown: string): string {
  const normalized = markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n*$/, "");
  return `${normalized}\n`;
}
```

- [ ] **Step 3: Write editor component test**

Create `src/components/EditorPane.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditorPane } from "./EditorPane";

describe("EditorPane", () => {
  it("shows empty state when no file is open", () => {
    render(<EditorPane openFile={null} markdown="" isDirty={false} onChange={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText("No file open")).toBeInTheDocument();
  });

  it("shows dirty status for unsaved edits", () => {
    render(
      <EditorPane
        openFile={{ relativePath: "chapter.md", name: "chapter.md" }}
        markdown="# Chapter"
        isDirty={true}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Implement editor component**

Create `src/components/EditorPane.tsx`:

```tsx
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { useEffect } from "react";

interface EditorPaneProps {
  openFile: { relativePath: string; name: string } | null;
  markdown: string;
  isDirty: boolean;
  onChange: (markdown: string) => void;
  onSave: () => void;
}

export function EditorPane({ openFile, markdown, isDirty, onChange, onSave }: EditorPaneProps) {
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: markdown,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "manuscript-editor",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getMarkdown());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getMarkdown() !== markdown) {
      editor.commands.setContent(markdown, { contentType: "markdown" });
    }
  }, [editor, markdown]);

  if (!openFile) {
    return <section className="editor-pane empty-state">No file open</section>;
  }

  return (
    <section className="editor-pane">
      <header className="editor-header">
        <div>
          <strong>{openFile.name}</strong>
          <span>{openFile.relativePath}</span>
        </div>
        <div className="editor-actions">
          <span>{isDirty ? "Unsaved" : "Saved"}</span>
          <button type="button" onClick={onSave} disabled={!isDirty}>
            Save
          </button>
        </div>
      </header>
      <EditorContent editor={editor} />
    </section>
  );
}
```

- [ ] **Step 5: Add editor styles**

Append to `src/styles.css`:

```css
.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.editor-header span {
  display: block;
  margin-top: 4px;
  color: #66717f;
  font-size: 13px;
}

.editor-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.manuscript-editor {
  max-width: 760px;
  min-height: calc(100vh - 120px);
  margin: 0 auto;
  outline: none;
  font-size: 18px;
  line-height: 1.72;
}

.manuscript-editor h1,
.manuscript-editor h2,
.manuscript-editor h3 {
  line-height: 1.25;
}
```

- [ ] **Step 6: Verify editor**

Run:

```bash
npm run test:unit -- src/editor/markdown.test.ts src/components/EditorPane.test.tsx
```

Expected: editor tests pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/editor src/components/EditorPane.tsx src/components/EditorPane.test.tsx src/styles.css package.json package-lock.json
git commit -m "feat: add rich markdown editor pane"
```

### Task 7: Implement File Tree UI and Basic File Operations

**Files:**
- Create: `src/components/FileTree.tsx`
- Create: `src/components/FileTree.test.tsx`
- Modify: `src-tauri/src/commands/workspace.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add Rust file operation tests**

Add tests to `src-tauri/src/commands/workspace.rs`:

```rust
#[test]
fn creates_and_renames_markdown_file() {
    let root = temp_root();
    create_file(root.path().to_string_lossy().to_string(), "chapter.md".to_string()).unwrap();
    assert!(root.path().join("chapter.md").exists());

    rename_entry(
        root.path().to_string_lossy().to_string(),
        root.path().join("chapter.md").to_string_lossy().to_string(),
        "renamed.md".to_string(),
    )
    .unwrap();
    assert!(root.path().join("renamed.md").exists());
}
```

- [ ] **Step 2: Implement Rust file operation commands**

Add commands to `src-tauri/src/commands/workspace.rs`:

```rust
#[tauri::command]
pub fn create_file(root_path: String, relative_path: String) -> Result<(), String> {
    let root = PathBuf::from(root_path);
    let file = root.join(relative_path);
    ensure_parent_inside_root(&root, &file)?;
    fs::File::create(file).map(|_| ()).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn create_folder(root_path: String, relative_path: String) -> Result<(), String> {
    let root = PathBuf::from(root_path);
    let folder = root.join(relative_path);
    ensure_parent_inside_root(&root, &folder)?;
    fs::create_dir_all(folder).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn rename_entry(root_path: String, path: String, new_name: String) -> Result<(), String> {
    let root = PathBuf::from(root_path);
    let source = PathBuf::from(path);
    ensure_inside_root(&root, &source)?;
    let target = source.with_file_name(new_name);
    ensure_parent_inside_root(&root, &target)?;
    fs::rename(source, target).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn delete_entry(root_path: String, path: String) -> Result<(), String> {
    let root = PathBuf::from(root_path);
    let target = PathBuf::from(path);
    ensure_inside_root(&root, &target)?;
    let metadata = fs::metadata(&target).map_err(|err| err.to_string())?;
    if metadata.is_dir() {
        fs::remove_dir_all(target).map_err(|err| err.to_string())
    } else {
        fs::remove_file(target).map_err(|err| err.to_string())
    }
}

fn ensure_parent_inside_root(root: &Path, path: &Path) -> Result<(), String> {
    let parent = path.parent().ok_or_else(|| "path has no parent".to_string())?;
    ensure_inside_root(root, parent)
}
```

Register these commands in `src-tauri/src/lib.rs`.

- [ ] **Step 3: Write FileTree component test**

Create `src/components/FileTree.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FileTree } from "./FileTree";

describe("FileTree", () => {
  it("renders all files and opens markdown files", async () => {
    const onOpenFile = vi.fn();
    render(
      <FileTree
        rootPath="/novel"
        nodes={[
          {
            path: "/novel/chapter.md",
            relativePath: "chapter.md",
            name: "chapter.md",
            extension: "md",
            kind: "file",
            isMarkdown: true,
            modifiedAt: 1,
            size: 10,
          },
          {
            path: "/novel/cover.png",
            relativePath: "cover.png",
            name: "cover.png",
            extension: "png",
            kind: "file",
            isMarkdown: false,
            modifiedAt: 1,
            size: 10,
          },
        ]}
        onOpenFile={onOpenFile}
        onOpenFolder={vi.fn()}
      />,
    );

    expect(screen.getByText("cover.png")).toBeInTheDocument();
    await userEvent.click(screen.getByText("chapter.md"));
    expect(onOpenFile).toHaveBeenCalledWith("/novel/chapter.md");
  });
});
```

- [ ] **Step 4: Implement FileTree**

Create `src/components/FileTree.tsx`:

```tsx
import type { FileNode } from "../types";

interface FileTreeProps {
  rootPath: string | null;
  nodes: FileNode[];
  onOpenFolder: () => void;
  onOpenFile: (path: string) => void;
}

export function FileTree({ rootPath, nodes, onOpenFolder, onOpenFile }: FileTreeProps) {
  return (
    <aside className="file-pane">
      <header className="pane-header">
        <strong>{rootPath ? "Files" : "DraftAgent"}</strong>
        <button type="button" onClick={onOpenFolder}>
          Open Folder
        </button>
      </header>
      {rootPath ? <TreeList nodes={nodes} onOpenFile={onOpenFile} /> : <p>Open a folder to start.</p>}
    </aside>
  );
}

function TreeList({ nodes, onOpenFile }: { nodes: FileNode[]; onOpenFile: (path: string) => void }) {
  return (
    <ul className="file-tree">
      {nodes.map((node) => (
        <li key={node.path}>
          <button
            type="button"
            className={node.isMarkdown ? "file-node markdown" : "file-node"}
            onClick={() => node.kind === "file" && node.isMarkdown && onOpenFile(node.path)}
          >
            {node.name}
          </button>
          {node.children ? <TreeList nodes={node.children} onOpenFile={onOpenFile} /> : null}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Verify file operations**

Run:

```bash
npm run tauri:test
npm run test:unit -- src/components/FileTree.test.tsx
```

Expected: Rust file operation tests and FileTree UI tests pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/components/FileTree.tsx src/components/FileTree.test.tsx src-tauri
git commit -m "feat: add file tree operations"
```

### Task 8: Wire Main App Workflow

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write App integration test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./api/tauri", () => ({
  tauriApi: {
    pickProjectFolder: vi.fn(),
    readMarkdownFile: vi.fn(),
    writeMarkdownFile: vi.fn(),
    copyText: vi.fn(),
    openExternal: vi.fn(),
    sendLmStudioRequest: vi.fn(),
    loadSettings: vi.fn(),
    saveSettings: vi.fn(),
  },
}));

describe("App", () => {
  it("renders the three main panes", () => {
    render(<App />);
    expect(screen.getByText("DraftAgent")).toBeInTheDocument();
    expect(screen.getByText("No file open")).toBeInTheDocument();
    expect(screen.getByText("Assistant")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Wire reducer, file tree, and editor**

Update `src/App.tsx`:

```tsx
import { useReducer } from "react";
import { tauriApi } from "./api/tauri";
import { EditorPane } from "./components/EditorPane";
import { FileTree } from "./components/FileTree";
import { buildIndex } from "./context/indexer";
import { normalizeMarkdownForSave } from "./editor/markdown";
import { appReducer, initialAppState } from "./state/appReducer";
import "./styles.css";

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);

  async function openFolder() {
    const project = await tauriApi.pickProjectFolder();
    if (!project) return;
    dispatch({
      type: "projectOpened",
      rootPath: project.rootPath,
      tree: project.tree,
      indexedDocuments: buildIndex([]),
    });
  }

  async function openFile(path: string) {
    if (!state.rootPath) return;
    if (state.isDirty && !window.confirm("Discard unsaved changes?")) return;
    const openFile = await tauriApi.readMarkdownFile(state.rootPath, path);
    dispatch({ type: "fileOpened", file: openFile.file, markdown: openFile.markdown });
  }

  async function saveFile() {
    if (!state.rootPath || !state.openFile) return;
    const markdown = normalizeMarkdownForSave(state.openMarkdown);
    await tauriApi.writeMarkdownFile(state.rootPath, state.openFile.path, markdown);
    dispatch({ type: "fileSaved", markdown });
  }

  return (
    <main className="app-shell">
      <FileTree rootPath={state.rootPath} nodes={state.tree} onOpenFolder={openFolder} onOpenFile={openFile} />
      <EditorPane
        openFile={state.openFile}
        markdown={state.openMarkdown}
        isDirty={state.isDirty}
        onChange={(markdown) => dispatch({ type: "editorChanged", markdown })}
        onSave={saveFile}
      />
      <aside className="assistant-pane">
        <h2>Assistant</h2>
      </aside>
    </main>
  );
}
```

- [ ] **Step 3: Verify app wiring**

Run:

```bash
npm run test:unit -- src/App.test.tsx src/state/appReducer.test.ts src/components/FileTree.test.tsx src/components/EditorPane.test.tsx
npm run build
```

Expected: tests pass and build succeeds.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: wire main writing workspace"
```

### Task 9: Build Assistant Prompt and Subscription Handoff

**Files:**
- Create: `src/assistant/promptBuilder.ts`
- Create: `src/assistant/promptBuilder.test.ts`
- Create: `src/components/AssistantPane.tsx`
- Create: `src/components/AssistantPane.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write prompt builder tests**

Create `src/assistant/promptBuilder.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildAssistantPrompt } from "./promptBuilder";

describe("buildAssistantPrompt", () => {
  it("builds a rewrite prompt with target and context", () => {
    const prompt = buildAssistantPrompt({
      mode: "rewrite",
      instruction: "Make this more tense.",
      targetLabel: "chapter.md",
      targetMarkdown: "The door opened.",
      context: [{ relativePath: "notes.md", title: "Notes", chunks: ["The house is haunted."] }],
    });

    expect(prompt).toContain("Mode: Full rewrite");
    expect(prompt).toContain("The door opened.");
    expect(prompt).toContain("The house is haunted.");
  });
});
```

- [ ] **Step 2: Implement prompt builder**

Create `src/assistant/promptBuilder.ts`:

```ts
import type { AssistantMode, IndexedDocument } from "../types";

interface PromptInput {
  mode: AssistantMode;
  instruction: string;
  targetLabel: string;
  targetMarkdown: string;
  context: Pick<IndexedDocument, "relativePath" | "title" | "chunks">[];
}

const modeLabels: Record<AssistantMode, string> = {
  rewrite: "Full rewrite",
  diff: "Proposed diff edits",
  suggestions: "Suggestions only",
};

export function buildAssistantPrompt(input: PromptInput): string {
  const contextText = input.context
    .map((doc) => `### ${doc.relativePath}\n${doc.chunks.slice(0, 3).join("\n\n")}`)
    .join("\n\n");

  return [
    "You are helping revise a novel draft.",
    `Mode: ${modeLabels[input.mode]}`,
    `Instruction: ${input.instruction}`,
    "",
    `Target: ${input.targetLabel}`,
    "```markdown",
    input.targetMarkdown,
    "```",
    "",
    "Relevant context:",
    contextText || "No extra context selected.",
    "",
    outputInstructions(input.mode),
  ].join("\n");
}

function outputInstructions(mode: AssistantMode): string {
  if (mode === "rewrite") {
    return "Return only the rewritten Markdown for the target.";
  }
  if (mode === "diff") {
    return "Return a unified diff against the target Markdown.";
  }
  return "Return concise suggestions. Do not rewrite the passage unless asked.";
}
```

- [ ] **Step 3: Write AssistantPane test**

Create `src/components/AssistantPane.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AssistantPane } from "./AssistantPane";

describe("AssistantPane", () => {
  it("submits a subscription handoff request", async () => {
    const onSubmit = vi.fn();
    render(<AssistantPane defaultProvider="openai-subscription" onSubmit={onSubmit} onImport={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Instruction"), "Make it sharper");
    await userEvent.click(screen.getByText("Prepare"));

    expect(onSubmit).toHaveBeenCalledWith({
      provider: "openai-subscription",
      mode: "rewrite",
      instruction: "Make it sharper",
    });
  });
});
```

- [ ] **Step 4: Implement AssistantPane**

Create `src/components/AssistantPane.tsx`:

```tsx
import { useState } from "react";
import type { AssistantMode, ProviderId } from "../types";

interface AssistantPaneProps {
  defaultProvider: ProviderId;
  onSubmit: (request: { provider: ProviderId; mode: AssistantMode; instruction: string }) => void;
  onImport: (response: string) => void;
}

export function AssistantPane({ defaultProvider, onSubmit, onImport }: AssistantPaneProps) {
  const [provider, setProvider] = useState<ProviderId>(defaultProvider);
  const [mode, setMode] = useState<AssistantMode>("rewrite");
  const [instruction, setInstruction] = useState("");
  const [importText, setImportText] = useState("");

  return (
    <aside className="assistant-pane">
      <h2>Assistant</h2>
      <label>
        Provider
        <select value={provider} onChange={(event) => setProvider(event.target.value as ProviderId)}>
          <option value="openai-subscription">OpenAI</option>
          <option value="anthropic-subscription">Anthropic</option>
          <option value="lm-studio">LM Studio</option>
        </select>
      </label>
      <label>
        Mode
        <select value={mode} onChange={(event) => setMode(event.target.value as AssistantMode)}>
          <option value="rewrite">Full rewrite</option>
          <option value="diff">Proposed edits</option>
          <option value="suggestions">Suggestions</option>
        </select>
      </label>
      <label>
        Instruction
        <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} />
      </label>
      <button type="button" onClick={() => onSubmit({ provider, mode, instruction })}>
        Prepare
      </button>
      <label>
        Import response
        <textarea value={importText} onChange={(event) => setImportText(event.target.value)} />
      </label>
      <button type="button" onClick={() => onImport(importText)}>
        Import
      </button>
    </aside>
  );
}
```

- [ ] **Step 5: Wire handoff in App**

In `src/App.tsx`, build prompt from current editor content, copy it, and open the selected service URL:

```ts
async function submitAssistantRequest(request: { provider: ProviderId; mode: AssistantMode; instruction: string }) {
  if (!state.openFile) return;
  const context = selectRelevantContext({
    documents: state.indexedDocuments,
    targetPath: state.openFile.path,
    instruction: request.instruction,
    limit: 4,
  });
  const prompt = buildAssistantPrompt({
    mode: request.mode,
    instruction: request.instruction,
    targetLabel: state.openFile.relativePath,
    targetMarkdown: state.openMarkdown,
    context,
  });

  await tauriApi.copyText(prompt);
  if (request.provider === "openai-subscription") {
    await tauriApi.openExternal(state.settings.openaiUrl);
  } else if (request.provider === "anthropic-subscription") {
    await tauriApi.openExternal(state.settings.anthropicUrl);
  }
}
```

Import `ProviderId`, `AssistantMode`, `buildAssistantPrompt`, and `selectRelevantContext`.

- [ ] **Step 6: Verify assistant handoff**

Run:

```bash
npm run test:unit -- src/assistant/promptBuilder.test.ts src/components/AssistantPane.test.tsx
npm run build
```

Expected: assistant prompt tests and build pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/assistant src/components/AssistantPane.tsx src/components/AssistantPane.test.tsx src/App.tsx
git commit -m "feat: add assistant subscription handoff"
```

### Task 10: Parse and Apply Imported Assistant Results

**Files:**
- Create: `src/assistant/responseParser.ts`
- Create: `src/assistant/responseParser.test.ts`
- Create: `src/assistant/applyResult.ts`
- Create: `src/assistant/applyResult.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write response parser tests**

Create `src/assistant/responseParser.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseAssistantResponse } from "./responseParser";

describe("parseAssistantResponse", () => {
  it("parses rewrite response as markdown", () => {
    const result = parseAssistantResponse("rewrite", "# Revised\n\nText.");
    expect(result).toEqual({ kind: "rewrite", markdown: "# Revised\n\nText." });
  });

  it("parses suggestions as notes", () => {
    const result = parseAssistantResponse("suggestions", "- Raise the stakes.");
    expect(result).toEqual({ kind: "suggestions", suggestions: "- Raise the stakes." });
  });
});
```

- [ ] **Step 2: Implement response parser**

Create `src/assistant/responseParser.ts`:

```ts
import type { AssistantMode } from "../types";

export type ParsedAssistantResult =
  | { kind: "rewrite"; markdown: string }
  | { kind: "diff"; patch: string }
  | { kind: "suggestions"; suggestions: string };

export function parseAssistantResponse(mode: AssistantMode, response: string): ParsedAssistantResult {
  const trimmed = stripMarkdownFence(response.trim());
  if (mode === "rewrite") {
    return { kind: "rewrite", markdown: trimmed };
  }
  if (mode === "diff") {
    return { kind: "diff", patch: trimmed };
  }
  return { kind: "suggestions", suggestions: trimmed };
}

function stripMarkdownFence(value: string): string {
  const match = value.match(/^```(?:markdown|diff)?\n([\s\S]*?)\n```$/);
  return match ? match[1].trim() : value;
}
```

- [ ] **Step 3: Write apply tests**

Create `src/assistant/applyResult.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyAssistantResult } from "./applyResult";

describe("applyAssistantResult", () => {
  it("applies full rewrite", () => {
    const result = applyAssistantResult("# Old", { kind: "rewrite", markdown: "# New" });
    expect(result).toBe("# New");
  });

  it("leaves suggestions out of the document", () => {
    const result = applyAssistantResult("# Old", { kind: "suggestions", suggestions: "Improve pacing." });
    expect(result).toBe("# Old");
  });
});
```

- [ ] **Step 4: Implement apply helper**

Create `src/assistant/applyResult.ts`:

```ts
import type { ParsedAssistantResult } from "./responseParser";

export function applyAssistantResult(currentMarkdown: string, result: ParsedAssistantResult): string {
  if (result.kind === "rewrite") {
    return result.markdown;
  }
  if (result.kind === "diff") {
    return applySimpleUnifiedDiff(currentMarkdown, result.patch);
  }
  return currentMarkdown;
}

function applySimpleUnifiedDiff(currentMarkdown: string, patch: string): string {
  const removed = patch
    .split("\n")
    .filter((line) => line.startsWith("-") && !line.startsWith("---"))
    .map((line) => line.slice(1))
    .join("\n");
  const added = patch
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n");

  if (!removed || !currentMarkdown.includes(removed)) {
    throw new Error("Diff could not be applied to the current document.");
  }

  return currentMarkdown.replace(removed, added);
}
```

- [ ] **Step 5: Wire import into App**

In `src/App.tsx`, track the last selected assistant mode with state and apply imported results:

```ts
function importAssistantResponse(response: string, mode: AssistantMode) {
  const parsed = parseAssistantResponse(mode, response);
  const nextMarkdown = applyAssistantResult(state.openMarkdown, parsed);
  dispatch({ type: "editorChanged", markdown: nextMarkdown });
  dispatch({
    type: "assistantMessageAdded",
    message: {
      role: "assistant",
      content: parsed.kind === "suggestions" ? parsed.suggestions : "Imported assistant result.",
    },
  });
}
```

Use `window.alert(error.message)` around failed diff application so the writer sees parse/apply failures.

- [ ] **Step 6: Verify imported result handling**

Run:

```bash
npm run test:unit -- src/assistant/responseParser.test.ts src/assistant/applyResult.test.ts
npm run build
```

Expected: parser/apply tests pass and build succeeds.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/assistant src/App.tsx
git commit -m "feat: apply imported assistant results"
```

### Task 11: Add LM Studio Direct Provider

**Files:**
- Modify: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/lm_studio.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/api/tauri.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add Rust LM Studio command**

Create `src-tauri/src/commands/lm_studio.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LmStudioRequest {
    pub base_url: String,
    pub model: String,
    pub prompt: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LmStudioResponse {
    pub content: String,
}

#[tauri::command]
pub async fn send_lm_studio_request(request: LmStudioRequest) -> Result<LmStudioResponse, String> {
    let url = format!("{}/chat/completions", request.base_url.trim_end_matches('/'));
    let body = serde_json::json!({
        "model": request.model,
        "messages": [
            { "role": "user", "content": request.prompt }
        ],
        "temperature": 0.7
    });

    let client = reqwest::Client::new();
    let response = client
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|err| err.to_string())?;

    let status = response.status();
    let value: serde_json::Value = response.json().await.map_err(|err| err.to_string())?;
    if !status.is_success() {
        return Err(format!("LM Studio returned {status}: {value}"));
    }

    let content = value["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| "LM Studio response did not include message content".to_string())?
        .to_string();

    Ok(LmStudioResponse { content })
}
```

Add dependencies:

```bash
cargo add reqwest --features json,rustls-tls --manifest-path src-tauri/Cargo.toml
cargo add serde_json --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 2: Register LM Studio command**

Update `src-tauri/src/commands/mod.rs`:

```rust
pub mod lm_studio;
pub mod workspace;
```

Add `commands::lm_studio::send_lm_studio_request` to `tauri::generate_handler![...]` in `src-tauri/src/lib.rs`.

- [ ] **Step 3: Add frontend API method**

Add to `src/api/tauri.ts` inside the returned object:

```ts
async sendLmStudioRequest(baseUrl: string, model: string, prompt: string): Promise<string> {
  const response = await deps.invoke<{ content: string }>("send_lm_studio_request", {
    request: { baseUrl, model, prompt },
  });
  return response.content;
}
```

- [ ] **Step 4: Wire LM Studio submit branch**

In `submitAssistantRequest`, add:

```ts
if (request.provider === "lm-studio") {
  const response = await tauriApi.sendLmStudioRequest(
    state.settings.lmStudioBaseUrl,
    state.settings.lmStudioModel,
    prompt,
  );
  importAssistantResponse(response, request.mode);
  return;
}
```

- [ ] **Step 5: Verify LM Studio command compiles**

Run:

```bash
npm run tauri:test
npm run build
```

Expected: Rust tests pass and TypeScript build succeeds. If LM Studio is not running, no live request test is required in this task.

- [ ] **Step 6: Commit**

Run:

```bash
git add src-tauri src/api/tauri.ts src/App.tsx package.json package-lock.json
git commit -m "feat: add lm studio provider"
```

### Task 12: Add Settings Screen

**Files:**
- Create: `src/components/SettingsDialog.tsx`
- Create: `src/components/SettingsDialog.test.tsx`
- Create: `src-tauri/src/commands/settings.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/api/tauri.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write settings component test**

Create `src/components/SettingsDialog.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../state/appReducer";
import { SettingsDialog } from "./SettingsDialog";

describe("SettingsDialog", () => {
  it("saves default provider changes", async () => {
    const onSave = vi.fn();
    render(<SettingsDialog settings={defaultSettings} onSave={onSave} onClose={vi.fn()} />);

    await userEvent.selectOptions(screen.getByLabelText("Default provider"), "anthropic-subscription");
    await userEvent.click(screen.getByText("Save settings"));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ defaultProvider: "anthropic-subscription" }));
  });
});
```

- [ ] **Step 2: Implement SettingsDialog**

Create `src/components/SettingsDialog.tsx`:

```tsx
import { useState } from "react";
import type { AppSettings, ProviderId } from "../types";

interface SettingsDialogProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

export function SettingsDialog({ settings, onSave, onClose }: SettingsDialogProps) {
  const [draft, setDraft] = useState(settings);

  return (
    <div className="settings-backdrop" role="dialog" aria-modal="true" aria-label="Settings">
      <section className="settings-dialog">
        <header>
          <h2>Settings</h2>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <label>
          Default provider
          <select
            value={draft.defaultProvider}
            onChange={(event) => setDraft({ ...draft, defaultProvider: event.target.value as ProviderId })}
          >
            <option value="openai-subscription">OpenAI</option>
            <option value="anthropic-subscription">Anthropic</option>
            <option value="lm-studio">LM Studio</option>
          </select>
        </label>
        <label>
          OpenAI URL
          <input value={draft.openaiUrl} onChange={(event) => setDraft({ ...draft, openaiUrl: event.target.value })} />
        </label>
        <label>
          Anthropic URL
          <input value={draft.anthropicUrl} onChange={(event) => setDraft({ ...draft, anthropicUrl: event.target.value })} />
        </label>
        <label>
          LM Studio base URL
          <input
            value={draft.lmStudioBaseUrl}
            onChange={(event) => setDraft({ ...draft, lmStudioBaseUrl: event.target.value })}
          />
        </label>
        <label>
          LM Studio model
          <input value={draft.lmStudioModel} onChange={(event) => setDraft({ ...draft, lmStudioModel: event.target.value })} />
        </label>
        <button type="button" onClick={() => onSave(draft)}>
          Save settings
        </button>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Implement settings persistence commands**

Create `src-tauri/src/commands/settings.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub default_provider: String,
    pub openai_url: String,
    pub anthropic_url: String,
    pub lm_studio_base_url: String,
    pub lm_studio_model: String,
    pub editor_font_size: u16,
    pub editor_line_width: u16,
    pub ignore_hidden: bool,
    pub ignore_large_files: bool,
}

#[tauri::command]
pub fn load_settings(app: tauri::AppHandle) -> Result<Option<Settings>, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(path).map_err(|err| err.to_string())?;
    serde_json::from_str(&text).map(Some).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn save_settings(app: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    let path = settings_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let text = serde_json::to_string_pretty(&settings).map_err(|err| err.to_string())?;
    fs::write(path, text).map_err(|err| err.to_string())
}

fn settings_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|err| err.to_string())?;
    Ok(dir.join("settings.json"))
}
```

Register `settings` module and commands in `mod.rs` and `lib.rs`.

- [ ] **Step 4: Wire settings in frontend API and App**

Add to `src/api/tauri.ts`:

```ts
async loadSettings(): Promise<AppSettings | null> {
  return deps.invoke<AppSettings | null>("load_settings");
},

async saveSettings(settings: AppSettings): Promise<void> {
  await deps.invoke("save_settings", { settings });
},
```

In `src/App.tsx`, load settings on mount, show SettingsDialog behind a toolbar button, and dispatch `settingsLoaded` after save.

- [ ] **Step 5: Verify settings**

Run:

```bash
npm run test:unit -- src/components/SettingsDialog.test.tsx
npm run tauri:test
npm run build
```

Expected: settings component test passes, Rust tests pass, build succeeds.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/components/SettingsDialog.tsx src/components/SettingsDialog.test.tsx src-tauri src/api/tauri.ts src/App.tsx src/styles.css
git commit -m "feat: add settings screen"
```

### Task 13: Add Error States and Unsaved-Change Protection

**Files:**
- Create: `src/state/guards.ts`
- Create: `src/state/guards.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/EditorPane.tsx`
- Modify: `src/components/FileTree.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add UI tests for unsaved switching**

Create `src/state/guards.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { shouldSwitchFile } from "./guards";

describe("unsaved change protection", () => {
  it("allows switching when the editor is clean", () => {
    const confirmDiscard = vi.fn();
    expect(shouldSwitchFile(false, confirmDiscard)).toBe(true);
    expect(confirmDiscard).not.toHaveBeenCalled();
  });

  it("blocks switching when discard is cancelled", () => {
    const confirmDiscard = vi.fn().mockReturnValue(false);
    expect(shouldSwitchFile(true, confirmDiscard)).toBe(false);
  });

  it("allows switching when discard is confirmed", () => {
    const confirmDiscard = vi.fn().mockReturnValue(true);
    expect(shouldSwitchFile(true, confirmDiscard)).toBe(true);
  });
});
```

- [ ] **Step 2: Implement unsaved switching guard**

Create `src/state/guards.ts`:

```ts
export function shouldSwitchFile(isDirty: boolean, confirmDiscard: () => boolean): boolean {
  if (!isDirty) {
    return true;
  }
  return confirmDiscard();
}
```

- [ ] **Step 3: Add error state to reducer**

Extend `AppState`:

```ts
errorMessage: string | null;
```

Add actions:

```ts
| { type: "errorShown"; message: string }
| { type: "errorCleared" }
```

Handle actions:

```ts
case "errorShown":
  return { ...state, errorMessage: action.message };
case "errorCleared":
  return { ...state, errorMessage: null };
```

- [ ] **Step 4: Wrap async app actions**

In `src/App.tsx`, use `shouldSwitchFile(state.isDirty, () => window.confirm("Discard unsaved changes?"))` before switching files. Wrap `openFolder`, `openFile`, `saveFile`, `submitAssistantRequest`, and `importAssistantResponse` with `try/catch` and dispatch `errorShown` with the thrown message.

Use:

```ts
function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

- [ ] **Step 5: Render error banner**

Add near the top of `App` render:

```tsx
{state.errorMessage ? (
  <div className="error-banner">
    <span>{state.errorMessage}</span>
    <button type="button" onClick={() => dispatch({ type: "errorCleared" })}>
      Dismiss
    </button>
  </div>
) : null}
```

Append to `src/styles.css`:

```css
.error-banner {
  position: fixed;
  top: 12px;
  left: 50%;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 720px;
  padding: 10px 12px;
  border: 1px solid #e2a8a8;
  border-radius: 6px;
  background: #fff4f4;
  color: #6f1d1d;
  transform: translateX(-50%);
  box-shadow: 0 6px 20px rgba(31, 35, 40, 0.12);
}
```

- [ ] **Step 6: Verify errors**

Run:

```bash
npm run test:unit -- src/state/guards.test.ts
npm run build
```

Expected: all unit tests pass and build succeeds.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/state/guards.ts src/state/guards.test.ts src/App.tsx src/components/EditorPane.tsx src/components/FileTree.tsx src/styles.css
git commit -m "feat: add writing safety error states"
```

### Task 14: Add Playwright Smoke Test

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/smoke.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Install browsers**

Run:

```bash
npx playwright install chromium
```

Expected: Chromium browser dependency is installed for Playwright.

- [ ] **Step 2: Create Playwright config**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:5173",
  },
});
```

- [ ] **Step 3: Add smoke test**

Create `tests/e2e/smoke.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("renders the DraftAgent workspace", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("DraftAgent")).toBeVisible();
  await expect(page.getByText("No file open")).toBeVisible();
  await expect(page.getByText("Assistant")).toBeVisible();
});
```

- [ ] **Step 4: Verify smoke test**

Run:

```bash
npm run test:e2e
```

Expected: Playwright opens the Vite app and the smoke test passes.

- [ ] **Step 5: Commit**

Run:

```bash
git add playwright.config.ts tests/e2e package.json package-lock.json
git commit -m "test: add workspace smoke test"
```

### Task 15: Final Local Verification and README Update

**Files:**
- Modify: `README.md`
- Modify: `PROJECT.local.md`
- Modify: `TASKS.local.md`

- [ ] **Step 1: Update README with local run commands**

Update `README.md`:

```md
# DraftAgent

DraftAgent is a local desktop writing workspace for drafting and revising long-form fiction stored as Markdown files.

## Current V1 Workflow

- Open a local folder.
- Browse all files in the left pane.
- Open one Markdown file at a time in the center editor.
- Save explicitly.
- Use the assistant pane to prepare OpenAI/Anthropic subscription handoff prompts or send to LM Studio.

## Development

```bash
npm install
npm run tauri:dev
```

## Validation

```bash
npm run test:unit
npm run tauri:test
npm run build
npm run test:e2e
```
```

- [ ] **Step 2: Record validation command in local context**

Update `PROJECT.local.md` commands:

```md
## Commands

- Dev command: `npm run tauri:dev`
- Unit tests: `npm run test:unit`
- Rust tests: `npm run tauri:test`
- Build: `npm run build`
- E2E smoke: `npm run test:e2e`
- Full validation: `npm run test:unit && npm run tauri:test && npm run build && npm run test:e2e`
```

- [ ] **Step 3: Run final validation**

Run:

```bash
npm run test:unit
npm run tauri:test
npm run build
npm run test:e2e
```

Expected: all commands pass.

- [ ] **Step 4: Start local desktop app**

Run:

```bash
npm run tauri:dev
```

Expected: DraftAgent opens as a desktop app with the three-column workspace.

- [ ] **Step 5: Commit README and local tracker updates**

Run:

```bash
git add README.md
git commit -m "docs: document local development workflow"
```

Do not commit `PROJECT.local.md` or `TASKS.local.md`; they are ignored local workflow files.

## Plan Self-Review

- Spec coverage: every approved v1 requirement maps to a task, including desktop app, Markdown editor, all-files tree, explicit save, assistant output modes, subscription handoff, LM Studio, settings, error states, and verification.
- Completion scan: this plan contains no marker sections and no open-ended implementation steps.
- Type consistency: provider ids, assistant modes, file node shape, settings names, and reducer actions are consistent across planned frontend files.
- Scope check: OpenAI/Anthropic API keys, autosave, tabs, persistent chat, checkpoints, cloud sync, and publishing remain outside v1.
