# Document-Native Assistant Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each openable Markdown document its own independent in-memory assistant session for the current app run, and label Anthropic models with their concrete generation names.

**Architecture:** Replace scattered global assistant UI state with a per-document `AssistantSession` map keyed by relative path. Keep the existing editor model intact, but make the visible assistant pane a controlled viewport over the current document session and route async responses back to their originating document. Keep Claude Code alias values internally while presenting explicit model labels in the UI.

**Tech Stack:** React, TypeScript, Vitest, Testing Library

---

### Task 1: Introduce document-native assistant session state

**Files:**
- Modify: `src/types.ts`
- Modify: `src/state/appReducer.ts`
- Modify: `src/state/appReducer.test.ts`

- [ ] Write failing reducer tests proving sessions are created per document, reset on project open, migrate on path changes, and delete with removed files.
- [ ] Add an `AssistantSession` type covering messages, mode, provider/model/effort selections, draft/import text, running state, request id, pending edit, diff visibility, and selection text.
- [ ] Replace `assistantMessages` / `assistantMessagesByPath` with `assistantSessionsByPath` plus actions for creating/updating/migrating/removing sessions.
- [ ] Run focused reducer tests and commit.

### Task 2: Make the assistant pane controlled by the active document session

**Files:**
- Modify: `src/components/AssistantPane.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] Write failing UI tests proving chapter one and chapter two preserve separate transcript, provider/model choice, draft text, running state, and staged-edit state when switching.
- [ ] Convert `AssistantPane` provider/model/effort/mode/instruction/import state from internal state to controlled props + change callbacks.
- [ ] In `App`, resolve the active document session from `state.openFile.relativePath`, lazily initialize one when needed, and pass it into `AssistantPane`.
- [ ] Keep the current visual layout unchanged while swapping session-backed values on file switch.
- [ ] Run focused UI tests and commit.

### Task 3: Route asynchronous responses back to the originating document

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] Write failing tests proving a chapter-one response that finishes while chapter two is visible attaches to chapter one, not chapter two.
- [ ] Capture originating path, markdown snapshot, and request id at submit time.
- [ ] Update only the originating session when responses complete, and keep background sessions running while hidden.
- [ ] For stale edit responses, append a system message to the originating session and do not mutate document text.
- [ ] Run focused tests and commit.

### Task 4: Keep sessions aligned with file lifecycle operations

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] Write failing tests for rename, move, delete, and project reset session behavior.
- [ ] Migrate session keys when open or background files are renamed/moved.
- [ ] Remove sessions when their files are deleted.
- [ ] Preserve sessions across close/reopen inside the same project session.
- [ ] Run focused tests and commit.

### Task 5: Expose concrete Anthropic model labels

**Files:**
- Modify: `src/assistant/providerOptions.ts`
- Modify: `src/App.test.tsx` or `src/components/AssistantPane.test.tsx` if introduced

- [ ] Write a failing test asserting the Anthropic selector shows `Claude Sonnet 4` and `Claude Opus 4.1` while retaining the `sonnet` and `opus` values sent to Claude Code.
- [ ] Update `anthropicModelOptions` labels accordingly.
- [ ] Run focused tests and commit.

### Task 6: Verify the full feature

**Files:**
- Modify if needed: `docs/USER_GUIDE.md`

- [ ] Update user docs if the new per-document behavior needs a sentence in the AI pane section.
- [ ] Run `npm run test:unit`.
- [ ] Run `npm run build`.
- [ ] Manually verify with two chapters that one request can keep running while another chapter is opened and that returning restores the first chapter's state.
- [ ] Commit final docs/cleanup changes.

### Task 7: Stage background edits without hidden document mutation

**Files:**
- Modify: `src/types.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] Write failing tests proving an off-screen edit response stores a pending edit but does not change the currently visible document.
- [ ] Record whether a session has an unseen reply or unseen edit waiting for review.
- [ ] When an edit response returns for a hidden document, compute and store the pending edit against that session only; do not dispatch editor text changes until the document becomes active.
- [ ] When the document becomes active, surface the pending diff/review state for that document.

### Task 8: Add restrained assistant activity badges to the file tree

**Files:**
- Modify: `src/components/FileTree.tsx`
- Modify: `src/styles.css`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] Write failing tests for `Working`, `Reply ready`, and `Edit ready` badges.
- [ ] Derive per-file activity labels from assistant sessions.
- [ ] Render badges only for active states; render nothing for idle files.
- [ ] Use muted styles for `Working` and `Reply ready`, with stronger emphasis for `Edit ready`.
