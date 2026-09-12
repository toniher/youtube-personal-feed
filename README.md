# youtube-personal-feed

[![npm version](https://img.shields.io/npm/v/youtube-personal-feed?logo=npm)](https://www.npmjs.com/package/youtube-personal-feed)

MCP server and CLI for your YouTube subscriptions. Exposes your feed, channel uploads, playlists (including Liked Videos), and video details to AI assistants and the terminal — with `https://www.youtube.com/watch?v=` links for transcript tools.

## Quick Start

**Prerequisites:** Node.js 18+, Google account with YouTube Data API v3 enabled.

**1. Google Cloud (one-time)**

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Library → enable **YouTube Data API v3**.
2. OAuth consent screen → **External**, add your Gmail under **Test users**, add scope `https://www.googleapis.com/auth/youtube.readonly`.
3. Credentials → Create Credentials → OAuth client ID → **Desktop App**.
4. Save to `~/.config/youtube-personal-mcp/.env` (or `.env` in repo root):
   ```ini
   CLIENT_ID=your-client-id.apps.googleusercontent.com
   CLIENT_SECRET=your-client-secret
   ```

**2. Install & authenticate**

```bash
npm install -g youtube-personal-feed
youtube-personal-feed-auth  # opens browser; token saved to ~/.config/youtube-personal-mcp/token.json
```

## MCP Setup

Add to `claude_desktop_config.json` (Claude Desktop) or your OpenCode MCP config:

```json
{
  "mcpServers": {
    "youtube-personal-feed": {
      "command": "youtube-personal-feed-mcp"
    }
  }
}
```

Local development: `npx tsx src/index.ts` with `cwd` set to the repo.

## Tools

| Tool | Description | Options |
|---|---|---|
| `list_subscriptions` | Channels you subscribe to | `query?`, `maxResults?` (default 50) |
| `list_feed` | Latest uploads across subscriptions | `limit?` (20), `sinceDays?`, `channelId?` |
| `list_channel_uploads` | Recent uploads for any channel | `channelId`, `maxResults?` (15) |
| `list_playlist` | Videos from any playlist (`LL`, `PL...`) | `playlistId`, `maxResults?` (15) |
| `list_liked_videos` | Your Liked Videos (`LL`) | `maxResults?` (15) |
| `get_video` | Video metadata and stats | `videoId` |

Feed items include `videoUrl` for transcript tools.

## CLI

Outputs JSON. Global install:

```bash
youtube-personal-feed subscriptions --query tech --limit 20
youtube-personal-feed feed --limit 10 --since-days 7
youtube-personal-feed uploads UCJaGVXG4KgOUXUtcmAHAOdA --limit 15
youtube-personal-feed video 64wtzsSQx84
```

From source (authenticate first):

```bash
npm run auth
npm run cli -- feed --limit 10
```

Works for all tools: `subscriptions`, `feed`, `uploads`, `playlist`, `liked`, `video`.

## Quota & Caching

YouTube API limit is 10,000 units/day. Uploads use the channel's uploads playlist (1 unit/request). Subscriptions cached 30 min, uploads/videos 10 min.

## Development

```bash
npm run auth                  # authenticate locally (before cli)
npm run cli -- <command>      # run CLI from source
npm run typecheck             # check types
npm run lint                  # lint + format check
npm run format                # format with Biome
npm run build                 # compile to dist/
npm run smoke                 # API smoke test (needs auth)
```
