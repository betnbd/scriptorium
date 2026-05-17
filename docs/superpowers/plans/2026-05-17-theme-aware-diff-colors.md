# Theme-Aware Diff Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make staged-edit diffs readable across every built-in theme while preserving red/green semantics.

**Architecture:** Keep `EditorPane` unchanged and move the behavior into semantic CSS tokens. Define light defaults once, define shared dark-theme overrides once, and have the existing diff selectors consume those tokens.

**Tech Stack:** CSS, React/Vite app, Playwright visual QA

---

### Task 1: Add semantic diff tokens

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Record the current failure**

Open the staged diff in a dark theme and confirm hard-coded light row colors create low-contrast prose.

- [ ] **Step 2: Add light and dark diff variables**

Add dedicated diff variables in `:root` and shared dark-theme overrides for dark themes.

- [ ] **Step 3: Replace hard-coded diff colors**

Update staged diff selectors to read from the new variables instead of fixed hex values.

- [ ] **Step 4: Verify rendered behavior**

Run the app and visually confirm one light theme plus each dark theme keeps readable prose, labels, markers, and rails.

- [ ] **Step 5: Commit**

Commit the focused CSS change after verification.
