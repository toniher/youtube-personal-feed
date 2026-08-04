import { createClient } from '../src/youtube.js';

async function main(): Promise<void> {
  const client = createClient();

  console.log('== list_subscriptions (first 10) ==');
  const subs = await client.listSubscriptions(10);
  if (subs.length === 0) {
    console.log('(no subscriptions found)');
  } else {
    for (const s of subs) {
      console.log(`- ${s.title}  ${s.channelUrl}`);
    }
  }

  console.log('\n== list_feed (first 10) ==');
  const feed = await client.buildFeed(10, null);
  if (feed.length === 0) {
    console.log('(feed empty)');
  } else {
    for (const v of feed) {
      console.log(`- ${v.publishedAt.slice(0, 10)}  ${v.channelTitle}: ${v.title}  ${v.videoUrl}`);
    }
  }

  if (feed[0]) {
    console.log('\n== get_video ==');
    const detail = await client.getVideoDetail(feed[0].videoId);
    console.log(`${detail.title} | duration=${detail.duration} views=${detail.viewCount} ${detail.videoUrl}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
