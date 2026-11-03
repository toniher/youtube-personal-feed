import { test } from "node:test";
import assert from "node:assert";
import {
  dedupeByVideoId,
  uploadsPlaylistId,
  YouTubeClient,
} from "../src/youtube.js";
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

// ---------------------------------------------------------------------------
// dedupeByVideoId
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// uploadsPlaylistId (UC -> UU conversion)
// ---------------------------------------------------------------------------

test("uploadsPlaylistId converts UC channel ID to UU playlist ID", () => {
  assert.strictEqual(uploadsPlaylistId("UC123456"), "UU123456");
});

test("uploadsPlaylistId preserves non-UC IDs unchanged", () => {
  assert.strictEqual(uploadsPlaylistId("PLabcdef"), "PLabcdef");
  assert.strictEqual(uploadsPlaylistId("LL"), "LL");
  assert.strictEqual(uploadsPlaylistId("UU123456"), "UU123456");
});

// ---------------------------------------------------------------------------
// YouTubeClient.mapError
// ---------------------------------------------------------------------------

test("mapError throws QuotaError for quotaExceeded", () => {
  assert.throws(
    () => YouTubeClient.mapError(new Error("quotaExceeded")),
    (err: Error) => err.constructor.name === "QuotaError",
  );
});

test("mapError throws QuotaError for 'quota exceeded'", () => {
  assert.throws(
    () => YouTubeClient.mapError(new Error("quota exceeded daily limit")),
    (err: Error) => err.constructor.name === "QuotaError",
  );
});

test("mapError throws QuotaError for 403", () => {
  assert.throws(
    () => YouTubeClient.mapError(new Error("HTTP 403 Forbidden")),
    (err: Error) => err.constructor.name === "QuotaError",
  );
});

test("mapError throws AuthError for invalid_grant", () => {
  assert.throws(
    () => YouTubeClient.mapError(new Error("invalid_grant")),
    (err: Error) => err.constructor.name === "AuthError",
  );
});

test("mapError throws AuthError for 'Invalid Credentials'", () => {
  assert.throws(
    () => YouTubeClient.mapError(new Error("Invalid Credentials")),
    (err: Error) => err.constructor.name === "AuthError",
  );
});

test("mapError throws AuthError for 401", () => {
  assert.throws(
    () => YouTubeClient.mapError(new Error("HTTP 401 Unauthorized")),
    (err: Error) => err.constructor.name === "AuthError",
  );
});

test("mapError throws generic Error for unknown errors", () => {
  assert.throws(
    () => YouTubeClient.mapError(new Error("network failure")),
    (err: Error) =>
      err instanceof Error &&
      err.message.startsWith("YouTube API error: network failure"),
  );
});

test("mapError handles non-Error values", () => {
  assert.throws(
    () => YouTubeClient.mapError("raw string error"),
    (err: Error) => err.message === "YouTube API error: raw string error",
  );
});

// ---------------------------------------------------------------------------
// Cache behavior (listPlaylist / listUploads)
// ---------------------------------------------------------------------------

test("listPlaylist caches results and serves from cache on second call", async (t) => {
  const listMock = t.mock.fn(async () => ({
    data: {
      items: [
        {
          contentDetails: { videoId: "vid1" },
          snippet: {
            title: "Video 1",
            videoOwnerChannelId: "UCchan",
            videoOwnerChannelTitle: "Channel",
            publishedAt: "2026-01-01T00:00:00Z",
          },
        },
      ],
    },
  }));

  const youtube = {
    playlistItems: { list: listMock },
  } as unknown as ReturnType<typeof import("googleapis").google.youtube>;
  const auth = {} as never;
  const client = new YouTubeClient(auth, youtube);

  const first = await client.listPlaylist("PL123", 15);
  const second = await client.listPlaylist("PL123", 15);

  assert.strictEqual(listMock.mock.callCount(), 1);
  assert.deepStrictEqual(first, second);
});

test("listPlaylist bypasses cache when forceRefresh is true", async (t) => {
  const listMock = t.mock.fn(async () => ({ data: { items: [] } }));

  const youtube = {
    playlistItems: { list: listMock },
  } as unknown as ReturnType<typeof import("googleapis").google.youtube>;
  const auth = {} as never;
  const client = new YouTubeClient(auth, youtube);

  await client.listPlaylist("PL123", 15);
  await client.listPlaylist("PL123", 15, true);

  assert.strictEqual(listMock.mock.callCount(), 2);
});

