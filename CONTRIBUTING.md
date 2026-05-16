# Contributing

Scriptorium is a local-first desktop app built with Tauri, React, TypeScript, and Rust.

## Development

```bash
npm install
npm run tauri:dev
```

## Validation

Run these before opening a pull request:

```bash
npm run test:unit
npm run tauri:test
npm run build
npm run test:e2e
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
git diff --check
```

Before publishing a desktop package, also run:

```bash
npm run tauri:build
dpkg-deb --info src-tauri/target/release/bundle/deb/Scriptorium_0.1.0_amd64.deb
dpkg-deb --contents src-tauri/target/release/bundle/deb/Scriptorium_0.1.0_amd64.deb
```

The Debian package should include `/usr/bin/scriptorium`, `Scriptorium.desktop`, and hicolor app icons.

## Public Release Check

Before making a repository or release artifact public, also check:

```bash
git status --short
git ls-files -z | xargs -0 du -b | sort -nr | head -30
rg -n "(sk-[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|ANTHROPIC_API_KEY|OPENAI_API_KEY|api[_-]?key|password|secret|token|credential)" --glob '!node_modules/**' --glob '!dist/**' --glob '!src-tauri/target/**' .
npm audit --omit=dev --audit-level=moderate
```

Expected matches should be documentation text, test fixtures, or lockfile package names only.

## Product Principles

- Keep manuscript files in standard Markdown.
- Prefer explicit user action before changing a document.
- Keep provider integrations local-first and transparent.
- Avoid adding workflow files, credentials, or local machine notes to the public repo.
