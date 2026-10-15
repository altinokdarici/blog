import type { APIRoute } from "astro";
import { HOME } from "@consts";
import { pngResponse, renderOgImage } from "@lib/og";

export const GET: APIRoute = async () => {
  const png = await renderOgImage({ title: HOME.DESCRIPTION });
  return pngResponse(png);
};
