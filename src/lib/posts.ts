import { getCollection } from "astro:content";

export async function getPublishedPosts() {
  return (await getCollection("blog"))
    .filter((post) => !post.data.draft)
    .sort((a, b) => {
      const dateCompare = b.data.date.valueOf() - a.data.date.valueOf();
      if (dateCompare !== 0) return dateCompare;
      return a.id.localeCompare(b.id);
    });
}

export function tagCounts(posts: Awaited<ReturnType<typeof getPublishedPosts>>) {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
