#!/usr/bin/env node

import { parseArgs } from "node:util";
import { z } from "zod";
import { createClient } from "./youtube.js";
import { getVersion } from "./version.js";

const usage = `Usage: youtube-personal-feed <command> [options]

Commands:
  subscriptions [--query <text>] [--limit <1-500>]
  feed [--channel-id <UC...>] [--limit <1-200>] [--since-days <1-365>]
  uploads <channel-id> [--limit <1-50>]
  playlist <playlist-id> [--limit <1-50>]
  liked [--limit <1-50>]
  video <video-id>

Options:
  -h, --help     Show help
  -v, --version  Show version
`;

function fail(message: string): never {
  throw new Error(`${message}\n\n${usage}`);
}

function validateOptions<T>(
  schema: z.ZodType<T>,
  input: Record<string, string | undefined>,
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    fail(
      `Invalid options: ${result.error.issues
        .map((e: z.ZodIssue) => e.message)
        .join(", ")}`,
    );
  }
  return result.data;
}

function limitSchema(min: number, max: number, defaultValue: number) {
  return z
    .string()
    .optional()
    .default(String(defaultValue))
    .refine((val) => {
      const n = Number(val);
      return Number.isInteger(n) && n >= min && n <= max;
    }, `Must be an integer between ${min} and ${max}.`)
    .transform((val) => Number(val));
}

function getParseResult(
  args: string[],
  options: Record<string, { type: "string" }>,
) {
  try {
    return parseArgs({
      args,
      options,
      allowPositionals: true,
      strict: true,
    });
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (
    !command ||
    command === "--help" ||
    command === "-h" ||
    command === "help"
  ) {
    console.log(usage);
    return;
  }
  if (command === "--version" || command === "-v" || command === "version") {
    console.log(getVersion());
    return;
  }

  const validCommands = new Set([
    "subscriptions",
    "feed",
    "uploads",
    "playlist",
    "liked",
    "video",
  ]);

  if (!validCommands.has(command)) {
    fail(`Unknown command: ${command}.`);
  }

  const client = createClient();

  switch (command) {
    case "subscriptions": {
      const { values } = getParseResult(args, {
        query: { type: "string" },
        limit: { type: "string" },
      });
      const { query, limit } = validateOptions(
        z.object({
          query: z.string().optional(),
          limit: limitSchema(1, 500, 50),
        }),
        values,
      );
      const subscriptions = await client.listSubscriptions(limit, query);
      console.log(
        JSON.stringify({ count: subscriptions.length, subscriptions }, null, 2),
      );
      return;
    }
    case "feed": {
      const { values } = getParseResult(args, {
        "channel-id": { type: "string" },
        limit: { type: "string" },
        "since-days": { type: "string" },
      });
      const {
        "channel-id": channelId,
        limit,
        "since-days": sinceDays,
      } = validateOptions(
        z.object({
          "channel-id": z.string().optional(),
          limit: limitSchema(1, 200, 20),
          "since-days": limitSchema(1, 365, 1).optional(),
        }),
        values,
      );
      const videos = await client.buildFeed(
        limit,
        sinceDays !== undefined ? sinceDays : null,
        channelId,
      );
      console.log(JSON.stringify({ count: videos.length, videos }, null, 2));
      return;
    }
    case "uploads": {
      const { positionals, values } = getParseResult(args, {
        limit: { type: "string" },
      });
      const [channelId] = positionals;
      if (!channelId || positionals.length > 1)
        fail("uploads requires exactly one channel ID.");
      const { limit } = validateOptions(
        z.object({
          limit: limitSchema(1, 50, 15),
        }),
        values,
      );
      const videos = await client.listUploads(channelId, limit, true);
      console.log(JSON.stringify({ count: videos.length, videos }, null, 2));
      return;
    }
    case "playlist": {
      const { positionals, values } = getParseResult(args, {
        limit: { type: "string" },
      });
      const [playlistId] = positionals;
      if (!playlistId || positionals.length > 1)
        fail("playlist requires exactly one playlist ID.");
      const { limit } = validateOptions(
        z.object({
          limit: limitSchema(1, 50, 15),
        }),
        values,
      );
      const videos = await client.listPlaylist(playlistId, limit, true);
      console.log(JSON.stringify({ count: videos.length, videos }, null, 2));
      return;
    }
    case "liked": {
      const { values } = getParseResult(args, {
        limit: { type: "string" },
      });
      const { limit } = validateOptions(
        z.object({
          limit: limitSchema(1, 50, 15),
        }),
        values,
      );
      const videos = await client.getLikedVideos(limit, true);
      console.log(JSON.stringify({ count: videos.length, videos }, null, 2));
      return;
    }
    case "video": {
      const { positionals } = getParseResult(args, {});
      const [videoId] = positionals;
      if (!videoId || positionals.length > 1)
        fail("video requires exactly one video ID.");
      console.log(
        JSON.stringify(await client.getVideoDetail(videoId), null, 2),
      );
      return;
    }
    default:
      fail(`Unknown command: ${command}.`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
