---
title: "One PR. One Purpose."
description: "Mixing unrelated changes in a single PR is careless. It makes reviews harder, hides bugs, slows teams down, and turns reverts into nightmares."
date: "2025-12-12"
---

A PR should do exactly one thing.

Fix a bug.
Refactor code.
Rename a variable.

Not two. Not three. Just one.

Mixing unrelated changes in a single PR is careless. It makes reviews harder, hides bugs, slows teams down, and turns reverts into nightmares.

And there is an even worse pattern.

Reviewers noticing an unrelated issue and saying
"Since you are already here, can you fix this too?"

No. That is how good PRs turn into messy ones.

Reviews exist to validate the intent of the PR, not to expand its scope. The moment unrelated changes enter, intent is lost.

## The rule

One logical change per PR.
Small enough to review quickly.
Safe enough to revert.
Clear from title to diff.

If something else needs fixing, open another PR.
If it depends on this one, say so.
Otherwise, do not mix.

I have been lucky to work in teams and companies that embrace this. It is not idealism. It works.

But I have seen startups use "moving fast" and "being agile" as excuses to skip discipline. That is not speed. That is debt with interest.

This is not process.
This is professionalism.

You are a software engineer.
Act like it.
