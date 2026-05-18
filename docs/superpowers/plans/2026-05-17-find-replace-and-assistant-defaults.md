# Find, Replace, and Assistant Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add current-file Find / Find and Replace controls and make new assistant sessions default to Anthropic Opus in Edit mode.

**Architecture:** Keep search UI and document mutations inside the editor surface, with menu commands routed through the existing editor command path. Use current in-memory markdown as the source of truth so replacements participate in existing per-file draft persistence and explicit-save behavior. Update the shared assistant-session factory so every new document session starts on Anthropic Opus in Edit mode.

**Tech Stack:** React, TypeScript, Tiptap, Vitest, Testing Library

---

### Task 1: Change assistant session defaults

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AssistantPane.test.tsx`
- Modify: `src/App.test.tsx`

- [ ] Write failing tests asserting fresh assistant sessions default to provider `anthropic-subscription`, model `opus`, and mode `edit`.
- [ ] Run the focused tests and verify they fail because current defaults are still Sonnet + Chat.
- [ ] Update the assistant session factory and any visible default expectations.
- [ ] Re-run the focused tests and commit.

### Task 2: Add editor search state and pure find/replace helpers

**Files:**
- Modify: `src/components/EditorPane.tsx`
- Modify: `src/components/EditorPane.test.tsx`

- [ ] Write failing tests for opening find state, counting matches, moving next/previous, replacing current, and replacing all in the active markdown.
- [ ] Add small pure helpers for locating plain-text matches and applying replacements.
- [ ] Add editor-local state for find text, replacement text, active match index, and expanded replace mode.
- [ ] Re-run the focused editor tests and commit.

### Task 3: Expose Find and Find and Replace through the Edit menu

**Files:**
- Modify: `src/components/AppMenuBar.tsx`
- Modify: `src/components/AppMenuBar.test.tsx`
- Modify: `src/App.tsx`

- [ ] Write failing tests asserting the Edit menu exposes `Find` and `Find and Replace` and emits the right editor commands.
- [ ] Extend the editor command type and menu wiring.
- [ ] Route commands from `AppMenuBar` into `EditorPane` through the existing ref-based command path.
- [ ] Re-run focused menu/app tests and commit.

### Task 4: Add keyboard shortcuts and session behavior

**Files:**
- Modify: `src/components/EditorPane.tsx`
- Modify: `src/components/EditorPane.test.tsx`
- Modify: `src/App.test.tsx`

- [ ] Write failing tests for `Ctrl+F`, `Ctrl+H`, `Enter`, `Shift+Enter`, and `Escape`.
- [ ] Implement shortcut handling in the editor surface.
- [ ] Add tests proving replacements mark the document dirty, survive file switches through the existing draft cache, and do not leak find state across files.
- [ ] Re-run focused tests and commit.

### Task 5: Style and document the workflow

**Files:**
- Modify: `src/styles.css`
- Modify: `docs/USER_GUIDE.md`

- [ ] Add minimal find-bar styling consistent with the existing editor chrome.
- [ ] Add a brief user-guide note for Find / Find and Replace and the shortcuts.
- [ ] Run targeted tests, full unit tests, and a production build.
- [ ] Commit the final feature set.

### Task 6: Ship the desktop build

**Files:**
- Build artifact only: `src-tauri/target/release/bundle/deb/Scriptorium_0.1.0_amd64.deb`

- [ ] Run `npm run tauri:build`.
- [ ] Reinstall the rebuilt Debian package locally.
- [ ] Verify the installed binary timestamp updates.