test("listUploads converts UC channel ID to UU playlist ID", async (t) => {
  const listMock = t.mock.fn(async () => ({ data: { items: [] } }));

  const youtube = {
    playlistItems: { list: listMock },
  } as unknown as ReturnType<typeof import("googleapis").google.youtube>;
  const auth = {} as never;
  const client = new YouTubeClient(auth, youtube);

  await client.listUploads("UCabc123", 15);

  assert.strictEqual(listMock.mock.callCount(), 1);
  const call0 = listMock.mock.calls[0] as { arguments: unknown[] };
  const args = call0.arguments[0] as Record<string, unknown>;
  assert.strictEqual(args.playlistId, "UUabc123");
});

// ---------------------------------------------------------------------------
// buildFeed (sorting, filtering, dedupe, limit)
// ---------------------------------------------------------------------------

test("buildFeed sorts videos by publishedAt descending", async (t) => {
  const subsMock = t.mock.fn(async () => ({
    data: {
      items: [
        {
          snippet: {
            title: "Channel 1",
            resourceId: { channelId: "UC1" },
            description: "",
            thumbnails: { default: { url: null } },
            publishedAt: null,
          },
        },
        {
          snippet: {
            title: "Channel 2",
            resourceId: { channelId: "UC2" },
            description: "",
            thumbnails: { default: { url: null } },
            publishedAt: null,
          },
        },
      ],
      nextPageToken: undefined,
    },
  }));

  const uploadsMock = t.mock.fn(async () => ({
    data: {
      items: [
        {
          contentDetails: { videoId: "vid-old" },
          snippet: {
            title: "Old",
            videoOwnerChannelId: "UC1",
            videoOwnerChannelTitle: "Channel",
            publishedAt: "2026-01-01T00:00:00Z",
          },
        },
        {
          contentDetails: { videoId: "vid-new" },
          snippet: {
            title: "New",
            videoOwnerChannelId: "UC2",
            videoOwnerChannelTitle: "Channel",
            publishedAt: "2026-06-01T00:00:00Z",
          },
        },
      ],
    },
  }));

  const youtube = {
    subscriptions: { list: subsMock as never },
    playlistItems: { list: uploadsMock as never },
  } as unknown as ReturnType<typeof import("googleapis").google.youtube>;
  const auth = {} as never;
  const client = new YouTubeClient(auth, youtube);

  const result = await client.buildFeed(50, null);
  const titles = result.map((v) => v.title);

  assert.ok(
    titles.indexOf("New") < titles.indexOf("Old"),
    "New video should appear before Old video",
  );
});

test("buildFeed filters by sinceDays", async (t) => {
  const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const newDate = new Date().toISOString();

  const subsMock = t.mock.fn(async () => ({
    data: {
      items: [
        {
          snippet: {
            title: "Channel 1",
            resourceId: { channelId: "UC1" },
            description: "",
            thumbnails: { default: { url: null } },
            publishedAt: null,
          },
        },
      ],
      nextPageToken: undefined,
    },
  }));

  const uploadsMock = t.mock.fn(async () => ({
    data: {
      items: [
        {
          contentDetails: { videoId: "vid-old" },
          snippet: {
            title: "Old",
            videoOwnerChannelId: "UC1",
            videoOwnerChannelTitle: "Channel",
            publishedAt: oldDate,
          },
        },
        {
          contentDetails: { videoId: "vid-new" },
          snippet: {
            title: "New",
            videoOwnerChannelId: "UC1",
            videoOwnerChannelTitle: "Channel",
            publishedAt: newDate,
          },
        },
      ],
    },
  }));

  const youtube = {
    subscriptions: { list: subsMock as never },
    playlistItems: { list: uploadsMock as never },
  } as unknown as ReturnType<typeof import("googleapis").google.youtube>;
  const auth = {} as never;
  const client = new YouTubeClient(auth, youtube);

  const result = await client.buildFeed(50, 7);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0]!.title, "New");
});

