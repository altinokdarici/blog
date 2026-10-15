import type { APIRoute, GetStaticPaths } from "astro";
import type { CollectionEntry } from "astro:content";
import { formatOgDate, pngResponse, renderOgImage } from "@lib/og";
import { getPublishedPosts } from "@lib/posts";

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getPublishedPosts();
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { post },
  }));
};

export const GET: APIRoute<{ post: CollectionEntry<"blog"> }> = async ({ props }) => {
  const { post } = props;
  const png = await renderOgImage({ title: post.data.title, subtitle: formatOgDate(post.data.date) });
  return pngResponse(png);
};
