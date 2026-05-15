# DraftAgent V1 Design

## Summary

DraftAgent v1 is a local desktop writing workspace for drafting and revising novels stored as ordinary Markdown files. The app opens a folder, shows the full file tree, presents one Markdown file at a time as a rich writing surface, and provides a right-side assistant pane for rewrites, proposed diff edits, and suggestions.

The product is personal and local-first. It should be useful for daily writing before it becomes broadly productized.

## Goals

- Build a desktop app launched normally on Ubuntu.
- Keep manuscript files as plain Markdown on disk.
- Hide Markdown syntax during normal drafting through a rich writing editor.
- Show all files in the opened folder, while editing and indexing Markdown files first.
- Support basic file operations similar to a simple Markdown editor: new file, new folder, rename, delete, move, open/reveal, edit, and explicit save.
- Keep the standard three-column layout visible in v1.
- Provide assistant workflows for full rewrite, proposed diff edits, and suggestions.
- Default provider choices to OpenAI and Anthropic subscription handoff workflows.
- Keep LM Studio as an optional fully in-app local model provider.
- Use automatic, relevance-scoped project context for assistant requests.

## Non-Goals

- No autosave.
- No multiple editor tabs.
- No fullscreen or distraction-free writing mode.
- No persistent assistant chat logs.
- No separate checkpoint/version history.
- No OpenAI or Anthropic API-key integrations in v1.
- No required project folder template.
- No publishing/export workflow.
- No collaboration or cloud sync.
- No full project-bible database or schema.

## Recommended Stack

Use Tauri, React, TypeScript, and TipTap/ProseMirror.

Tauri should provide the desktop shell, native file access, local settings storage, clipboard access, and external URL/app launch behavior. React should own the three-pane interface. TipTap/ProseMirror should provide a rich editor that can load Markdown and serialize back to Markdown on explicit save.

Electron is a viable fallback but is heavier than needed for this local Ubuntu tool. A native GTK app would be Linux-native but would slow down the rich-editor and assistant workflow work.

## Product Layout

The main window has three always-visible columns.

### File Worktree

The left pane opens any local folder and shows all files. Markdown files are visually treated as primary because they are the first editable and indexed manuscript format.

V1 file operations:

- Open folder.
- Create file.
- Create folder.
- Rename file or folder.
- Move file or folder.
- Delete file or folder.
- Open/reveal a file.
- Save the open Markdown file.

Destructive file operations should ask for confirmation.

### Editor

The center pane opens one file at a time. Markdown files open in a rich writing editor that hides Markdown syntax during normal drafting. Non-Markdown files can be shown as read-only text or a simple unsupported-file state in v1.

File writes are explicit-save only. Editing or applying assistant changes marks the editor dirty but does not write to disk until Save.

### Assistant

The right pane maintains one running session for the open project. The session resets each time the project/app is opened and is not persisted.

The assistant pane includes:

- Provider selector.
- Output mode selector.
- Instruction box.
- Context preview.
- Response area.
- Import/apply actions.

## Assistant Request Model

Assistant requests target the current text selection when text is selected. If no text is selected, they target the open file.

The writer chooses one output mode:

- Full rewrite: return replacement text for the selected text or open file.
- Proposed edits: return structured diff/patch edits for review and apply.
- Suggestions: return notes only with no document changes.

The app automatically adds relevant project context when useful. The context layer should prefer the open file, selected text, nearby headings, filename matches, Markdown links, recent files, and text relevance. It should not dump the whole project by default.

## Provider Behavior

OpenAI and Anthropic are the default provider choices, but in v1 they use subscription handoff workflows rather than API calls.

### OpenAI / Anthropic Subscription Handoff

For subscription providers, DraftAgent prepares a structured prompt containing:

- The selected/open target text.
- The requested output mode.
- The user instruction.
- Relevant Markdown context.
- Formatting instructions for rewrite, diff, or suggestions.

The app should provide actions to copy the prompt, open the chosen service, paste/import the response, and then apply the result locally if the result is a rewrite or diff.

This mode cannot guarantee the same fully automated direct-edit loop as an API-backed integration. The design intentionally treats it as a companion workflow.

### LM Studio Local Provider

LM Studio is the first optional fully in-app provider. DraftAgent should call LM Studio through its OpenAI-compatible local server. The settings screen should include base URL and model name.

In LM Studio mode, DraftAgent can send the request directly, receive a result, and apply rewrites or diffs to the editor state. Suggestions stay in the assistant pane.

## Settings

Provider and app preferences live in a separate settings screen, not in the main assistant pane.

Settings should include:

- Default provider: OpenAI subscription, Anthropic subscription, or LM Studio.
- OpenAI and Anthropic handoff URLs or app launch behavior.
- LM Studio base URL and model name.
- Project `.env` support for local/provider preferences.
- App-local settings that override project `.env` values on this machine.
- Basic editor preferences such as font size and line width.
- Indexing controls: reindex project, ignore hidden folders, ignore large files, and ignore binary files.

OpenAI and Anthropic API keys should not be requested or required in v1.

## Workspace and Indexing

The workspace layer should read and write directly to the selected local folder. The file tree shows all files. The indexer focuses on Markdown files.

Indexing should extract:

- Relative file path.
- File name.
- Headings.
- Markdown links.
- Plain-text chunks.
- Modified time.

V1 should use deterministic local search and lightweight scoring for context retrieval. Good initial signals are open-file proximity, filename similarity, heading matches, links, recency, and lexical relevance.

## Data Storage

Source-of-truth content remains the Markdown files in the opened folder.

App-local storage may contain:

- Last opened folder.
- Settings.
- Window layout preferences.
- Index cache.

V1 should not persist assistant chat logs or hidden manuscript checkpoints.

## Error Handling

The app should handle these states clearly:

- No project folder open.
- File no longer exists.
- Unsaved editor changes before switching files.
- Unsupported file type.
- Markdown parse/serialize issue.
- Failed save.
- Failed file operation.
- LM Studio unavailable or misconfigured.
- Imported subscription response cannot be parsed as the requested mode.

For unsaved changes, switching files should prompt to save, discard, or cancel.

## Testing Strategy

Focus tests on workflows that could damage writing.

- Open a folder and render the full file tree.
- Open, edit, and explicitly save a Markdown file.
- Create, rename, move, and delete files/folders.
- Convert Markdown to editor state and back without corrupting common Markdown.
- Build assistant prompts from selection/open file plus relevant context.
- Import a subscription response and apply full rewrite or diff without writing to disk.
- Send a request to LM Studio when configured.
- Verify editor dirty state, undo behavior, and save behavior after assistant-applied changes.

## References

- OpenAI documents ChatGPT subscription and API/platform usage as separate billing and access paths: https://help.openai.com/en/articles/8156019
- Anthropic documents Claude paid plans and Console/API usage as separate billing and access paths: https://support.anthropic.com/en/articles/9876003-i-subscribe-to-a-paid-claude-ai-plan-why-do-i-have-to-pay-separately-for-api-usage-on-console
