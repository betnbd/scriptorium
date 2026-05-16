# Privacy

Scriptorium is local-first. It does not run a hosted service and does not collect telemetry.

## What Stays Local

- Manuscript files opened from the file tree.
- Settings saved by the desktop app.
- The file index used to select relevant context.
- OpenAI and Anthropic credentials, which remain in their own local CLI tools.

## What Can Leave The Machine

When you click an assistant send button, Scriptorium builds a prompt from:

- your message,
- the current selection or open Markdown file,
- relevant Markdown context from the opened folder,
- the visible assistant conversation history.

That prompt is sent to the selected provider:

- OpenAI subscription requests run through the local `codex` CLI.
- Anthropic subscription requests run through the local `claude` CLI.
- LM Studio requests are sent only to `localhost`, `127.0.0.1`, or `::1`.

Scriptorium does not send files to providers automatically. It sends data only when you explicitly submit an assistant request.

## Project Preferences

Project preference files are opt-in. If enabled, Scriptorium reads `.scriptorium.env` from the opened folder. Keep that file out of shared repos unless every collaborator expects the same local preferences.
