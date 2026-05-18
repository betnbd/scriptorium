# Document-Native Assistant Sessions Design

## Goal
Make each Markdown document own an independent assistant session for the current app run, so multiple chapters can keep working in parallel while the writer switches between them.

## Product Behavior
Each document gets its own in-memory assistant companion keyed by its relative path. The right pane shows the session for the currently open document, but switching files does not stop or reset sessions belonging to other documents. A chapter that is still generating a response continues running off-screen; when the writer returns, its transcript, controls, running state, and any staged edit are still there.

Sessions last only until the app or project session ends. Reopening Scriptorium starts fresh, preserving the existing no-persisted-chat rule.

## Session State
Move the assistant state that is currently global into a per-document session record:

- transcript messages
- chat/edit mode
- draft message text and manual-import text
- provider choice, model choice, and effort choice
- running state and request identity
- staged edit payload and diff visibility
- last known selection text for prompt targeting, if any

The visible assistant pane becomes a viewport over the current document's session rather than the single assistant instance for the whole app.

## Request Routing
Every request captures the originating document path, markdown snapshot, and session/request id at submit time. When a response returns, it is applied only to that originating session. A response from chapter one must never be injected into chapter two merely because chapter two is visible when the request finishes.

For edit-mode responses, the app should only stage the edit if the originating document is still in the expected markdown state. If that document changed before the response returned, attach an explanatory system message to that document session and avoid applying stale text.

## File Lifecycle
- Opening a document creates its session lazily if none exists.
- Switching documents swaps the visible assistant viewport to that document's existing session.
- Renaming or moving a file migrates its session key so the conversation travels with the document.
- Deleting a file removes its session.
- Closing a file leaves its session alive for the rest of the current project/app session.
- Opening a new project clears all document sessions, matching the current reset-on-project-open behavior.

## UI Behavior
The pane keeps its current visual structure. The only visible behavioral changes are that each chapter resumes its own controls, prompt draft, transcript, running indicator, and staged-edit state, and Anthropic model labels show the concrete model generation rather than only the family alias (for example, `Claude Sonnet 4` and `Claude Opus 4.1`). No tabs, extra windows, or global session picker are added.

## Error Handling
- Late responses route to the originating session without stealing focus.
- Stale edit responses do not mutate changed documents.
- Pending edits remain applicable only from the document that produced them.
- Provider availability remains global settings/status, but user choices within the pane are document-local for the current run.

## Testing
Add focused tests for:

1. independent transcripts when switching files
2. independent running states across files
3. provider/model/draft preservation per file
4. late response routing to the originating file
5. pending edits remaining document-bound
6. session migration on rename/move
7. session cleanup on delete and reset on project open
8. stale edit protection when the originating document changes before a response returns

## Non-goals
- Persisting sessions across app restarts
- Showing multiple assistant panes at once
- Spawning OS-level terminal windows per chapter
- Changing the one-open-editor-file rule

## Background Edit Review Extension
Background edit responses must stage inside the originating document session without mutating an off-screen document. If the originating file is not currently visible when an edit response returns, the session stores the pending edit and marks the file as `Edit ready`; the editor text changes only when that document is opened again for review.

## File Tree Activity Indicators
The file tree should stay visually quiet by default. Only documents with actionable assistant activity show a compact status badge:

- `Working` while a request is in flight
- `Reply ready` when an unseen chat response has arrived
- `Edit ready` when an unseen staged edit is waiting for review

`Edit ready` receives the strongest emphasis because it requires user action. Idle sessions show no badge.
