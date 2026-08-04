#!/usr/bin/env node

import { createClient } from "./youtube.js";

const usage = `Usage: youtube-feed <command> [options]

Commands:
  subscriptions [--query <text>] [--limit <1-500>]
  feed [--channel-id <UC...>] [--limit <1-200>] [--since-days <1-365>]
  uploads <channel-id> [--limit <1-50>]
  video <video-id>
`;

function fail(message: string): never {
  throw new Error(`${message}\n\n${usage}`);
}

function parseOptions(args: string[]): {
  positional: string[];
  options: Map<string, string>;
} {
  const positional: string[] = [];
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) fail(`Missing value for ${arg}.`);
    options.set(arg, value);
    index += 1;
  }
  return { positional, options };
}

function numberOption(
  options: Map<string, string>,
  name: string,
  defaultValue: number,
  min: number,
  max: number,
): number {
  const value = options.get(name);
  if (value === undefined) return defaultValue;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    fail(`${name} must be an integer between ${min} and ${max}.`);
  }
  return number;
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

  const { positional, options } = parseOptions(args);
  const client = createClient();

  switch (command) {
    case "subscriptions": {
      const subscriptions = await client.listSubscriptions(
        numberOption(options, "--limit", 50, 1, 500),
        options.get("--query"),
      );
      console.log(
        JSON.stringify({ count: subscriptions.length, subscriptions }, null, 2),
      );
      return;
    }
    case "feed": {
      const videos = await client.buildFeed(
        numberOption(options, "--limit", 20, 1, 200),
        options.has("--since-days")
          ? numberOption(options, "--since-days", 1, 1, 365)
          : null,
        options.get("--channel-id"),
      );
      console.log(JSON.stringify({ count: videos.length, videos }, null, 2));
      return;
    }
    case "uploads": {
      const [channelId] = positional;
      if (!channelId || positional.length > 1)
        fail("uploads requires exactly one channel ID.");
      const videos = await client.listUploads(
        channelId,
        numberOption(options, "--limit", 15, 1, 50),
        true,
      );
      console.log(JSON.stringify({ count: videos.length, videos }, null, 2));
      return;
    }
    case "video": {
      const [videoId] = positional;
      if (!videoId || positional.length > 1)
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
