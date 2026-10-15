import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { getCollection, render } from "astro:content";
import sanitizeHtml from "sanitize-html";
import { HOME } from "@consts";

function absolutize(url: string, base: URL) {
  if (!url || url.startsWith("#")) return url;
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

export async function GET(context: APIContext) {
  const site = context.site ?? new URL("https://altinok.dev");
  const container = await AstroContainer.create();

  const blog = (await getCollection("blog"))
    .filter(post => !post.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  const items = await Promise.all(blog.map(async (post) => {
    const link = `/${post.id}/`;
    const base = new URL(link, site);
    const { Content } = await render(post);
    const html = await container.renderToString(Content);

    const content = sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ["src", "alt", "title", "width", "height"],
      },
      transformTags: {
        a: (tagName, attribs) => ({
          tagName,
          attribs: attribs.href ? { ...attribs, href: absolutize(attribs.href, base) } : attribs,
        }),
        img: (tagName, attribs) => ({
          tagName,
          attribs: attribs.src ? { ...attribs, src: absolutize(attribs.src, base) } : attribs,
        }),
      },
    });

    return {
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link,
      content,
    };
  }));

  return rss({
    title: HOME.TITLE,
    description: HOME.DESCRIPTION,
    site,
    items,
  });
}
