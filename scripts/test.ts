import { test } from "node:test";
import assert from "node:assert";
import { dedupeByVideoId } from "../src/youtube.js";
import type { FeedVideo } from "../src/types.js";

function video(videoId: string, title: string): FeedVideo {
  return {
    videoId,
    title,
    channelId: "UC123",
    channelTitle: "Channel",
    publishedAt: "2026-01-01T00:00:00Z",
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

test("dedupeByVideoId returns empty array for empty input", () => {
  assert.deepStrictEqual(dedupeByVideoId([]), []);
});

test("dedupeByVideoId returns same array when no duplicates", () => {
  const input = [video("a", "A"), video("b", "B"), video("c", "C")];
  assert.deepStrictEqual(dedupeByVideoId(input), input);
});

test("dedupeByVideoId keeps first occurrence and removes later duplicates", () => {
  const input = [
    video("a", "A"),
    video("b", "B"),
    video("a", "A again"),
    video("c", "C"),
    video("b", "B again"),
  ];
  assert.deepStrictEqual(dedupeByVideoId(input), [
    video("a", "A"),
    video("b", "B"),
    video("c", "C"),
  ]);
});

test("dedupeByVideoId with all duplicates returns single item", () => {
  const input = [video("a", "A"), video("a", "A again"), video("a", "A third")];
  assert.deepStrictEqual(dedupeByVideoId(input), [video("a", "A")]);
});
