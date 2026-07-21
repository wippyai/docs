# Render Engines

The Wippy Web Host renders a micro frontend app (`view.page`) through one of **two page-render engines**. The engine is a *delivery* concern — the same app renders identically under either — chosen by an operator switch, with an optional per-page override.

| Engine | How a page renders | Isolation | Routing |
|--------|--------------------|-----------|---------|
| **Iframe** (default) | A srcdoc `<iframe>` with `proxy.js` injected | Full document isolation | Memory-history only (srcdoc has no real URL) |
| **Web Fragment** | A [`reframed`](https://web-fragments.dev) same-origin realm reflected into a `<web-fragment>` shadow root, with `proxy-fragment.js` | Realm isolation, shared DOM tree | Real `window.history` (URL routers work) |

Both engines are at **feature parity**: authenticated API, WebSocket, host-mediated state, confirm/bridge dialogs, `@history`/`@visibility` events, title propagation, global error capture, host-CSS + theme injection (including dark-in-shadow), content-mode auto-height, and nested `<w-artifact>` embeds — plus a genuine `window.history`, so URL routers (Vue Router `createWebHistory`) need no memory-history shim.

## How a fragment renders

A `view.page` selected for the fragment engine is mounted as `<web-fragment src="/@fragment/{id}/">`. The [`/@fragment` gateway](../../framework/views.md#web-fragments-gateway) in `wippy/views` serves the reframing contract; the `reframed` client creates a hidden same-origin realm iframe (`wf:<id>`), streams the gateway's transformed HTML into the fragment's shadow root, and runs `proxy-fragment.js` (a `@wippy-fe/proxy` adapter) inside the realm to provide the `$W` proxy API. Because the realm is same-origin with the host, the proxy talks to the host directly rather than over `postMessage`.

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

Two detectors surface these at authoring time (they detect *app-code incompatibility*, not deployment mistakes):

- **Build-time** (`@wippy-fe/vite-plugin`): scans page source and emits a build **warning** naming the API, suggesting `wippy.renderEngine: "iframe"`.
- **Dev-runtime** (fragment proxy, DEV only): patches those APIs to `console.warn` once on an actual call.

## Enabling fragments — setup summary

Enabling the fragment engine in a consuming app requires up-to-date framework modules plus the operator switch — no router or parameter wiring:

1. **Framework modules** — `wippy/facade ≥ 0.6.28` (the `render_engine` switch) and `wippy/views ≥ 0.5.9` (the self-mounting gateway), pinned in `wippy.lock`.
2. **The switch** — set the facade `render_engine` to `fragment` (globally) or opt pages in per-page with `wippy.renderEngine`.

> The `/@fragment` gateway is **self-provided by `wippy/views ≥ 0.5.9`**: the module declares its own top-level router and binds it to a `server` requirement defaulting to `app:gateway`. A consumer needs no fragment wiring and **boots normally on the iframe engine** whether or not fragments are enabled; override the `server` parameter only if your `http.service` id differs from `app:gateway`. When a page requests fragments but the gateway or proxy is unavailable, the host's runtime capability probe **silently falls back to the iframe engine** — the page still works. See [Views → Web Fragments gateway](../../framework/views.md#web-fragments-gateway).

The frontend app itself needs no fragment-specific code; `proxy-fragment.js` is a host artifact served from the CDN, not something the app bundles.

## See Also

- [Facade](../../framework/facade.md) — the `render_engine` operator switch and `hostConfig.renderEngine`
- [Views](../../framework/views.md) — the self-mounting `/@fragment` gateway and its `server` binding
- [Micro Frontend Apps (view.page)](../frontend-registry/view-page.md) — the per-page `wippy.renderEngine` field
- [Proxy & Isolation](./proxy-isolation.md) — the shared proxy API (both engines) and the iframe engine
- [Web Host Overview](./overview.md) — how the host loads and renders pages
