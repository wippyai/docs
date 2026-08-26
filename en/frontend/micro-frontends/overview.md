---
title: "Wippy Micro Frontends"
description: "Choose between a micro frontend app and a web component, then follow the relevant build, routing, proxy, and theming guides."
---

# Wippy Micro Frontends

Wippy frontend code runs inside the Web Host's isolation boundary. You can
build two artifact types: **micro frontend apps** and **web components**. Both
are independent Vite projects, communicate with the platform through
`@wippy-fe/proxy`, and are declared to the backend in a `_index.yaml` registry
entry. They differ in how they are rendered and where they are used.

## Micro frontend app vs web component

| | Micro Frontend App (`view.page`) | Web component (`view.component`) |
|---|---|---|
| **Rendered as** | Page surface: srcdoc iframe or Web Fragment | Custom element in Shadow DOM, inside a page |
| **Has its own URL / nav entry** | Yes — claims a backend `mountRoute` | No — embedded inside another page or chat artifact |
| **Internal routing** | Yes — `vue-router` with memory history | No — single component, no router |
| **Controls its allocated surface** | Yes — the surface may be one panel, not the browser viewport | No — sized by the surrounding layout |
| **Reusable across pages** | No — one URL, one place | Yes — any page can embed the tag |
| **Receives typed props** | No — reads `AppConfig` | Yes — schema-declared HTML attributes |
| **Emits typed events** | No — communicates via proxy API | Yes — schema-declared `CustomEvent`s |
| **CSS isolation** | Engine-dependent: iframe boundary; a Web Fragment shares the host document | Shadow DOM selector boundary |

**Quick rule:** use a micro frontend app when it needs `vue-router`, a
dedicated URL, or ownership of a routed page surface. Use a web component when
it must be embeddable, reusable, and self-contained.

## What to read next

[Quickstart](./quickstart.md) provides minimal end-to-end examples for a Vue
micro frontend app and a Vue web component, with links to the public
[`app`](https://github.com/wippyai/app) repository.

Build a micro frontend app:

1. [Micro Frontend App](./micro-frontend-app.md) — scaffold, `package.json` wippy block, Vite config, bootstrap sequence, router sync
2. [Build System](./build-system.md) — `@wippy-fe/vite-plugin`, `wippy-meta.json`, externals
3. [Proxy API](./proxy-api.md) — `@wippy-fe/proxy` reference for communicating with the host
4. [Theming](./theming.md) → [Theming: Micro Frontend Apps](./micro-frontend-app-theming.md) — CSS variable catalog, then how to receive it via proxy injections

Build a web component:

1. [Web Component](./web-component.md) — scaffold, `WippyVueElement`, props, events, shadow DOM CSS
2. [Build System](./build-system.md) — same Vite toolchain, different plugin and output format
3. [Proxy API](./proxy-api.md) — same API, imported directly from `@wippy-fe/proxy`
4. [Theming](./theming.md) → [Theming: Web Components](./web-component-theming.md) — CSS variable catalog, then how to receive it across the shadow DOM boundary

Both:

- [Host-less Mode](./host-less-mode.md) — develop and test without running the full Web Host
- [Compliance Rule Index](./compliance-checklist.md) — canonical rule owners and deterministic gates
- [Debugging](./debugging.md) — symptom-first guide for the most common failure scenarios

## Prerequisites

- Wippy backend module with `wippy/views` declared as a dependency (see [Views](../../framework/views.md))
- `wippy/facade` for the Web Host entry point (see [Facade Entry Point](../web-host/entry-point.md))
- Node.js 22 or newer and Vite 7, as declared by the selected Web Host source;
  re-check its package when the target release changes
