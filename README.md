# DraftAgent

DraftAgent is a local desktop writing workspace for drafting and revising long-form fiction stored as Markdown files.

## Current V1 Workflow

- Open a local folder.
- Browse all files in the left pane.
- Open one Markdown file at a time in the center editor.
- Write in a rich editor while DraftAgent saves plain Markdown.
- Save explicitly; manuscript changes are not autosaved.
- Use the assistant pane to prepare OpenAI/Anthropic subscription handoff prompts or send directly to LM Studio.
- Import assistant rewrites, proposed diff edits, or suggestions back into the workspace.

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

`npm run test:e2e` starts the Vite app on Tauri's local development port and runs a Playwright smoke test. If Playwright cannot download Chromium for your Linux version, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a local Chromium-compatible browser.
