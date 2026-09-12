#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadEnv } from "./config.js";
import { AuthError, createClient, QuotaError } from "./youtube.js";
import type { YouTubeClient } from "./youtube.js";
import type { FeedVideo, SubscriptionItem, VideoDetail } from "./types.js";

const server = new McpServer({
  name: "youtube-personal-feed",
  version: "0.1.4",
});

function text(payload: unknown): {
  content: [{ type: "text"; text: string }];
} {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

let cachedClient: YouTubeClient | null = null;

function getClient(): YouTubeClient {
  if (cachedClient) return cachedClient;
  cachedClient = createClient();
  return cachedClient;
}

async function handleError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof AuthError || err instanceof QuotaError) {
    return text({ error: message });
  }
  return text({ error: `Unexpected error: ${message}` });
}

server.tool(
  "list_subscriptions",
  "List YouTube channels the authenticated user is subscribed to.",
  {
    query: z
      .string()
      .optional()
      .describe(
        "Optional case-insensitive substring to filter channels by title.",
      ),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(500)
      .default(50)
      .describe("Max channels to return."),
  },
  async ({ query, maxResults }) => {
    try {
      const client = getClient();
      const items: SubscriptionItem[] = await client.listSubscriptions(
        maxResults,
        query,
      );
      return text({ count: items.length, subscriptions: items });
    } catch (err) {
      return handleError(err);
    }
  },
);

server.tool(
  "list_feed",
  "List the most recent uploads across all subscribed channels (the subscription feed). Returns standard https://www.youtube.com/watch?v= URLs that can be fed into a transcript-extraction MCP.",
  {
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .default(20)
      .describe("Max videos to return."),
    sinceDays: z
      .number()
      .int()
      .min(1)
      .max(365)
      .nullable()
      .optional()
      .describe("Only return videos published within the last N days."),
    channelId: z
      .string()
      .optional()
      .describe(
        "Restrict the feed to a single subscribed channel by its channel ID.",
      ),
  },
  async ({ limit, sinceDays, channelId }) => {
    try {
      const client = getClient();
      const items: FeedVideo[] = await client.buildFeed(
        limit,
        sinceDays ?? null,
        channelId,
      );
      return text({ count: items.length, videos: items });
    } catch (err) {
      return handleError(err);
    }
  },
);

server.tool(
  "list_channel_uploads",
  "List the most recent uploads of a specific channel (not required to be subscribed).",
  {
    channelId: z.string().describe("The YouTube channel ID (UC...)."),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(15)
      .describe("Max videos to return."),
  },
  async ({ channelId, maxResults }) => {
    try {
      const client = getClient();
      const items: FeedVideo[] = await client.listUploads(
        channelId,
        maxResults,
        true,
      );
      return text({ count: items.length, videos: items });
    } catch (err) {
      return handleError(err);
    }
  },
);

server.tool(
  "list_playlist",
  "List videos from any YouTube playlist ID (e.g. LL for Liked Videos or custom PL...).",
  {
    playlistId: z
      .string()
      .describe(
        "The YouTube playlist ID (e.g. 'LL' for Liked Videos or 'PL...').",
      ),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(15)
      .describe("Max videos to return."),
  },
  async ({ playlistId, maxResults }) => {
    try {
      const client = getClient();
      const items: FeedVideo[] = await client.listPlaylist(
        playlistId,
        maxResults,
        true,
      );
      return text({ count: items.length, videos: items });
    } catch (err) {
      return handleError(err);
    }
  },
);

server.tool(
  "list_liked_videos",
  "List the user's Liked Videos playlist ('LL'). Returns standard https://www.youtube.com/watch?v= URLs.",
  {
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(15)
      .describe("Max videos to return."),
  },
  async ({ maxResults }) => {
    try {
      const client = getClient();
      const items: FeedVideo[] = await client.getLikedVideos(maxResults, true);
      return text({ count: items.length, videos: items });
    } catch (err) {
      return handleError(err);
    }
  },
);

server.tool(
  "get_video",
  "Get details for a single YouTube video by ID.",
  {
    videoId: z
      .string()
      .describe("The YouTube video ID (from the watch?v= URL)."),
  },
  async ({ videoId }) => {
    try {
      const client = getClient();
      const detail: VideoDetail = await client.getVideoDetail(videoId);
      return text(detail);
    } catch (err) {
      return handleError(err);
    }
  },
);

async function main(): Promise<void> {
  loadEnv();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("youtube-personal-feed MCP server running over stdio");
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
