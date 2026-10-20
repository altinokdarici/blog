---
title: "Using an Azure DevOps npm Feed from a GitHub Repo, Without Storing a Secret"
description: "How to make a private Azure DevOps npm feed the default registry for a GitHub repo, and authenticate in CI, on Windows, WSL, macOS, and Codespaces without a PAT."
date: "2026-10-20"
tags: ["tooling", "ci", "npm"]
---

In an enterprise, installing straight from the public npm registry is risky. Packages can be hijacked, typosquatted, or unpublished, and every build depends on a service you don't control. That's why most companies use a private feed instead, usually a mirror of the public registry. Every open-source package you install is cached in the private feed, so you can scan it and you still have it if it disappears upstream. The same feed is also where the company publishes and shares its own private packages.

On Azure, that feed is usually an Azure DevOps (ADO) Artifacts feed, even when the code lives on GitHub. Pointing a GitHub repo at an ADO feed is easy. Logging in to it is the hard part. Every place that installs packages needs a valid credential: CI, a Windows laptop, WSL, a Mac, a Codespace.

The usual answer is to create a personal access token (PAT), save it as a GitHub secret, and tell people to paste one into their `~/.npmrc`. That works until the PAT expires, the person who created it leaves, or it ends up in a log. This post describes a setup with no long-lived feed secret anywhere: not in GitHub, and not in the repo.

## The shape of it

The feed is the default registry for the whole repo, and npm, pnpm, or Yarn installs everything through it. The repo's `.npmrc` only says *where* the registry is. It never says how to log in:

```ini
registry=https://pkgs.dev.azure.com/<org>/_packaging/<feed>/npm/registry/
always-auth=true
```

The credential always goes in the **user-level** `~/.npmrc`, and each environment gets it in its own way:

| Environment | How it gets a token |
|---|---|
| GitHub Actions | GitHub OIDC → Microsoft Entra → ADO access token |
| Windows | `vsts-npm-auth` |
| WSL | `vsts-npm-auth`, called through Windows |
| macOS | `ado-npm-auth` with `azureauth` |
| Codespaces | Azure CLI (`az`) |

The important point is that only the identity changes between rows. Everything else stays the same.

## CI: trade an OIDC token for an ADO token

GitHub Actions can give every job a short-lived, signed token (a JWT) that says "this is repo X, running on branch Y". Microsoft Entra can be set up to trust that token. You create an app registration (or a managed identity) for reading the feed, and add a *federated credential* to it that says: accept tokens signed by GitHub for this repo and this branch or event.

Then you give that identity read access to the ADO feed. That's the only permission it needs.

In the workflow:

```yaml
permissions:
  id-token: write   # lets the job request the OIDC token
  contents: read

steps:
  - uses: actions/checkout@v4

  - uses: azure/login@v2
    with:
      client-id: ${{ vars.FEED_READER_CLIENT_ID }}
      tenant-id: ${{ vars.AZURE_TENANT_ID }}
      allow-no-subscriptions: true

  - uses: microsoft/setup-cfs@main
    with:
      feed-url: https://pkgs.dev.azure.com/<org>/_packaging/<feed>/
      npm-config: true

  - run: pnpm install --frozen-lockfile
```

