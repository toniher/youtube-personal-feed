# youtube-personal-feed

An MCP server that connects to your personal YouTube account and exposes your **subscription feed** to AI assistants: list your subscribed channels, list the most recent uploads across your feed, and get `https://www.youtube.com/watch?v=` links that can be handed off to other MCPs (for example transcript-extraction tools).

## Requirements

- Node.js 18+
- A Google account and a Google Cloud project with the YouTube Data API v3 enabled
- An MCP client (opencode, Claude Desktop, etc.)

## Google Cloud Console setup (one-time)

1. Go to <https://console.cloud.google.com> and create a project (or reuse one).
2. **Enable the API**: APIs & Services -> Library -> search "YouTube Data API v3" -> Enable.
3. **OAuth consent screen**: APIs & Services -> OAuth consent screen.
   - User type: **External**, then add your own Gmail address as a **test user**.
   - Add the scope `https://www.googleapis.com/auth/youtube.readonly`.
4. **Create a Desktop client**: APIs & Services -> Credentials -> Create credentials -> **OAuth client ID** -> Application type **Desktop app**.
   - No redirect URI needs to be registered; loopback redirect is allowed for Desktop clients.
5. Copy the **Client ID** and **Client secret** into a `.env` file at the repo root:

   ```
   CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
   CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
   ```

   (`cp .env.example .env` first.)

## Install and authenticate

```bash
npm install
npm run auth
```

`npm run auth` prints a URL, opens your browser, and asks you to consent. Tokens are stored in `~/.config/youtube-mcp/token.json` (read-only to you) and are refreshed automatically at runtime.

> Note: because this uses an unverified "Desktop app" client, Google shows a "Google hasn't verified this app" warning the first time. Click *Advanced -> Go to <project> (unsafe)* to proceed.

## Register with an MCP client

- **opencode**: a project-level `.mcp.json` is included. It registers the server as `youtube-feed` with `npx tsx src/index.ts`. Reopen opencode in this directory to pick it up.
- **Claude Desktop**: add to `claude_desktop_config.json`:

  ```json
  {
    "mcpServers": {
      "youtube-feed": {
        "command": "npx",
        "args": ["tsx", "src/index.ts"],
        "cwd": "/absolute/path/to/youtube-personal-feed"
      }
    }
  }
  ```

- **Production-ish**: `npm run build` then point the client at `node /absolute/path/to/dist/index.js`.

## Tools

| Tool | Inputs | Output |
|---|---|---|
| `list_subscriptions` | `query?`, `maxResults?` (default 50) | channelId, title, channelUrl, thumbnail, publishedAt |
| `list_feed` | `limit?` (default 20), `sinceDays?`, `channelId?` | latest uploads across subscriptions: videoId, title, channelTitle, publishedAt, **videoUrl** |
| `list_channel_uploads` | `channelId`, `maxResults?` (default 15) | uploads for any channel, same fields |
| `get_video` | `videoId` | snippet/contentDetails/statistics + videoUrl + channelUrl |

Feed items always include `videoUrl` in the form `https://www.youtube.com/watch?v=<id>` — the format accepted by most transcript-extraction MCP servers.

## Quota

The YouTube Data API default quota is **10,000 units/day**. List calls cost ~1 unit each. This server caches subscriptions for 30 minutes and per-channel uploads for 10 minutes, so a full feed refresh over ~100 subscriptions costs about 100 units. If you hit the quota, the tools return a clear error; wait until the next day or request more quota.

## Development

```bash
npm run typecheck   # type-check
npm run build       # compile to dist/
npm run smoke       # sanity check auth + subscriptions (prints real data)
```

## Project layout

```
src/config.ts   # env loading, credential + token path helpers
src/auth.ts     # one-time OAuth loopback flow (npm run auth)
src/youtube.ts  # YouTube Data API v3 wrapper + caching
src/index.ts    # MCP server (McpServer, stdio, 4 tools)
src/types.ts    # shared types
scripts/smoke.ts
```
