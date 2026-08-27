---
title: "Render Engines"
description: "How view.page applications run in srcdoc iframes or Web Fragments, including selection rules and compatibility limits."
---

# Render Engines

This page is a render-engine selection and compatibility reference. It explains
operator and package settings; it is not a standalone deployment recipe.

The Wippy Web Host renders a micro frontend app (`view.page`) through one of **two page-render engines**. The engine is a delivery concern chosen by an operator switch, with an optional per-page override. Portable apps use the Wippy proxy and router APIs so their behavior does not depend on a particular engine.

| Engine | How a page renders | Isolation | Routing |
|--------|--------------------|-----------|---------|
| **Iframe** (default) | A srcdoc `<iframe>` with `proxy.js` injected | Full document isolation | Memory-history only (srcdoc has no real URL) |
| **Web Fragment** | A [`reframed`](https://web-fragments.dev) same-origin realm reflected into a `<web-fragment>` shadow root, with `proxy-fragment.js` | Realm isolation, shared DOM tree | Real `window.history` (URL routers work) |

Both engines support the Wippy application services used by portable apps: authenticated API, WebSocket, host-mediated state, confirm/bridge dialogs, `@history`/`@visibility` events, title propagation, error capture, platform CSS and theme delivery, content-mode auto-height, and nested `<w-artifact>` embeds. Delivery and control are engine-specific: iframe CSS and error capture honor proxy injection flags, while the Fragment gateway installs its platform CSS and error capture unconditionally. See [CSS Injection](./css-injection.md). Browser-history capabilities also differ, as shown in the table.

Use `createAppRouter()` from `@wippy-fe/router` for an app that can run under either engine. The current factory uses memory history, receives its initial route from `AppConfig.context.route`, and synchronizes with the host over `@history`. A direct `createWebHistory()` router is Fragment-only and is not portable to iframe or `auto` deployments that may fall back to iframe.

## How a fragment renders

A `view.page` selected for the fragment engine is mounted as `<web-fragment src="/@fragment/{id}/">`. The [`/@fragment` gateway](../../framework/views.md#web-fragments-gateway) in `wippy/views` serves the reframing contract; the `reframed` client creates a hidden same-origin realm iframe (`wf:<id>`), streams the gateway's transformed HTML into the fragment's shadow root, and runs `proxy-fragment.js` (a `@wippy-fe/proxy` adapter) inside the realm to provide the `$W` proxy API. The adapter routes the shared `postMessage` protocol to the captured same-origin Host window instead of relying on the realm's patched `window.parent`.

The same page under the iframe engine is a srcdoc `<iframe>` with `proxy.js` injected — see [Proxy & Isolation](./proxy-isolation.md).

## Selecting the engine

### Global switch (operator)

The engine for a whole deployment is the facade `render_engine` requirement → `hostConfig.renderEngine`. The default is `iframe`; only the exact string `fragment` opts a deployment into the fragment engine (any other value, including a typo, is treated as `iframe`).

```bash
wippy run -c -o wippy.facade:render_engine:default=fragment
```

See [Facade → Render engine](../../framework/facade.md#render-engine) for the parameter.

### Per-page override (app author)

A page opts in or out with `wippy.renderEngine` in its `package.json` `wippy` block:

| Value | Behavior |
|-------|----------|
| `"auto"` (default) | Follow the global switch. |
| `"iframe"` | Always render as a srcdoc iframe — opt out of fragments regardless of the switch. |
| `"fragment"` | Prefer the fragment engine. Under a global-`fragment` deployment: always. Under a global-`iframe` deployment: only if a runtime **capability probe** (`GET /@fragment/{id}/`, cached per session) confirms the gateway + proxy are present; otherwise falls back to iframe (fail-safe). |

See [Micro Frontend Apps → Render engine](../frontend-registry/view-page.md#render-engine).

## Fragment limitations

Some browser APIs behave **incorrectly — and silently — inside a reframed realm**. A page that depends on any of these should pin `wippy.renderEngine: "iframe"`.

| API / feature | Behavior in a realm | Impact |
|---------------|---------------------|--------|
| `document.elementFromPoint` | Returns `null` — **regardless of panel size** | Breaks pointer hit-testing: drag & drop, sortable lists, Popper/floating-ui, virtual scrollers |
| `matchMedia`, `vh`/`vw` units, `position: fixed` | Resolve against the **host** viewport, not the fragment panel | Off by ~1px in a full-size panel; materially wrong in a small panel (sidebar/modal) |
| `window.scrollX/Y`, `scrollTo` | Target the hidden realm window (always `0`) | Scroll-driven UI reads the wrong geometry |
| Web Workers, Canvas, WebGL, WASM | **Work normally** | — |

`vh`/`vw` and `matchMedia` appear here because they ask about the **window**. An app that sizes itself against its allocated *surface* instead — container queries on `wippy-surface`, and the `--wippy-surface-*` variables — resolves identically under both engines and needs no pinning. See [Surface Portability](../micro-frontends/surface-portability.md), and [Surface Migration](../micro-frontends/surface-migration.md) to convert an existing app. `position: fixed` and `elementFromPoint` have no portable form and remain genuine reasons to pin.

Two detectors surface these at authoring time (they detect *app-code incompatibility*, not deployment mistakes):

- **Build-time** (`@wippy-fe/vite-plugin`): scans page source and emits a build **warning** naming the API, suggesting `wippy.renderEngine: "iframe"`.
- **Dev-runtime** (fragment proxy, DEV only): patches those APIs to `console.warn` once on an actual call.

## Enabling fragments — setup summary

Enabling the fragment engine in a consuming application requires compatible
framework modules plus the operator switch; no additional router or parameter
wiring is required:

1. **Framework modules** — use a current compatible `wippy/facade` and `wippy/views` pair that exposes the `render_engine` switch and self-mounting fragment gateway. Verify the exact release in current Wippy module documentation.
2. **The switch** — set the facade `render_engine` to `fragment` (globally) or opt pages in per-page with `wippy.renderEngine`.

> The `/@fragment` gateway is self-provided by current `wippy/views`: the module declares its own top-level router and binds it to a `server` requirement defaulting to `app:gateway`. A consumer needs no fragment wiring and boots normally on the iframe engine whether or not fragments are enabled; override the `server` parameter only if your `http.service` id differs from `app:gateway`. When a page opts into fragments per-page on an otherwise iframe deployment, a runtime capability probe confirms the gateway + `proxy-fragment.js` before switching and otherwise stays on the iframe engine. The global `render_engine: fragment` switch trusts the operator and does not probe. See [Views → Web Fragments gateway](../../framework/views.md#web-fragments-gateway).

The frontend app itself needs no fragment-specific code; `proxy-fragment.js` is a host artifact served from the CDN, not something the app bundles.

## See Also

- [Facade](../../framework/facade.md) — the `render_engine` operator switch and `hostConfig.renderEngine`
- [Views](../../framework/views.md) — the self-mounting `/@fragment` gateway and its `server` binding
- [Micro Frontend Apps (view.page)](../frontend-registry/view-page.md) — the per-page `wippy.renderEngine` field
- [Proxy & Isolation](./proxy-isolation.md) — the shared proxy API (both engines) and the iframe engine
- [Web Host Overview](./overview.md) — how the host loads and renders pages
