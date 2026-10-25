---
title: "Writing Exports Maps from the Imports Already in Use"
description: "A CLI that scans a monorepo and its consumers for deep imports, then writes package.json exports maps that keep them working. Built issue by issue with a coding agent."
date: "2025-09-18"
tags: ["typescript", "monorepo", "cli", "agents"]
---
![Exportmapify scans the main monorepo and consumer repos into one usage file, then writes exports maps into the main repo packages.](./flow.svg)


Large JavaScript monorepos tend to grow the same way. A package ships a `main` field, and over the years other packages start importing files from inside it: `@company/ui/lib/Button`, `@company/utils/lib/formatDate`. Nobody planned these paths. They are just whatever worked.

Then someone wants to add an `exports` field to `package.json`. The moment you do, Node and modern bundlers stop allowing any path you did not list. Every deep import that is not in the map breaks. In a big repo, nobody knows the full list, and some of the importers live in other repositories.

I wrote [exportmapify](https://github.com/altinokdarici/exportmapify) to answer one question: what is the smallest `exports` map that keeps every import that exists today working?

## Measure first, then write

The tool has two commands and I kept them apart on purpose.

`evaluate` walks a repo, parses every TypeScript and JavaScript file, and records each import that targets an internal package. It catches ES imports, `require` calls and dynamic `import()`. The result is a plain JSON file:

```json
{
  "@company/ui": {
    "package": "@company/ui",
    "versionRequirement": "*",
    "importPaths": [".", "./lib/Button", "./lib/Modal"]
  }
}
```

`fix` reads that file and writes `exports` into each package that lives under the current directory.

Splitting them gave me three things. The usage file is something a human can read and review in a PR. Scans are additive, so I can run `evaluate` on the main repo and then on each consumer repo, and they all merge into one file. And `fix --dry-run` can show the exact change before anything is written.

## Consumers in other repos

The hardest real case was code outside the monorepo. Apps in separate repositories import packages from the main one, and they also break when `exports` lands.

So `evaluate` takes `--main-repo`. When it scans a consumer repo, it first discovers the packages in the main repo, and then only records imports that point at them. Everything else (React, lodash, the consumer's own packages) is ignored. `fix` then only touches packages that exist in the target directory, even if the usage file has data from five repos.

## Inference is the real work

Knowing that someone imports `./lib/Button` is the easy part. Writing a correct entry for it is not. The import path is a source-ish path. The map has to point at built files, with the right conditions.

For each path the tool has to work out:

- Where the built file is: `lib/`, `dist/`, or next to the source, with `.ts` mapped to `.js` and `.d.ts`.
- Whether the package ships both CJS and ESM builds, so it can emit `import` and `require` conditions.
- What the old `main`, `module`, `types` and `browser` fields said, since those express intent the package author already had.
- What to do when the build output is missing because the scan runs on a clean checkout. In that case it infers from source files.
- Whether to add a `source` condition for tools that resolve straight to TypeScript.

Each of those became its own small module with its own tests. The resulting entry looks like this:

```json
"./lib/Button": {
  "types": "./lib/Button.d.ts",
  "import": "./esm/Button.js",
  "require": "./lib/Button.js"
}
```

## How I built it

This was one of my first projects built mostly with a coding agent. The workflow ended up being the interesting part.

I started with a todo folder of design notes. That did not work well. The notes drifted from the code and the agent had no clear unit of work. So I moved every item into a GitHub issue with a short spec: the problem, the expected input and output, and the edge cases. Browser field handling, source file inference, CJS/ESM detection, file discovery and the source condition each became one issue.

Then I wrote a `CLAUDE.md` with the architecture, one function per file, the commands to build, lint and test, and an issue workflow: branch name from the issue number, implement, run typecheck, lint and tests, open a PR that closes the issue. After that, each feature was one session and one PR. Most of the merged PRs in the repo came out of that loop.

What made it work was not the agent being clever. It was that each issue was small and checkable, and the repo told the agent how to check its own work.

## What went wrong

The first version of import tracking recorded too much. On the main repo scan it picked up imports of external packages too, which bloated the usage file and made `fix` think about packages it should never touch. The fix was to resolve the set of internal packages first and filter against it. Obvious in hindsight, but I only saw it after running the tool on a real repo instead of fixtures.

I also learned that the README rots faster than code when an agent is adding features quickly. Several PRs changed behavior that the README still described the old way. Now I treat the README as part of the acceptance check for each issue.

## Trade-offs

- **Explicit paths over wildcards.** The tool writes one entry per used path. A `"./lib/*"` pattern would be shorter, but it would also export things nobody uses, which defeats the point of an `exports` map. The cost is a longer map.
- **Static scan only.** Imports built from strings at runtime are invisible. In practice these were rare, and the dry run makes misses easy to spot.
- **Usage, not intent.** The map reflects what people use today, not what the package author wants to be public. I see it as a safe starting point. You can delete entries later, on purpose, with a deprecation.

## Why I care

Most of my work now is building tools that agents and people both use. This one is small, but it has the shape I like: measure the real system, write a reviewable artifact, then make a change you can preview. That shape is also what makes a tool safe to hand to an agent. A step that writes a JSON file and a step that applies it is much easier to trust than one step that edits a hundred `package.json` files at once.

## What's next

A `check` command for CI that fails when a new deep import is not covered, a fixture monorepo for the README demo, and either finishing or dropping version tracking. The code is at [github.com/altinokdarici/exportmapify](https://github.com/altinokdarici/exportmapify).
