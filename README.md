# Scriptorium

Scriptorium is a local-first desktop writing workspace for drafting and revising long-form fiction stored as Markdown files. It combines a Typora-style editor, a manuscript file tree, and an in-app AI conversation pane backed by local provider CLIs or LM Studio.

## Features

- Open any local manuscript folder; no project template required.
- Browse all files while editing one Markdown file at a time.
- Write in a visual editor or switch to Markdown source mode.
- Save explicitly; manuscript changes are not autosaved.
- Choose lightweight themes: Paper, Catppuccin, Gruvbox, Dracula, Nord, Solarized, Tokyo Night, Rose Pine, and Everforest.
- Use OpenAI via a local Codex login, Anthropic via Claude Code, or LM Studio on localhost.
- Ask for chat responses, suggestions, proposed diffs, or rewrites.
- Review rewrite/diff output before applying it to the open file.

## Privacy

Scriptorium reads and writes files on your computer. Manuscript text leaves the machine only when you send an assistant request to a configured provider. OpenAI and Anthropic requests run through your locally authenticated CLI sessions; LM Studio requests are restricted to localhost by default.

See [PRIVACY.md](PRIVACY.md) for the exact data flow.

## Requirements

- Node.js 20 or newer.
- Rust stable and the Tauri 2 Linux desktop prerequisites.
- Optional provider tools:
  - `codex login` for OpenAI subscription-backed requests.
  - `claude auth login` for Anthropic subscription-backed requests.
  - LM Studio running its local OpenAI-compatible server for local models.

## Development

```bash
npm install
npm run tauri:dev
```

## Build And Package

```bash
npm run test:unit
npm run tauri:test
npm run build
npm run tauri:build
npm run test:e2e
```

The current package target is a Debian bundle:

```bash
./src-tauri/target/release/scriptorium
src-tauri/target/release/bundle/deb/Scriptorium_0.1.0_amd64.deb
```

## Provider Setup

Open Settings, use **Provider connections**, and run the sign-in flow for the provider you want. Scriptorium does not store OpenAI or Anthropic passwords.

Project-level preferences are disabled by default. If enabled, Scriptorium reads `.scriptorium.env` from the opened project folder. See [.scriptorium.env.example](.scriptorium.env.example) for supported keys.

## Documentation

- [User Guide](docs/USER_GUIDE.md)
- [Privacy](PRIVACY.md)
- [Security](SECURITY.md)
- [Contributing](CONTRIBUTING.md)

## Troubleshooting

On some Linux systems, AppImage WebKit helper processes can be unstable. This repo currently builds the native release binary and Debian package instead of AppImage artifacts.
