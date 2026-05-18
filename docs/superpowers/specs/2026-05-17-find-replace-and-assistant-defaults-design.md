# Find, Replace, and Assistant Defaults Design

## Goal

Add a writer-friendly find / find-and-replace workflow for the currently open file, and make new assistant sessions default to Anthropic Opus in Edit mode.

## Scope

Find and replace applies only to the active document. It remains session-local and works against the in-memory draft, including unsaved edits. Project-wide search, regex, case toggles, and persisted search history are intentionally out of scope for this first pass.

## User Experience

The Edit menu gains `Find` and `Find and Replace` actions. Either action opens a compact find bar attached to the editor rather than a blocking dialog. The bar supports:

- search text
- replacement text when replace mode is expanded
- next match
- previous match
- replace current
- replace all
- close

Keyboard behavior should be conventional:

- `Ctrl+F` opens Find
- `Ctrl+H` opens Find and Replace
- `Enter` advances to the next match while the search field is focused
- `Shift+Enter` moves to the previous match
- `Escape` closes the bar

The bar operates on the active file only and reflects the current in-memory text, not only the last saved disk state. Replacements update the editor draft and preserve explicit-save semantics: the document becomes dirty, but nothing is written to disk until Save.

## Architecture

Keep the search UI local to the editor surface. `EditorPane` will expose the editing primitives needed to find ranges and apply replacements in either visual or markdown mode, while `AppMenuBar` only triggers open states through existing editor commands. Search state should live with the editor session for the active file rather than in project-global state, so switching files does not leak search terms or ranges across documents.

New assistant sessions continue to be created through the existing helper, but their defaults become:

- provider: Anthropic subscription
- Anthropic model: `opus`
- mode: `edit`

This preserves explicit save, document-local assistant sessions, and the current one-file-at-a-time interaction model.

## Error Handling and Edge Cases

- Empty search text disables navigation and replacement actions.
- No matches produces a restrained `0 matches` state rather than an error banner.
- Search always reflects the current active draft, including unsaved edits.
- Switching files closes or resets the current find bar for the newly active document rather than carrying stale match indexes across files.
- Replace all applies only to the active file and marks it unsaved.

## Testing

Add focused tests for:

- assistant defaults: Anthropic + Opus + Edit
- opening Find / Find and Replace from the Edit menu and shortcuts
- next / previous navigation behavior
- replace current and replace all mutating only the current draft
- unsaved replacements surviving file switches within the current project session
- find state not leaking between files
