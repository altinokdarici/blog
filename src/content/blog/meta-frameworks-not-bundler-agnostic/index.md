---
title: "JS Meta Frameworks Are Not Bundler Agnostic"
description: "I thought frameworks sat above the bundler, but reading the plugin code changed my view."
date: "2025-11-07"
tags: ["javascript", "tooling"]
---

I used to think JavaScript meta frameworks sat cleanly above the bundler. The framework should define routing, data loading, server boundaries. The bundler should handle graph traversal, transforms, and the dev server. In my head these were two separate layers.

Then I looked at the plugin code.

React Router's Vite plugin is around four thousand lines before counting helpers. It creates virtual modules, injects routing logic into the module graph, hooks into the dev server, controls HMR, shapes the server and client builds, and pushes data into the runtime. That is not a small adapter. A large part of the framework logic lives inside the plugin.

Next.js shows the same pattern. Even though it sits on top of Turbopack or Webpack, the integration layer is deep. The server component pipeline, the routing model, entrypoints, data fetching strategy, and streaming rules all depend on bundler specific behavior. The framework runtime is tightly fused to the build pipeline.

React Server Components made this even more obvious. RSC needs transforms, graph annotations, special entrypoints, and a protocol handled inside the build system. None of this is general purpose. Porting a JS framework to another bundler means rebuilding a significant part of its behavior inside a new plugin.

This changed how I think about JavaScript frameworks.
They can target multiple bundlers, but the cost of doing so is high because the plugin layer contains so much framework logic. The separation looks clean in theory. In practice the framework rewires the bundler and depends on details that are not portable.

So the idea that a JS meta framework simply "sits on top" of a bundler no longer fits. The plugin is where most of the real work happens, and that plugin effectively becomes the foundation the framework stands on.

Once you read the plugin code, it is hard to keep thinking of JS frameworks as independent layers you can move between bundlers. The boundary is thinner than it looks, and most of the complexity hides in the integration layer.
