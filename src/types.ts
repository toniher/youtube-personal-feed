import { z } from "zod";

export const subscriptionItemSchema = z.object({
  channelId: z.string(),
  title: z.string(),
  handle: z.string().nullable(),
  description: z.string(),
  thumbnailUrl: z.string().nullable(),
  publishedAt: z.string().nullable(),
  channelUrl: z.string(),
});
export type SubscriptionItem = z.infer<typeof subscriptionItemSchema>;

export const feedVideoSchema = z.object({
  videoId: z.string(),
  title: z.string(),
  channelId: z.string(),
  channelTitle: z.string(),
  publishedAt: z.string(),
  videoUrl: z.string(),
  description: z.string().optional(),
});
export type FeedVideo = z.infer<typeof feedVideoSchema>;

export const videoDetailSchema = feedVideoSchema.extend({
  duration: z.string().nullable(),
  viewCount: z.string().nullable(),
  likeCount: z.string().nullable(),
  commentCount: z.string().nullable(),
  liveBroadcastContent: z.string(),
  channelUrl: z.string(),
});
export type VideoDetail = z.infer<typeof videoDetailSchema>;
