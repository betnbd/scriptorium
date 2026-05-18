# Folder-wide AI runs design

## Goal

Let the user write one prompt in the existing AI panel and run that same prompt against every Markdown document in the currently open folder, while preserving Scriptorium's file-local review model.

## Product shape

The AI panel gains an explicit target control with two choices:

- `Current document` — the existing behavior and default.
- `All documents in folder` — run the same request across every Markdown document in the currently open project folder.

All existing provider, model, effort, mode, and message controls remain shared. The feature changes the send target, not the request-building surface.

## User flow

1. The user opens a folder and enters a prompt in the AI panel.
2. They choose `All documents in folder` instead of the default `Current document`.
3. On send, Scriptorium creates one normal assistant run per Markdown document in the open folder.
4. Runs execute sequentially, not all at once.
5. Each document behaves as though the prompt had been sent manually on that file:
   - its own assistant history entry,
   - its own staged edit or chat response,
   - its own unread / edit-ready file-tree notification,
   - its own later keep/reject review.
6. The user can move through documents afterward and review each result individually.

## Editing behavior

Folder-wide Edit mode does not auto-accept or auto-save results. Each generated edit is staged on its own document and must be reviewed with the existing `Keep edits` / `Reject edits` flow.

If the user later keeps a staged edit, the existing accepted-edit autosave behavior applies to that one file exactly as it does today.

## Batch execution model

Folder-wide runs are sequential. This avoids launching many provider processes at once, keeps resource use predictable, and makes progress legible.

The active batch should expose simple progress in the AI panel, such as `Running on 7 of 24 documents`, while still allowing completed results to appear on their respective documents as soon as they finish.

A folder-wide run should target Markdown documents already represented by the open project tree/index. Non-Markdown files and folders are excluded.

## Session and context behavior

Each file keeps its own assistant session. For each document, Scriptorium builds the prompt using that document as the target, with the same relevance-scoped context retrieval rules already used for single-file requests.

The batch request should not reuse conversation history from the currently open document across the whole folder. Each file should use its own existing session history, so the batch remains equivalent to manually sending the same prompt document by document.

Current selection is irrelevant for `All documents in folder`; that mode targets whole documents only.

## Error handling

A failure on one document should not abort the rest of the batch. That file receives an error state/message, the batch records the failure, and processing continues to the next document.

When the batch completes, the AI panel should summarize completion counts such as succeeded / failed, so the user can see whether attention is needed before review.

## UI details

- Default target remains `Current document`.
- `All documents in folder` is disabled when no folder is open or when there are no eligible Markdown documents.
- The send button label should reflect the target clearly enough that a folder-wide action is not accidental.
- Existing per-file file-tree badges remain the main review affordance; no separate batch-review surface is introduced in this version.

## Testing notes

Coverage should verify:

- default single-document behavior remains unchanged,
- folder-wide mode enumerates all Markdown files in the open folder and excludes non-Markdown entries,
- runs are sequential,
- each file receives its own request/session/result and notification state,
- Edit mode stages each result without auto-keeping it,
- failures do not stop later documents from running,
- current selection is ignored for folder-wide runs,
- progress/completion state is shown accurately.

## Non-goals

This version does not add:

- arbitrary file subset selection,
- recursive include/exclude rules beyond the folder's normal indexed Markdown set,
- concurrent fan-out,
- bulk keep/reject controls,
- automatic acceptance of batch edits,
- a separate batch history system.