test("buildFeed limits results to the requested limit", async (t) => {
  const subsMock = t.mock.fn(async () => ({
    data: {
      items: [
        {
          snippet: {
            title: "Channel 1",
            resourceId: { channelId: "UC1" },
            description: "",
            thumbnails: { default: { url: null } },
            publishedAt: null,
          },
        },
      ],
      nextPageToken: undefined,
    },
  }));

  const uploadsMock = t.mock.fn(async () => ({
    data: {
      items: [
        {
          contentDetails: { videoId: "v1" },
          snippet: {
            title: "V1",
            videoOwnerChannelId: "UC1",
            videoOwnerChannelTitle: "Channel",
            publishedAt: "2026-01-01T00:00:00Z",
          },
        },
        {
          contentDetails: { videoId: "v2" },
          snippet: {
            title: "V2",
            videoOwnerChannelId: "UC1",
            videoOwnerChannelTitle: "Channel",
            publishedAt: "2026-01-01T00:00:00Z",
          },
        },
        {
          contentDetails: { videoId: "v3" },
          snippet: {
            title: "V3",
            videoOwnerChannelId: "UC1",
            videoOwnerChannelTitle: "Channel",
            publishedAt: "2026-01-01T00:00:00Z",
          },
        },
      ],
    },
  }));

  const youtube = {
    subscriptions: { list: subsMock as never },
    playlistItems: { list: uploadsMock as never },
  } as unknown as ReturnType<typeof import("googleapis").google.youtube>;
  const auth = {} as never;
  const client = new YouTubeClient(auth, youtube);

  const result = await client.buildFeed(2, null);
  assert.strictEqual(result.length, 2);
});

test("buildFeed deduplicates videos across channels", async (t) => {
  const subsMock = t.mock.fn(async () => ({
    data: {
      items: [
        {
          snippet: {
            title: "Channel 1",
            resourceId: { channelId: "UC1" },
            description: "",
            thumbnails: { default: { url: null } },
            publishedAt: null,
          },
        },
        {
          snippet: {
            title: "Channel 2",
            resourceId: { channelId: "UC2" },
            description: "",
            thumbnails: { default: { url: null } },
            publishedAt: null,
          },
        },
      ],
      nextPageToken: undefined,
    },
  }));

  const uploadsMock = t.mock.fn(async () => ({
    data: {
      items: [
        {
          contentDetails: { videoId: "shared" },
          snippet: {
            title: "Shared",
            videoOwnerChannelId: "UC1",
            videoOwnerChannelTitle: "Channel",
            publishedAt: "2026-01-01T00:00:00Z",
          },
        },
        {
          contentDetails: { videoId: "unique" },
          snippet: {
            title: "Unique",
            videoOwnerChannelId: "UC1",
            videoOwnerChannelTitle: "Channel",
            publishedAt: "2026-01-01T00:00:00Z",
          },
        },
      ],
    },
  }));

  const youtube = {
    subscriptions: { list: subsMock as never },
    playlistItems: { list: uploadsMock as never },
  } as unknown as ReturnType<typeof import("googleapis").google.youtube>;
  const auth = {} as never;
  const client = new YouTubeClient(auth, youtube);

  const result = await client.buildFeed(50, null);
  const ids = result.map((v) => v.videoId);
  assert.strictEqual(ids.filter((id) => id === "shared").length, 1);
});

// ---------------------------------------------------------------------------
// listSubscriptions query filter
// ---------------------------------------------------------------------------

test("listSubscriptions filters by query case-insensitively", async (t) => {
  const listMock = t.mock.fn(async () => ({
    data: {
      items: [
        {
          snippet: {
            title: "Running Club",
            resourceId: { channelId: "UC1" },
            description: "A running club",
            thumbnails: { default: { url: "http://example.com/thumb.jpg" } },
            publishedAt: "2026-01-01T00:00:00Z",
          },
        },
        {
          snippet: {
            title: "Cooking Show",
            resourceId: { channelId: "UC2" },
            description: "A cooking show",
            thumbnails: { default: { url: "http://example.com/thumb.jpg" } },
            publishedAt: "2026-01-01T00:00:00Z",
          },
        },
      ],
      nextPageToken: undefined,
    },
  }));

  const youtube = {
    subscriptions: { list: listMock },
  } as unknown as ReturnType<typeof import("googleapis").google.youtube>;
  const auth = {} as never;
  const client = new YouTubeClient(auth, youtube);

  const result = await client.listSubscriptions(50, "running");
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0]!.title, "Running Club");
});
