# Wippy Micro Frontends

Wippy frontend code runs inside the Web Host's isolation boundary. There are two kinds of artifact you can build: **micro frontend apps** and **web components**. Both are independent Vite projects, both communicate with the platform through `@wippy-fe/proxy`, and both are declared to the backend via a `_index.yaml` registry entry. The difference is how they are rendered and what they are suitable for.

## Micro Frontend App vs web component

| | Micro Frontend App (`view.page`) | Web component (`view.component`) |
|---|---|---|
| **Rendered as** | Full iframe, isolated browsing context | Custom element in Shadow DOM, inside a page |
| **Has its own URL / nav entry** | Yes — claims a `mountRoute` | No — embedded inside another page or chat artifact |
| **Internal routing** | Yes — `vue-router` with memory history | No — single component, no router |
| **Controls the viewport** | Yes | No — sized by the surrounding layout |
| **Reusable across pages** | No — one URL, one place | Yes — any page can embed the tag |
| **Receives typed props** | No — reads `AppConfig` | Yes — schema-declared HTML attributes |
| **Emits typed events** | No — communicates via proxy API | Yes — schema-declared `CustomEvent`s |
| **CSS isolation** | iframe boundary | Shadow DOM (full encapsulation) |

**Quick rule:** if it needs `vue-router`, a dedicated URL, or owns the full viewport — it is a micro frontend app. If it is embeddable, reusable, and self-contained — it is a web component.

When in doubt, start with a web component. It is easier to promote to a micro frontend app later than the reverse.

## What to read next

In a hurry? [Quickstart](./quickstart.md) has minimal end-to-end examples for both a Vue micro frontend app and a Vue web component, with links to the public [`app`](https://github.com/wippyai/app) repo.

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
- [Compliance Checklist](./compliance-checklist.md) — MUST/SHOULD rules before shipping
- [Debugging](./debugging.md) — symptom-first guide for the most common failure scenarios

## Prerequisites

- Wippy backend module with `wippy/views` declared as a dependency (see [Views](../../framework/views.md))
- `wippy/facade` for the Web Host entry point (see [Facade Entry Point](../web-host/entry-point.md))
- Node.js 20+, pnpm or npm, Vite 6
