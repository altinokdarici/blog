---
title: "One Memory for All My Coding Agents"
description: "Why I gave Claude Code, Copilot CLI, and my sandboxes one shared memory server, how it works, and what went wrong along the way."
date: "2026-10-15"
tags: ["agents", "tooling"]
---

Every coding agent I use starts each session with no memory. It doesn't know I prefer small commits, that one repo needs Node 24, or that I already tried an approach yesterday and threw it away. I explain it again, the agent does good work, and the next session starts from zero.

This wasn't a real problem until I started working on tens of projects at the same time. With one project, the fix is easy: keep a Markdown file with my preferences and project notes, and have the agent read it at the start of every session. Many people do exactly that, and it works.

My setup doesn't fit in one file. I work on several machines: a laptop, a desktop, and a home server I message from my phone. I use more than one agent, mostly Claude Code and Copilot CLI. And more and more of my agents run in short-lived environments, like cloud sandboxes, that start clean and don't have my local Claude or Copilot setup at all. A Markdown file on my laptop doesn't reach any of them. What I teach one agent stays with that agent, on that machine, in that project.

So I moved memory out of the agents and machines: one memory server that every agent talks to, and that a fresh environment can connect to with nothing more than a plugin and a token.

## Why I care about this

The short answer: context is the bottleneck now. Models are good at writing code. They're much worse at knowing *your* code, *your* habits, and *what already happened*. Most of my bad agent sessions weren't bad because the model was weak. They went wrong because the agent was missing something I knew and didn't think to say.

There's a second reason. I wanted to understand agent memory by running it myself, not by reading about it. What should be remembered? Who decides? When does memory help, and when does it confuse the agent with stale facts? I couldn't answer those questions from the outside.

And a third, practical one: I kept losing sessions. I'd remember fixing something "last week, on the desktop, I think in Copilot" and have no way to find it. I wanted to ask "which session did I set up the VPN in?" and get the answer back.

## What it does

From my point of view as the user, three things happen without me doing anything:

1. **It saves as I work.** When I finish a turn, the question and answer are saved. When a session ends, it's turned into knowledge: people, projects, decisions, preferences, and how they connect.
2. **It recalls before the agent answers.** When I type a prompt, the system looks up related memories and quietly adds them to the agent's context. The agent "just knows" what I told a different agent last week.
3. **It keeps a record of every session.** Each session gets a short record: which machine, which folder, which project, what I asked for, and the command to resume it. I can search those records like anything else.

Memory is also **per project**. What I learn in one repo stays with that repo, and every clone of it on every machine shares it. Personal preferences ("write short commit messages") go into a general memory that every project can read. That split mattered more than I expected. Before it, questions in one repo pulled in confident but irrelevant memories from another.

## How it fits together

Here's the topology at a high level:

```text
   Laptop                 Desktop               Home server
 ┌───────────────┐   ┌───────────────┐   ┌──────────────────────┐
 │ Claude Code   │   │ Copilot CLI   │   │ Chat bot (phone ->   │
 │ Copilot CLI   │   │ Agents app    │   │ coding agent)        │
 │  + memory     │   │  + memory     │   │  + memory plugin     │
 │    plugin     │   │    plugin     │   │                      │
 └──────┬────────┘   └──────┬────────┘   │  ┌────────────────┐  │
        │  hooks: save / recall          │  │ Reverse proxy  │  │
        └──────────┬────────┴────────────┼─►│ HTTPS + token  │  │
                   │                     │  └───────┬────────┘  │
                   │                     │  ┌───────▼────────┐  │
     MCP tools ────┘                     │  │ Memory server  │  │
     (agents can search directly)        │  │ graph + vectors│  │
                                         │  │ on local disk  │  │
                                         │  └────────────────┘  │
                                         └──────────────────────┘
```

The pieces:

- **A plugin in each agent.** It uses the agent's lifecycle hooks: session start, prompt submitted, turn finished, and session end. These are the only places memory touches the agent. The upstream plugin was written for Claude Code. I wrote a companion for Copilot CLI, because the hooks had the same names but behaved differently.
- **One memory server at home.** It runs [Cognee](https://github.com/topoteretes/cognee) for memory, with Neo4j as the graph database, in containers on a small server. It stores entities and relationships plus vector embeddings for search, and computes embeddings locally. I'm not attached to either tool. They were a practical starting point, and there are other options that are at least as good. The plugins only need something that can save and recall.
- **A reverse proxy in front.** It handles HTTPS and checks a token on every request, so any of my environments can use it, including a fresh sandbox.
- **MCP tools.** Besides the automatic recall, agents can search memory directly with MCP tools when they need to dig deeper.

## Why this shape

**A home server, because it was there.** Running it at home was a matter of convenience and cost, not principle. I had a server at home that was mostly idle, so I put the memory there. Nothing in the design depends on that. The same setup would run just as well on a small cloud VM, or I could point the plugins at a paid hosted memory service. I just didn't want to pay for either.

**One server, many clients.** The value is in sharing. A memory per machine would just repeat the problem I started with.

**Companion plugins, not forks.** The memory plugin keeps improving upstream. I add only the small layer each agent needs, so I get upstream fixes for free.

## What went wrong

**It failed silently at first.** When I first installed the plugin in Copilot CLI, it logged success at every step and remembered almost nothing. The lesson: don't trust logs, check the result. Does the agent's context actually contain the memory?

**Backfilling was a mistake.** I uploaded every old session at once so the history would be searchable from day one. It kept the memory server busy for days. Now I record sessions only as they happen. Fresh memory turned out to be more useful than complete memory.

**Memory has to fail quietly.** When the memory server is slow or down, the agent must keep working without it. A missing memory costs a little context; a hanging prompt costs the whole session. Every hook has a short timeout, so the agent carries on without memory instead of waiting for it.

## What I learned

- Memory is mostly a **scoping** problem. Deciding *which* memory to show an agent matters more than how much it remembers.
- **Automatic beats manual.** I never once remembered to "save this to memory" by hand. Hooks do it every time.
- **Searchable session records** turned out to be the most useful feature, even though it started as an afterthought.
