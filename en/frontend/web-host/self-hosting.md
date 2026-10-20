---
title: "Self-hosted Web Host"
description: "Serve the Web Host asset graph from a Wippy application with wippy/cdn-web-host."
keywords:
  - Web Host
  - self-hosting
  - offline
  - cdn-web-host
---

# Self-hosted Web Host

`wippy/cdn-web-host` embeds a Web Host build in a Wippy module and serves its
files from the application. It removes the Web Host asset graph's dependency
on the public Wippy CDN. The module does not download assets during startup or
asset requests, and it does not need CDN Core, a database, or a writable asset
directory.

**Availability:** This integration is proposed in [Web Host MR !41](https://git.spiralscout.com/estimation-engine/wippy-web-host/-/merge_requests/41).
Host `1.0.66`, module `0.0.66`, and the required Facade `0.6.46` are unpublished
candidates. The examples below describe that candidate and require those
packages or local replacements. Earlier Host tags do not contain this module's
build workflow.

## Bind the module

Host `1.0.N` pairs with `wippy/cdn-web-host` version `0.0.N`. The candidate
requires `wippy/facade >=0.6.46 <0.7.0`. Facade does not depend on this module;
the module depends on the Facade contributor contract.

Add the dependency where the application declares its modules:

```yaml
- name: cdn_web_host
  kind: ns.dependency
  component: wippy/cdn-web-host
  version: "0.0.66"
  parameters:
    - name: server
      value: app:gateway
    - name: public_url
      value: https://app.example
```

Use the application's HTTP service entry for `server`. Set `public_url` to
the origin through which browsers reach that application. An optional external
path prefix is allowed, for example `https://app.example/tenant`.

The URL must use HTTP or HTTPS with a DNS hostname or valid IPv4 address.
Credentials, query strings, fragments, IPv6 literals, and traversal segments
are rejected. The value is configuration, not a download source.

Once the packages are published, run
`wippy update wippy/facade wippy/cdn-web-host` to resolve the declared versions
and retain the resulting `wippy.lock`. Use the application's existing startup
workflow and persistent data. This integration does not require a new database.

## How Facade selects the local Host

The module registers a `wippy.facade.config_contributor` function. Facade calls
it through its existing generic contributor pipeline while building config.
The Web Host does not discover CDN modules.

With the example above, the contributor supplies:

```text
fe_facade_url = https://app.example/cdn/web-host/webcomponents-1.0.66
host_policy_mode = shared
```

Facade uses that URL for the Host entrypoint and its import map. It still
owns AppConfig, authentication, and the application bootstrap. No separate
Facade Host URL setting or application resolver shim is needed.

An explicit application resolver value for `fe_facade_url` takes precedence
and suppresses both contributed values. An explicit resolver
`host_policy_mode` is retained when the module supplies the Host URL. Empty or
invalid `public_url` makes no contribution, so the existing Facade Host
selection, including its online default, remains in effect. Local assets that
need URL substitution return `503` until `public_url` is valid.

The packaged build contains an asset-root placeholder. The module replaces it
with the configured public URL only in manifest-listed text files. Other
assets are served unchanged. GET and HEAD are supported. Unknown paths return
`404`, and invalid paths return `400`. Unchanged assets use immutable caching
and ETags. Responses with URL substitution use `Cache-Control: no-store`.

## Markdown and Tailwind

Markdown rendered by `w-page` and `w-artifact` can create HTML iframes whose
content is only known at runtime. The existing renderer loads Tailwind's
browser compiler to generate CSS for utility classes in that content.

The offline build loads the pinned Tailwind Play `3.4.16` file from
`<fe_facade_url>/@core/tailwind-play.3.4.16.offline.js`. The normal online build
keeps its existing `https://cdn.tailwindcss.com` script. This is separate from
the Host's CSS compiled during its build.

The Host repository keeps the downloaded script, its source and checksum
record, and third-party notices in `external-lib-precompiled/`. The offline
build verifies the script's size and SHA-256 before including it. The module
also serves the notices at `<fe_facade_url>/@core/TAILWIND-PLAY-NOTICES.txt`.

## Verify the application

1. Open `/api/public/facade/config` and check that its `facade_url` field
   points to the application's versioned `/cdn/web-host/` route. This is the
   resolved value of the `fe_facade_url` requirement. The endpoint uses the
   default public-router prefix; use the application's configured router
   prefix if it differs.
2. Reload the application. Check the browser Network panel for Host modules,
   the import map, shared vendor files, iframe proxy, and workers below that
   URL. A document already loaded with another Host needs a reload.
3. Open a Markdown preview and confirm that its Tailwind script uses the same
   local release root. Test this with external requests blocked, including in
   a fresh browser context so cached CDN responses cannot hide dependencies.
4. Exercise the application's pages and components. Check their own network
   requests separately. Local Host delivery does not make application bundles,
   images, icons, fonts, or external APIs offline-ready.

For icons and fonts, use [Local CDN Assets](../cdn-assets.md). Font use remains
a manual CSS change using the Fonts panel's copyable stylesheet import and
family declaration. This module does not rewrite font CSS or repair the
separate Views fragment import-map and scopes limitation.

An external prefix changes the Host asset URLs only. For example,
`public_url=https://app.example/tenant` selects
`https://app.example/tenant/cdn/web-host/webcomponents-1.0.66`. Configure the
reverse proxy to forward that asset path to the application's versioned
router. This does not relocate Facade's own root-relative bootstrap, config,
or CSS routes below `/tenant`.

## Build a specific Host tag

The Host repository owns the module source, exporter, and manual release
workflow. The Makefile and Windows wrappers live in `wippy/cdn-web-host/`.
Generated module output needs no Host submodule. Host CI does not build or
publish Wippy modules.

Use a supported release tag, Node.js 22 or later, and pnpm `10.24.0`. The
candidate tag below must exist before this release build can run:

```sh
git clone --branch webcomponents-1.0.66 --single-branch git@git.spiralscout.com:estimation-engine/wippy-web-host.git web-host-1.0.66
cd web-host-1.0.66
corepack enable
corepack prepare pnpm@10.24.0 --activate
pnpm install --frozen-lockfile
make -C wippy/cdn-web-host build
```

On Windows, replace the last command with
`.\wippy\cdn-web-host\make.bat build`. Run it from the Host repository root.
The build verifies the tag, clean source, matching version pair, asset hashes,
and provenance. It writes `artifacts/wippy-cdn-web-host/` without publishing.

Set `WIPPY_CLI` to an absolute native Wippy CLI path, then use these targets:

| Target | Result |
| --- | --- |
| `make -C wippy/cdn-web-host check` | Validates the prepared module and runs native `publish --dry-run`. |
| `make -C wippy/cdn-web-host publish-prepared` | Validates and publishes the prepared module. |
| `make -C wippy/cdn-web-host release` | Builds, validates, and publishes the selected tag in one command. |

Windows uses the same targets through `wippy/cdn-web-host/make.bat`.
Publication uses the native CLI's existing Hub credentials and packs the
validated source directory. It does not retain a WAPP for a later archive
upload. Keep credentials outside the Host repository and CI. Before tagging,
`build-draft` and `check-draft` support local work; publication rejects draft
provenance.
