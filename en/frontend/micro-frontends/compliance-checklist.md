# Wippy FE Compliance Checklist

A single, exhaustive checklist for shipping Wippy child apps (`view.page`) and web components (`view.component`) — covering YAML registration, FE source, build pipeline, theming, proxy API, router/host integration, and host-less mode. Every rule cites a source (canonical doc, host contract, gold-standard reference, or real-world incident) and most have a copy-paste verification command.

This doc supersedes the older `app-checklist.md` for new work. The older checklist remains valid for the micro-frontend-app subset; this one extends it with web components, host-less mode, real-world fixes, and verification recipes.

**Gold standards** (validated against this checklist):

- Micro Frontend App: `app-template/frontend/applications/main/`
- Web component: `app-template/frontend/web-components/mermaid/`

When this checklist disagrees with what the gold standards do, the gold standards win. See §14 for the validation report.

---

## Conventions

- **MUST** — REJECT the module if not satisfied
- **SHOULD** — WARN; document the deviation if you keep it
- **MAY** — informational, no compliance gate
- **VERIFY** — copy-paste shell command that confirms the rule

Source references use:

- `docs:<filename>:<line>` — canonical FE docs
- `gold:<path>` — a file in the gold-standard app-template repo, [`wippyai/app`](https://github.com/wippyai/app). Path aliases: `gold:main/…` = [`frontend/applications/main/…`](https://github.com/wippyai/app/tree/main/frontend/applications/main); `gold:mermaid/…` = [`frontend/web-components/mermaid/…`](https://github.com/wippyai/app/tree/main/frontend/web-components/mermaid). Any other `gold:` path is repo-root-relative (e.g. `gold:src/app/views/_index.yaml`)
- `kb:<topic>` — Wippy KB
- `incident:<id>` — bug found during a real audit

---

## Table of contents

0. [The FE isolation paradigm](#0-the-fe-isolation-paradigm) — read this first
1. [Decide what you're shipping](#1-decide-what-youre-shipping)
2. [YAML registration (host contract)](#2-yaml-registration-host-contract)
3. [Micro Frontend Apps — manifest, build, runtime](#3-micro-frontend-apps--manifest-build-runtime)
4. [Web components — manifest, build, runtime](#4-web-components--manifest-build-runtime)
5. [Theming](#5-theming)
6. [Proxy API & subscriptions](#6-proxy-api--subscriptions)
7. [Router & host integration](#7-router--host-integration)
8. [Build pipeline & Makefile](#8-build-pipeline--makefile)
9. [Host-less mode](#9-host-less-mode)
10. [Verification recipes](#10-verification-recipes)
11. [Acceptance criteria (REJECT rules)](#11-acceptance-criteria-reject-rules)
12. [Known intentional deviations](#12-known-intentional-deviations)
13. [Tooling gotchas](#13-tooling-gotchas)
14. [Gold-standard validation report](#14-gold-standard-validation-report)
15. [Appendix A — Window globals & DOM markers](#appendix-a--window-globals--dom-markers)
16. [Appendix B — HostApi method signatures](#appendix-b--hostapi-method-signatures)
17. [Appendix C — ProxyConfig.injections reference](#appendix-c--proxyconfiginjections-reference)

---

## 0. The FE isolation paradigm

> Cite as: "**check FE isolation paradigm is followed**".

A Wippy FE module (`view.page` or `view.component`) is a **standalone, universal build artifact** that has ZERO knowledge of where or how it is served. The `_index.yaml` registry entries on the BE side are the **serving facade** — they declare, for THIS Wippy deployment, where the bundle is mounted (`meta.url`), how it's reached (`meta.entry_point` / `meta.base_path`), and where the bytes come from (`fs.directory` + `http.static`, or any other source: `fs.embed`, in-memory FS, upstream proxy, DB-backed FS).

```
┌──────────────────────┐   built once, served anywhere   ┌──────────────────────┐
│ FE module (universal)│ ──────────────────────────────► │ _index.yaml (per-BE) │
│                      │                                 │                      │
│ - vite base: ''      │                                 │ - meta.url           │
│ - relative imports   │                                 │ - meta.entry_point   │
│ - package.json:      │                                 │ - meta.tag_name      │
│   tag, props, events │                                 │ - fs.directory OR    │
│ - NO mount URL       │                                 │   fs.embed OR any    │
│ - NO peer-module URL │                                 │   filesystem source  │
└──────────────────────┘                                 └──────────────────────┘
       ▲                                                          │
       │       built bundle (index.js, sourcemaps, optional       │
       │       static assets) lands wherever the BE expects ──────┘
       │       (configurable via Makefile / build script's `--outDir`)
```

### What the FE module MUST NOT know

- The URL prefix where it will be mounted on this deployment.
- Whether it's served from a filesystem, in-memory FS, CDN, or remote registry.
- Which other modules are co-located on the same Wippy instance, or at what URLs they live.
- Whether the BE uses one centralized `fs.directory` or one per module.

### What the YAML facade decides (and can override per deployment)

- `meta.url` — the **URL prefix** at which a router serving this bundle is mounted. Not a physical path. May be backed by `/static/...`, an in-memory FS, or a remote server.
- `meta.entry_point` — the URL **relative to the bundle root** pointing at the entry (`app.html` for pages, `index.js` for components).
- `meta.tag_name` (WCs only) — the custom-element tag the bundle registers itself as.
- `fs.directory` + `http.static` (or any equivalent) — where the bytes come from on this deployment. Single-shared-FS, per-module-FS, embedded-FS — all valid, FE doesn't care.

### Corollaries (the rules this paradigm produces)

**Bundle portability:**

- `vite.config.ts` MUST have `base: ''` so all asset URLs in the build are relative. Hardcoding `base: '/app/keeper/'` is **REJECT** — it bakes a deployment-specific URL prefix into a universal artifact. See §3.4 and §9.5.

**No cross-module URL hardcoding:**

- A FE module MUST NEVER `import('/components/x/dist/index.js')` or `fetch('/wc/x/...')` to reach another WC's physical URL. **REJECT.** Such a URL is a presumption about THIS deployment's serving layout — it breaks the moment the BE relocates the peer module, or runs it from an embedded FS. Consume another WC via the proxy / host pipeline instead:
  - **Registry-declared WCs (the common case)** — if the peer is `auto_register: true` + `announced: true` in its `view.component` entry, the host eagerly registers it in every iframe at boot. Consumer code just does `await customElements.whenDefined('wc-x')` and then uses the tag. No URL knowledge required.
  - **Artifact-based / dynamically-loaded WCs** — call `loadWebComponent(componentId, tagName?)` from `@wippy-fe/proxy`. **`componentId` is the artifact UUID** (the host fetches the artifact's package.json via the artifact API, validates it as a Wippy package, then dynamic-imports it). This is the path for user-generated / AI-generated WCs delivered as artifacts.

**Build script owns the output path, not vite.config:**

- The deployment's build script (Makefile / make.ps1 / npm script) passes `--outDir <wherever-the-BE-expects>` per module. The `vite.config.ts` does NOT hardcode `outDir`.

**`package.json` describes the module, not its mount point:**

- Carry `wippy.tagName`, `wippy.type`, `wippy.props`, `wippy.events`. Do NOT carry `wippy.url`, `wippy.host`, `wippy.mountPath` — those are deployment-specific and belong in the BE's `_index.yaml` `meta.*`.
- **Source-of-truth precedence: the registry entry always wins over `package.json`.** `meta.tag_name`, `meta.props`, `meta.events` on the `view.component` entry override the corresponding `wippy.tagName` / `wippy.props` / `wippy.events` in `package.json` for THIS deployment.

**Re-mounting under a different URL must work without a rebuild:**

- Because `base: ''`, the bundle's relative imports resolve against whatever `<base>` the host injects from `meta.url` + `meta.base_path` at serve time. Test in dev by changing `meta.url`, reloading — no rebuild needed. If it breaks, the paradigm is being violated somewhere.

### Audit checklist — "is FE isolation paradigm followed?"

- [ ] `vite.config.ts` has `base: ''` (and **not** `'/something/'`).
- [ ] `vite.config.ts` does NOT hardcode `outDir` — the build script passes `--outDir` per deployment.
- [ ] `package.json` carries `wippy.tagName` / `wippy.type` / props / events. It does NOT carry any deployment URL or mount path.
- [ ] Source tree has zero hardcoded references to peer modules' physical URLs.
- [ ] If the module consumes another WC, it does so via `await customElements.whenDefined('wc-x')` (for registry-declared peers with `auto_register: true` + `announced: true`) or `loadWebComponent(artifactUUID)` (for artifact-delivered peers) — never by hardcoding a URL.
- [ ] No `import.meta.url`-based path math that presumes a specific serving layout. The pattern `define(import.meta.url, …)` is fine; `import.meta.url.split('/components/')[1]` is not.

---

## 1. Decide what you're shipping

| Question | Use |
|---|---|
| Will it be loaded in its own iframe with its own `app.html`? | `view.page` |
| Will it be inserted as a `<custom-tag>` inside another page's DOM? | `view.component` |
| Both? | ship two registry entries — one for each role |

**Runtime difference** (`kb:view-page-vs-component`):

- `view.page` → host loads it in an **iframe** with its own `app.html`. Code runs in iframe document.
- `view.component` → host registers a custom tag and inserts the element directly in the host DOM (typically with shadow DOM). Code runs in the **same document** as the host.

**`view.page` does not imply nav presence.** A `view.page` entry with `meta.announced: false` is reachable via:

- a `mountRoute` someone navigates to,
- direct `host.openSession` / `host.openArtifact` invocation,
- being used inside a managed-layout panel,
- being loaded inside a `<w-artifact>` element by another app.

A "page in iframe with no nav-owner" — common in artifact viewers, embedded demos, sub-tools — is an explicit and supported pattern. Set `announced: false` to keep it out of nav while leaving it routable.

Conversely, a `view.component` entry with `auto_register: true` and `announced: true` will appear in tag-explorer registries; with `announced: false` it's an internal building block.

**For `view.component` entries, `announced: true` is a HARD requirement to participate in the host's autoload.** The `/api/public/components/list` endpoint filters server-side by `announced == true`; `auto_register: true` alone is *not* enough to make the host inject the WC's `<script type="module">` tag at boot. Symptom of getting this wrong: `customElements.get('your-tag')` stays `undefined`, Vue silently renders an empty `<your-tag></your-tag>` with no shadow root content, no console error.

---

## 2. YAML registration (host contract)

A registry.entry is what the host actually reads at navigation/render time. The `wippy.*` block in your `package.json` is the host-less mirror. **YAML is canonical**; package.json is for embedded fallback.

### 2.1 `view.page` meta fields

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    name: main
    title: Admin Panel
    icon: tabler:layout-dashboard
    order: 0
    announced: true
    secure: false
    url: /app
    base_path: app/main
    entry_point: app.html
    mountRoute: /home/:part(.*)*
    proxy:
      enabled: true
      injections:
        css:
          themeConfig: true
          iframe: true
          primevue: true
          customCss: true
          customVariables: true
        tailwindConfig: true
        iconifyIcons: true
```

**Field-by-field** (`gold:src/app/views/_index.yaml`, `kb:view-page-fields`):

| Field | Required | Purpose |
|---|---|---|
| `meta.type` | MUST | `"view.page"` literal |
| `meta.name` | MUST | Page id (combines with namespace into `<ns>:<name>`, e.g. `app.views:main`) |
| `meta.title` | MUST | Human-readable title (used in nav and page tabs) |
| `meta.icon` | SHOULD | Iconify icon code (e.g. `tabler:home`); only relevant if `announced: true` |
| `meta.url` | MUST | **URL prefix** at which the FS+http.router serving this bundle is mounted. Not a physical path. |
| `meta.base_path` | MUST | URL path appended to `url` to reach the bundle root. Combined with `url`, becomes the **HTML `<base>` injected into `entry_point`**, so relative module imports inside `app.html` resolve against the bundle root. |
| `meta.entry_point` | MUST | URL path **relative to the bundle root** pointing at the entry HTML file. e.g. `app.html` (most common). |
| `meta.mountRoute` | MAY | Vue Router 4 path the host claims for this page (e.g. `/home/:part(.*)*`). |
| `meta.secure` | SHOULD | Default `false`. Set `true` to enforce auth. |
| `meta.announced` | SHOULD | Default `false`. Set `true` to appear in nav. Pages without nav-owner keep `false`. |
| `meta.hidden` | MAY | Soft-hide from announced nav. |
| `meta.order` | MAY | Sort position in nav (when announced). |
| `meta.group` / `meta.group_icon` / `meta.group_order` | MAY | Nav grouping. |
| `meta.config_overrides` | MAY | **Per-page + sub-tree override.** The MAIN way to theme the whole app is the host's facade module — the facade owns `cssVariables` / `customCSS` / `host_custom_css` / `css_variables` for the app shell. Reach for `config_overrides` when you want a page — **and everything it embeds** — to look or behave differently from the rest of the app: the override is merged into that page's `theming.global` and propagates to all its nested children. Typical use: a module that ships pages carrying their own theme (e.g. an admin UI) that cascades to their whole sub-tree. |
| `meta.proxy` | SHOULD | Per-entry proxy injection config, nested under `meta`. camelCase under an `injections` wrapper — same shape as the package.json `wippy.proxy` block: `injections.css.{themeConfig, primevue, customCss, customVariables}`, `injections.tailwindConfig`, `injections.iconifyIcons`. Deep-merged over the bundled `wippy.proxy`; YAML wins per nested key. |

**VERIFY** at runtime that the host registry recognizes your entry:
```bash
curl -fsS http://<host>/api/public/pages/list | jq '.pages[] | select(.id=="<namespace>:<name>")'
```

### 2.2 `view.component` meta fields

```yaml
- name: mermaid
  kind: registry.entry
  meta:
    type: view.component
    name: mermaid
    title: Mermaid Diagram
    tag_name: example-mermaid
    entry_point: index.js
    announced: true
    secure: false
    auto_register: true
    url: /app/wc/mermaid
    props:
      type: object
      properties:
        definition:
          type: string
          default: ""
          description: Mermaid diagram definition string
        transparent:
          type: boolean
          default: true
          description: Whether the diagram background is transparent
```

**Field-by-field** (`gold:src/app/views/_index.yaml`, `kb:view-component-fields`):

| Field | Required | Purpose |
|---|---|---|
| `meta.type` | MUST | `"view.component"` literal |
| `meta.name` | MUST | Component logical name |
| `meta.tag_name` | MUST | Custom-element tag. **Must contain a hyphen** (Custom Elements spec). |
| `meta.entry_point` | MUST | URL relative to bundle root pointing at the entry **JS** file (e.g. `index.js`). |
| `meta.url` | MUST | URL prefix where the bundle is served. Same semantics as for `view.page`. |
| `meta.base_path` | MAY | Supported for components too; composes the same way (`<url>/<base_path>/<entry_point>`). Current app-template WC entries omit it, so they are served as `meta.url + meta.entry_point`. |
| `meta.announced` | MUST per `kb:view-component-fields` | Default `false` (falls back to `meta.public`). MUST be `true` for the component to appear in `/api/public/components/list`. |
| `meta.secure` | MUST per kb | Default `false`. |
| `meta.auto_register` | MUST per kb | Default `false`. MUST be `true` for the host to autoload it; leave/set `false` for lazy-loaded WCs. |
| `meta.props` | SHOULD | JSON Schema mirroring `wippy.props` from package.json. Each property MUST have `type`, `default`, `description`. |
| `meta.events` | MAY | JSON Schema mirroring `wippy.events`. Omit if the WC has no custom events. |
| `meta.description` | SHOULD | **Verbose AI/human-readable usage explanation.** Not a one-line label — a paragraph or two that explains: what the WC renders, the intended call shape, what input forms are supported, what edge cases or fallbacks exist, and notable performance characteristics. |
| `meta.title`, `meta.icon` | MAY | For browse/registry UIs. |

**No `proxy:` block for WCs** — they run in the host's document, not in their own iframe, so proxy injections don't apply.

**Hyphenated prop names** (e.g. `allow-multiple`) are camelCased in Vue (`allowMultiple`). Non-string props are JSON-encoded in attributes; the WC must `JSON.parse` them or use `WippyVueElement`/`WippyElement` (which handle this automatically).

### 2.3 `config_overrides` shape

```ts
interface AppConfigOverrides {
  customization?: Partial<AppCustomization>  // compatibility-shaped override; projected into theming.global for children
  axiosDefaults?: Partial<AxiosDefaults>     // MERGED into config.axiosDefaults
  routePrefix?: string                       // REPLACES config.routePrefix
  apiRoutes?: ApiRoutesOverride              // REPLACES config.apiRoutes
}
```

`customization` field merge semantics (mergeChildCustomization):
- `cssVariables` → **REPLACE** (override map fully replaces parent map)
- `customCSS` → **REPLACE** (new string replaces parent; not concatenated)
- `icons` → **MERGE** shallow (additive)
- `iconSets` → **MERGE** per-prefix (additive)

**Isolation depends on the field.** `config_overrides` are NOT uniformly "isolation-only" — behaviour is field-specific:

- **`cssVariables` / `customCSS` (REPLACE)** → the page's theme replaces the inherited one and then **propagates to everything the page embeds** (it is merged into the page's `theming.global`, which all nested children inherit). Use it to theme a **sub-tree**, not just one iframe: a module shipping pages with their own palette (e.g. an admin UI whose theme cascades to its artifacts/sub-apps), demo pages with divergent themes, artifact viewers with a fixed brand, debug pages on alternate API routes.
- **`icons` / `iconSets` (MERGE)** → additive, NON-isolating. Adding icons via `config_overrides.customization.icons` augments the child-projected icon set without isolating the iframe. At runtime the page reads the result from `config.theming.global.icons` / `iconSets`.

### 2.4 The `meta.proxy:` entry-level block (page only)

For `view.page` entries, the **registry-entry's `proxy:` block nested under `meta:`** configures host-side proxy injection per page. It is camelCase and uses the `injections` wrapper — the **same shape as the package.json `wippy.proxy` block**. The host reads `entry.meta.proxy` and deep-merges it over the bundled `wippy.proxy`; the YAML wins per nested key.

```yaml
meta:
  type: view.page
  # ...
  proxy:
    enabled: true
    injections:
      css:
        themeConfig: true
        iframe: true
        primevue: true
        customCss: true
        customVariables: true
      tailwindConfig: true
      iconifyIcons: true
```

All injection flags are technically MAY — the host has sane defaults — but micro frontend apps SHOULD declare them explicitly to avoid invisible drift.

---

## 3. Micro Frontend Apps — manifest, build, runtime

### 3.1 `package.json`

Reference: `gold:main/package.json`.

```json
{
  "name": "@wippy/app-main",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "title": "Wippy App",
  "description": "...",
  "files": ["dist/", "src/", "package.json"],
  "browser": "dist/app.js",
  "wippy": {
    "type": "page",
    "title": "Wippy App",
    "icon": "tabler:home",
    "path": "dist/app.html",
    "proxy": {
      "enabled": true,
      "injections": {
        "css": {
          "themeConfig": true,
          "iframe": true,
          "primevue": true,
          "markdown": true,
          "customCss": true,
          "customVariables": true
        },
        "tailwindConfig": false,
        "resizeObserver": false,
        "preventLinkClicks": false,
        "iconifyIcons": false,
        "errorCapture": true
      }
    },
    "scripts": {
      "build": "build",
      "debug": "build:debug",
      "test": "lint"
    }
  },
  "scripts": {
    "build": "vite build",
    "build:debug": "vite build --mode development",
    "dev": "vite build --watch",
    "type-check": "vue-tsc --build --force",
    "lint": "eslint src --ext .ts,.vue",
    "lint:fix": "eslint src --ext .ts,.vue --fix"
  },
  "dependencies": {
    "@wippy-fe/theme": "^0.0.28"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "@wippy-fe/types-global-proxy": "^0.0.28",
    "@wippy-fe/vite-plugin": "^0.0.32",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.57.0",
    "eslint-plugin-vue": "^9.0.0",
    "postcss": "^8.4.0",
    "primevue": "^4.3.3",
    "tailwindcss": "3",
    "typescript": "^5.0.0",
    "vite": "^6.0.0",
    "vue": "^3.5.0",
    "vue-eslint-parser": "^9.4.3",
    "vue-router": "^4.6.4",
    "vue-tsc": "^2.0.0"
  },
  "peerDependencies": {
    "@iconify/vue": "^5.0.0",
    "@wippy-fe/pinia-persist": "^0.0.28",
    "@wippy-fe/proxy": "^0.0.28",
    "@wippy-fe/router": "^0.0.28",
    "axios": "^1.0.0",
    "luxon": "^3.5.0",
    "pinia": "^2.1.0",
    "primevue": "^4.3.3",
    "vue": "^3.5.0",
    "vue-router": "^4.0.0"
  }
}
```

**Specification** — `docs:app-checklist.md:39`, `gold:main/package.json:4`:

- MUST set `"specification": "wippy-component-1.0"`.
- MUST set package `name` to `@<org>/app-<short>` (e.g. `@wippy/app-main`).
- MUST set top-level `"title"` (matches `wippy.title`).

**`wippy` block**:
- MUST set `wippy.type: "page"`.
- MUST set `wippy.title` (typically equals top-level `title`).
- SHOULD set `wippy.icon` to an Iconify code (only relevant if the page is `announced: true`).
- MUST set `wippy.path: "dist/app.html"` (or wherever your built entry HTML lives).

**`wippy.scripts` map** — entry → npm script binding:
- MUST set `wippy.scripts.build` (typically `"build"`).
- MAY set `wippy.scripts.debug` (typically `"build:debug"`).
- MAY set `wippy.scripts.test` (typically `"lint"` or `"test"`).

**`wippy.proxy.injections`** — full reference: Appendix C.

All flags are technically MAY (host has defaults). The **recommended set for a typical micro frontend app** is:

| Flag | Recommended | When to set otherwise |
|---|---|---|
| `proxy.enabled` | `true` | `false` for pages with no proxy needs (rare) |
| `injections.css.themeConfig` | `true` | `false` only if you don't use Wippy theming |
| `injections.css.iframe` | `true` | `false` only outside iframe context |
| `injections.css.primevue` | `true` | `false` if you don't use PrimeVue |
| `injections.css.markdown` | `true` if app renders any markdown | `false` if you have no markdown anywhere |
| `injections.css.customCss` | `true` | `false` if you don't read child-projected `theming.global.customCSS` |
| `injections.css.customVariables` | `true` | `false` if you don't read child-projected `theming.global.cssVariables` |
| `injections.tailwindConfig` | `false` | `true` if using Tailwind Play CDN runtime |
| `injections.resizeObserver` | `false` | `true` for widget-style pages needing reported size |
| `injections.preventLinkClicks` | `false` | `true` if you don't have your own router |
| `injections.iconifyIcons` | `false` | `true` if using CDN Iconify |
| `injections.errorCapture` | `true` | `false` if you handle errors fully internally |
| `injections.refreshWhenVisible` | `false` (or omit) | `true` for pages that need stale-data refresh |
| `injections.historyPolyfill` | `true` (or omit) | leave on; host installs always-stub |

**Dependency hygiene**:

- `dependencies`: only what's bundled into the page (e.g. `@wippy-fe/theme`, app-specific libs like `chart.js`).
- `devDependencies`: build toolchain (`vite`, `vue-tsc`, `typescript`, `@vitejs/plugin-vue`, `eslint*`, `tailwindcss@3`, `postcss`, `autoprefixer`, `primevue` for build-time, `vue` for build-time, `vue-router` if you build-time-import it, `@wippy-fe/types-global-proxy`, `@wippy-fe/vite-plugin`).
- `peerDependencies`: every package the host's import map provides. Canonical set: `vue`, `vue-router`, `pinia`, `axios`, `@iconify/vue`, `@wippy-fe/proxy`, `@wippy-fe/router`, `@wippy-fe/pinia-persist`, `primevue` and any `primevue/*` you import. Add `luxon`, `nanoevents`, `@tanstack/vue-query`, `@tanstack/query-core` only if the app actually imports them.
- Adding to `peerDependencies` does NOT bundle the package — it's a host-import-map subscription.

**Version alignment**: `@wippy-fe/*` packages SHOULD be on the same minor version (e.g. all `^0.0.28`). Ecosystem mismatch causes silent ABI drift.

**VERIFY** required wippy fields:
```bash
node -e 'const p=require("./package.json");const m=["specification","title"].filter(k=>!p[k]).concat(p.wippy?[]:["wippy"]);if(m.length)throw new Error("missing: "+m.join(","));console.log("OK")'
```

### 3.2 `vite.config.ts`

Reference: `gold:main/vite.config.ts`.

```ts
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('example-'),
        },
      },
    }),
    wippyPagePlugin(),
  ],
  base: '',
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
  build: {
    target: 'esnext',
    cssCodeSplit: false,
    sourcemap: true,
    rollupOptions: {
      input: { app: resolve(__dirname, 'app.html') },
      external: [
        'vue',
        'pinia',
        'vue-router',
        '@iconify/vue',
        'nanoevents',
        'luxon',
        '@wippy-fe/proxy',
        'axios',
        '@tanstack/vue-query',
        '@tanstack/query-core',
      ],
      output: {
        entryFileNames: '[name].js',
        assetFileNames: '[name]-[hash][extname]',
      },
    },
  },
})
```

Rules:

- MUST set `base: ''` (relative paths; bundle is portable to any URL prefix). A hardcoded absolute base (e.g. `/app/keeper/`) is **REJECT** — see §9.5.
- MUST include `vue()` plugin.
- SHOULD include `wippyPagePlugin()` from `@wippy-fe/vite-plugin` (default; opt out only if your team explicitly does NOT want host-less mode support — rare).
- SHOULD pass `template.compilerOptions.isCustomElement` if your templates render custom-element tags.
- MUST set `build.target: 'esnext'`.
- MAY set `build.cssCodeSplit: false` to inline all CSS into a single bundle.
- MAY set `build.sourcemap: true` for production.
- MUST set `build.rollupOptions.input` to your `app.html`.
- MUST list every host-provided package in `build.rollupOptions.external`. Canonical set for a full-featured app: `vue`, `pinia`, `vue-router`, `axios`, `@iconify/vue`, `@wippy-fe/proxy`, `nanoevents`, `luxon`.
- MUST NOT set `build.assetsInlineLimit` to a large value (`incident:1I`); leave at the 4 KB default.
- MUST NOT force `define: { 'process.env.NODE_ENV': '"production"' }` (`incident:7C`); it overrides `--mode development`.

**VERIFY** base + canonical externals + plugin:
```bash
grep -E "base:\s*['\"]" path/to/vite.config.ts            # must show: base: ''
grep -A 25 "external:" path/to/vite.config.ts              # check coverage of imported host packages
grep -E "wippyPagePlugin" path/to/vite.config.ts        # SHOULD be present
```

### 3.3 `app.html`

Reference: `gold:main/app.html`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wippy</title>
    <script type="importmap">
    {
        "imports": {
            "vue":          "https://esm.sh/vue@3",
            "pinia":        "https://esm.sh/pinia",
            "vue-router":   "https://esm.sh/vue-router@4",
            "luxon":        "https://esm.sh/luxon",
            "@iconify/vue": "https://esm.sh/@iconify/vue",
            "axios":        "https://esm.sh/axios",
            "@wippy-fe/markdown-iframe": "https://web-host.wippy.ai/<release-tag>/@wippy-fe/markdown-iframe.js"
        }
    }
    </script>
    <script
        src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"
        data-role="@wippy/scripts"
    ></script>
</head>
<body>
    <div id="app">
        <wippy-loading title="Loading..."></wippy-loading>
    </div>
    <script type="module" src="./src/app.ts"></script>
</body>
</html>
```

Rules:
- MUST contain `<!DOCTYPE html>`, `<html lang="...">`, charset, viewport.
- MUST contain a `<title>`.
- MUST contain `<script type="importmap">` with at minimum every host-provided package the app imports at runtime.
- The importmap MUST cover every external the app actually imports at runtime.
- Importmap URLs SHOULD use `https://esm.sh/<pkg>@<major>`.
- MUST contain exactly one `<script data-role="@wippy/scripts" src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js">`. The URL always requires a release-tag segment.
- MUST contain `<div id="app"></div>` mount point.
- MUST contain `<wippy-loading title="...">` inside the mount instead of a hand-rolled spinner.
- MUST contain `<script type="module" src="./src/app.ts">` (or your entry path) at end of body.

**VERIFY**:
```bash
grep -c '<script type="importmap">' app.html      # must = 1
grep -c 'data-role="@wippy/scripts"' app.html     # must = 1
grep -c '<wippy-loading' app.html                 # must >= 1
```

### 3.4 `src/app.ts` (bootstrap)

Reference: `gold:main/src/app.ts`.

```ts
import { addCollection } from '@iconify/vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { createWippyPersist, preloadWippyState } from '@wippy-fe/pinia-persist'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { PrimeVuePlugin } from '@wippy-fe/theme/primevue-plugin'
// Sync getters from @wippy-fe/proxy — available immediately, never awaited to obtain.
import { config, host, api, on } from '@wippy-fe/proxy'

import App from './app/app.vue'
import { AXIOS_INSTANCE, HOST_API, WIPPY_INSTANCE } from './constants'
import { createAppRouter } from './router'
import '@wippy-fe/theme/theme-config.css'
import './styles.css'
import './tailwind.css'

export async function createMainApp() {
  const routePath = config.context?.route
  const initialPath = routePath
    ? (routePath.startsWith('/') ? routePath : '/' + routePath)
    : '/'

  if (config.theming.global?.icons) {
    addCollection({
      prefix: 'custom',
      icons: config.theming.global.icons,
    })
  }
  for (const [prefix, icons] of Object.entries(config.theming.global?.iconSets ?? {})) {
    addCollection({ prefix, icons })
  }

  const app = createApp(App)

  const preloaded = await preloadWippyState()
  const pinia = createPinia()
  pinia.use(createWippyPersist(preloaded))
  app.use(pinia)
  app.use(VueQueryPlugin)
  app.use(PrimeVuePlugin)

  app.provide(HOST_API, host)
  app.provide(AXIOS_INSTANCE, api)
  app.provide(WIPPY_INSTANCE, { on })

  const router = createAppRouter(host, on, initialPath)
  app.use(router)

  return app
}

export async function mountApp(elementId: string = '#app') {
  const app = await createMainApp()
  app.mount(elementId)
  return app
}

mountApp()
```

> `config`, `host`, `api`, and `on` are **synchronous** getters from `@wippy-fe/proxy` — the host injects the child config before the runtime loads, so they resolve the moment your code runs. You never `await` to *obtain* them (the only `await` left is `preloadWippyState()`, an actual async op). Providing them via `app.provide(...)` is an ergonomics choice so the rest of the app can `inject(...)`; a component can equally `import { host, api, on } from '@wippy-fe/proxy'` at its own call site. See [Proxy API](./proxy-api.md).

Rules:
- MUST obtain `config`, `host`, `api`, `on` via `import { ... } from '@wippy-fe/proxy'` (sync getters — no `await` to obtain them; never `window.$W` / `getWippyApi`).
- MUST resolve initial path from `config.context?.route`, then fall back to `'/'`.
- MUST normalize the resolved path to start with `/`.
- MUST `app.provide(HOST_API, ...)`, `app.provide(AXIOS_INSTANCE, ...)`, `app.provide(WIPPY_INSTANCE, ...)`.
- MUST `app.mount('#app')` (or whatever id matches the `<div id>` in app.html).
- MUST register the PrimeVue plugin if you use any PrimeVue component.
- SHOULD register `createWippyPersist(preloaded)` on pinia for state persistence across iframe destructions.
- SHOULD register `VueQueryPlugin` if you use TanStack Query.
- MUST register `config.theming.global?.icons` and `config.theming.global?.iconSets` during bootstrap.
- MUST NOT `console.log` boot diagnostics in production (`console.warn`/`console.error` allowed).

### 3.5 `src/router/index.ts`

Reference: `gold:main/src/router/index.ts`.

**Canonical pattern** — wrap `@wippy-fe/router`'s factory:

```ts
import type { HostApi } from '../types'
import type { Router } from 'vue-router'
import { createAppRouter as createAppRouterFactory } from '@wippy-fe/router'

type OnSubscription = (
  pattern: string,
  callback: (event: { path?: string, message?: unknown }) => void,
) => void

const routes = [
  { path: '/',                       name: 'home',      component: () => import('../pages/home.vue') },
  { path: '/users',                  name: 'users',     component: () => import('../pages/users.vue') },
  { path: '/:pathMatch(.*)*',        name: 'not-found', redirect: '/' },
]

export function createAppRouter(host: HostApi, on: OnSubscription | null, initialPath: string): Router {
  return createAppRouterFactory(routes, {
    host: host as never,
    on: on as never,
    initialPath,
  })
}
```

The factory (`@wippy-fe/router`) encapsulates:
- `createMemoryHistory()` (no arg).
- `if (initialPath) history.replace(initialPath)` BEFORE `createRouter`.
- `setLocalRouter(...)` registration so the link classifier prefers your routes.
- `router.afterEach(to => host.onRouteChanged(to.fullPath, navId))` with echo-loop suppression.
- `on('@history', ({ path, navId }) => ...)` listener with leading-slash normalization.

Rules (apply whether you use the factory or a hand-rolled body):
- MUST use `createMemoryHistory()` — never `createWebHistory` or `createHashHistory`.
- MUST call `history.replace(initialPath)` BEFORE `createRouter` (`incident:2A`).
- MUST register `router.afterEach` that calls `host.onRouteChanged(to.fullPath, navId?)` (`incident:2B`).
- MUST register `on('@history', ...)` listener with null-check on `on` (`incident:2C`).
- MUST guard `!path` inside the `@history` handler.
- MUST normalize leading slash on incoming paths (`incident:2E`).
- MUST include catch-all route `/:pathMatch(.*)*` with `name: 'not-found'`.
- SHOULD use `navId` to suppress the round-trip echo of self-initiated navigation.
- SHOULD call `setLocalRouter(...)` so the host's link classifier can fast-path local routes.

**Use `@wippy-fe/router@^0.0.28` (or later).** That release is the canonical home of the factory body, including `setLocalRouter` registration and the `@history` listener. There is no acceptable reason for a new module to hand-roll this.

### 3.6 `src/constants.ts` and `src/types.ts`

Reference: `gold:main/src/constants.ts`, `gold:main/src/types.ts`.

```ts
// src/constants.ts
import type { InjectionKey } from 'vue'
import type { HostApi, ProxyApiInstance } from './types'

export const HOST_API       = Symbol('host_api') as InjectionKey<HostApi>
export const AXIOS_INSTANCE = Symbol('axios')    as InjectionKey<ProxyApiInstance['api']>
export const WIPPY_INSTANCE = Symbol('proxy')    as InjectionKey<ProxyApiInstance>
```

```ts
// src/types.ts
// HostApi / ProxyApiInstance / AppConfig are not named exports of any @wippy-fe package.
// Derive them at the type level from $W (typeof only — no runtime access to the internal
// global). The $W typings ship with @wippy-fe/types-global-proxy (add it to tsconfig "types").
export type HostApi = Awaited<ReturnType<typeof window.$W.host>>
export type ProxyApiInstance = Awaited<ReturnType<typeof window.$W.instance>>
export type WippyConfig = Awaited<ReturnType<typeof window.$W.config>>
```

Both files are tiny and stable. Copy verbatim into new apps.

### 3.7 Styling

`src/styles.css` — 9-line boilerplate (`gold:main/src/styles.css`):

```css
html, body {
  height: 100%;
  margin: 0;
  background: transparent;
}

#app {
  height: 100%;
}
```

Rules:
- MUST set `background: transparent` so the host's iframe styles win.
- MUST NOT set padding/margin on `html, body, #app`.
- MUST NOT redefine `--p-surface-N`, `--p-content-background`, `--p-text-color`, `--p-primary-color`, etc. at module scope. Host owns them.
- MUST NOT redefine PrimeVue component tokens (`.p-dialog`, `.p-button`, etc.) globally.
- MUST NOT write raw Tailwind color classes (`text-red-500`, `bg-green-100`, etc.) for colors that have semantic meaning. Use severity classes (`text-danger-500`, `bg-success-100`) instead. (`docs:theming.md`)
- DO put per-app theming in YAML `meta.config_overrides` (or the package.json `wippy.configOverrides` mirror) — not in source CSS.

`src/tailwind.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`tailwind.config.ts` (`gold:main/tailwind.config.ts`):
```ts
import themePreset from '@wippy-fe/theme/tailwind.config'

export default {
  presets: [themePreset],
  content: ['./src/**/*.{vue,ts}', './app.html'],
}
```

Note: `themePreset` is a **default import**, not a named import.

`postcss.config.js` (CRITICAL):
```js
module.exports = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}
```

### 3.8 Vue / TypeScript hygiene

Reference: `gold:main/tsconfig.json`.

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client", "@wippy-fe/types-global-proxy"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "vite.config.ts"]
}
```

Rules:
- MUST `target: "ES2020"` (canonical). `lib` MUST include `"ES2020"`, `"DOM"`, `"DOM.Iterable"`. ES2022+ is allowed but ES2020 is the gold-standard floor.
- MUST `module: "ESNext"`, `moduleResolution: "bundler"`, `strict: true`, `noEmit: true`.
- MUST include `vite/client` and `@wippy-fe/types-global-proxy` in `types`.
- MUST include `src/**/*.ts`, `src/**/*.vue`, and `vite.config.ts` in `include`.
- ALL `.vue` files MUST use `<script setup lang="ts">` at the top. Place the `<script setup>` block before `<template>`.
- MUST type props with TS interface or generic: `defineProps<{ foo: string }>()`. Untyped object syntax is REJECT.
- MUST use Composition API. Use `ref` over `reactive` where the semantics are equivalent.
- Use `computed` properties for derived state; prefer early returns to reduce nesting.
- File names SHOULD be kebab-case.
- MUST avoid `any`; prefer `unknown` + guards. Each retained `any` MUST have a justifying comment. Aim ≤ 50 across an entire app.
- `pages/<x>.vue` MUST be lazy-loaded in router: `() => import('../pages/x.vue')`.
- MUST NOT use `console.log` in production code. `console.warn` and `console.error` are allowed for error reporting.
- `npm run type-check` MUST exit 0.
- Tests SHOULD exist for non-trivial logic and MUST pass.
- Handle all states in UI components: loading, error, empty, success.
- Prefix event handlers with `handle` (e.g., `handleClick`, `handleSubmit`).

### 3.9 Subscription cleanup (the leak avoidance pattern)

`instance.on(pattern, cb)` returns an unsubscribe function. ALWAYS store it. ALWAYS call it in `onUnmounted`. (`incident:3A-3I`, `kb:subscription-cleanup`.)

Canonical pattern:
```ts
import { onMounted, onUnmounted, inject } from 'vue'
import { WIPPY_INSTANCE } from '../constants'

const instance = inject(WIPPY_INSTANCE)!

let unsub: (() => void) | null = null
onMounted(() => {
  unsub = instance.on('keeper.task', () => load())
})
onUnmounted(() => {
  unsub?.()
})
```

For multiple subscriptions:
```ts
let unsubs: Array<() => void> = []
onMounted(() => {
  unsubs.push(instance.on('keeper.session:message', onMessage))
  unsubs.push(instance.on('keeper.session:status',  onStatus))
})
onUnmounted(() => {
  unsubs.forEach(u => u?.())
  unsubs = []
})
```

Anti-patterns (REJECT):
- `instance.on(...)` at module top-level (outside `onMounted`) — leaks for app lifetime (`incident:3A`).
- `instance.on(...)` with return value discarded — silent leak (`incident:3B-3G`).
- `instance.off(...)` — that method does NOT exist; `// @ts-ignore` won't save you (`incident:3D`).
- Loop-creating subscriptions without storing all unsubs (`incident:3C`).
- `window.addEventListener('message', ...)` without matching `removeEventListener` in `onUnmounted` (`incident:3I`).
- Raw `new EventSource(...)` — bypasses host auth bridge; use `instance.on(...)` for an equivalent server-side topic (`incident:3J`).
- `window.addEventListener('error' | 'unhandledrejection', ...)` / `window.onerror` — installing **window-global error handlers**. The host owns global error capture (the host shell's error handler + the iframe proxy's `errorCapture` injection); a child app or web component adding its own duplicates them. This bites web components especially: multiple instances share one realm, so a single error fires every instance's handler → doubled error reporting and toasts. For your own reporting use `instance.logger.captureException(...)`; for component-scoped failures use Vue's `onErrorCaptured`. **MUST NOT** install global `error`/`unhandledrejection` handlers from a WC.

---

## 4. Web components — manifest, build, runtime

### 4.1 `package.json`

Reference: `gold:mermaid/package.json`.

```json
{
  "name": "@example/mermaid",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "title": "Mermaid Diagram",
  "description": "...",
  "browser": "dist/index.js",
  "files": ["dist/", "src/", "package.json"],
  "dependencies": {
    "@wippy-fe/theme": "^0.0.28",
    "@wippy-fe/webcomponent-core": "^0.0.28",
    "@wippy-fe/webcomponent-vue": "^0.0.28",
    "mermaid": "^11"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "@wippy-fe/proxy": "^0.0.28",
    "@wippy-fe/vite-plugin": "^0.0.32",
    "typescript": "^5.0.0",
    "vite": "^6.0.0",
    "vue": "^3.5.0",
    "vue-tsc": "^2.0.0"
  },
  "peerDependencies": {
    "@wippy-fe/proxy": "^0.0.28",
    "vue": "^3.5.0"
  },
  "wippy": {
    "tagName": "example-mermaid",
    "type": "widget",
    "description": "...",
    "props": {
      "type": "object",
      "properties": {
        "definition": { "type": "string", "default": "", "description": "..." },
        "transparent": { "type": "boolean", "default": true, "description": "..." }
      }
    },
    "scripts": {
      "build": "build",
      "debug": "build:debug",
      "test": "lint"
    }
  },
  "scripts": {
    "build": "vite build",
    "build:debug": "vite build --mode development",
    "dev": "vite build --watch",
    "lint": "eslint src --ext .ts,.vue",
    "lint:fix": "eslint src --ext .ts,.vue --fix"
  }
}
```

**Specification & metadata**:
- MUST `"specification": "wippy-component-1.0"`.
- MUST `name` follow `@<org>/<short>` (e.g. `@example/mermaid`).
- MUST set top-level `"title"` and `"description"`.
- MUST set `"browser": "dist/index.js"` pointing at the built entry.
- MUST list `dist/`, `src/`, `package.json` in `files`.

**`wippy` block (WC-specific)**:
- MUST `wippy.type: "widget"` OR `"component"` (NOT `"page"` or `"web-component"`).
- MUST `wippy.tagName` (camelCase) — the custom element tag. Must contain a hyphen.
- MUST `wippy.description` — a **verbose AI/human-readable usage explanation** (not a one-line label). Must explain HOW to use the WC: the expected call shape (which props vs children), supported input forms, fallback paths, notable perf characteristics.
- MUST `wippy.props` JSON Schema. Every property MUST have `type`, `default`, `description`.
- MAY `wippy.events` JSON Schema (omit if no custom events).
- MUST NOT have `wippy.path` (no HTML entry).
- MUST NOT have `wippy.icon` (no nav presence).
- MUST NOT have `wippy.proxy` block (WCs run in host doc, not iframe).
- MUST set `wippy.scripts.build`. MAY set `debug` and `test`.

**Dependency hygiene**:
- `dependencies`: bundled-into-WC packages. Canonical: `@wippy-fe/theme`, `@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue`. Plus the WC's domain libs (e.g. `mermaid`, `chart.js`).
- `devDependencies`: build toolchain. Canonical: `vite`, `@vitejs/plugin-vue`, `typescript`, `vue-tsc`, `vue` for build-time, `eslint*`, `@wippy-fe/proxy` (build-time type imports).
- `peerDependencies`: only what the host's import map provides at runtime. Canonical minimum: `@wippy-fe/proxy`, `vue`. Add `pinia` and `@iconify/vue` if used.

### 4.2 `vite.config.ts` (web component, library mode)

Reference: `gold:mermaid/vite.config.ts`.

```ts
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue(), wippyComponentPlugin()],
  build: {
    target: 'esnext',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MermaidDiagram',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      input: { index: resolve(__dirname, 'src/index.ts') },
      external: [
        'vue',
        'pinia',
        '@iconify/vue',
        '@wippy-fe/proxy',
      ],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash][extname]',
      },
      // preserveEntrySignatures: false ensures define(import.meta.url, …) stays in
      // the entry chunk — required so the ?declare-tag= query the host appends reaches
      // import.meta.url and registration doesn't silently no-op.
      preserveEntrySignatures: false,
    },
    sourcemap: true,
  },
})
```

Rules:
- MUST set `build.target: 'esnext'`.
- MUST use `build.lib` library mode with `formats: ['es']` (ESM only).
- MUST set `entry` (and `input.index`) to your `src/index.ts`.
- MUST set `preserveEntrySignatures: false`.
- MUST set entry/chunk/asset file names: `[name].js`, `[name]-[hash].js`, `[name]-[hash][extname]`.
- MUST include `wippyComponentPlugin()` from `@wippy-fe/vite-plugin` in `plugins` so the build emits `dist/wippy-meta.json` (see [§9.3a](#93a-wippycomponentplugin-web-components)).
- MUST externalize what the host provides: `vue`, `pinia`, `@iconify/vue`, `@wippy-fe/proxy`.
- MUST **bundle** (NOT externalize) `@wippy-fe/theme`, `@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue`, `@wippy-fe/pinia-persist` (if used), and your domain libs.
- DO NOT set `base` (no HTML entry, base is irrelevant).
- DO NOT set `cssCodeSplit` (CSS is `?inline`-imported into the JS, see §4.3).

### 4.3 `src/index.ts` (entry)

Reference: `gold:mermaid/src/index.ts`.

```ts
import { WippyVueElement, define } from '@wippy-fe/webcomponent-vue'
import type { WippyElementConfig, WippyPropsSchema } from '@wippy-fe/webcomponent-vue'
import type { ComponentProps } from './types.ts'
import type { Events } from './constants.ts'
import MermaidDiagram from './app/mermaid-diagram.vue'
import stylesText from './styles.css?inline'
import pkg from '../package.json'

class MermaidElement extends WippyVueElement<ComponentProps, Events> {
  static get wippyConfig(): WippyElementConfig<ComponentProps> {
    return {
      propsSchema: pkg.wippy.props as WippyPropsSchema,
      hostCssKeys: ['themeConfigUrl'] as const,
      inlineCss: stylesText,
      contentTemplate: 'text/vnd.mermaid',  // optional; reads text from a child <template data-type="text/vnd.mermaid"> element
    }
  }

  static get vueConfig() {
    return {
      rootComponent: MermaidDiagram,
    }
  }
}

export async function webComponent() {
  return MermaidElement
}

define(import.meta.url, MermaidElement)
```

Rules:
- MUST extend `WippyVueElement<ComponentProps, Events>` (Vue) or `WippyElement` (vanilla).
- MUST implement `static get wippyConfig()` returning:
  - `propsSchema: pkg.wippy.props as WippyPropsSchema` — single source of truth from package.json.
  - `hostCssKeys: [...]` — which host-provided CSS bundles to inject into the shadow root. Use the const names from `@wippy-fe/webcomponent-core`: `themeConfigUrl` (theme tokens), `iframeCssUrl` (layout), `primeVueCssUrl` (PrimeVue components), `markdownCssUrl` (markdown). Pick the minimal set you need. (`preflightCssUrl` is **not** a member of the `HostCssKey` union — Tailwind v3 preflight is reachable only imperatively via `loadCss(hostCss.preflightCssUrl)`.)
  - `inlineCss: stylesText` — your WC-specific CSS imported via `?inline`.
  - `contentTemplate?: 'text/vnd.foo'` — optional MIME type; when set, the WC reads text from a child `<template data-type="<mime>">` element, e.g. `<example-mermaid><template data-type="text/vnd.mermaid">graph TD; A --> B</template></example-mermaid>` (rare).
- MUST implement `static get vueConfig()` returning `{ rootComponent }`. Add `plugins: [PrimeVuePlugin, ...]` if you use PrimeVue components.
- MUST export async `webComponent()` factory function so the host loader can call it.
- MUST `define(import.meta.url, ElementClass)` at module level.

### 4.4 Theme compatibility

- WC root element MUST NOT have padding or margin. Host controls outer spacing.
- WC MUST use semantic CSS vars for theme-dependent colors: `--p-text-color`, `--p-content-background`, `--p-content-border-color`, `--p-text-muted-color`, `--p-content-hover-background`, `--p-primary-color`.
- WC MUST NOT use raw `--p-surface-N` for theme-dependent purposes — that scale is fixed.
- For derived shades, use `color-mix(in srgb, var(--semantic) X%, transparent)`.
- For severity colors, use `--p-danger-*`, `--p-success-*`, `--p-warn-*`, `--p-info-*`, `--p-help-*`, `--p-accent-*` — never raw Tailwind color names.
- Use `<Icon icon="tabler:icon-name" />` from `@iconify/vue` for all icons — never inline `<svg>` for reusable iconography.
- Use semantic HTML elements where possible; include proper ARIA roles and attributes on interactive elements.

### 4.5 `src/styles.css`

```css
@import "@wippy-fe/theme/theme-config.css";

.my-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}
```

The `?inline` import in `index.ts` reads this file as a string and bakes it into the bundle. Combined with `hostCssKeys`, the shadow root gets host CSS + your WC-specific CSS.

### 4.6 `src/constants.ts` (events typing)

Reference: `gold:mermaid/src/constants.ts`.

```ts
import { useProps, useEvents, usePropsErrors } from '@wippy-fe/webcomponent-vue'
import type { ComponentProps } from './types.ts'

export interface Events {
  load: undefined
  unload: undefined
  error: { message: string, error: unknown }
  invalid: { message: string }
}

export const useComponentProps = () => useProps<ComponentProps>()
export const useComponentEvents = () => useEvents<Events>()
export const useComponentPropsErrors = usePropsErrors
```

Use `useComponentProps()` and `useComponentEvents()` in your Vue components instead of plain `defineProps` / `defineEmits` — they integrate with the WC's prop/event marshalling.

### 4.7 `tsconfig.json` (WC variant)

Reference: `gold:mermaid/tsconfig.json`.

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vite/client", "@wippy-fe/proxy"],
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*.ts", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Differences vs micro frontend apps:
- `types` uses `@wippy-fe/proxy` (not `@wippy-fe/types-global-proxy`).
- Adds `useDefineForClassFields`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `allowImportingTsExtensions`.
- `references` to a `tsconfig.node.json`.

### 4.8 Runtime caching / state persistence

For state that must survive WC unmount or iframe destruction, use `@wippy-fe/pinia-persist`:
- `persist-key` prop values MUST be globally unique across the app.
- `@wippy-fe/pinia-persist` MUST be **bundled** into the WC (NOT external).

---

## 5. Theming

### 5.0 Visual-matching escalation (HEAVILY recommended)

To match a visual design, escalate in this strict order. Do not skip ahead — most "I want it to look like X" work fits at level 1 or 2.

| Level | What | Where |
|---|---|---|
| **1 — CSS variables** | Override existing `--p-*` semantic vars (primary/content/text/severity) and override the surface scale if the brand needs a different neutral palette. Use Playwright + DevTools `getComputedStyle(document.documentElement)` to enumerate every `--p-*` already defined; pick from that menu first. | Facade `theming.global` / `theming.children`, or per-page `config_overrides.customization.cssVariables` for isolation. NEVER `:root` in `.css` files. |
| **2 — `customCSS` for PrimeVue components** | Add design-token overrides (`--p-button-border-radius`, `--p-dialog-shadow`, etc.) and selector tweaks (`.p-button.p-button-xs { … }`, `.p-accordionheader::before { … }`) when level 1 vars don't reach. | Facade `theming.global` / `theming.children`, or per-page `config_overrides.customization.customCSS`. NEVER raw `.p-*` rules in `.css` files. |
| **3 — Custom Vue components** | Build your own component. Reserved for things PrimeVue genuinely doesn't offer: novel visualizations (force graph, custom chart), domain-specific layouts, interactions outside PrimeVue's catalog. | Vue source in your app. |

**REJECT level-3 work that could have been done at level 1 or 2.** Examples of "should have been level 1/2":
- Custom dropdown when `<Select>` exists.
- Custom modal when `<Dialog>` + `useDialog` exists.
- Custom toast when `<Toast>` + `useToast` exists (or `host.toast()`).
- Custom confirm prompt when `<ConfirmDialog>` + `useConfirm` exists (or `host.confirm()`).
- Custom tooltip when the `v-tooltip` directive exists.
- Custom inline button styled to look like a primary button when a styled `<Button>` exists.

Examples where level 3 IS legitimate:
- Force graph for dataflow visualization (no PrimeVue equivalent).
- Token-bar charts (Chart.js wrapper).
- Markdown/rich-text renderers (markdown-it / shiki wrappers).
- Code editor (Monaco WC).
- Domain-specific shell components in managed-layout panels.

### 5.1 Facade-first: the main way to theme a Wippy app

A Wippy module composes itself from `ns.dependency` entries. **One of those is `wippy/facade`** — the dependency that parameterises the host shell (top bar, nav, login page, layout) and ALL the global theming. The facade is where the main customization lives.

**Set theming on the facade dependency, not on individual pages.** Parameters of interest:

| `wippy/facade` parameter | Purpose |
|---|---|
| `app_title`, `app_name`, `app_icon` | brand identity |
| `custom_css` | global CSS — reaches the host chrome, `view.page` iframes, and `view.component` shadow roots (1.0.43+). Where 95%+ of your styling lives. |
| `css_variables` | JSON map of CSS variable overrides (`--p-primary`, `--p-surface-*`, brand-specific `--k-*` tokens, etc.); custom properties inherit into every surface, shadow roots included. |
| `host_custom_css` | host-chrome-only CSS (not delivered to children — scope class rules to `.wippy-host-app`). Use `children_custom_css` for CSS that should reach `view.page` iframes and `view.component` shadow roots but not the host chrome. |
| `hide_nav_bar`, `show_admin`, `history_mode`, `session_type`, `login_path` | UX shell behaviour |
| `fe_mode`, `host_config_layout` | managed-layout mode + layout declaration |

### 5.1.1 Three levels of override (priority, low → high)

1. **Facade global** — set in the host's `wippy/facade` `ns.dependency` parameters. Affects the whole user shell + every page inheriting from the facade. **This is where 95%+ of theming should live.**
2. **Page configOverrides** — YAML registry entry's `meta.config_overrides` (canonical) AND/OR `package.json` `wippy.configOverrides` (host-less mirror). For `cssVariables`/`customCSS` this **replaces** the inherited theme for the page and **cascades to its nested sub-tree** (see §2.3). For `icons`/`iconSets` it is the canonical additive registration path.
3. **Runtime overlay** — `window.__WIPPY_CONFIG_OVERRIDES__` set BEFORE proxy.js loads. Rare; for query-string or feature-flag theming.

See [theming.md](./theming.md) for the full three-level guide with examples, escalation criteria, and anti-patterns.

### 5.1.2 Where each override lives — STRICT placement rule

Mismatched placement is the #1 source of theme drift. The rule:

| Override target | Where it goes | Where it MUST NOT go |
|---|---|---|
| Existing host var (`--p-*`) — change its value | Facade theming, or `config_overrides.customization.cssVariables` for per-page isolation | NEVER `:root { --p-* }` in `src/styles.css` |
| New derived var your project owns — needed for project use | Same place as above; compute via `color-mix()` or `var()` referencing host vars | NEVER `:root { --my-* }` in `src/styles.css` |
| HOST-owned selector override (`.p-button`, `.p-dialog`, `.p-inputtext`, etc.) | Facade theming, or `config_overrides.customization.customCSS` for per-page isolation | NEVER raw `.p-*` rules in `src/styles.css` |
| Project-internal class override (`.keeper-nav-btn`, `.search-wrap`) | `src/styles.css` (or facade theming if it must reach the host shell) | n/a |
| Project-scoped non-theme constant (chart bar color, fixed spacing tag) | `src/styles.css` with a clear project prefix (e.g., `--keeper-chart-bar-*`) | n/a |

**Rationale**: theme is a host concern; the host's CSS pipeline composes facade global + per-page customization in a defined order. CSS files inside the bundle ship AFTER the host's pipeline and shadow it, breaking the override semantics.

**REJECT 42b**: any `:root { --p-* }` (or `:root { --<other-host-var> }`) redefinition in a child app's `.css` file. Move to facade theming or per-page `config_overrides.customization.cssVariables`.

**REJECT 43a**: any raw `.p-<component>` rule in a child app's `.css` file. Move to facade theming or per-page `config_overrides.customization.customCSS`.

### 5.2 Semantic vs fixed CSS variables

| Variable | Flips in dark mode? | Use for |
|---|---|---|
| `--p-text-color` | yes | body text |
| `--p-content-background` | yes | container / page background |
| `--p-content-border-color` | yes | borders |
| `--p-text-muted-color` | yes | secondary text |
| `--p-content-hover-background` | yes | hover states |
| `--p-primary-color` | yes | primary action color |
| `--p-surface-0` … `--p-surface-950` | NO (fixed scale) | only as anchors for color-mix(); avoid for theme-dependent UI |
| `--p-primary-500` … `--p-primary-950` | NO (fixed scale) | only when you need a specific primary shade |
| `--p-danger-color`, `--p-success-color`, `--p-warn-color`, `--p-info-color`, `--p-help-color`, `--p-accent-color` | yes | severity colors. Use these, NOT raw Tailwind names. |

Anti-pattern (REJECT):
```css
.card { background: var(--p-surface-100); }   /* fixed; doesn't flip */
.card { background: var(--p-primary); }       /* invalid token; --p-primary-color is the right one */
```

Canonical:
```css
.card {
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  color: var(--p-text-color);
}
.muted-card {
  background: color-mix(in srgb, var(--p-content-background) 92%, var(--p-text-color) 8%);
}
.danger-banner { background: var(--p-danger-color); }
```

### 5.3 REPLACE vs MERGE per field

| Field in `customization` | Per-page semantics |
|---|---|
| `cssVariables` | REPLACE — your map fully replaces parent's |
| `customCSS` | REPLACE — your string fully replaces parent's |
| `icons` | MERGE shallow — additive |
| `iconSets` | MERGE per-prefix — additive |

`AppConfigOverrides` top-level:

| Field | Semantics |
|---|---|
| `customization` | merged via `mergeChildCustomization` (above) |
| `axiosDefaults` | MERGE shallow |
| `routePrefix` | REPLACE |
| `apiRoutes` | REPLACE |

### 5.4 `@light` / `@dark` blocks

The host SUPPORTS `@light` and `@dark` keys in `cssVariables` maps — they compile to `@media (prefers-color-scheme: light/dark) { :root { ... } }` blocks ONLY. They are NOT a `[data-theme]` attribute and do not emit any attribute-scoped selector at injection time — binding is solely on the OS color-scheme preference (see `createCssVariables` in `src/shared/util/createStyle.ts`).

Example:
```yaml
cssVariables:
  --p-primary-color: var(--p-primary-500)
  --kp-bg: var(--p-content-background)
  '@light':
    --p-content-background: '#ffffff'
    --p-text-color: '#18181b'
  '@dark':
    --p-content-background: '#1c1a19'
    --p-text-color: '#fafafa'
```

An app that toggles themes via `document.documentElement.setAttribute('data-theme', ...)` will NOT trigger these overrides; the host injects no `[data-theme]` CSS. To support a manual toggle, document it as a project-specific extension and emit your own `[data-theme]`-scoped variable block. See also [micro-frontend-app-theming.md](./micro-frontend-app-theming.md) and [host-less-mode.md](./host-less-mode.md).

### 5.5 `customCSS` scoping

- For host-wide `customCSS`, rules MUST be scoped to `.wippy-host-app` (or your specific page selector) so they don't leak into child iframes.
- For per-page overrides, the host already scopes them; you can write top-level selectors.

### 5.6 Iconify discipline

Icons in Wippy apps follow a single workflow:

1. **Use `@iconify/vue` `<Icon>` for ALL icons.** Don't inline `<svg>` for reusable iconography. Don't ship icon-font CSS (Tabler-icons-font, Material Icons font). The proxy and the build assume Iconify; mixing systems creates a/b drift.
2. **Prefer permissive packs.** All free for commercial use, all available via Iconify:
   - `tabler` (MIT, ~5,400 icons) — broad UI coverage; the gold-standard default for keeper-class apps.
   - `lucide` (ISC, ~1,500 icons) — clean line style.
   - `phosphor` (MIT, ~7,000 icons) — six weight variants.
   - `material-symbols` (Apache 2.0, ~3,000+ icons) — Google's modern set.
   - `mdi` (Apache 2.0, ~7,000 icons) — Material Design Icons community pack.
   - `heroicons` (MIT, ~300 icons) — Tailwind team's set, outline + solid.
3. **Don't use commercial-licensed packs** (FontAwesome Pro, etc.) without licence verification per developer seat. Iconify hosts MIT/CC-BY subsets of FontAwesome (`fa6-solid`/`fa6-regular`/`fa6-brands`) — use those instead.
4. **Custom icons** — when no permissive pack covers a symbol:
   - Declare them in `theming.global.icons` / `iconSets` when shared, or `config_overrides.customization.icons` for per-page additions — safe because `icons` MERGES, not replaces.
   - The bootstrap path (`config.theming.global?.icons → addCollection({ prefix: 'custom', icons })` plus `iconSets`) wires them automatically.
   - **NEVER call `addCollection()` from arbitrary application code.** The bootstrap path is canonical; everything else fragments the registry.
   - Mint custom icons sparingly. If you find yourself adding more than a dozen, consider whether a permissive pack already has the symbol.
5. **At call sites**, prefer `<Icon icon="tabler:home" />` over hardcoded SVG. Use Iconify's pack:name format consistently. Use `aria-hidden="true"` for decorative icons, `aria-label` for meaningful ones.

REJECT (5.6.r): any `.vue` file that registers icons via `addCollection()` outside `app.ts`'s canonical bootstrap. REJECT raw `<svg>` for reusable iconography (one-off illustrations are OK).

---

## 6. Proxy API & subscriptions

### 6.1 Injection keys (apps)

In `src/constants.ts` (micro frontend apps):

| Key | Provides | Use |
|---|---|---|
| `HOST_API` | `HostApi` | `inject(HOST_API)` |
| `WIPPY_INSTANCE` | `ProxyApiInstance` | `inject(WIPPY_INSTANCE)` |
| `AXIOS_INSTANCE` | pre-configured `axios` (auth + baseURL) | `inject(AXIOS_INSTANCE)` |

For web components, import from `@wippy-fe/proxy` directly:
```ts
import { host, api, on } from '@wippy-fe/proxy'
```

### 6.2 `host.*` methods (full reference: Appendix B)

| Method | Use |
|---|---|
| `host.toast` | replaces PrimeVue ToastService |
| `host.confirm` | replaces `window.confirm` |
| `host.startChat` | open a new chat |
| `host.openSession` | navigate to session |
| `host.openArtifact` | open artifact |
| `host.setContext` | set chat context |
| `host.navigate` | host-side navigation |
| `host.onRouteChanged` | report router change |
| `host.handleError` | report error |
| `host.formatUrl` | prepend `routePrefix` |
| `host.classifyLink` | classify nav target |
| `host.layout` | managed-layout API (always present; `host.layout.snapshot` is null outside managed mode) |
| `host.logout` | sign out |

Rules:
- MUST use `host.toast` not PrimeVue ToastService.
- MUST use `host.confirm` not `window.confirm`.
- MUST use injected `useApi()` / `AXIOS_INSTANCE` not raw `axios.create()`.
- MUST NOT call `sendIframeMessage()` directly — go through `host.*` methods.

**VERIFY**:
```bash
grep -r "axios.create" src/    # should = 0
grep -r "window.confirm" src/  # should = 0
```

### 6.3 `instance.on(pattern, cb)` reserved patterns

| Pattern | Payload | Meaning |
|---|---|---|
| `@history` | `{ path?, navId? }` | host pushed a route |
| `@visibility` | boolean | iframe visibility changed |
| `@layout-change` | `LayoutSnapshot` | layout tree changed |
| `@layout-panel-changed` | `{ panelId, ... }` | single panel changed |
| `@layout-breakpoint` | `{ name, width }` | breakpoint changed (`name` = new breakpoint, `width` = threshold px) |
| `@message` | wildcard | catch all WebSocket messages |
| `@state-error` | `{ error, key }` | state save failed |

Custom topics use colon-separated parts; `*` is wildcard.

### 6.4 Layout API

`host.layout` is always present (a `LayoutApi` object). Outside managed-layout mode, `host.layout.snapshot` is `null` and all mutation/bus calls are silent no-ops — gate on `host.layout.snapshot` (or `isManaged` from `useWippyLayout`) before mutating, not a null-check on `host.layout`.

---

## 7. Router & host integration

(Source body in §3.5; this section is verification-focused.)

| # | Rule | REJECT? |
|---|---|---|
| 7-1 | `createMemoryHistory()` (no arg) | yes |
| 7-2 | `history.replace(initialPath)` BEFORE `createRouter` | yes |
| 7-3 | `router.afterEach(to => host.onRouteChanged(to.fullPath, navId?))` | yes |
| 7-4 | `on('@history', ...)` listener with null guard | yes |
| 7-5 | catch-all `/:pathMatch(.*)*` route with `name: 'not-found'` | yes |
| 7-6 | initial path = `config.context?.route ?? '/'`, normalized | yes |
| 7-7 | leading-slash normalization in `@history` handler | yes |
| 7-8 | echo-loop suppression via `navId` token | should |
| 7-9 | `setLocalRouter(...)` registration for link classifier | should |

If you persist last-route to localStorage, EXCLUDE ID-bearing routes (`/session/:id`, `/changes/:id`, etc.) — reload-after-delete lands on stale 404s otherwise (`incident:2H`).

`window.addEventListener('message', ...)` for cross-iframe messaging: MUST add `if (event.source !== window.parent) return` origin check and `removeEventListener` in `onUnmounted`.

---

## 8. Build pipeline & Makefile

### 8.1 Canonical Makefile recipe

```make
build-<app>-frontend:
	cd <path-to-app> && npm install --no-audit --no-fund --prefer-offline && npm run build -- --outDir <dest> --emptyOutDir
```

Rules:
- MUST use `npm run build -- --outDir <abs-or-relative> --emptyOutDir`.
- MUST NOT use the `rm + mkdir + cp` dance — pollutes source tree with `dist/` and is not atomic.
- MUST `cd` into the app dir.
- Output dir MUST be relative to `static/<embed-name>` (or wherever the wippy.yaml `embed:` paths expect).

Each module that publishes a frontend MUST have its own `build-<app>-frontend` target. Add to `publish-*` chains.

### 8.2 `make.bat` + `make.ps1` are required (every module, every time)

Every module that ships a `Makefile` MUST also ship `make.bat` + `make.ps1` next to it. **No "if your team runs on Windows" carve-out** — Wippy modules are written by mixed teams and audited on mixed machines, and the wrapper is small enough that there is no reason not to have it.

- `make.bat` is a thin shim that invokes `make.ps1` via `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass`.
- `make.ps1` mirrors every Makefile target one-for-one — `build-*`, `lint*`, `publish*`, `dev`, `clean`, etc. — so the same workflow runs on Linux, macOS, and Windows.
- Keep `make.ps1` pure ASCII (no em-dashes, smart quotes) — Windows PowerShell 5.1 reads BOM-less files as Windows-1252 and corrupts non-ASCII chars on read.

REJECT a module that ships `Makefile` without matching `make.bat` + `make.ps1`.

### 8.3 Externals + importmap + peerDeps three-way sync

Three lists must coexist:
- `vite.config.ts` `external:` array (what NOT to bundle)
- `app.html` `<script type="importmap">` keys (host-less resolution)
- `package.json` `peerDependencies` (npm install hint)

Rule: every package the app actually imports at runtime MUST be resolvable via the importmap (or by the host's runtime importmap, when running under a real host).

Mismatch symptom: `Failed to resolve module specifier 'pinia'` (`incident:8A`).

**VERIFY**:
```bash
grep -A 25 "external:" vite.config.ts | grep -oE "'[^']+'" | tr -d "'" | sort -u > /tmp/ext
node -e 'const fs=require("fs");const m=fs.readFileSync("app.html","utf8").match(/<script type="importmap">([\s\S]+?)<\/script>/);console.log(Object.keys(JSON.parse(m[1]).imports).join("\n"))' | sort -u > /tmp/imp
diff /tmp/ext /tmp/imp  # may show divergences (host's runtime importmap may add more); investigate each line
```

### 8.4 Pre-publish gates

- `npm run type-check` MUST exit 0.
- `npm test` MUST pass if any tests exist.
- `npm run build` MUST succeed.
- `npm run lint` SHOULD exit 0 if you have eslint configured.

---

## 9. Host-less mode

Host-less = boot the SPA via a static HTTP server with no real Wippy host running. `dev-proxy.js` provides a host shim plus a "dev overlay" UI for accepting/editing the config. Host-less mode is the **default supported workflow** for new apps; the `wippyPagePlugin()` and importmap+`<wippy-loading>` patterns described below should be present unless a team has a very good reason to opt out (rare). (See [host-less-mode.md](./host-less-mode.md) for full detail.)

### 9.1 Importmap (esm.sh)

```html
<script type="importmap">
{
  "imports": {
    "vue":          "https://esm.sh/vue@3",
    "pinia":        "https://esm.sh/pinia",
    "vue-router":   "https://esm.sh/vue-router@4",
    "luxon":        "https://esm.sh/luxon",
    "@iconify/vue": "https://esm.sh/@iconify/vue",
    "axios":        "https://esm.sh/axios"
  }
}
</script>
```

Rules:
- MUST exist in `app.html`.
- MUST cover every package the app imports at runtime.
- SHOULD use `esm.sh` URLs with major version pin (`@3`, `@4`).
- MUST NOT include `@wippy-fe/proxy` — the real host or dev-proxy injects it.

### 9.2 dev-proxy.js + `@wippy/scripts` data-role

```html
<script
  src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"
  data-role="@wippy/scripts"
></script>
```

Production CDN form:
```html
<script
  src="https://web-host.wippy.ai/<release-tag>/dev-proxy.js"
  data-role="@wippy/scripts"
></script>
```

Rules:
- MUST have `data-role="@wippy/scripts"` so the host (when running) can find and replace it.
- MUST have `src=` set; raw `<script data-role="@wippy/scripts"></script>` placeholder is acceptable only when a real host injects the src at boot.

### 9.3 wippyPagePlugin (default)

```ts
// vite.config.ts
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'

export default defineConfig({
  plugins: [vue(), wippyPagePlugin(), /* … */],
  /* … */
})
```

The plugin's `transformIndexHtml` hook injects the package.json `wippy` block into the built HTML at the top of `<head>`:

```html
<script type="application/json" data-role="@wippy/package">
{
  "name": "...",
  "wippy": { "proxy": { "injections": { ... } }, "configOverrides": { ... } }
}
</script>
```

Dev-proxy reads the JSON synchronously at boot and seeds:
- proxy injection defaults from `wippy.proxy.injections`
- per-page customization from `wippy.configOverrides.customization`

so the dev-overlay shows the correct values pre-populated.

Rules:
- SHOULD include `wippyPagePlugin()` in `vite.config.ts`. This is the **default** for new apps; opt out only with a very good reason (e.g. shipping a host-only bundle that explicitly does not support host-less dev), and document the reason in your project's CLAUDE.md.
- MUST install `@wippy-fe/vite-plugin@^0.0.32` or later in devDependencies. The `0.0.32` release adds **strict build-time validation** — bad `package.json` shape FAILS the build with an actionable error.
- The plugin is harmless under a real host (the host ignores the `@wippy/package` script tag).

**VERIFY** the script is in the built HTML:
```bash
npm run build && grep -c 'data-role="@wippy/package"' dist/app.html  # SHOULD = 1
```

### 9.3a wippyComponentPlugin (web components)

`view.component` packages have no HTML entry to inject into, so the page plugin doesn't apply. Use `wippyComponentPlugin()` from the same `@wippy-fe/vite-plugin` package — it's emit-only:

```ts
// vite.config.ts (web component)
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'

export default defineConfig({
  plugins: [vue(), wippyComponentPlugin(), /* … */],
  /* … */
})
```

The component plugin emits `dist/wippy-meta.json` (the resolved `wippy` block) only — no HTML transform, no inline script tag.

Rules:
- MUST be present in every `view.component` build that ships against `wippy/views ≥ 0.5.0`.
- MUST install `@wippy-fe/vite-plugin@^0.0.32` or later in devDependencies.

**VERIFY** the meta file is in the dist:
```bash
npm run build && test -f dist/wippy-meta.json && echo "OK: wippy-meta emitted" || echo "MISSING: wippy-meta.json"
```

### 9.3b The `wippy-meta.json` contract + version correlation

The presence of `dist/wippy-meta.json` next to the served entry is a **hard requirement** for `wippy/views ≥ 0.5.0`. The file is the resolved `wippy` block from `package.json` as a single JSON object — with every `"file://<rel>"` string replaced by the referenced file's UTF-8 contents at build time.

Two endpoints read it:

| Endpoint | What it serves |
|---|---|
| `GET /api/public/pages/content/{id}` | resolved `wippy-meta.json` next to the served `app.html` (view.page) |
| `GET /api/public/components/list` + `/components/by-tag/{tag}` | resolved `wippy-meta.json` next to each `index.js` (view.component). `{tag}` is the WC's custom-element tag name (e.g. `example-mermaid`), resolved via `loadByTagName()` — not the CDN git release tag. |

**YAML-first priority**: the operator's `_index.yaml` registry entry overlays the bundled meta per-field. If `meta.tag_name`, `meta.title`, `meta.description`, `meta.props`, `meta.events`, or `meta.entry_point` is set in YAML, that wins. Otherwise the bundled meta fills in.

**Fallback when missing**: if `wippy-meta.json` is absent next to the entry, views falls back to a deprecated YAML-synthesis path AND emits a per-process deprecation warning. Treat the warning as a release-blocker.

#### Version correlation table

| `wippy/views` (BE module) | `@wippy-fe/vite-plugin` (FE plugin) | Contract |
|---|---|---|
| `< 0.4.32` | `< 0.0.31` | Legacy YAML-synthesis only. `wippy-meta.json` not consumed even if present. |
| `0.4.32` | `0.0.31` (transitional) | Plugin emits `wippy-meta.json`; views still synthesizes from YAML. No package.json validation. |
| `≥ 0.5.0` | `0.0.31` | Views reads `wippy-meta.json` as source-of-truth with YAML-overlay. No validation. |
| **`≥ 0.5.0`** | **`≥ 0.0.32`** | **Canonical contract.** Strict build-time package.json validation — plugin throws on missing `name`/`version`/`wippy` block, wrong `wippy.type`, missing/forbidden `wippy.path` or `wippy.tagName`, malformed Custom Element `tagName`, and `file://` basenames that don't follow the `*.do-not-link.<ext>` convention. |
| Future | (TBD) | YAML-synthesis fallback removed. `wippy-meta.json` becomes truly mandatory. |

Roll-out pattern: ship FE plugin first (`0.0.32`), then bump BE views (`0.5.0`).

**VERIFY** the meta file is in the dist and contains resolved content (no `file://` strings):
```bash
npm run build
test -f dist/wippy-meta.json && echo "OK: emitted" || echo "REJECT: missing"
grep -c 'file://' dist/wippy-meta.json | { read n; [ "$n" = "0" ] && echo "OK: all file:// resolved" || echo "REJECT: $n unresolved file:// refs"; }
```

### 9.4 wippy-loading

```html
<div id="app">
  <wippy-loading title="Loading..."></wippy-loading>
</div>
```

The `<wippy-loading>` element is auto-registered by dev-proxy (and by the real host) before the body parses.

REJECT custom hand-rolled spinners.

### 9.5 base: '' (relative paths) — REJECT if hardcoded

`base: ''` in vite.config produces relative `./app.js`, `./assets/...` paths in the built HTML/JS. The bundle is portable to any URL prefix and any mount point — host-managed, host-less dev, or moved between projects.

A hardcoded absolute base (e.g. `base: '/app/keeper/'`) ties the bundle to a specific mount point and breaks portability. **This is a 100% REJECT — there is no acceptable "documented exception".** A child app must not assume its own URL prefix; the prefix is a host-side `meta.url` + `meta.base_path` concern, and the host injects the appropriate `<base>` into the HTML at serve time. Set `base: ''` and let the host do its job.

### 9.6 Dev-overlay accept flow

- `<wippy-dev-overlay>` shadow-DOM web component, FAB in bottom-right.
- Manual mode blocks boot until "Accept config" clicked.
- Auto-accept via `localStorage['@wippy-dev/auto-accept'] === 'true'`.
- Stored config: `localStorage['@wippy-dev/config']`, `localStorage['@wippy-dev/proxy-config']`.
- Reset clears all `@wippy-dev/*` keys + reloads.

---

## 10. Verification recipes

Run these before submitting. Each maps to a section.

### 10.1 Bootstrap & build

```bash
# 10.1.1 — wippy.specification + wippy.type
node -e 'const p=require("./package.json"); if(p.specification!=="wippy-component-1.0") throw new Error("bad specification"); const t=p.wippy?.type; if(t!=="page" && t!=="widget" && t!=="component") throw new Error("bad wippy.type"); console.log("OK")'

# 10.1.2 — markdown injection if app uses markdown (micro frontend apps only)
grep -A 10 'wippy.proxy.injections.css' package.json | grep -c '"markdown": true'  # 1 if uses markdown, 0 otherwise

# 10.1.3 — base relative
grep -E "base:\s*['\"]" vite.config.ts                # must show: base: ''

# 10.1.4 — wippyPagePlugin present (host-less default)
grep -c "wippyPagePlugin" vite.config.ts            # SHOULD = 1

# 10.1.5 — type-check
npx vue-tsc --build --force || npx vue-tsc --noEmit    # exit 0
```

### 10.2 Router & host integration (micro frontend apps)

```bash
# 10.2.1 — createMemoryHistory only
grep -c "createMemoryHistory" src/router/index.ts          # >= 1
grep -c "createWebHistory"    src/router/index.ts          # 0

# 10.2.2 — using @wippy-fe/router factory (canonical)
grep -c "from '@wippy-fe/router'" src/router/index.ts      # 1 if canonical

# 10.2.3 — afterEach calls onRouteChanged (if not using factory)
grep -A 10 "router.afterEach" src/router/index.ts | grep -c "host.onRouteChanged"  # >= 1 if hand-rolled

# 10.2.4 — @history listener
grep -c "@history" src/router/index.ts                     # >= 1

# 10.2.5 — catch-all + name
grep -E "pathMatch.*not-found|name:.*not-found" src/router/index.ts  # >= 1
```

### 10.3 Proxy API & subscription cleanup

```bash
# 10.3.1 — no module-scope instance.on
grep -n "^instance\.on" src/**/*.{ts,vue}                 # should be empty

# 10.3.2 — every instance.on has matching onUnmounted in same file
for f in $(grep -rl "instance\.on(" src --include="*.vue"); do
  o=$(grep -c "instance\.on(" "$f"); u=$(grep -c "onUnmounted" "$f")
  [ "$o" -gt 0 ] && [ "$u" -eq 0 ] && echo "FAIL: $f"
done

# 10.3.3 — no instance.off
grep -r "instance\.off" src                               # should be empty

# 10.3.4 — no raw axios.create
grep -r "axios.create" src                                 # should be empty

# 10.3.5 — no raw EventSource
grep -r "new EventSource" src                              # should be empty

# 10.3.6 — no window.confirm
grep -r "window\.confirm" src                             # should be empty

# 10.3.7 — addEventListener pairs with removeEventListener
for f in $(grep -rl "addEventListener" src --include="*.vue"); do
  a=$(grep -c "addEventListener" "$f"); r=$(grep -c "removeEventListener" "$f")
  [ "$a" -ne "$r" ] && echo "FAIL: $f add=$a remove=$r"
done
```

### 10.4 Styling & theming

```bash
# 10.4.1 — no theme-dependent --p-surface-N use (informational; document exceptions)
grep -r "var(--p-surface-[0-9]" src/**/*.vue | wc -l       # aim for 0; project minimum acceptable

# 10.4.2 — no invalid --p-primary token
grep -rE "var\(--p-primary\)[^-]" src/**/*.vue | wc -l   # must = 0

# 10.4.3 — no module-level redefinition of host tokens
grep -rE ":root\s*\{[^}]*--p-(content-background|text-color|primary)" src/styles.css  # must = 0
```

### 10.5 Vue/TS hygiene

```bash
# 10.5.1 — every .vue starts with <script setup lang="ts">
find src -name "*.vue" | while read f; do
  grep -q '<script setup lang="ts">' "$f" || echo "FAIL: $f"
done

# 10.5.2 — count any-casts (informational; aim ≤ 50)
grep -rE ":\s*any|as\s*any" src | wc -l

# 10.5.3 — no console.log
grep -rE "console\.log" src                               # should be empty
```

### 10.6 Host-less boot

```bash
npm run build

# checks on dist/app.html
grep -c 'data-role="@wippy/scripts"' dist/app.html         # must = 1
grep -c 'data-role="@wippy/package"' dist/app.html         # SHOULD = 1 (when wippyPagePlugin enabled)
grep -c '<script type="importmap">' dist/app.html          # must = 1
grep -c '<wippy-loading' dist/app.html                     # must >= 1
grep 'src="./app.js"' dist/app.html                        # match (relative path)

# live boot test: serve dist/ via http-server with dev-proxy.js from the Wippy Web Host CDN.
# Browser: see <wippy-loading>, then dev-overlay FAB → Accept → app boots.
```

### 10.7 Browser-emulator dark/light + contrast check (recommended)

Static checks catch token misuse but not actual rendering. Before shipping any non-trivial visual change, **verify the app in a browser emulator (Playwright or equivalent) under both dark and light theme**, and check contrast on both.

Recommended Playwright recipe:

```js
// dark + light snapshot pair
for (const scheme of ['dark', 'light']) {
  await page.emulateMedia({ colorScheme: scheme })
  await page.goto('http://localhost:<port>/<route>')
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `.local/snap-${scheme}.png`, fullPage: true })
}

// contrast smoke — flag any element with computed text vs background
// contrast ratio < 4.5 (WCAG AA body) or < 3 (WCAG AA large text).
// Use `axe-core`, `@axe-core/playwright`, or `pa11y` for a real audit.
```

Verify visually: text legibility on both schemes, no light-only assumptions (white-on-white panels), severity colours readable on both, hover/active states visible in both.

REJECT a page that renders correctly in dark mode but is broken in light mode (or vice versa).

### 10.8 Final gates

```bash
npx vue-tsc --build --force && \
npm test --if-present -- --run && \
npm run build && \
grep -c 'data-role="@wippy/scripts"' dist/app.html && \
grep -c '<wippy-loading' dist/app.html && \
echo "ALL GATES PASS"
```

---

## 11. Acceptance criteria (REJECT rules)

REJECT a submission if any of the following are true.

### Manifest (§3.1, §4.1)
1. `package.json.specification` is not `"wippy-component-1.0"`.
2. `wippy.type` is not `"page"` (micro frontend apps), `"widget"` (web components, historical), or `"component"` (web components, newer alias accepted by the vite plugin validator).
3. Micro Frontend App: `wippy.path` does not point to the actual built artifact (e.g. `dist/app.html`).
4. WC: `wippy.tagName` is missing or does not contain a hyphen.
5. WC: `wippy.props` is missing OR has properties without `type`/`default`/`description`.
5a. WC: `wippy.description` is missing OR is a one-line label. It MUST be a verbose usage explanation — see §4.1 / §2.2.
6. `peerDependencies` is missing `@wippy-fe/proxy` and `vue` (both kinds).
7. Micro Frontend App: `peerDependencies` is missing `vue-router`, `axios`, or `@iconify/vue` if the app imports them.
8. WC: `dependencies` is missing `@wippy-fe/webcomponent-core` or `@wippy-fe/webcomponent-vue`.

### vite.config.ts (§3.2, §4.2)
9. Micro Frontend App: `base` is not `''`. Hardcoded absolute base (e.g. `/app/keeper/`) is REJECT with no documented-exception escape hatch — see §9.5.
10. Micro Frontend App: `build.rollupOptions.external` does not include `vue` and `@wippy-fe/proxy`.
11. WC: `build.lib` library mode is missing OR `formats: ['es']` is missing.
12. WC: `build.rollupOptions.preserveEntrySignatures` is not `false`.
13. WC: `@wippy-fe/proxy` is not in externals (must be external, never bundled).
14. WC: `@wippy-fe/theme`, `@wippy-fe/webcomponent-core`, `@wippy-fe/webcomponent-vue` are listed in externals (must be bundled, never external).

### tsconfig.json (§3.8, §4.7)
15. `strict` is not `true`.
16. `target` is older than `ES2020`.
17. Micro Frontend App: `types` is missing `vite/client` or `@wippy-fe/types-global-proxy`.
18. WC: `types` is missing `vite/client` or `@wippy-fe/proxy`.
19. `vue-tsc` does not exit 0.

### app.html (§3.3)
20. No `<script data-role="@wippy/scripts">`.
21. No `<script type="importmap">` covering host-provided packages the app imports.
22. No `<div id="app">` mount.
23. No `<wippy-loading>` (uses custom spinner instead).

### Bootstrap (§3.4)
24. `app.ts` obtains `config` / `host` / `api` / `on` from anything other than sync `@wippy-fe/proxy` imports (e.g. reaches for `window.$W` / `getWippyApi`, or `await`s to *obtain* a getter).
25. `app.ts` does not provide `HOST_API`, `AXIOS_INSTANCE`, `WIPPY_INSTANCE` injections.
26. `app.ts` resolves initial path from a non-canonical source (must be `config.context?.route ?? '/'`, with documented project-specific extensions).

### Router (§3.5, §7)
27. Uses `createWebHistory` or `createHashHistory` (must be `createMemoryHistory`).
28. Calls `history.replace(initialPath)` AFTER `createRouter` instead of before.
29. `router.afterEach` does not call `host.onRouteChanged(to.fullPath, navId?)`.
30. No `on('@history', ...)` listener.
31. No catch-all `/:pathMatch(.*)*` route OR catch-all has no `name`.
32. `@history` handler does not normalize leading slash on incoming paths.

### Proxy & subscriptions (§3.9, §6)
33. Any `instance.on(...)` at module scope (outside `onMounted`).
34. Any `instance.on(...)` whose return value is discarded.
35. Any `onUnmounted` block missing the matching unsubscribe call(s).
36. Any reference to `instance.off(...)` (the method does not exist).
37. Any `window.addEventListener('message', ...)` without matching `removeEventListener` in `onUnmounted`.
38. Any raw `new EventSource(...)`.
39. Any raw `axios.create(...)`.
40. Any `window.confirm(...)`.

### Styling (§3.7, §5, §4.4)
41. `html, body, #app` set non-zero padding/margin.
42. `styles.css` redefines `--p-content-background`, `--p-text-color`, `--p-content-border-color`, `--p-primary-color`, or `--p-surface-*` at module scope.
42b. ANY child-app `.css` file contains `:root { --p-* … }` or `:root { --<other-host-var> … }` redefinition (§5.1.2). Move to facade theming or per-page `config_overrides.customization.cssVariables`.
43. PrimeVue component tokens are restyled with `!important` in `styles.css`.
43a. ANY child-app `.css` file contains a raw `.p-<component>` (e.g. `.p-button`, `.p-dialog`, `.p-inputtext`) selector rule (§5.1.2). Move to facade theming or per-page `config_overrides.customization.customCSS`.
44. Any Vue file uses `var(--p-primary)` (invalid token; must be `--p-primary-color`).
45. Any Vue file uses raw Tailwind color names (`bg-red-*`, `bg-sky-*`, etc.) for semantic meaning.
46. Any hardcoded hex/rgb in Vue source for semantic colors (use `--p-danger-*` etc., or `color-mix()`).
46a. Page renders correctly in only one of `prefers-color-scheme: dark` / `light`. Verify in a browser emulator before claiming the page is shippable (§10.7).
46b. Custom Vue component reimplements something PrimeVue already ships (e.g. custom dropdown when `<Select>` exists, custom modal when `<Dialog>` exists, custom toast when `<Toast>` exists, custom confirm when `<ConfirmDialog>` exists). Use the PrimeVue component, possibly with §5.0 level-1 / level-2 customization.

### Iconography (§5.6)
46c. Reusable iconography uses raw `<svg>` instead of `<Icon>` from `@iconify/vue`.
46d. Custom icon collection registered via `addCollection()` outside the canonical `app.ts` bootstrap path.
46e. Icon font CSS (Tabler-icons-font, Material Icons font, FontAwesome CSS, etc.) shipped alongside Iconify.

### Vue/TS hygiene (§3.8)
47. `.vue` file does not use `<script setup lang="ts">`.
48. `defineProps` uses untyped object syntax instead of TS generic.
49. Production code contains `console.log`.

### Web components (§4)
50. WC root element has padding or margin.
51. WC does not extend `WippyVueElement` or `WippyElement`.
52. WC `static get wippyConfig()` is missing OR doesn't return `propsSchema`/`hostCssKeys`/`inlineCss`.
53. WC `static get vueConfig()` is missing OR doesn't return `rootComponent`.
54. WC entry does not call `define(import.meta.url, ElementClass)` at module level.
55. WC has `wippy.path` (page-only field) or `wippy.proxy` (page-only block).

### Build pipeline (§8)
55a. Module ships `Makefile` without matching `make.bat` + `make.ps1` wrappers (§8.2).

### Accessibility (§3.8)
56. Icon-only `<button>` lacks `aria-label`.
57. Clickable `<div @click>` lacks `role="button"` + `aria-label` + keyboard handler (should be `<button>`).

---

## 12. Known intentional deviations

When you knowingly diverge from canonical, document it in your project's CLAUDE.md. Real examples:

| Deviation | Reason | Acceptable? |
|---|---|---|
| Triple-source initial path (`config.context.route → parent window URL → localStorage`) | Full-page reload recovery on apps that reload outside the host's normal navigation | YES |
| `createPinia()` registered but no `defineStore` yet | Reserved for upcoming stores | BORDERLINE — clean up if no stores planned |
| No PrimeVue plugin in app | App uses raw HTML buttons + custom CSS | YES (intentional UI choice) |
| Custom `inlineCssPlugin` in vite.config | Single-file deployment | YES |
| Raw `localStorage.*` for ad-hoc persistence keys | Avoid pinia overhead for one or two keys | DISCOURAGED. Prefer the canonical stack: facade module owns theme; `@wippy-fe/router` factory owns route restoration; `@wippy-fe/pinia-persist` owns durable state. Raw `localStorage` should be a measured exception in a leaf component, not the default. |
| Skip `wippyPagePlugin()` | Want a very-good-reason: e.g. shipping a host-only bundle that explicitly does not support host-less dev | RARELY YES. Default is to include it. Document the very-good reason in CLAUDE.md. |

---

## 13. Tooling gotchas

### 13.1 Wippy CLI port already in use (`:8080`, `:5173`)

Symptom: `EADDRINUSE` when starting `./wippy.exe run -c`.

Fix: override the gateway port via the `-o` flag. Examples:

```bash
# Pick a different port for the wippy gateway:
./wippy.exe run -c -o app:gateway:addr=:8086

# Combine multiple overrides — gateway port + facade fe_facade_url default:
./wippy.exe run -c -o app:gateway:addr=:9000 -o wippy.facade:fe_facade_url:default=http://localhost:5173
```

The `-o <module>:<entry>:<property>=<value>` form patches the registry entry's property at boot — no source edits required. To set a *requirement default* (rather than overriding a configured value), use the `:default` suffix on the property name.

For Vite (`5173`), kill the existing process or choose a different port via `vite --port <n>`.

### 13.2 Persistent `app.db`

Symptom: migration on first run succeeds, on second run fails with "table already exists".

Fix: delete `.wippy/app.db*` between fresh runs. For test harnesses, prefer `:memory:`.

### 13.3 npm ERESOLVE after `@wippy-fe/*` bump

Symptom: `npm install` fails with ERESOLVE after bumping `@wippy-fe/proxy` (e.g. 0.0.12 → 0.0.27).

Fix: delete `node_modules/` AND `package-lock.json`, then `npm install`.

### 13.4 Importmap drift

Symptom: `Failed to resolve module specifier 'pinia'`.

Fix: keep peerDependencies, vite externals, and importmap in sync. Verification recipe in §10.1 / §8.3.

---

## 14. Gold-standard validation report

The checklist's REJECT rules were validated against the two gold standards.

### `app-template/frontend/applications/main/` — micro-frontend-app gold standard

| Rule | Status | Notes |
|---|---|---|
| 1 (specification) | PASS | `wippy-component-1.0` |
| 2 (wippy.type) | PASS | `"page"` |
| 3 (wippy.path) | PASS | `dist/app.html` |
| 6 (peerDeps include @wippy-fe/proxy + vue) | PASS | both present |
| 7 (peerDeps include vue-router, axios, @iconify/vue) | PASS | all present |
| 9 (base: '') | PASS | `base: ''` in `vite.config.ts:15` |
| 10 (vite externals include vue + @wippy-fe/proxy) | PASS | both present |
| 15 (tsconfig strict) | PASS | `strict: true` |
| 16 (target ≥ ES2020) | PASS | `target: "ES2020"` (canonical floor) |
| 17 (types include vite/client + types-global-proxy) | PASS | both listed |
| 19 (vue-tsc exit 0) | not-run | (live check) |
| 20 (`@wippy/scripts` data-role) | PASS | present |
| 21 (importmap exists) | PASS | covers vue, pinia, vue-router, luxon, @iconify/vue, axios, @wippy-fe/markdown-iframe |
| 22 (`<div id="app">`) | PASS | present |
| 23 (`<wippy-loading>`) | PASS | present |
| 24 (await all 4 $W calls) | PASS | confirmed in `src/app.ts:16-19` |
| 25 (provide HOST_API/AXIOS/WIPPY) | PASS | confirmed |
| 26 (initial path resolution) | PASS | `config.context?.route \|\| '/'` then leading-slash normalize |
| 27-32 (router rules) | PASS via `@wippy-fe/router` factory | gold uses canonical factory |
| 41 (no padding/margin on html/body) | PASS | only `margin: 0; height: 100%` |
| 42 (no host token redefinition in styles.css) | PASS | 9-line boilerplate |
| 47 (`<script setup lang="ts">` everywhere) | PASS-by-convention | not exhaustively grepped |
| 48 (typed defineProps) | PASS-by-convention | |

**No REJECTs.** Gold standard passes the entire checklist.

**Note on §9.3 `wippyPagePlugin()`**: gold standard predates this enhancement and does NOT yet include the plugin. New apps SHOULD include it (default for host-less mode support).

### `app-template/frontend/web-components/mermaid/` — WC gold standard

| Rule | Status | Notes |
|---|---|---|
| 1 (specification) | PASS | `wippy-component-1.0` |
| 2 (wippy.type) | PASS | `"widget"` |
| 4 (wippy.tagName has hyphen) | PASS | `example-mermaid` |
| 5 (wippy.props well-formed) | PASS | both props have type/default/description |
| 6 (peerDeps include @wippy-fe/proxy + vue) | PASS | both present |
| 8 (deps include @wippy-fe/webcomponent-core + -vue) | PASS | both present |
| 11 (build.lib + formats: ['es']) | PASS | confirmed |
| 12 (preserveEntrySignatures: false) | PASS | confirmed with comment explaining why |
| 13 (@wippy-fe/proxy in externals) | PASS | present |
| 14 (@wippy-fe/theme/-core/-vue NOT in externals) | PASS | none in externals (correctly bundled) |
| 15-18 (tsconfig + types) | PASS | uses `@wippy-fe/proxy` (correct for WCs) |
| 50 (no root padding/margin) | PASS-by-convention | `.mermaid-container` uses `width:100%; height:100%; box-sizing:border-box` |
| 51 (extends WippyVueElement) | PASS | `class MermaidElement extends WippyVueElement<ComponentProps, Events>` |
| 52 (wippyConfig static getter) | PASS | returns propsSchema/hostCssKeys/inlineCss/contentTemplate |
| 53 (vueConfig static getter) | PASS | returns rootComponent |
| 54 (define(import.meta.url, ...) at module level) | PASS | `define(import.meta.url, MermaidElement)` |
| 55 (no wippy.path or wippy.proxy) | PASS | neither present |

**No REJECTs.** Gold standard passes the entire checklist.

### Process notes

If this checklist's rules ever flag a gold standard as REJECT, the rule is wrong — not the gold standard. Update this doc; do NOT change the gold standard.

---

## Appendix A — Window globals & DOM markers

Constants exported from `@wippy-fe/shared`:

| Constant | Value | Who writes | Who reads |
|---|---|---|---|
| `GLOBAL_CONFIG_VAR` | `__WIPPY_APP_CONFIG__` | host entry point | child app, dev-proxy |
| `GLOBAL_PROXY_CONFIG_VAR` | `__WIPPY_PROXY_CONFIG__` | host | dev-proxy boot |
| `GLOBAL_API_PROVIDER` | `__WIPPY_APP_API__` | host | child app |
| `GLOBAL_WEB_COMPONENT_CACHE` | `__WIPPY_WEB_COMPONENT_CACHE__` | wc loader | wc loader |
| `WIPPY_SCRIPTS_DATA_ROLE` | `@wippy/scripts` | author (in `app.html`) | host injects scripts adjacent to it |
| `WIPPY_PACKAGE_DATA_ROLE` | `@wippy/package` | `@wippy-fe/vite-plugin` (build time) | dev-proxy boot |

Authors should NEVER reference `window.__WIPPY_*` directly — always import from `@wippy-fe/shared` (constants) or use `@wippy-fe/proxy` API helpers.

---

## Appendix B — HostApi method signatures

```ts
interface HostApi {
  toast(opts: ToastMessageOptions): void
  confirm(opts: LimitedConfirmationOptions): Promise<boolean>
  startChat(token: string, opts?: { sidebar?: boolean }): void
  openSession(uuid: string, opts?: { sidebar?: boolean }): void
  openArtifact(uuid: string, opts?: { target: 'modal' | 'sidebar' }): void
  setContext(
    context: Record<string, unknown>,
    sessionUUID?: string,
    source?: { type: string; uuid: string; instanceUUID?: string },
  ): void
  navigate(url: string): void
  onRouteChanged(internalRoute: string, navId?: number): void
  handleError(code: 'auth-expired' | 'other', error: Record<string, unknown>): void
  formatUrl(relativeUrl: string): string
  classifyLink(href: string | null | undefined): LinkClassification
  layout: LayoutApi
  logout(): void
}
```

LayoutApi:

```ts
interface LayoutApi {
  readonly snapshot: LayoutSnapshot | null

  resizePanel(panelId: string, size: SizeValue): void
  collapsePanel(panelId: string): void
  expandPanel(panelId: string): void
  openDrawer(panelId: string): void
  closeDrawer(panelId: string): void
  toggleDrawer(panelId: string): void
  movePanel(panelId: string, target: PanelTarget): void
  removePanel(panelId: string): void
  updatePanel(panelId: string, def: Partial<HostPanelDef>): void
  openModal(id: string, def: HostModalDef): void
  closeModal(modalId: string): void
  addFloating(id: string, def: HostFloatingDef): void
  removeFloating(floatingId: string): void

  broadcast(channel: string, payload: unknown): void
  send(target: string, channel: string, payload: unknown): void
  on(channel: string, handler: (env: BroadcastEnvelope) => void): () => void
}
```

`host.layout` is always present (a `LayoutApi` object). Outside managed-layout mode, `host.layout.snapshot` is `null` and all mutation/bus calls are silent no-ops — gate on `host.layout.snapshot` (or `isManaged` from `useWippyLayout`) before mutating, not a null-check on `host.layout`.

---

## Appendix C — `ProxyConfig.injections` reference

```ts
interface ProxyConfig {
  enabled: boolean
  injections: {
    css: {
      themeConfig: boolean       // semantic CSS vars
      iframe: boolean            // iframe layout/containment
      primevue: boolean          // PrimeVue component CSS
      markdown: boolean          // markdown typography
      customCss: boolean         // theming.global.customCSS
      customVariables: boolean   // theming.global.cssVariables → :root
    }
    tailwindConfig: boolean      // window.tailwind.config
    resizeObserver: boolean      // report iframe size
    preventLinkClicks: boolean   // intercept <a> clicks
    iconifyIcons: boolean        // register iconify-icon WC + icons
    refreshWhenVisible: boolean  // reload on @visibility(true)
    historyPolyfill: boolean     // history() stub (always installed)
    errorCapture: boolean        // unhandledrejection + onerror → host
  }
}
```

The YAML registry-entry `meta.proxy:` block uses the same camelCase flags under an `injections` wrapper (deep-merged over the bundled `wippy.proxy`):
```yaml
meta:
  type: view.page
  # ...
  proxy:
    enabled: true
    injections:
      css:
        themeConfig: true
        iframe: true
        primevue: true
        customCss: true
        customVariables: true
      tailwindConfig: true
      iconifyIcons: true
```

CSS injections are applied in this order: `themeConfig → iframe → primevue → markdown → customVariables → customCss`. A MutationObserver pins the customCss `<style>` tag to the end of `<head>` to preserve precedence.

---

## Cross-references

- [micro-frontend-app.md](./micro-frontend-app.md) — detailed micro-frontend-app authoring guide
- [web-component.md](./web-component.md) — web-component authoring guide
- [proxy-api.md](./proxy-api.md) — full HostApi + instance.on() reference
- [host-less-mode.md](./host-less-mode.md) — host-less boot in detail
- [theming.md](./theming.md) — three-level theming guide
- [build-system.md](./build-system.md) — build pipeline details
