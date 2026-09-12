import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { google } from "googleapis";
import { loadEnv, tokenFilePath } from "./config.js";
import type { FeedVideo, SubscriptionItem, VideoDetail } from "./types.js";

const SUBSCRIPTIONS_TTL_MS = 30 * 60 * 1000;
const UPLOADS_TTL_MS = 10 * 60 * 1000;

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

export class AuthError extends Error {}

export class QuotaError extends Error {}

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

function readTokens(): Record<string, unknown> | null {
  const path = tokenFilePath();
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function createOAuthClient(): OAuth2Client {
  const { CLIENT_ID, CLIENT_SECRET } = process.env as Record<string, string>;
  const client = new google.auth.OAuth2({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
  });
  const tokens = readTokens();
  if (!tokens) {
    throw new AuthError(
      "Not authenticated. Run `youtube-personal-feed-auth` once to connect your YouTube account.",
    );
  }
  client.setCredentials(
    tokens as Parameters<OAuth2Client["setCredentials"]>[0],
  );
  client.on("tokens", (newTokens) => {
    const existing = readTokens() ?? {};
    persistTokens({ ...existing, ...newTokens });
  });
  return client;
}

export function persistTokens(tokens: Record<string, unknown>): void {
  const path = tokenFilePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export class YouTubeClient {
  auth: OAuth2Client;
  private subscriptionsCache: CacheEntry<SubscriptionItem[]> | null = null;
  private playlistCache = new Map<string, CacheEntry<FeedVideo[]>>();
  private videoCache = new Map<string, CacheEntry<VideoDetail>>();

  constructor(auth: OAuth2Client) {
    this.auth = auth;
  }

  private get api() {
    return google.youtube({
      version: "v3",
      auth: this.auth as never,
    });
  }

  private static mapError(err: unknown): never {
    const message = err instanceof Error ? err.message : String(err);
    if (/(quotaExceeded|quota exceeded|403)/i.test(message)) {
      throw new QuotaError(
        "YouTube API quota exceeded (default 10,000 units/day). Wait until tomorrow or request more quota.",
      );
    }
    if (/(invalid_grant|Invalid Credentials|401)/i.test(message)) {
      throw new AuthError(
        "YouTube authorization failed or was revoked. Re-run `youtube-personal-feed-auth` (or `npm run auth`).",
      );
    }
    throw new Error(`YouTube API error: ${message}`);
  }

  async listSubscriptions(
    maxResults = 50,
    query?: string,
  ): Promise<SubscriptionItem[]> {
    const fresh =
      this.subscriptionsCache && this.subscriptionsCache.expiresAt > Date.now();
    let items: SubscriptionItem[];
    if (fresh) {
      items = this.subscriptionsCache!.value;
    } else {
      items = await this.fetchAllSubscriptions();
      this.subscriptionsCache = {
        expiresAt: Date.now() + SUBSCRIPTIONS_TTL_MS,
        value: items,
      };
    }
    if (query) {
      const q = query.toLowerCase();
      items = items.filter((s) => s.title.toLowerCase().includes(q));
    }
    return items.slice(0, maxResults);
  }

  private async fetchAllSubscriptions(): Promise<SubscriptionItem[]> {
    const out: SubscriptionItem[] = [];
    let pageToken: string | undefined;
    do {
      const res = await this.api.subscriptions
        .list({
          part: ["snippet"],
          mine: true,
          maxResults: 50,
          pageToken,
        })
        .catch(YouTubeClient.mapError);
      for (const s of res.data.items ?? []) {
        const snippet = s.snippet;
        if (!snippet) continue;
        const channelId = snippet.resourceId?.channelId;
        if (!channelId) continue;
        out.push({
          channelId,
          title: snippet.title ?? "(untitled)",
          handle: null,
          description: snippet.description ?? "",
          thumbnailUrl: snippet.thumbnails?.default?.url ?? null,
          publishedAt: snippet.publishedAt ?? null,
          channelUrl: `https://www.youtube.com/channel/${channelId}`,
        });
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
    return out;
  }

  async listUploads(
    channelId: string,
    maxResults = 15,
    forceRefresh = false,
  ): Promise<FeedVideo[]> {
    const playlistId = channelId.startsWith("UC")
      ? `UU${channelId.slice(2)}`
      : channelId;
    return this.listPlaylist(playlistId, maxResults, forceRefresh);
  }

  async listPlaylist(
    playlistId: string,
    maxResults = 15,
    forceRefresh = false,
  ): Promise<FeedVideo[]> {
    const key = playlistId;
    const cached = this.playlistCache.get(key);
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      return cached.value.slice(0, maxResults);
    }
    const out: FeedVideo[] = [];
    const res = await this.api.playlistItems
      .list({
        part: ["snippet", "contentDetails"],
        playlistId,
        maxResults: Math.min(maxResults, 50),
      })
      .catch(YouTubeClient.mapError);
    for (const item of res.data.items ?? []) {
      const videoId = item.contentDetails?.videoId;
      const snippet = item.snippet;
      if (!videoId || !snippet) continue;
      const channelId = snippet.videoOwnerChannelId ?? snippet.channelId ?? "";
      out.push({
        videoId,
        title: snippet.title ?? "(untitled)",
        channelId,
        channelTitle:
          snippet.videoOwnerChannelTitle ?? snippet.channelTitle ?? channelId,
        publishedAt: snippet.publishedAt ?? "",
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        description: snippet.description ?? undefined,
      });
    }
    const unique = dedupeByVideoId(out);
    this.playlistCache.set(key, {
      expiresAt: Date.now() + UPLOADS_TTL_MS,
      value: unique,
    });
    return unique.slice(0, maxResults);
  }

  async getLikedVideos(
    maxResults = 15,
    forceRefresh = false,
  ): Promise<FeedVideo[]> {
    return this.listPlaylist("LL", maxResults, forceRefresh);
  }

  async getVideoDetail(videoId: string): Promise<VideoDetail> {
    const cached = this.videoCache.get(videoId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const res = await this.api.videos
      .list({
        part: ["snippet", "contentDetails", "statistics"],
        id: [videoId],
      })
      .catch(YouTubeClient.mapError);
    const item = res.data.items?.[0];
    if (!item) throw new Error(`Video not found: ${videoId}`);
    const snippet = item.snippet;
    const detail: VideoDetail = {
      videoId,
      title: snippet?.title ?? "(untitled)",
      channelId: snippet?.channelId ?? "",
      channelTitle: snippet?.channelTitle ?? "",
      publishedAt: snippet?.publishedAt ?? "",
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      channelUrl: snippet?.channelId
        ? `https://www.youtube.com/channel/${snippet.channelId}`
        : "",
      description: snippet?.description ?? undefined,
      duration: item.contentDetails?.duration ?? null,
      viewCount: item.statistics?.viewCount ?? null,
      likeCount: item.statistics?.likeCount ?? null,
      commentCount: item.statistics?.commentCount ?? null,
      liveBroadcastContent: snippet?.liveBroadcastContent ?? "none",
    };
    this.videoCache.set(videoId, {
      expiresAt: Date.now() + UPLOADS_TTL_MS,
      value: detail,
    });
    return detail;
  }

  async buildFeed(
    limit: number,
    sinceDays: number | null,
    channelIdFilter?: string,
  ): Promise<FeedVideo[]> {
    const since =
      sinceDays != null ? Date.now() - sinceDays * 24 * 60 * 60 * 1000 : null;
    const subscriptions = await this.listSubscriptions(500);
    let channels = subscriptions;
    if (channelIdFilter) {
      channels = subscriptions.filter((s) => s.channelId === channelIdFilter);
      if (channels.length === 0) {
        channels = [
          {
            channelId: channelIdFilter,
            title: "",
            handle: null,
            description: "",
            thumbnailUrl: null,
            publishedAt: null,
            channelUrl: "",
          },
        ];
      }
    }
    const uploadsByChannel: FeedVideo[][] = [];
    for (let start = 0; start < channels.length; start += 10) {
      const batch = channels.slice(start, start + 10);
      const uploads = await Promise.all(
        batch.map(async (sub) => {
          try {
            return await this.listUploads(sub.channelId, 15);
          } catch {
            return [];
          }
        }),
      );
      uploadsByChannel.push(...uploads);
    }
    const all = uploadsByChannel
      .flat()
      .filter(
        (video) => !since || new Date(video.publishedAt).getTime() >= since,
      );
    all.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
    return dedupeByVideoId(all).slice(0, limit);
  }
}

function dedupeByVideoId(videos: FeedVideo[]): FeedVideo[] {
  const seen = new Set<string>();
  const out: FeedVideo[] = [];
  for (const v of videos) {
    if (seen.has(v.videoId)) continue;
    seen.add(v.videoId);
    out.push(v);
  }
  return out;
}

export function createClient(): YouTubeClient {
  loadEnv();
  if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
    throw new AuthError(
      "Missing Google OAuth credentials. 1. Create a Desktop OAuth client in Google Cloud Console (see README.md). 2. Set CLIENT_ID and CLIENT_SECRET in the environment, .env, or ~/.config/youtube-personal-mcp/.env.",
    );
  }
  const auth = createOAuthClient();
  return new YouTubeClient(auth);
}

export { readTokens };
