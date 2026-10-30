# Contributing

Thanks for considering a contribution. There is no build step and no runtime dependency.

## Setup

```bash
npm install
```

## Before you open a PR

```bash
npm test            # node:test, runs on the current Node (>= 22.6)
npm run typecheck   # tsc --noEmit
```

Then try the extension in a live session, in a terminal that supports inline images:

```bash
pi -e /path/to/this/repo
```

## Guidelines

- Keep the extension dependency-free: pi provides `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, and `typebox` as peers.
- No build step. The TypeScript source is what pi loads and what npm ships.
- No network calls, no telemetry, no data collection.
- Never send image data to the model: the tool result stays text only.
- Tests live in `test/` and run with `node --test`. Keep pure helpers exported so they stay testable.

## Releasing

Versions are bumped manually and released by tagging:

```bash
npm version patch|minor|major
git push --follow-tags origin main
```

The `release` GitHub Action publishes to npm on `v*` tags using npm trusted publishing (OIDC), so no npm token is stored in the repo.

First publish only: the package name must exist on npm and be linked to this repo as a trusted publisher (npmjs.com, package settings, "Trusted Publisher": repository `clementprevot/pi-show-image`, workflow `release.yml`, environment `npm`). Publish the first version locally with `npm publish` while logged in, then link the trusted publisher so later tags publish automatically.
