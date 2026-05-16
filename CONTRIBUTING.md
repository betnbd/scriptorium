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

## Product Principles

- Keep manuscript files in standard Markdown.
- Prefer explicit user action before changing a document.
- Keep provider integrations local-first and transparent.
- Avoid adding workflow files, credentials, or local machine notes to the public repo.
