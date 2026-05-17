# Theme-Aware Diff Colors Design

## Goal
Keep staged-edit diffs semantically red/green while making every row, label, and marker readable in both light and dark themes.

## Design
The diff viewer will use dedicated semantic CSS variables instead of hard-coded light-theme colors. Light defaults will live in `:root`; dark themes will share a dark diff palette through a grouped selector so the component stays simple and theme-aware without copying one-off rules into every component.

## Scope
- Add dedicated variables for unchanged text, marker text, removed/revised labels, row backgrounds, and row rails.
- Replace the current hard-coded diff colors with those variables.
- Keep the current red/green meaning intact across all themes.
- Verify the rendered diff in light and dark themes after the change.

## Non-goals
- No redesign of the diff layout.
- No change to the red/green semantics.
- No per-theme artistic remapping unless visual QA reveals a genuine contrast problem.
