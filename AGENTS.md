# Agent Guidelines for YouTube Personal Feed MCP Server

This repository implements an MCP (Model Context Protocol) server exposing a user's personal YouTube subscription feed and video details using the YouTube Data API v3 and Google OAuth 2.0.

## Project Overview

- **Name:** `youtube-personal-feed`
- **Runtime:** Node.js (>= 18), TypeScript (ES2022 / NodeNext ESM)
- **Protocol:** MCP over `stdio` transport (`@modelcontextprotocol/sdk`)
- **API Integration:** YouTube Data API v3 via `googleapis` and `google-auth-library`
- **Key Purpose:** Enable LLM agents to list subscriptions, build subscription video feeds, query channel uploads, and retrieve video details.

---

## Directory & Layout

```
youtube-personal-feed/
├── package.json           # Scripts, dependencies, binary definition
├── tsconfig.json          # Root TypeScript config (ES2022, NodeNext)
├── tsconfig.build.json    # Build-specific config (compiles src/ -> dist/)
├── .env.example           # Template for CLIENT_ID and CLIENT_SECRET
├── scripts/
│   └── smoke.ts           # Standalone smoke test script
└── src/
    ├── config.ts          # Environment loading (.env) and path helper functions
    ├── types.ts           # Shared TypeScript interfaces (SubscriptionItem, FeedVideo, VideoDetail)
    ├── auth.ts            # One-time OAuth 2.0 loopback server flow
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
| `npm run smoke` | Executes the smoke test script (`scripts/smoke.ts`) to test API operations. |

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
- Channel uploads are fetched by querying the uploads playlist (`UU<channelId>`) via `playlistItems.list`, which costs **1 unit per request** compared to 100 units for `search.list`.
- In-memory caching is implemented in `YouTubeClient`:
  - `subscriptionsCache`: TTL = 30 minutes (`SUBSCRIPTIONS_TTL_MS`)
  - `uploadsCache`: TTL = 10 minutes (`UPLOADS_TTL_MS`)
  - `videoCache`: TTL = 10 minutes (`UPLOADS_TTL_MS`)
- When modifying API logic, maintain quota-friendly endpoints and cache semantics.

### 4. Credentials & Token Security
- OAuth tokens are saved outside the repository at `~/.config/youtube-mcp/token.json` (or `$XDG_CONFIG_HOME/youtube-mcp/token.json`) with restrictive file permissions (`0o600`).
- **NEVER** expose, log, or commit client secrets or token contents.

---

## Development & Verification Workflow

When making changes to this codebase, follow these steps:

1. **Verify Types:** Run `npm run typecheck` to ensure there are no compilation errors or interface mismatches.
2. **Build Verification:** Run `npm run build` if output distribution code (`dist/`) needs to be updated or tested.
3. **Functional Verification:** If credentials and tokens are present, execute `npm run smoke` to verify end-to-end integration with the YouTube API.