[`microsoft/setup-cfs`](https://github.com/microsoft/setup-cfs) does the token work for you. It uses the Azure session that `azure/login` created to get an Azure DevOps access token, puts it in the `CFS_ACCESSTOKEN` environment variable, and with `npm-config: true` writes the `.npmrc` entry for the feed. The token works for about an hour, which is plenty for an install. The same action can also set up NuGet, if your repo uses both.

The client ID and tenant ID are not secrets, so they can be plain repository variables. Nothing in GitHub can be used to read the feed outside a running job from the trusted repo.

Two things that are easy to get wrong:

- **The federated credential's subject has to match exactly.** A `pull_request` run and a `push` to `main` have different subjects, so you need a credential for each one you want to allow.
- **Entra trust isn't enough by itself.** ADO also has to know the identity. Add it to the organization and give it Reader on the feed, or you'll get a 401/403 even though `azure/login` worked.

## Local: one script, run before install

For people, the identity is their own work account. I don't want them to read a wiki page. Instead, a `preinstall` script detects the platform and runs the right tool:

```json
{
  "scripts": {
    "preinstall": "node scripts/feed-auth.mjs"
  }
}
```

The script exits right away in CI, where the workflow has already set the token. On a developer machine it picks one of these paths.

### Windows

[`vsts-npm-auth`](https://www.npmjs.com/package/vsts-npm-auth) reads the repo's `.npmrc`, signs in with your Windows identity, and writes a token to your user `.npmrc`. If the first run fails, usually because a cached token is stale, the script tries once more with `-F` to force a new one.

```sh
vsts-npm-auth -config .npmrc
# on failure:
vsts-npm-auth -config .npmrc -F
```

### WSL

WSL has no good browser or broker for signing in, but Windows does. So the script calls the Windows `vsts-npm-auth.exe` through interop, then copies the credential into the Linux user's `~/.npmrc`. You sign in once, on the Windows side, and both environments work.

### macOS

`vsts-npm-auth` is Windows-only. On a Mac, [`ado-npm-auth`](https://github.com/microsoft/ado-npm-auth) does the same job and uses [`azureauth`](https://github.com/AzureAD/microsoft-authentication-cli) to sign in:

```sh
npx ado-npm-auth --config .npmrc
```

### Codespaces

A Codespace is Linux with no Windows to fall back on, so the script uses the Azure CLI. If `az account get-access-token` fails, it runs `az login --use-device-code` and tries again. Then it writes the token to `~/.npmrc` the same way CI does.

## Publishing: a second identity, not more permissions

Installing is only half of it. If the repo also publishes a package to the feed, don't give the reader identity Contributor rights. Create a second app registration, the **feed publisher**, and keep the two apart.

### Why reader and publisher are separate apps

The reader identity is used everywhere. Every pull request signs in as it, including pull requests from people you don't know well yet, and every install runs third-party code: `preinstall` and `postinstall` scripts from hundreds of packages. Assume that, eventually, something malicious will run while the reader token is in the environment.

If that token can only read, the damage is limited. An attacker can download packages they could probably get anyway. If the same token can publish, they can push a new version of one of your internal packages, and every team that depends on it installs the attacker's code on its next build. A single bad dependency in one PR turns into a supply-chain attack on the whole company.

Keeping them as two apps means:

- **Least privilege by default.** The identity that runs on every PR, with the most untrusted code, has the least power.
- **Different trust rules.** The reader can trust `pull_request` and `main`. The publisher trusts one protected place only.
- **Separate audit trails.** Feed logs show which identity published what, and a publish by anything other than the publisher is an obvious alarm.
- **Independent revocation.** If something goes wrong you can disable publishing without breaking every build.

### Lock the publisher to a protected environment

Create a GitHub Environment, say `release`, that requires reviewers and only allows deployments from `main`. Then give the publisher's federated credential exactly one subject:

```text
repo:<owner>/<repo>:environment:release
```

A pull request can't produce that subject, so no PR can sign in as the publisher, whatever its workflow file says.

### Build and publish in separate jobs

The build job uses the reader, installs dependencies, builds, and packs a tarball. The publish job signs in as the publisher and never runs an install, so no third-party install script runs while the publish token is present:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    permissions: { id-token: write, contents: read }
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          client-id: ${{ vars.FEED_READER_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          allow-no-subscriptions: true
      - uses: microsoft/setup-cfs@main
        with:
          feed-url: https://pkgs.dev.azure.com/<org>/_packaging/<feed>/
          npm-config: true
      - run: pnpm install --frozen-lockfile && pnpm build && npm pack
      - uses: actions/upload-artifact@v4
        with: { name: package, path: "*.tgz" }

  publish:
    needs: build
    runs-on: ubuntu-latest
    environment: release
    permissions: { id-token: write }
    steps:
      - uses: actions/download-artifact@v4
        with: { name: package }
      - uses: azure/login@v2
        with:
          client-id: ${{ vars.FEED_PUBLISHER_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          allow-no-subscriptions: true
      - uses: microsoft/setup-cfs@main
        with:
          feed-url: https://pkgs.dev.azure.com/<org>/_packaging/<feed>/
          npm-config: true
      - run: npm publish *.tgz --ignore-scripts
```

Give the publisher **Contributor** on the feed and nothing else.

## What you need for this to work

- **Feed access for the identity you're using.** In CI that's the feed-reader app. Locally it's your work account. For releases, it's the publisher. Most "it's broken" reports end up being this.
- **No credentials in the repo.** The repo `.npmrc` has the registry URL and nothing else. Tokens only go in `~/.npmrc`.
