# Scriptorium

Scriptorium is a local desktop writing workspace for drafting and revising long-form fiction stored as Markdown files.

## Current V1 Workflow

- Open a local folder.
- Browse all files in the left pane.
- Open one Markdown file at a time in the center editor.
- Write in a rich editor while Scriptorium saves plain Markdown.
- Save explicitly; manuscript changes are not autosaved.
- Choose from lightweight built-in editor themes, including Paper, Catppuccin,
  Gruvbox, Dracula, Nord, Solarized, Tokyo Night, Rose Pine, and Everforest.
- Use the assistant pane to talk to an in-app provider:
  - OpenAI subscription via a local `codex login` session.
  - Anthropic subscription via a local `claude auth login` session.
  - LM Studio through its local OpenAI-compatible server.
- Apply assistant rewrites, proposed diff edits, or suggestions back into the workspace.

## Development

```bash
npm install
npm run tauri:dev
```

## Local Desktop Launch

For this Ubuntu workstation, use the native release binary or the Debian package instead of the AppImage target:

```bash
npm run tauri:build
./src-tauri/target/release/scriptorium
```

The build is configured to produce the Debian bundle at `src-tauri/target/release/bundle/deb/` and to avoid AppImage packaging, which can launch a bundled WebKitGTK helper process that crashes on this machine.

## Validation

```bash
npm run test:unit
npm run tauri:test
npm run build
npm run tauri:build
npm run test:e2e
```

`npm run test:e2e` starts the Vite app on Tauri's local development port and runs a Playwright smoke test. If Playwright cannot download Chromium for your Linux version, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a local Chromium-compatible browser.
