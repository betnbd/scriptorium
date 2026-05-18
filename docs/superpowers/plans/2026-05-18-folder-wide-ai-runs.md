# Folder-wide AI Runs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the AI panel run one prompt sequentially across every Markdown document in the open folder while preserving per-file staged review and notifications.

**Architecture:** Keep folder-wide orchestration in `App.tsx`, where project tree, document contents, assistant sessions, and provider calls already meet. Extend `AssistantPane` with an explicit target selector plus batch progress display, and reuse the existing per-file session/result pipeline so each document behaves like an ordinary single-file request.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Tauri

---

### Task 1: Add the target selector to the AI panel

**Files:**
- Modify: `src/components/AssistantPane.tsx`
- Modify: `src/components/AssistantPane.test.tsx`
- Modify: `src/types.ts`

- [ ] Add failing tests proving the panel defaults to `Current document`, exposes `All documents in folder`, and forwards the selected target in `onSubmit`.
- [ ] Add a small target type and controlled/uncontrolled target field to the pane.
- [ ] Render the target selector and update request payload shape.
- [ ] Re-run focused pane tests and commit.

### Task 2: Orchestrate sequential folder-wide runs

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] Add failing app tests proving folder-wide mode sends the same request sequentially to every Markdown file, excludes non-Markdown entries, ignores current selection, and preserves per-file result notifications.
- [ ] Add helper logic to collect eligible Markdown documents from the current project index/tree.
- [ ] Refactor single-file send internals into reusable per-document request execution.
- [ ] Implement sequential batch orchestration that continues after per-file failures.
- [ ] Re-run focused app tests and commit.

### Task 3: Expose progress and completion state

**Files:**
- Modify: `src/components/AssistantPane.tsx`
- Modify: `src/components/AssistantPane.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] Add failing tests for in-progress and completed batch summaries.
- [ ] Add batch state in `App.tsx` with total, completed, succeeded, and failed counts.
- [ ] Render progress such as `Running on 2 of 5 documents` and a completion summary in the pane.
- [ ] Re-run focused tests and commit.

### Task 4: Verify and ship the feature

**Files:**
- Modify if needed: `docs/USER_GUIDE.md`
- Build artifact only: `src-tauri/target/release/bundle/deb/Scriptorium_0.1.0_amd64.deb`

- [ ] Add a brief user-guide note for folder-wide AI runs if the UI needs explanation.
- [ ] Run `npm run test:unit`, `npm run tauri:test`, `npm run build`, and `git diff --check`.
- [ ] Build and reinstall the Debian package locally.
- [ ] Commit the completed feature set.
