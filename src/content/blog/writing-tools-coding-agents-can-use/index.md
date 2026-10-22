---
title: "Writing Tools That Coding Agents Can Actually Use"
description: "Tool names and descriptions are prompts. Output needs a budget. Errors need a next step. Habits that fixed most of my agent tool failures."
date: "2026-10-22"
tags: ["agents", "tooling", "mcp"]
---

![How an agent uses a tool: a clear description leads to the right call, output is cut to a budget with a hint, and errors say what to try next.](./flow.svg)


I have built a lot of tools for coding agents over the last year: MCP servers, CLI wrappers, small helpers that let an agent talk to a build system or a ticket queue. For a long time I wrote them the way I write APIs for people. They worked fine when I called them by hand. Then I watched agents use them, and a surprising amount of failure came from the tools rather than the model.

This post is about the handful of habits that fixed most of it.

## The problem

An agent sees a tool through three things: its name, its description and its schema. That is the whole interface. It cannot read the source, it cannot ask a colleague, and it usually cannot see the docs. When it gets a result back, that text goes straight into its context and stays there.

So a tool can fail an agent in ways that would never bother a human:

- Two tools with similar names, and the agent keeps picking the wrong one.
- A parameter called `path` where it is unclear if it is relative to the repo or absolute.
- A command that returns 40,000 lines of log, which pushes the actual task out of context.
- An error like `Error: 400` that gives the agent nothing to try next, so it retries the same call five times.

None of these are model bugs. They are interface bugs.

## Names and descriptions are prompts

The first fix was to treat the description as a prompt, because that is what it is. A good description answers four questions: what does this do, when should I use it, when should I use something else, and what does a typical call look like.

```json
{
  "name": "search_code",
  "description": "Search file contents in the current repo with a regex. Use for finding symbols or strings. To find files by name, use find_files instead. Example: {\"pattern\": \"class UserStore\", \"glob\": \"src/**/*.ts\"}",
  "input_schema": {
    "type": "object",
    "properties": {
      "pattern": { "type": "string", "description": "Regex, ripgrep syntax." },
      "glob": { "type": "string", "description": "Optional file filter, relative to repo root." }
    },
    "required": ["pattern"]
  }
}
```

The "use find_files instead" line did more than anything else. Most wrong-tool calls I saw were between two tools that overlapped. Saying out loud where the boundary is fixed it. When I could not write that sentence clearly, it usually meant the two tools should be merged.

I also stopped exposing every knob. If a parameter is needed in one call out of a hundred, it costs attention in the other ninety-nine. I moved those into sensible defaults or a separate tool.

## Output has a budget

The second fix was output size. Agents pay for every token a tool returns, and they pay again on every later turn because it stays in context. A test run that prints everything is fine in a terminal and terrible in a context window.

Every handler now goes through a small wrapper:

```ts
function budget(text: string, max = 8_000, hint = "") {
  if (text.length <= max) return text;
  const head = text.slice(0, max * 0.3);
  const tail = text.slice(-max * 0.6);
  return `${head}\n... [${text.length - head.length - tail.length} chars cut] ...\n${tail}\n${hint}`;
}
```

Two details matter. I keep both the head and the tail, because for build and test output the useful part is often at the end. And the hint tells the agent how to get the rest, for example "rerun with `filter` to see one test" or "read the full log at `.logs/test.txt`". Without the hint the agent assumes the output is complete and draws the wrong conclusion.

## Errors should say what to do next

The third fix was errors. When a tool fails, the agent reads the error and decides what to do. If the error is vague it guesses, and guesses tend to loop.

I now return errors in a fixed shape: what failed, why, and a concrete next step.

```ts
return agentError({
  what: "File not found: src/userStore.ts",
  why: "Paths are relative to the repo root.",
  next: "Did you mean src/stores/userStore.ts? Use find_files to search by name."
});
```

That last line looks like a small thing, but it turned many three-call loops into one retry. I also stopped throwing on recoverable cases. A search with no matches returns "no matches" and a suggestion, not an exception, because some agent runtimes treat exceptions as hard failures and give up.

## Measure it

Each of these fixes came from watching transcripts, which does not scale. So I started keeping a small task list per tool set, like "find where X is defined" or "run only the failing test", and replaying it against a model. For each run I count three things: did it pick the right tool first, were the arguments valid, and how many calls did it take.

This is not a rigorous benchmark. It is a smoke test for the interface. But it catches regressions when I rename a tool or add a new one that overlaps with an old one, which is exactly when things used to break quietly.

## Trade-offs

Longer descriptions cost tokens on every request, since tool definitions are sent every time. With a large tool set this adds up. My rule now is that every sentence in a description has to prevent a mistake I have actually seen. If not, it goes.

Truncation can hide the one line that matters. Keeping the tail helps, and so does letting the agent ask for a filtered view, but it is still a guess about what is important.

Fewer, broader tools are easier to choose between but harder to describe. I lean toward fewer tools with clear boundaries, and accept a few more parameters.

## What failed

I tried putting tool guidance in the system prompt instead of the descriptions. It worked for one agent and broke when the same MCP server was used by another runtime with its own system prompt. Guidance has to live with the tool.

I also tried returning JSON everywhere for consistency. For structured data that is good. For logs and diffs it made things worse, because escaped newlines are harder for the model to read. Plain text for text, JSON for data.

## Lessons

- The tool definition is a prompt. Write it like one, with boundaries and an example.
- Every tool needs an output budget and a way to get more.
- Errors should end with a next step.
- Keep a small replay set and run it when tools change.

## What's next

I want to turn these rules into a linter and a set of wrappers so I stop rewriting them per project, and add the replay runner with a fake model so it can run in CI. If that works out it will show up as a small open-source package.
