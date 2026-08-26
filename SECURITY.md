# Security Policy

## Supported versions

Security fixes target the latest published npm version and the current `main` branch. Older package versions may not receive fixes; upgrade before reporting a dependency-only issue.

## Reporting a vulnerability

Please report security issues privately through [GitHub Security Advisories](https://github.com/seekskyworld/CreatPPT/security/advisories/new). Include:

- a short impact summary;
- affected version, commit, or package tarball;
- a minimal reproduction or proof of concept;
- any suggested mitigation.

Do not include API keys, npm tokens, private decks, or personal data in the report. The maintainers will acknowledge the report, reproduce it, coordinate a fix, and publish a disclosure when it is safe to do so.

If the advisory form is unavailable, contact a repository maintainer privately through GitHub rather than opening a public issue. Do not publish a vulnerability before maintainers have had a reasonable opportunity to respond.

## Scope notes

CreatPPT is local-first. The CLI and workspace server listen on `127.0.0.1` by default, and user-provided assets remain in the local delivery directory. Remote images, third-party npm registries, browser extensions, and user-hosted reverse proxies are outside the project's control; still report a reproducible issue when it crosses a CreatPPT trust boundary.
