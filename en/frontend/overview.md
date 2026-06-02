# Frontend

Wippy's frontend system is built around three distinct layers. Understanding how they relate to each other is the starting point for all FE work.

![Wippy FE architecture](./diagrams/fe-arch-overview.svg)

## The Three Layers

### Layer 1: BE → FE Bridge

The backend registers frontend artifacts — pages and web components — as registry entries in `_index.yaml`. The `wippy/views` module reads these entries, exposes them through REST APIs, and serves their static files. This layer answers the question: *how does a Wippy backend tell the Web Host that a page or component exists?*

See: [BE → FE Bridge](./be-fe-bridge/registry-entries.md)

### Layer 2: Web Host

The Web Host is a Vue 3 SPA delivered from CDN (`https://web-host.wippy.ai`). The `wippy/facade` backend loads it as a JS module that takes over the page; the host then reads its configuration from `wippy/facade`, builds the navigation sidebar from the registry, mounts each registered page in its own isolated iframe, and auto-registers web components that are both `announced: true` and `auto_register: true`. The Web Host is typically invisible to end users — they see only the pages it hosts.

The entry point for deploying the Web Host is the `wippy/facade` backend module, which serves a page that loads the Web Host JS module and supplies its configuration through `/facade/config`.

See: [Web Host](./web-host/overview.md)

### Layer 3: Writing Wippy FE

Wippy frontend code runs inside the Web Host's isolation boundary. Page applications are typically full Vue 3 SPAs mounted in iframes. Web components are custom elements mounted in shadow roots. Both kinds communicate with the Web Host through the Proxy API (`window.$W`), which provides auth-aware HTTP, host navigation, theme-aware CSS, and event subscriptions.

See: [Writing Wippy FE](./writing-fe/page-app.md)

---

## Module responsibilities

| Module | Provides |
|---|---|
| `wippy/facade` | Serves the page that loads the Web Host JS module; `/facade/config` endpoint; `wippy-context-2.0` config with auth, env, theming, host UI config, and app branding |
| `wippy/views` | Registry for FE artifacts; routing for mount routes; static file serving; sidebar listing APIs (`/api/public/pages/list`, `/api/public/components/list`) |

---

## Navigation

### BE → FE Bridge

How the Wippy backend connects to the Wippy frontend through the registry.

- [Registry Entries](./be-fe-bridge/registry-entries.md) — `_index.yaml` format, `specification: wippy-component-1.0`, `wippy-meta.json`
- [Pages (view.page)](./be-fe-bridge/view-page.md) — metadata fields, proxy injection flags, `config_overrides`
- [Components (view.component)](./be-fe-bridge/view-component.md) — autoload gates, `auto_register`, props/events schemas
- [Dynamic Routing](./be-fe-bridge/dynamic-routing.md) — mount route sync, `CmdRouteChanged`, `classifyLink`

### Web Host

How the CDN-delivered Web Host receives configuration, initialises, and manages pages and components.

- [Overview](./web-host/overview.md) — three-layer model, entry points, CDN versioning
- [Facade Entry Point](./web-host/entry-point.md) — how `wippy/facade` loads the Web Host JS module, `/facade/config` shape, manual iframe embedding, auth flow
- [Bootstrap Sequence](./web-host/bootstrap.md) — facade JS-module init path, manual iframe path, `AppConfig` interface
- [Multi-Panel Layout](./web-host/multi-panel-layout.md) — managed-layout mode, `HostLayoutDeclaration`, layout API
- [Proxy & Isolation](./web-host/proxy-isolation.md) — iframe proxy vs WC proxy, `IFrameMessageType`, `<w-iframe>`, `<w-artifact>`
- [CSS Injection](./web-host/css-injection.md) — injection pipeline, per-flag reference, `--wippy-host-*` variables
- [@wippy-fe Packages](./web-host/packages.md) — all 14 `@wippy-fe/*` packages, host import map

### Writing Wippy FE

How to build pages and web components that run inside the Web Host.

- [Page App](./writing-fe/page-app.md) — scaffold, Vite config, bootstrap sequence, router sync
- [Web Component](./writing-fe/web-component.md) — `WippyVueElement`, props, events, shadow DOM CSS
- [Proxy API](./writing-fe/proxy-api.md) — complete `window.$W` reference
- [Theming](./writing-fe/theming.md) — CSS cascade, semantic variables, `hostCssKeys`
- [Build System](./writing-fe/build-system.md) — `@wippy-fe/vite-plugin`, `wippy-meta.json`, externals
- [Host-less Mode](./writing-fe/host-less-mode.md) — local development without the Web Host
- [Compliance Checklist](./writing-fe/compliance-checklist.md) — MUST/SHOULD rules for production FE
