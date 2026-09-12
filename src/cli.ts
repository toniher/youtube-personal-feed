#!/usr/bin/env node

import { parseArgs } from "node:util";
import { createClient } from "./youtube.js";

const usage = `Usage: youtube-personal-feed <command> [options]

Commands:
  subscriptions [--query <text>] [--limit <1-500>]
  feed [--channel-id <UC...>] [--limit <1-200>] [--since-days <1-365>]
  uploads <channel-id> [--limit <1-50>]
  playlist <playlist-id> [--limit <1-50>]
  liked [--limit <1-50>]
  video <video-id>
`;

function fail(message: string): never {
  throw new Error(`${message}\n\n${usage}`);
}

function numericOption(
  value: string | undefined,
  name: string,
  defaultValue: number,
  min: number,
  max: number,
): number {
  if (value === undefined) return defaultValue;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    fail(`${name} must be an integer between ${min} and ${max}.`);
  }
  return n;
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
      const subscriptions = await client.listSubscriptions(
        numericOption(
          values.limit as string | undefined,
          "--limit",
          50,
          1,
          500,
        ),
        values.query as string | undefined,
      );
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
      const videos = await client.buildFeed(
        numericOption(
          values.limit as string | undefined,
          "--limit",
          20,
          1,
          200,
        ),
        values["since-days"] !== undefined
          ? numericOption(
              values["since-days"] as string,
              "--since-days",
              1,
              1,
              365,
            )
          : null,
        values["channel-id"] as string | undefined,
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
      const videos = await client.listUploads(
        channelId,
        numericOption(values.limit as string | undefined, "--limit", 15, 1, 50),
        true,
      );
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
      const videos = await client.listPlaylist(
        playlistId,
        numericOption(values.limit as string | undefined, "--limit", 15, 1, 50),
        true,
      );
      console.log(JSON.stringify({ count: videos.length, videos }, null, 2));
      return;
    }
    case "liked": {
      const { values } = getParseResult(args, {
        limit: { type: "string" },
      });
      const videos = await client.getLikedVideos(
        numericOption(values.limit as string | undefined, "--limit", 15, 1, 50),
        true,
      );
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
