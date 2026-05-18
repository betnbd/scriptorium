# Scriptorium User Guide

## Start A Project

1. Open Scriptorium.
2. Choose **File > Open Folder**.
3. Select a folder containing Markdown manuscript files.
4. Pick a file from the left pane.

To start from one document instead, choose **File > Open File** and select a Markdown file. Scriptorium opens that file and uses its parent folder for the left pane.

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

Each Markdown file keeps its own assistant session for the current app run. If one chapter is still working while you switch to another, it continues in the background and is waiting for you when you return. Use **New chat** to reset only the current chapter's conversation.

Modes:

- **Chat**: discusses the open file and can suggest changes without touching the document.
- **Edit**: stages revised Markdown directly in the editor.

Edit results are staged in the editor immediately and marked as **AI edit staged** beside the save status. Use **Show diff** to inspect the local before/after change, **Keep edits** to dismiss the review bar, or **Reject edits** to restore the previous text. Save manually when you want to write staged changes to disk.

Use **Paste response** only when you need to manually import an assistant response.

## Provider Setup

Open **File > Settings** or **AI > AI Settings**.

- OpenAI: install/sign in to Codex with `codex login`.
- Anthropic: install/sign in to Claude Code with `claude auth login`.
- LM Studio: start LM Studio's local server and use a localhost base URL.

## Project Preferences

Project preferences are off by default. If enabled in Settings, Scriptorium reads `.scriptorium.env` from the opened folder.
