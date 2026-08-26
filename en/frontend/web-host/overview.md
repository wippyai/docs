---
title: "Web Host Overview"
description: "How the CDN-hosted Web Host, facade page, and child micro frontends fit together in a Wippy application."
---

# Web Host Overview

The Wippy Web Host is a Vue 3 single-page application built with the
Feature-Sliced Design methodology and delivered from
`https://web-host.wippy.ai`. It hosts the user-facing pages and UI components
of a Wippy application. Configure it through the `wippy/facade` backend module;
you do not build or deploy it with the application.

![Wippy FE architecture](../diagrams/fe-arch-overview.svg)

## Three-Layer Model

A running Wippy application is composed of three nested layers:

**Layer 1 — Page served by `wippy/facade`.** This is your backend-rendered HTML page. The `wippy/facade` module registers a static file server and a `/facade/config` endpoint on your Wippy gateway. When a user navigates to your application, `wippy/facade` serves a thin HTML page that loads the Web Host JS-module entry from the CDN (`module.js` for compat, `managed-layout.js` for managed) and initializes it with config from `/facade/config`. The page itself carries no Vue or React — it is intentionally thin.

**Layer 2 — Web Host.** The Web Host bundle loads as a JS module that takes over
the entire page and its browser history. It owns the Wippy chrome: navigation,
chat, session management, and the page rendering surface. It receives its full
configuration from the page's init call and contains no deployment-specific
URLs or tokens. The same CDN bundle can therefore serve different deployments.
For manual, facade-less embeddings, the host can run inside an iframe through
the `iframe.html` entry described below.

**Layer 3 — Child micro-frontends.** The Web Host in turn embeds user-defined views as either nested iframes (`view.page` modules) or web components (`view.component` modules). Each child runs in isolation. The Web Host injects a proxy script that gives children access to the Wippy API, authentication context, theme CSS, and communication channels — all without the child needing to know where it is deployed.

```
Page (wippy/facade HTML — loads module.js / managed-layout.js)
  └─ Web Host (takes over the page + browser history)
       ├─ Chat UI, navigation, sidebar
       └─ Child micro-frontends
            ├─ view.page  → srcdoc iframe + proxy.js
            └─ view.component → custom element + @wippy-fe/proxy ESM
```

## Entry Points

The Web Host CDN serves several entry points from the same versioned directory.
Choose one according to the integration. Each entry is available at
`<release-tag>/<entry>`, such as `/<release-tag>/module.js`.

| Entry | Use case |
|-------|----------|
| `module.js` | Full app in **compat** mode — the standard nav-sidebar + page-area + chat-right-panel shell. Mounted directly into the page via `window.initWippyApp()`; takes over the whole page and its browser history. This is the entry the current `wippy/facade` serves by default. |
| `managed-layout.js` | Full app in **managed** mode — the declarative multi-panel layout. Served by the facade when `fe_mode = managed`. Early access (see [Multi-Panel Layout](./multi-panel-layout.md)). |
| `iframe.html` | Full app run **inside an iframe** for isolation or partial-page embedding. Use it for manual, facade-less embeddings where you supply config via a `SetConfig` PostMessage handshake. The facade itself loads the JS-module entries above, not this one. |
| `chat-iframe.html` | Minimal chat interface without sidebar or pages. Useful for embedding a focused chat widget. |
| `chat.js` | Headless ESM module exposing chat stores and WebSocket client. Use for building completely custom UIs. |
| `ws.js` | Standalone WebSocket service with no Vue or Pinia dependency. Use for low-level real-time integrations. |

For standard `wippy/facade`-based deployments you never reference these paths directly. The facade reads `fe_facade_url` from its configuration, selects the JS-module entry that matches `fe_mode` (`module.js` for compat, `managed-layout.js` for managed), and constructs the correct URL automatically.

## CDN Versioning

The Web Host is versioned by git tag. The canonical production URL pattern is:

```
https://web-host.wippy.ai/<release-tag>/
```

Where `<release-tag>` is the Web Host git release tag — either a stable release or a feature-branch preview deploy. The staging CDN is at `https://web-host.staging.wippy.ai/<release-tag>/`.

Normally, the `wippy/facade` module selects the version through its default
`fe_facade_url`, which points to a matching Web Host build. Updating
`wippy/facade` therefore moves the deployment to its corresponding Web Host
version. Child apps that share vendor libraries through the import map receive
the versions provided by that build.

To pin a specific Web Host version — to stay on a known-good build, or to opt into a feature-branch / early-access tag — override the `fe_facade_url` parameter:

```yaml
- name: fe_facade_url
  value: https://web-host.wippy.ai/<release-tag>
```

This pins the entire deployment to that build. See [CLI overrides](../../guides/cli.md) for the `-o` / `--override` syntax to set it at runtime instead.

## Tech Stack

The Web Host is built with Vue 3 (Composition API), PrimeVue + Tailwind CSS 3 for UI components, Pinia for state management, Vue Router for navigation, and Axios for HTTP. During development, fetch `<fe_facade_url>/import-map.json` and put every key from its `imports` object in Rollup externals, even if the current artifact does not import that key. Bundle an imported dependency only when its exact specifier is absent. Re-fetch when the Web Host tag changes or a new dependency is added.

## See Also

- [Facade Entry Point](./entry-point.md) — how the facade delivers the Web Host to users and what the config flow looks like
- [Bootstrap Sequence](./bootstrap.md) — what happens inside the Web Host after it receives configuration
- [Multi-Panel Layout](./multi-panel-layout.md) — managed layout mode for custom multi-panel shells
- [Packages](./packages.md) — the `@wippy-fe/*` npm packages available to child app developers
- [Facade module](../../framework/facade.md) — backend setup for `wippy/facade`
- [Render Engines](./render-engines.md) — the two page-render engines (srcdoc iframe vs Web Fragment)
