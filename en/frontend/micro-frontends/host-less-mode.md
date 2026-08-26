---
title: "Host-less Mode"
description: "Run and test Wippy micro frontend apps and web components without the Web Host."
---

# Host-less Mode

Host-less mode lets a Wippy micro frontend app or web component build, run, and test **without** the Wippy Web Host wrapping it.

> **Default injection state:** The dev overlay starts with `themeConfig`, `primevue`, `markdown`, and `iframe` **disabled**, but `customCss` and `customVariables` **enabled**. So an app that relies only on custom overrides may appear to work, while one that expects the platform theme variables or PrimeVue styles will render unstyled until you enable those injections. Open the overlay FAB → enable the injections you need → check "Auto-accept on reload" to persist across reloads.

---

## Table of contents

- [Mental model — apps and WCs are intentionally standalone-aware](#mental-model--apps-and-wcs-are-intentionally-standalone-aware)
- [The `@wippy/scripts` switchpoint — one tag, two boot paths](#the-wippyscripts-switchpoint--one-tag-two-boot-paths)
- [What `dev-proxy.js` actually does](#what-dev-proxyjs-actually-does)
- [The dev overlay (config modal)](#the-dev-overlay-config-modal)
- [Host stubs — the standalone `host` API](#host-stubs--the-standalone-host-api)
- [Web components — host-less playground and tests](#web-components--host-less-playground-and-tests)
- [Common deviations and how to spot them](#common-deviations-and-how-to-spot-them)
- [Troubleshooting](#troubleshooting)
- [Related docs](#related-docs)

---

## Mental model — apps and WCs are standalone-aware

Every Wippy micro frontend app and web component follows one runtime constraint:

> **The runtime contract is the proxy API surface.**

What that means in practice:

- The only thing an app or WC touches at runtime is the proxy API surface: the sync getters imported from `@wippy-fe/proxy` (`host`, `api`, `on`, `config`, `state`, `ws`, `logger`). Both apps and WCs use the same imports; under the hood they resolve to the same `ProxyApiInstance` that the runtime installs as internal globals (`window.$W`, `window.__WIPPY_APP_API__` — never read these directly).
- Apps and WCs do **not** import code from neighboring apps, the parent
  module's Lua side, the Wippy Web Host, or another project module. They live
  in their own folder. Vite derives every Rollup external from the pinned
  target-host `import-map.json`; `package.json` declares only the npm
  dependencies and peer roots the artifact actually imports.
- The same `app.ts` (or WC `index.ts`) boots correctly in two environments:
  1. **Hosted** — inside a Wippy Web Host that injects `proxy.js`, AppConfig, importmap, and CSS.
  2. **Host-less** — running its `app.html` directly via Vite dev server, file://, a unit-test page, a Storybook-style playground, etc.

Each app or WC is a small program with a standardized I/O surface. The host is one possible runtime; standalone is another. Application code does not need to distinguish between them.

This design supports:
- Local frontend iteration without starting a full Wippy backend.
- Isolated WC unit tests under Vitest and jsdom.
- Apps shared between Wippy modules; every micro frontend app and web component builds with the same toolchain regardless of which module ships it.
- Customer-specific overlays that let operators patch metadata (theming, import map, and environment) without rebuilding the frontend bundle.

---

## The `@wippy/scripts` switchpoint — one tag, two boot paths

Every canonical app's `app.html` ships with **one** script tag that decides the boot path at load time:

This is an abbreviated body/boot example. Insert the complete valid import-map
response described by the [Import-map snapshot algorithm](./build-system.md#import-map-snapshot-algorithm),
updated when the pinned Web Host tag changes.

```html
<!-- URL MUST include a release-tag segment: https://web-host.wippy.ai/<release-tag>/dev-proxy.js -->
<script
    src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"
    data-role="@wippy/scripts"
></script>
```

Full `app.html` scaffold in [Micro Frontend App](./micro-frontend-app.md).

Two attributes on that one tag carry the entire dual-mode contract:

| Attribute | Role | Used by |
|---|---|---|
| `data-role="@wippy/scripts"` | Marker for the host. When present, the host removes this `<script>` element before serving the iframe and injects its own `loading.js` + `proxy.js` + importmap + AppConfig **before** the marker. The element disappears in hosted mode. | Wippy Web Host |
| `src="…/dev-proxy.js"` | Fallback URL. Used when no host is present — the browser loads `dev-proxy.js` directly and that script bootstraps the page. The `src=` attribute is irrelevant in hosted mode (the `<script>` element no longer exists). | Standalone browser load |

**Choose a URL that matches your environment.** The Web Host URL requires a release-tag segment in the path and must match the release used by the facade's `fe_facade_url`. `/dev-proxy.js` directly under the host root is not valid; pin a specific build at `/<release-tag>/dev-proxy.js`. The same bundle works for local iteration, CI, and shareable preview links.

| Environment | Sample `src=` value |
|---|---|
| Public CDN (standard) | `https://web-host.wippy.ai/<release-tag>/dev-proxy.js` |
| Self-hosted Wippy deployment | `https://<your-wippy-host>/<release-tag>/dev-proxy.js` |

The same HTML element is both the host's script-injection anchor and the host-less fallback boot.

### What goes in the importmap?

Fetch the complete map once during development, using the same tag as `fe_facade_url` and `dev-proxy.js`:

```bash
curl.exe -fsS "https://web-host.wippy.ai/<release-tag>/import-map.json" -o import-map.json
```

Set the text of the `app.html` `<script type="importmap">` element to the
fetched JSON response verbatim. Do not put comments, ellipsis placeholders, or
hand-written substitutions inside that JSON. The
[Build and Dependency Contract](./build-system.md#import-map-snapshot-algorithm)
defines the snapshot and provenance requirements; the fetched release response
provides the exact `imports` object.

Conventions:
- Put **every fetched key** in Rollup externals, including currently unused keys.
- Keep the same complete key/value object in `app.html`; do not reconstruct it with `esm.sh`.
- Bundle an imported specifier only when its exact key is absent.
- Re-fetch when the Web Host tag changes or a new dependency is added, to check whether that exact specifier can be external.

Standalone `app.html` resolves the complete copied map. Hosted mode uses the map delivered by the same pinned release.

### Exposing `package.json` to dev-proxy (canonical scaffold)

Every Wippy app's `package.json` carries metadata that determines runtime defaults — proxy injections (`wippy.proxy.injections.css.*`), per-page theming overrides (`wippy.configOverrides.customization`), iconify icon collections, etc. In hosted mode the host reads these from the registry. In host-less mode dev-proxy needs the same data to apply the same defaults.

The canonical pattern is `wippyPagePlugin()` from the coherent current `@wippy-fe/vite-plugin` family (`0.0.46` at publication), added once to your `vite.config.ts`. The plugin reads your `package.json` at build time and does **two** things:

1. **Resolves `file://` references** in the `wippy` block (any string value of the form `"file://<relative>"` is replaced with the referenced file's UTF-8 contents — see `*.do-not-link.<ext>` naming convention in [build-system.md](./build-system.md)).
2. **Emits two outputs** with the resolved JSON:
   - `<head>`-injected `<script type="application/json" data-role="@wippy/package">` for host-less / dev-proxy boot.
   - `wippy-meta.json` in the actual Vite output directory for wippy-hosted mode.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'

export default defineConfig({
  plugins: [
    vue(),
    wippyPagePlugin(),
  ],
  // …
})
```

**For web components** (`view.component`, ESM-only — no HTML entry to inject into) use `wippyComponentPlugin()` from the same package. It only emits `wippy-meta.json` in the actual output directory; no `transformIndexHtml` step.

```ts
// vite.config.ts for a web component
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
export default defineConfig({ plugins: [wippyComponentPlugin()] })
```

> `wippyPackagePlugin` remains a deprecated compatibility alias. New page code uses `wippyPagePlugin()`; component-only builds use `wippyComponentPlugin()`.

The plugin emits this into the top of `<head>` in the built `app.html`:

```html
<script type="application/json" data-role="@wippy/package">
{ "name": "@wippy/your-app", "version": "1.0.0", "wippy": { "proxy": {...}, "configOverrides": {...} } }
</script>
```

dev-proxy.js reads this synchronously at boot via
`document.querySelector('script[data-role="@wippy/package"]')` and uses `wippy.proxy.injections` to seed the proxy-config defaults and `wippy.configOverrides.customization` to seed `appConfig.theming.global`. The data-role string `@wippy/package` is exported as `WIPPY_PACKAGE_DATA_ROLE` from `@wippy-fe/shared` so both sides of the boundary share the constant.

This shape has the following properties:
- **Single source.** The plugin reads `package.json` at build time; source files do not import it.
- **Synchronous access.** Inline metadata is available to `dev-proxy.js` before application code runs.
- **Defined ordering.** The plugin injects the metadata at the top of `<head>`, before any script tag. Dev-proxy is a synchronous UMD script; module scripts are deferred.
- **Plugin-owned template update.** The plugin injects the metadata without a hand-maintained block in `app.html`.
- **Shared constant.** `@wippy-fe/shared` exports the `'@wippy/package'` value as `WIPPY_PACKAGE_DATA_ROLE`; dev-proxy and the plugin import it from there.
- **Hosted compatibility.** The host's `processWebPage` reads `package.json` from the registry server-side and treats the inline JSON tag as metadata.

Dev-proxy reads the JSON during `resolveDevConfig()` and uses it to populate the development-overlay defaults. If the script tag is absent, dev-proxy falls back to `getDefaultProxyConfig()`, so older apps continue with the generic defaults.

> **Why a plugin and not a runtime `window` global?** Dev-proxy.js is a non-module synchronous script that runs early during `<head>` parsing — before any module script (including your `app.ts`) has loaded. So `app.ts` cannot set a global *before* dev-proxy reads it. A build-time HTML transform places the data in the DOM up-front, available the instant dev-proxy executes.

> **Why one tag and not two?** A second `<script>` block (e.g. an `if (!window.__WIPPY__) load dev-proxy`) would only run after the host's injection completes; if the marker is gone, the conditional has nothing to attach to. The single-tag pattern means the marker is *always* in the source HTML, and the host's job is exactly "delete this marker and replace it." The standalone case happens precisely when nobody deleted it.

The host contract requires that the HTML file specified in `wippy.path` MUST include a `<script type="text/javascript" data-role="@wippy/scripts">` element where additional scripts will be automatically injected.

Canonical app templates include the `src="…/dev-proxy.js"` value. **Include the `src=` fallback** unless the application cannot run host-less and records that limitation.

---

## What `dev-proxy.js` actually does

`dev-proxy.js` is the host-less boot bundle, served from the Wippy Web Host CDN at `https://web-host.wippy.ai/<release-tag>/dev-proxy.js`.

Its job is to make the `@wippy-fe/proxy` getters resolve correctly without any host — by installing the same internal globals (`window.$W`, `window.__WIPPY_APP_API__`) the real host would. App and WC code never touches those globals; it just imports from `@wippy-fe/proxy` and the getters work. dev-proxy does this in roughly five steps:

1. **Install history guard** (`installHistoryGuard()`) — stubs `pushState` / `replaceState` so vue-router doesn't try to mutate browser history outside an iframe-srcdoc context.
2. **Resolve a config** (`resolveDevConfig()` in `src/proxy/dev/resolve-dev.ts`):
   - Read `localStorage['@wippy-dev/config']` and `localStorage['@wippy-dev/proxy-config']`.
   - If `localStorage['@wippy-dev/auto-accept'] === 'true'` AND a stored config exists → use it immediately, render the overlay in monitoring mode.
   - Otherwise → render the overlay in *waiting* mode (FAB pulses blue, "Accept config to continue loading" speech bubble) and block boot until the developer clicks Accept.
3. **Build a fake `ProxyApiInstance`** wired to:
   - The accepted `ChildAppConfig` (what `config` from `@wippy-fe/proxy` returns).
   - A nanoevents emitter for `on(...)` subscriptions and `@history` / `@visibility` simulations.
   - `host` stubs that console-log every method (`createDevHostAPI()` in `src/proxy/dev/host-stubs.ts`).
   - A real axios instance backing `api` from `@wippy-fe/proxy`, configured against the URL the developer entered (`env.APP_API_URL` defaults to `${location.origin}/api`).
   - A logger / state / ws stub that mirrors the production proxy shape.
4. **Apply CSS injection** based on the proxy config the developer chose:
   - `themeConfig: true` → injects `theme-config.css` from `@wippy-fe/theme`.
   - `iframe`, `primevue`, `markdown` → ditto, the inline-CSS bundles from `src/proxy/dev/css-inline.ts`.
   - `customCss` / `customVariables` → applies `appConfig.theming.global.customCSS` / `cssVariables` (including the `@dark`/`@light` blocks described in [micro-frontend-app-theming.md](./micro-frontend-app-theming.md#l3--per-page-config_overrides-in-registry-yaml)).
5. **Install the internal proxy globals** with the same shape as `entry.iframe.ts`, so the `@wippy-fe/proxy` getters (`config`, `host`, `api`, `on`, `logger`, `state`, `ws`, `loadWebComponent`) resolve. Any app or WC code that imports from `@wippy-fe/proxy` works unchanged. (The globals themselves — `window.$W` et al. — are internal; see [Proxy & Isolation § Internals](../web-host/proxy-isolation.md#internals--do-not-read-or-override).)

Default `ChildAppConfig` (from `getDefaultConfig()` in `config-store.ts`):

```ts
{
  $schema: '<built schema URL>',
  auth: { token: 'dev-token', expiresAt: '' },
  env: {
    APP_API_URL: `${location.origin}/api`,
    APP_AUTH_API_URL: `${location.origin}/api`,
    APP_WEBSOCKET_URL: `${location.origin.replace(/^http/, 'ws')}/ws`,
  },
  theming: { global: {} },
  context: { resourceId: '', resourceType: 'page' },
}
```

You override any of this in the modal (or by editing `localStorage['@wippy-dev/config']`).

---

## The dev overlay (config modal)

The development overlay is a shadow-DOM web component (`<wippy-dev-overlay>`) that renders:

- A FAB (floating action button) in the bottom-right corner — the only visible affordance until clicked.
- A **speech bubble** in waiting mode: "Accept config to continue loading."
- A **panel** that opens when the FAB is clicked. The panel has three sections:
  - **Monitor** — live readout of current path, document title, viewport size; "Trigger Refresh" button that fires `@visibility(true)` so the app can re-fetch.
  - **Configuration (collapsible)**:
    - `App Config (JSON)` — full `ChildAppConfig` as editable JSON. Validates on Accept.
    - `Proxy Injections` — checkboxes for every proxy injection flag (`themeConfig`, `iframe`, `primevue`, `markdown`, `customCss`, `customVariables`, `tailwindConfig`, `resizeObserver`, `preventLinkClicks`, `iconifyIcons`, `refreshWhenVisible`, `historyPolyfill`, `errorCapture`).
    - `Options` — "Auto-accept on reload" checkbox (writes the auto-accept flag to localStorage).
  - **Footer** — Reset (clears all `@wippy-dev/*` localStorage keys), Accept (saves config + resolves the boot promise).

LocalStorage keys it uses (defined in `src/proxy/dev/config-store.ts`):

| Key | What it stores |
|---|---|
| `@wippy-dev/config` | The accepted `ChildAppConfig` JSON |
| `@wippy-dev/proxy-config` | The accepted partial `ProxyConfig` (injection flags) |
| `@wippy-dev/auto-accept` | `'true'` to skip the manual accept step on reload |

With auto-accept enabled, a refresh boots the app immediately with the last accepted config. The FAB remains available for monitoring and changes.

---

## Host stubs — the standalone `host` API

The `host` API (`import { host } from '@wippy-fe/proxy'`) is the surface the app uses to ask the host to do things — toast, navigate, open a session, set context, format URLs, etc. With no real host, dev-proxy substitutes a stub layer in `src/proxy/dev/host-stubs.ts`:

| Method | Standalone behavior |
|---|---|
| `host.toast(message)` | Console-log only |
| `host.confirm({ message })` | Browser `window.confirm()` |
| `host.startChat(token, options)` | Console-log |
| `host.openSession(uuid, options)` | Console-log |
| `host.openArtifact(uuid, options)` | Console-log |
| `host.navigate(url)` | Console-log + emits `@history` so the child router picks it up + updates the overlay path readout |
| `host.onRouteChanged(path)` | Console-log + updates the overlay path readout |
| `host.handleError(code, error)` | `console.error` |
| `host.setContext(context, sessionUUID, source)` | Console-log |
| `host.formatUrl(rel)` | Returns `${appConfig.routePrefix || ''}${rel}` |
| `host.classifyLink(href)` | Real implementation — uses `mountRoutes` / `routePrefix` from the accepted config |
| `host.layout.*` | No-op stubs that satisfy the type contract |

The stubs log requested host side effects to the console. If application correctness depends on an effect, such as `host.openSession` opening a session, test that path under a host; the stubs do not perform it.

---

## Web components — host-less playground and tests

Web components share the same dual-mode design but are loaded as ES modules instead of iframes. The proxy contract for WCs is `import { api, host, on, ... } from '@wippy-fe/proxy'` — and that import resolves at runtime by reading `window.__WIPPY_APP_API__` (set by either the real proxy or dev-proxy).

### Playground / demo HTML page

```html
<!-- demo.html in your WC project -->
<!DOCTYPE html>
<html>
<head>
    <!-- Required complete import-map script omitted from this abbreviated example. -->
    <script src="https://web-host.wippy.ai/webcomponents-1.0.44/dev-proxy.js" data-role="@wippy/scripts"></script>
</head>
<body>
    <my-component prop1="value"></my-component>
    <script type="module" src="./src/index.ts"></script>
</body>
</html>
```

Same switchpoint, same dev overlay. Your WC's `index.ts` calls `define(import.meta.url, ...)` and the element registers itself; dev-proxy provides the host stubs.

If `dev-proxy.js` fails to load (or you forget to include it), `entry.web-component.ts` throws an explicit error:

> `@wippy-fe/proxy: Proxy globals not found. For dev/testing without the Wippy host, add <script src="dev-proxy.js"></script> to your HTML.`

That error indicates that the host-less boot script is missing.

### Vitest / jsdom tests

For unit tests the dev overlay is unnecessary — tests don't have a UI to interact with. The pattern is to **fake the host context directly** by attaching the wrapper object the host would attach:

```ts
import { describe, expect, it } from 'vitest'
import { WippyElement } from './base-element'

class TestEl extends WippyElement {
  static get wippyConfig() {
    return { propsSchema: { properties: {} }, hostCssKeys: [] }
  }
  protected onMount(): void {}
  protected onUnmount(): void {}
}

const TAG = 'wippy-test-el'
customElements.define(TAG, TestEl)

it('reads host wrapper attached by resolver as __wippyHost', () => {
  const el = document.createElement(TAG) as TestEl
  const fakeHost = { layout: { broadcast: () => {} } }
  ;(el as any).__wippyHost = fakeHost
  expect(el.host).toBe(fakeHost)
})
```

The `__wippyHost` property is the contract the managed-layout host uses. Tests that need API or proxy globals can either mount dev-proxy via a vitest setup file, or stub `window.__WIPPY_APP_API__` themselves:

```ts
// vitest.setup.ts
;(window as any).__WIPPY_APP_API__ = {
  api: mockApi,
  host: mockHost,
  on: mockOn,
  // ...other ProxyApiInstance fields
}
```

In both approaches, test-owned code satisfies the proxy contract instead of a Wippy server.

---

## Common deviations and how to spot them

When an app or WC has drifted from the standalone-aware contract, the symptoms are predictable:

| Symptom | Probable cause | Fix |
|---|---|---|
| `app.html` has `<script data-role="@wippy/scripts"></script>` with no `src=` | Page can't boot host-less. Loading the file directly produces a blank page — the proxy runtime never installs, so `@wippy-fe/proxy` imports fail to resolve. | Add `src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"` to the tag — the URL always requires a release-tag segment. |
| `app.html` has the dev-proxy `<script src=…>` but **no `<script type="importmap">`** above it | Browser can't resolve external bare specifiers. The first module-script load fails with `Failed to resolve module specifier`. | Fetch `<release-tag>/import-map.json`, copy its complete `imports` object into `<head>` before dev-proxy, and use all keys as Rollup externals. |
| `app.html` body has a custom SVG spinner / `<div>Loading…</div>` instead of `<wippy-loading title="…">` | Pre-bootstrap loader doesn't match the canonical Wippy idiom. The custom markup keeps showing while the WC ecosystem (which would render a styled, theme-aware loader) is fully booted. | Replace with `<wippy-loading title="Loading..."></wippy-loading>`. The `<wippy-loading>` web component is registered by `dev-proxy.js` (it imports `@wippy-fe/loading` synchronously) before the `<body>` parses, so the element resolves correctly even at very early page load. |
| `import` from a sibling app's source files | Shared code is being copy-pasted across module boundaries. | Extract to a workspace package or duplicate intentionally; never reach across app folders. |
| Hardcoded `fetch('/api/…')` calls | Bypasses the axios instance the proxy provides; won't pick up `env.APP_API_URL` overrides. | Use `useApi()` (apps) or `import { api } from '@wippy-fe/proxy'` (WCs). |
| `new EventSource(...)` for live data | Bypasses the host's auth/relay bridge; standalone mode has no equivalent. | Use `on('your.topic', cb)` — works in both modes (in standalone the topic just doesn't fire unless you simulate it). |
| `document.documentElement.setAttribute('data-theme', ...)` for theme switch | `data-theme` is not the Wippy theme protocol. | Use Auto mode or the host-managed `.w-theme-light` / `.w-theme-dark` classes. Configured `@light` / `@dark` values support both paths. See [micro-frontend-app-theming.md](./micro-frontend-app-theming.md#l3--per-page-config_overrides-in-registry-yaml). |
| `import '@wippy-fe/theme/theme-config.css'` in `app.ts` | Redundant — the host injects theme-config via `themeConfig: true` proxy injection. In host-less mode dev-proxy injects it too. | Remove the import. |
| Hardcoded API base URLs in api/ modules | Won't work in host-less mode against a different env. | Read from `appConfig.env.APP_API_URL` via `useApi()`. |

---

## Troubleshooting

**"Proxy globals not found" error.**
The WC bundle ran but neither real proxy nor dev-proxy initialized `window.__WIPPY_APP_API__`. Check that `<script src=".../dev-proxy.js" data-role="@wippy/scripts">` is in the page and the URL is reachable. In production-host mode this error means the host failed to inject proxy.js — check the host logs.

**Dev overlay never appears.**
The overlay is a shadow-DOM custom element appended to `document.body` after `DOMContentLoaded`. If you load `dev-proxy.js` from inside `<head>` and the body is missing or has `display: none`, the overlay can't render. Move the script to the bottom of the body, or unhide the body.

**Auto-accept "stuck" with bad config.**
If the stored config is broken and auto-accept is on, the overlay still renders (in monitoring mode); click the FAB → Reset to clear all `@wippy-dev/*` localStorage keys, then reload.

**Theme is wrong in dev mode.**
By default `getDefaultProxyConfig()` enables `customCss` and `customVariables` but disables `themeConfig`, `iframe`, `primevue`, `markdown`. If your app expects PrimeVue's theme-config CSS, toggle those checkboxes in the panel. Auto-accept will remember.

**Importmap mismatch between hosted and standalone.**
Re-fetch the pinned release's `import-map.json`, replace the complete host-less `imports` object, and regenerate the Rollup external keys from it. Do not patch individual entries or maintain a curated subset.

**WC test fails with "host getter returned null".**
Tests need to set `el.__wippyHost = fakeWrapper` *before* `connectedCallback` fires. Either set it before `document.body.appendChild(el)`, or fake the wrapper through whatever resolver pattern your suite uses.

---

## Related docs

- [proxy-api.md](./proxy-api.md) — full `@wippy-fe/proxy` reference (works identically in hosted and host-less mode)
- [micro-frontend-app.md](./micro-frontend-app.md) — building micro frontend apps (the boot path is the dual-mode `app.html` pattern this doc covers)
- [web-component.md](./web-component.md) — building web components (`WippyVueElement`, `define()`, host-less playground/tests)
- [theming.md](./theming.md) — per-page theme overrides via `config_overrides` (also feed dev-proxy via `theming.global.cssVariables` / `customCSS`)
- [compliance-checklist.md](./compliance-checklist.md) — §9 Host-less mode checklist with full REJECT rules
