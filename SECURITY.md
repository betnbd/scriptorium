# Security

## Supported Versions

Scriptorium is pre-1.0. Security fixes are made on `main` until a formal release branch policy exists.

## Reporting A Vulnerability

Open a private security advisory or contact the repository owner. Do not publish exploit details in a public issue before a fix is available.

## Local-First Boundaries

Scriptorium intentionally limits provider traffic:

- Subscription providers run through local CLIs.
- LM Studio is restricted to loopback hosts.
- Project preference files are disabled by default.
- Tauri shell permissions are not granted to the webview.

When changing provider or filesystem code, add tests for path containment, provider destination validation, and no-surprise file edits.
