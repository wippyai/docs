---
title: "Frontend"
---

# Frontend

Wippy's frontend system is built around three distinct layers. Understanding how they relate to each other is the starting point for all frontend work.

![Wippy FE architecture](./diagrams/fe-arch-overview.svg)

## The Three Layers

### Layer 1: Frontend Facade

The `wippy/facade` backend module is the entry point for serving a Wippy frontend. It registers a thin HTML page and a `/facade/config` endpoint on your Wippy gateway. When a user opens the application, the facade serves that page, which loads the Web Host JS module from CDN and initialises it with configuration from `/facade/config`. The page itself carries no Vue or React — it exists only to load the Web Host and hand it its config.

See: [Web Host — Facade Entry Point](./web-host/entry-point.md)

### Layer 2: Web Host

The Web Host is a Vue 3 SPA delivered from CDN (`https://web-host.wippy.ai`). The `wippy/facade` backend loads it as a JS module that takes over the page; the host then reads its configuration from `wippy/facade`, builds the navigation sidebar from the registry, mounts each registered micro frontend app in its own isolated iframe, and auto-registers web components that are both `announced: true` and `auto_register: true`. The Web Host is typically invisible to end users — they see only the micro frontends it hosts.

The entry point for deploying the Web Host is the `wippy/facade` backend module, which serves a page that loads the Web Host JS module and supplies its configuration through `/facade/config`.

See: [Web Host](./web-host/overview.md)

### Layer 3: Wippy Micro Frontends

Wippy frontend code runs inside the Web Host's isolation boundary. Micro frontend apps are typically full Vue 3 SPAs mounted in iframes. Web components are custom elements mounted in shadow roots. Both kinds communicate with the Web Host through **`@wippy-fe/proxy`** — synchronous imports (`host`, `api`, `on`, `config`, …) that provide auth-aware HTTP, host navigation, theme-aware CSS, and event subscriptions.

See: [Wippy Micro Frontends](./micro-frontends/overview.md)

---

## Registration and module responsibilities

The three layers above describe how a Wippy frontend runs. Underpinning them is a registration concern handled by the `wippy/views` backend module. The backend registers frontend artifacts — micro frontend apps and web components — as registry entries in `_index.yaml`. The `wippy/views` module catalogs these entries, exposes them through REST APIs, and serves their static files. This is what tells the Web Host that a micro frontend app or web component exists.

See: [Frontend Registry](./frontend-registry/registry-entries.md)

| Module | Provides |
|---|---|
| `wippy/facade` | Serves the page that loads the Web Host JS module; `/facade/config` endpoint; `wippy-context-2.0` config with auth, env, theming, host UI config, and app branding |
| `wippy/views` | Registry for FE artifacts; routing for mount routes; static file serving; sidebar listing APIs (`/api/public/pages/list`, `/api/public/components/list`) |

---

## Navigation

### Frontend Registry

How the Wippy backend connects to the Wippy frontend through the registry.

- [Registry Entries](./frontend-registry/registry-entries.md) — `_index.yaml` format, `specification: wippy-component-1.0`, `wippy-meta.json`
- [Micro Frontend Apps (view.page)](./frontend-registry/view-page.md) — metadata fields, proxy injection flags, `config_overrides`
- [Web Components (view.component)](./frontend-registry/view-component.md) — autoload gates, `auto_register`, props/events schemas
- [Dynamic Routing](./frontend-registry/dynamic-routing.md) — mount route sync, `CmdRouteChanged`, `classifyLink`

### Web Host

How the CDN-delivered Web Host receives configuration, initialises, and manages pages and components.

- [Overview](./web-host/overview.md) — three-layer model, entry points, CDN versioning
- [Facade Entry Point](./web-host/entry-point.md) — how `wippy/facade` loads the Web Host JS module, `/facade/config` shape, manual iframe embedding, auth flow
- [Bootstrap Sequence](./web-host/bootstrap.md) — facade JS-module init path, manual iframe path, `AppConfig` interface
- [Multi-Panel Layout](./web-host/multi-panel-layout.md) — managed-layout mode, `HostLayoutDeclaration`, layout API
- [Proxy & Isolation](./web-host/proxy-isolation.md) — iframe proxy vs WC proxy, `IFrameMessageType`, `<w-iframe>`, `<w-artifact>`
- [CSS Injection](./web-host/css-injection.md) — injection pipeline, per-flag reference, `--wippy-host-*` variables
- [@wippy-fe Packages](./web-host/packages.md) — every `@wippy-fe/*` package, host import map

### Wippy Micro Frontends

How to build micro frontend apps and web components that run inside the Web Host.

- [Micro Frontend App](./micro-frontends/micro-frontend-app.md) — scaffold, Vite config, bootstrap sequence, router sync
- [Web Component](./micro-frontends/web-component.md) — `WippyVueElement`, props, events, shadow DOM CSS
- [Chat Web Components](./micro-frontends/chat-web-components.md) — ready-made `<wippy-chat>` & co.; composable chat elements you drop into any child
- [Proxy API](./micro-frontends/proxy-api.md) — complete `@wippy-fe/proxy` reference
- [Theming](./micro-frontends/theming.md) — CSS cascade, semantic variables, `hostCssKeys`
- [Build System](./micro-frontends/build-system.md) — `@wippy-fe/vite-plugin`, `wippy-meta.json`, externals
- [Host-less Mode](./micro-frontends/host-less-mode.md) — local development without the Web Host
- [Compliance Checklist](./micro-frontends/compliance-checklist.md) — MUST/SHOULD rules for production frontend
