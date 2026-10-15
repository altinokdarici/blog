# altinok.dev

Personal blog of Altinok Darici, originally based on [Astro Nano](https://github.com/markhorn-dev/astro-nano).

## Stack

- [Astro 7](https://astro.build) with the Content Layer API (`src/content.config.ts`)
- [Tailwind CSS 4](https://tailwindcss.com) via `@tailwindcss/vite`
- ESLint flat config (`eslint.config.js`)
- pnpm 9 (pinned through `packageManager` in `package.json`)

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start the dev server at `localhost:4321` |
| `pnpm build` | Run `astro check` and build the site into `dist/` |
| `pnpm preview` | Preview the production build |
| `pnpm lint` | Lint the project with ESLint |

## Adding a post

Create a folder under `src/content/blog/` named after the post's URL slug, with an `index.md` (or `index.mdx`) inside. Images can live next to it in the same folder.

```md
---
title: "My new post"
description: "One-sentence summary used for listings and share cards."
date: "2026-01-31"
tags: ["typescript", "tooling"]
draft: false
---

Post content goes here.
```

Posts with `draft: true` are left out of the build. The post is published at `/<folder-name>/`.

## Deployment

Every push to `main` runs the GitHub Actions workflow in `.github/workflows/`, which builds the site and deploys it to GitHub Pages.
