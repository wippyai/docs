# Web Host Overview

The Wippy Web Host is a Vue 3 single-page application built with the Feature-Sliced Design methodology and delivered from a CDN at `https://web-host.wippy.ai`. It hosts all user-facing pages and UI components for a Wippy application. You do not build or deploy it — you configure it through the `wippy/facade` backend module and it loads automatically.

![Wippy FE architecture](../diagrams/fe-arch-overview.svg)

## Three-Layer Model

A running Wippy application is composed of three nested layers:

**Layer 1 — Page served by `wippy/facade`.** This is your backend-rendered HTML page. The `wippy/facade` module registers a static file server and a `/facade/config` endpoint on your Wippy gateway. When a user navigates to your application, `wippy/facade` serves a thin HTML page that loads the Web Host JS-module entry from the CDN (`module.js` for compat, `managed-layout.js` for managed) and initializes it with config from `/facade/config`. The page itself carries no Vue or React — it is intentionally thin.

**Layer 2 — Web Host.** The Web Host bundle loads as a JS module that takes over the entire page and its browser history. It owns the Wippy chrome: the navigation sidebar, chat panel, session management, and the page rendering surface. It receives its full configuration from the page's init call and never contains deployment-specific URLs or tokens in the bundle itself. This is what makes the CDN-hosted bundle portable across deployments. (For manual, facade-less embeddings the same host can instead run inside an iframe via the `iframe.html` entry — see the entry-points table below.)

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

The Web Host CDN serves several entry points from the same versioned directory. The right one depends on how you are integrating:

Each entry is served from the CDN at `<release-tag>/<entry>` (e.g. `/<release-tag>/module.js`).

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

Normally you don't set the version at all. The `wippy/facade` module ships with a default `fe_facade_url` pointing at a matching Web Host build, so **the Web Host version moves with the facade module** — updating `wippy/facade` is how you move to a newer Web Host. Child apps that share vendor libraries via the import map receive exactly the versions that build provides.

To pin a specific Web Host version — to stay on a known-good build, or to opt into a feature-branch / early-access tag — override the `fe_facade_url` parameter:

```yaml
- name: fe_facade_url
  value: https://web-host.wippy.ai/<release-tag>
```

This pins the entire deployment to that build. See [CLI overrides](../../guides/cli.md) for the `-o` / `--override` syntax to set it at runtime instead.

## Tech Stack

The Web Host is built with Vue 3 (Composition API), PrimeVue + Tailwind CSS 3 for UI components, Pinia for state management, Vue Router for navigation, and Axios for HTTP. All of these are available to child applications as externals through the host-provided import map — child apps do not need to bundle their own copies.

## See Also

- [Facade Entry Point](./entry-point.md) — how the facade delivers the Web Host to users and what the config flow looks like
- [Bootstrap Sequence](./bootstrap.md) — what happens inside the Web Host after it receives configuration
- [Multi-Panel Layout](./multi-panel-layout.md) — managed layout mode for custom multi-panel shells
- [Packages](./packages.md) — the `@wippy-fe/*` npm packages available to child app developers
- [Facade module](../../framework/facade.md) — backend setup for `wippy/facade`
