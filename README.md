# youtube-personal-feed

[![npm version](https://img.shields.io/npm/v/youtube-personal-feed?logo=npm)](https://www.npmjs.com/package/youtube-personal-feed)

An MCP (Model Context Protocol) server and CLI that connects to your personal YouTube account and exposes your **subscription feed** to AI assistants.

Fetch subscribed channels, list recent uploads across your feed, query specific channel uploads, and get `https://www.youtube.com/watch?v=` links ready for transcript tools.

---

## Quick Start

### 1. Prerequisites

- **Node.js** 18+
- A Google Account with **YouTube Data API v3** enabled in Google Cloud Console.

### 2. Google Cloud Setup (One-Time)

1. Go to [Google Cloud Console](https://console.cloud.google.com).
2. Enable **YouTube Data API v3** (*APIs & Services -> Library*).
3. Configure **OAuth consent screen** (*APIs & Services -> OAuth consent screen*):
   - Set User Type to **External** and add your Gmail address under **Test users**.
   - Add scope: `https://www.googleapis.com/auth/youtube.readonly`.
4. Create **Desktop App** credentials (*APIs & Services -> Credentials -> Create Credentials -> OAuth client ID*).
5. Save your credentials to `~/.config/youtube-personal-mcp/.env` (or `.env` in the project root):
   ```ini
   CLIENT_ID=your-client-id.apps.googleusercontent.com
   CLIENT_SECRET=your-client-secret
   ```

### 3. Install & Authenticate

```bash
# Install globally
npm install -g youtube-personal-feed

# Authenticate once (opens browser to log in)
youtube-personal-feed-auth
```

*Tokens are stored securely at `~/.config/youtube-personal-mcp/token.json`.*

---

## MCP Setup

Add the MCP server to your assistant configuration:

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "youtube-personal-feed": {
      "command": "youtube-personal-feed-mcp"
    }
  }
}
```

### OpenCode

Add to your OpenCode MCP settings:

```json
{
  "mcpServers": {
    "youtube-personal-feed": {
      "command": "youtube-personal-feed-mcp"
    }
  }
}
```

*For local source development, use `npx tsx src/index.ts` with `cwd` set to the repository.*

---

## Available MCP Tools

| Tool | Description | Key Options |
|---|---|---|
| `list_subscriptions` | List channels you are subscribed to | `query?`, `maxResults?` (default 50) |
| `list_feed` | Latest uploads across all subscriptions | `limit?` (default 20), `sinceDays?`, `channelId?` |
| `list_channel_uploads` | Recent uploads for any channel | `channelId`, `maxResults?` (default 15) |
| `get_video` | Detailed video metadata & statistics | `videoId` |

*Feed items include standard `videoUrl` (`https://www.youtube.com/watch?v=...`) for easy integration with transcript MCP servers.*

---

## CLI Usage

You can also run commands directly from the terminal (outputs JSON):

```bash
# List subscriptions
youtube-personal-feed subscriptions --query tech --limit 20

# Get recent feed (past 7 days)
youtube-personal-feed feed --limit 10 --since-days 7

# Get uploads for a specific channel
youtube-personal-feed uploads UCJaGVXG4KgOUXUtcmAHAOdA --limit 15

# View video details
youtube-personal-feed video 64wtzsSQx84
```

*For local development from source, use `npm run cli -- <command>`.*

---

## Quota & Caching

- YouTube Data API daily limit: **10,000 units/day**.
- Subscriptions are cached for **30 minutes**; channel uploads are cached for **10 minutes**.
- Uploads are fetched efficiently via channel upload playlists (1 unit/request).

---

## Development

```bash
npm run typecheck   # Type check TypeScript
npm run lint        # Lint and check formatting
npm run format      # Format code with Biome
npm run build       # Build dist/
npm run smoke       # Smoke test API operations
```
