import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import satori from "satori";
import sharp from "sharp";
import { SITE } from "@consts";

const require = createRequire(import.meta.url);

let fonts: Promise<{ regular: Buffer; semibold: Buffer }> | undefined;

function loadFonts() {
  fonts ??= Promise.all([
    readFile(require.resolve("@fontsource/inter/files/inter-latin-400-normal.woff")),
    readFile(require.resolve("@fontsource/inter/files/inter-latin-600-normal.woff")),
  ]).then(([regular, semibold]) => ({ regular, semibold }));
  return fonts;
}

type Node = {
  type: string;
  props: { style?: Record<string, unknown>; children?: Node | string | (Node | string)[] };
};

const el = (type: string, style: Record<string, unknown>, children?: Node["props"]["children"]): Node => ({
  type,
  props: { style, children },
});

export function formatOgDate(date: Date) {
  return date.toLocaleDateString("en-us", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function renderOgImage({ title, subtitle }: { title: string; subtitle?: string }) {
  const { regular, semibold } = await loadFonts();

  const tree = el(
    "div",
    {
      width: 1200,
      height: 630,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "80px",
      boxSizing: "border-box",
      backgroundColor: "#fafaf9",
      color: "#1c1917",
      fontFamily: "Inter",
      borderTop: "16px solid #292524",
    },
    [
      el("div", { display: "flex", fontSize: 30, fontWeight: 600, color: "#57534e" }, SITE.NAME),
      el(
        "div",
        { display: "flex", width: 1040, fontSize: title.length > 60 ? 60 : 72, fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.02em" },
        title,
      ),
      el(
        "div",
        { display: "flex", width: 1040, justifyContent: "space-between", fontSize: 28, fontWeight: 400, color: "#78716c" },
        [el("div", { display: "flex" }, subtitle ?? ""), el("div", { display: "flex" }, "altinok.dev")],
      ),
    ],
  );

  // satori's types expect a ReactNode; a plain element object is what it consumes at runtime.
  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Inter", data: regular, weight: 400, style: "normal" },
      { name: "Inter", data: semibold, weight: 600, style: "normal" },
    ],
  });

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export function pngResponse(png: Buffer) {
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
}
