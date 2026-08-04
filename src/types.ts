export interface SubscriptionItem {
  channelId: string;
  title: string;
  handle: string | null;
  description: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  channelUrl: string;
}

export interface FeedVideo {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  videoUrl: string;
  description?: string;
}

export interface VideoDetail extends FeedVideo {
  duration: string | null;
  viewCount: string | null;
  likeCount: string | null;
  commentCount: string | null;
  liveBroadcastContent: string;
  channelUrl: string;
}
