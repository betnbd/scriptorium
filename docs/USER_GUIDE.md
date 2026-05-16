# Scriptorium User Guide

## Start A Project

1. Open Scriptorium.
2. Choose **File > Open Folder**.
3. Select a folder containing Markdown manuscript files.
4. Pick a file from the left pane.

## Install Or Update On Linux

After building the Debian package, install it with:

```bash
sudo apt install ./src-tauri/target/release/bundle/deb/Scriptorium_0.1.0_amd64.deb
```

Installing a newer package upgrades the app in place. To remove the app package, run `sudo apt remove scriptorium`.

## Write

- Use **Visual** mode for a clean writing view with Markdown syntax hidden.
- Use **Markdown** mode when you want raw Markdown source.
- Use **Ctrl+S** to save.
- Use the top menus for headings, lists, links, emphasis, and layout controls.

For very large Markdown files, **Visual** mode becomes a read-only rendered preview to keep scrolling responsive. Switch to **Markdown** mode to edit those files directly.

## Use The AI Pane

1. Open a Markdown file.
2. Choose a provider, model, effort, and mode.
3. Type a message.
4. Send the request.

Modes:

- **Chat**: asks a question without changing the file.
- **Rewrite**: prepares a full replacement for review.
- **Diff**: prepares proposed edits for review.
- **Suggest**: returns advice without changing the file.

Rewrite and diff results show **Apply edits** and **Discard** before the document changes.

## Provider Setup

Open **File > Settings** or **AI > AI Settings**.

- OpenAI: install/sign in to Codex with `codex login`.
- Anthropic: install/sign in to Claude Code with `claude auth login`.
- LM Studio: start LM Studio's local server and use a localhost base URL.

## Project Preferences

Project preferences are off by default. If enabled in Settings, Scriptorium reads `.scriptorium.env` from the opened folder.
