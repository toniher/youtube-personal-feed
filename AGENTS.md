# Agent Guidelines for YouTube Personal Feed MCP Server

This repository provides an MCP (Model Context Protocol) server and a CLI for a user's personal YouTube subscription feed and video details using the YouTube Data API v3 and Google OAuth 2.0.

## Project Overview

- **Name:** `youtube-personal-feed`
- **Runtime:** Node.js (>= 18), TypeScript (ES2022 / NodeNext ESM)
- **Protocol:** MCP over `stdio` transport (`@modelcontextprotocol/sdk`)
- **API Integration:** YouTube Data API v3 via `googleapis` and `google-auth-library`
- **Interfaces:** MCP over stdio and JSON-output CLI
- **Key Purpose:** List subscriptions, build subscription video feeds, query channel uploads, and retrieve video details.

---

## Directory & Layout

```
youtube-personal-feed/
├── package.json           # Scripts, dependencies, binary definition
├── LICENSE                # MIT license
├── tsconfig.json          # Root TypeScript config (ES2022, NodeNext)
├── tsconfig.build.json    # Build-specific config (compiles src/ -> dist/)
├── .env.example           # Template for CLIENT_ID and CLIENT_SECRET
├── scripts/
│   └── smoke.ts           # Standalone smoke test script
└── src/
    ├── config.ts          # Environment loading (.env) and path helper functions
    ├── types.ts           # Shared TypeScript interfaces (SubscriptionItem, FeedVideo, VideoDetail)
    ├── auth.ts            # One-time OAuth 2.0 loopback server flow
    ├── cli.ts             # JSON-output CLI entrypoint
    ├── youtube.ts         # YouTube API wrapper client with in-memory caching & error mapping
    └── index.ts           # MCP server entrypoint exposing tools over stdio
```

---

## Command Reference

| Command | Purpose |
|---|---|
| `npm run typecheck` | Validates TypeScript types across `src/` and `scripts/` using `tsc --noEmit`. |
| `npm run build` | Compiles TypeScript files from `src/` to `dist/` via `tsconfig.build.json`. |
| `npm run dev` | Runs the MCP server in development mode using `tsx src/index.ts`. |
| `npm run start` | Runs the production build (`node dist/index.js`). |
| `npm run auth` | Launches the local loopback server to handle Google OAuth authentication. |
| `npm run cli -- <args>` | Runs the CLI from source; for example, `npm run cli -- feed --limit 10`. |
| `npm run smoke` | Executes the smoke test script (`scripts/smoke.ts`) to test API operations. |
| `npm run lint` | Lints TypeScript sources and verifies their Biome formatting. |
| `npm run format` | Applies Biome formatting to TypeScript sources. |
| `npm run precommit` | Runs the staged-file checks and full TypeScript typecheck used by the pre-commit hook. |
| `npm pack --dry-run` | Verifies the files included in the published npm package. |

## Code Quality Hooks

- `npm install` runs `prepare`, which installs the `simple-git-hooks` pre-commit hook.
- The hook runs Biome formatting and linting on staged `.ts` files through `lint-staged`, then runs `npm run typecheck` for the full project.
- Run `npm run format` before committing formatting changes, and `npm run lint` before submitting changes that modify TypeScript.
- Do not use `git commit --no-verify` unless a maintainer has explicitly approved bypassing the checks.

## Published Binaries

The package is intended to support global installation and exposes three binaries:

| Binary | Purpose |
|---|---|
| `youtube-personal-feed` | CLI: `subscriptions`, `feed`, `uploads`, and `video`; writes JSON to stdout. |
| `youtube-personal-feed-auth` | One-time OAuth loopback authorization flow. |
| `youtube-personal-feed-mcp` | MCP server over stdio. |

Keep `package.json` `bin`, `files`, and `prepack` entries aligned with the compiled files in `dist/`. Do not add credentials, tokens, source-only scripts, or `node_modules` to the published package.

---

## Code & Architecture Conventions

### 1. Module System & Imports
- Target is **ESM (`"type": "module"`)** with `NodeNext` module resolution.
- **Relative imports must include the `.js` file extension** (e.g., `import { loadEnv } from './config.js';`).
- Standard library modules use the `node:` prefix (e.g., `import { readFileSync } from 'node:fs';`).

### 2. Error Handling & Custom Errors
- `AuthError`: Thrown when credentials or tokens are missing, expired, or rejected.
- `QuotaError`: Thrown when YouTube API rate/quota limits are reached (HTTP 403 or `quotaExceeded`).
- MCP tool handlers catch errors and return structured responses via `text({ error: message })` instead of letting standard tool execution crash.

### 3. Caching & Quota Efficiency
- YouTube Data API v3 enforces a daily quota budget (default 10,000 units).
- Channel uploads are fetched by replacing a channel ID's `UC` prefix with `UU` and querying the resulting uploads playlist via `playlistItems.list`, which costs **1 unit per request** compared to 100 units for `search.list`.
- Fetch only the requested newest uploads; do not page through a channel's full upload history for a feed request.
- In-memory caching is implemented in `YouTubeClient`:
  - `subscriptionsCache`: TTL = 30 minutes (`SUBSCRIPTIONS_TTL_MS`)
  - `uploadsCache`: TTL = 10 minutes (`UPLOADS_TTL_MS`)
  - `videoCache`: TTL = 10 minutes (`UPLOADS_TTL_MS`)
- When modifying API logic, maintain quota-friendly endpoints and cache semantics.

### 4. Feed and Upload Semantics
- `buildFeed` / `list_feed` / `youtube-personal-feed feed` aggregates recent uploads across subscriptions and sorts the combined videos by publication date.
- Its optional `channelId` filter limits the result to one subscribed channel. The implementation also permits a direct channel ID for compatibility with the MCP tool description.
- `listUploads` / `list_channel_uploads` / `youtube-personal-feed uploads` directly retrieves uploads for one channel, whether or not the user subscribes to it.
- `buildFeed` fetches subscription uploads in batches of 10 to balance responsiveness with API load. Preserve bounded concurrency when changing it.

### 5. Credentials & Token Security
- OAuth tokens are saved outside the repository at `~/.config/youtube-mcp/token.json` (or `$XDG_CONFIG_HOME/youtube-mcp/token.json`) with restrictive file permissions (`0o600`).
- Credentials resolve in this precedence order: existing `CLIENT_ID` and `CLIENT_SECRET` environment variables, repository `.env`, then `$XDG_CONFIG_HOME/youtube-mcp/.env` (normally `~/.config/youtube-mcp/.env`).
- The global config file should be created with `0o600` permissions.
- **NEVER** expose, log, or commit client secrets or token contents.

---

## Development & Verification Workflow

When making changes to this codebase, follow these steps:

1. **Format and Lint:** Run `npm run format` as needed, then `npm run lint` to validate TypeScript style and lint rules.
2. **Verify Types:** Run `npm run typecheck` to ensure there are no compilation errors or interface mismatches.
3. **Build Verification:** Run `npm run build` to validate `dist/` and every binary entrypoint.
4. **Package Verification:** When changing package metadata or binaries, run `npm pack --dry-run`.
5. **Functional Verification:** If credentials and tokens are present, execute `npm run smoke` and an appropriate `npm run cli -- ...` command to verify API operations.
