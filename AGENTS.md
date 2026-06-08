# AGENTS.md

## Purpose

Local-first desktop writing workspace for long-form Markdown manuscripts: a Typora-style editor, a file tree, and an AI assistant pane backed by local provider CLIs (Codex / Claude Code) or LM Studio.

## Stack

Tauri 2 (Rust backend) + React 19 + TypeScript + Vite. Editor is TipTap. Frontend tests use Vitest + Testing Library (jsdom); browser tests use Playwright. Linux desktop only (WebKit2GTK 4.1).

## Build / Run / Test

```bash
npm install
npm run tauri:dev          # run the desktop app (Vite + Tauri)
npm run test:unit          # Vitest unit/component tests
npm run tauri:test         # Rust tests (cargo test in src-tauri)
npm run build              # tsc typecheck + vite build (web bundle)
npm run tauri:build        # native release binary + .deb bundle
npm run test:e2e           # Playwright browser smoke + layout tests
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check   # CI checks Rust fmt
```

CI (`.github/workflows/ci.yml`) runs, in order: `cargo fmt --check`, `test:unit`, `tauri:test`, `build`, then `test:e2e`. Match that before pushing.

## Layout

- `src/` — React frontend.
  - `src/api/tauri.ts` — typed wrapper over all Tauri `invoke` calls; the single frontend/backend boundary.
  - `src/state/appReducer.ts` — central app state reducer; `guards.ts` validates transitions.
  - `src/assistant/` — prompt building, response parsing, and local diff/apply for AI edits (`promptBuilder`, `responseParser`, `localDiff`, `applyResult`).
  - `src/context/indexer.ts` — builds context from the manuscript folder for assistant requests.
  - `src/components/` — UI panes (`EditorPane`, `FileTree`, `AssistantPane`, `SettingsDialog`, `AppMenuBar`).
  - `src/editor/markdown.ts` — Markdown <-> editor conversion.
- `src-tauri/src/commands/` — Rust IPC handlers (the only commands exposed; registered in `lib.rs`):
  - `workspace.rs` — all filesystem ops (read tree, read/write Markdown, create/rename/delete/move).
  - `agent_cli.rs` — drives Codex/Claude Code CLIs (subscription-backed providers); 30-min timeout.
  - `lm_studio.rs` — localhost LM Studio HTTP requests; 120s timeout.
  - `settings.rs` — load/save app settings and read project `.scriptorium.env`.
- `docs/superpowers/{plans,specs}/` — design plans and specs per feature.
- `.scriptorium.env.example` — supported project-preference keys (provider, models, theme, editor).

## Gotchas

- Manuscript edits are NOT autosaved — saving is explicit. AI edits are staged into the open file as a diff to keep/reject, then saved manually. Preserve this flow.
- The only legitimate way for the frontend to touch the backend is through `src/api/tauri.ts`; new backend behavior means a new command in `src-tauri/src/commands/` registered in `lib.rs`.
- Playwright uses Brave at `/usr/bin/brave-browser` if present, else `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, else system Chromium. The e2e server runs on port 1420 with `reuseExistingServer`.
- Builds ship the native binary + `.deb` only; AppImage is intentionally avoided (unstable WebKit helper processes on some Linux systems).
- Visual mode is read-only for very large files (Markdown source mode stays editable) — a deliberate responsiveness tradeoff, not a bug.
- Project preferences (`.scriptorium.env` in the opened folder) are off by default and only read when enabled in Settings.
