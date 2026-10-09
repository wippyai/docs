---
title: "Bootstrap Sequence"
description: "How the Web Host receives AppConfig and initializes stores, routing, theming, rendering, and real-time services."
---

# Bootstrap Sequence

This page is a lifecycle and configuration reference. The sequence diagrams
describe Host initialization; they are not application bootstrap code to copy.

After receiving its configuration, the Web Host runs a fixed initialization
sequence before rendering the full interface. Configuration arrives either
through a JS module that takes over the page or through a manually embedded
iframe. The internal steps are identical once configuration is available.

## Path A — JS Module (Standard, facade path)

The current `wippy/facade` uses this path. It serves a page that loads a Web
Host JS-module entry: `module.js` for **compat** mode or `managed-layout.js` for
**managed** mode. The module then takes over the page and its browser history.

1. **Fetch configuration and register the map.** The facade requirement is named `import_map`; `/facade/config` exposes it as `cfg.importMap`. The shell loads the shared import-map bootstrap and registers the composed map before importing Host modules.

2. **Import the Host module and initialize the app.** The shell imports `module.js` or `managed-layout.js`, which exposes `window.initWippyApp`. It then calls `initWippyApp(appConfig, rootContainer?)` with the initial `AppConfig`, including `importMap: cfg.importMap`. There is no PostMessage handshake.

3. **Initialization proceeds** — see [Internal Init Sequence](#internal-init-sequence) below.

## Path B — Iframe (manual, facade-less)

Use this path to embed the full host inside an iframe for partial-page rendering
with stronger isolation. It loads `iframe.html?waitForCustomConfig` and receives
configuration through a `SetConfig` PostMessage. The current facade does not
produce this embedding.

1. **Parent prepares the iframe.** Add `?waitForCustomConfig` to the versioned `iframe.html` URL. Install a `message` listener before assigning `iframe.src`. The standalone bootstrap waits for the parent `SetConfig` before registering the import map or importing Host app modules. This happens before the Host app mounts.

2. **Parent answers `GetConfig`.** Wait for the iframe's `get-config` message.
   Accept it only when both `event.origin` equals the trusted iframe origin and
   `event.source` equals `iframe.contentWindow`. Then send a complete `AppConfig`
   in a `set-config` message, using the trusted origin as `targetOrigin`. A
   `/facade/config` response can provide deployment settings, but the parent
   must add `$schema`, `auth`, and `context`. See the [manual iframe example](./entry-point.md#manual-facade-less-iframe-embedding)
   for the full listener and message flow.

3. **Web Host receives `AppConfig`.** It validates the message envelope, accepts an iframe message only from the physical parent window, and checks `event.origin` against the parent origin when that origin is accessible. In a Web Fragment, it also requires `fragmentId` to match that occurrence’s own ID. Later valid `SetConfig` messages can update that document’s config.

4. **Initialization proceeds** — the internal path is identical to Path A from this point forward.

## Internal Init Sequence

Once `AppConfig` is available (via either path), the Web Host runs the following
startup sequence:

**1. Resolve and normalize configuration.**
`resolveConfig()` initializes and merges the supplied configuration, applies
schema migrations, normalizes session policy, and populates the configuration,
authentication, and environment state used by the rest of the Host.

**2. Fetch backend page routes.**
Before creating or mounting the Vue application, the Host awaits
`GET /api/public/pages/routes`. A backend syntax or duplicate-route error aborts
startup and is relayed through the Host error path; it is not a post-mount route
installation step.

**3. Create the application and router.**
The Vue application is created. The router uses the history mode from
`AppConfig.hostConfig.history` and registers both static system routes and the
backend mount routes before the application mounts.

**4. Install application providers.**
`setupApp()` installs Pinia, configures Axios and authentication, installs
PrimeVue and the theme providers, and wires the remaining application services.
Child applications receive the configured API surface through the proxy layer.

**5. Mount and resolve the current URL.**
Only after configuration, route loading, router creation, and provider setup
have completed does the module entry mount `App.vue`. The router then resolves
the current browser or hash URL against the complete route table.

**6. Create WebSocket clients when requested.**
WebSocket setup is consumer-driven rather than a fixed final bootstrap step.
`useWsClientRaw()` creates the client when a consuming component or composable
requests it. The connection starts eagerly unless `hostConfig.lazyWS` is true;
with lazy mode, it starts when a subscription requires it.

## AppConfig TypeScript Interface

The following abridged declaration shows the main configuration fields accepted
by both `initWippyApp` and `SetConfig`. Supporting types and less commonly used
fields remain authoritative in the pinned Web Host `app-config/types.ts`; do not
treat this excerpt as a replacement for the shipped schema. There is no
`feature` or `fe_mode` field in `AppConfig` — `fe_mode` is a facade requirement
parameter that selects the module entry, and managed mode is conveyed through
`hostConfig.layout`:

```typescript
interface AppConfig {
  $schema: string             // current facade: <facade_url>/schemas/wippy-context-2.2.json
  auth: AppAuthConfig
  env: AppEnv
  axiosDefaults?: Partial<AxiosDefaults>
  routePrefix?: string
  apiRoutes?: ApiRoutesOverride
  tanstack?: TanstackConfig    // TanStack Query defaults (global + per role-based category)
  iconify?: IconifyConfig | null
  themeMode?: 'auto' | 'light' | 'dark'
  theming: AppTheming
  hostConfig: HostConfig
  context: AppContext
}

interface AppAuthConfig {
  token: string            // Bearer token
  expiresAt: string        // ISO 8601 expiry timestamp
}

interface AppEnv {
  APP_API_URL: string
  APP_AUTH_API_URL: string
  APP_WEBSOCKET_URL: string
}

interface AppTheming {
  global?: ThemingScope
  host?: HostThemingScope
  children?: ChildrenThemingScope
}

interface CssVariablesMap {
  [key: string]: string | Record<string, string> | undefined
  '@dark'?: Record<string, string>
  '@light'?: Record<string, string>
}

interface ThemingScope {
  customCSS?: string
  cssVariables?: CssVariablesMap
  fonts?: FontConfig[]
  icons?: Record<string, unknown>
  iconSets?: Record<string, Record<string, unknown>>
}

interface HostThemingScope extends ThemingScope {
  i18n?: Partial<I18NTextTypes>
}

interface ChildrenThemingScope {
  customCSS?: string
  cssVariables?: CssVariablesMap
  fonts?: FontConfig[]
}

interface HostConfig {
  session?: { type: 'non-persistent' | 'cookie' }
  history?: 'browser' | 'hash'
  showAdmin?: boolean
  allowSelectModel?: boolean
  startNavOpen?: boolean
  hideNavBar?: boolean
  disableRightPanel?: boolean
  hideSessionSelector?: boolean
  renderEngine?: 'iframe' | 'fragment'
  lazyWS?: boolean
  additionalNavItems?: PageApi.Page[]
  stateCache?: { maxPages?: number; maxSizePerPage?: number }
  allowAdditionalTags?: Record<string, string[]>   // tag → allowed attributes
  chat?: {
    convertPasteToFile?: {
      enabled: boolean
      minFileSize: number
      allowHtml: boolean
    }
  }
  layout?: HostLayoutDeclaration
}

// TanStack Query defaults. A top-level field (shared by host + children, like
// apiRoutes). Default behavior (no config) is refetchOnWindowFocus: false so
// alt-tabbing back doesn't reload in-flight content.
interface TanstackConfig {
  default?: TanstackQueryOptions   // overrides the global query defaults
  content?: TanstackQueryOptions   // single-resource renders (page/artifact/session/entry/model/upload)
  lists?: TanstackQueryOptions     // navigation / index / list queries
}

interface IconifyConfig {
  providers?: Record<string, {
    resources: string[]
    path?: string
    timeout?: number
  } | null> | null
}

// JSON-safe subset of TanStack query options (no functions — config is JSON).
interface TanstackQueryOptions {
  refetchOnWindowFocus?: boolean
  refetchOnReconnect?: boolean
  refetchOnMount?: boolean
  staleTime?: number
  gcTime?: number
  retry?: boolean | number
  refetchInterval?: number | false
}

interface AppContext {
  resourceId: string
  resourceType: 'page' | 'artifact'
  route?: string
  parentResourceId?: string
  nestingDepth?: number
  isNavOwner?: boolean
  layoutPanelId?: string
  layoutId?: string
  layout?: unknown
  extensions?: Record<string, unknown>
}
```

`AppConfig.iconify` selects Iconify collection sources. The default remains online when this field is omitted. Set it explicitly to use a local collection. See [Iconify providers](./iconify.md) for the provider format and reset behavior. Explicitly configured values are projected to child applications through AppConfig.

PrimeVue is available to application imports through the exact specifiers in
the pinned Host import map. Rebuilt consumers use the Host's shared PrimeVue
vendor graph within their JavaScript realm. Each iframe or Web Fragment has its
own realm and module graph. The import map does not inject styles; request the
needed PrimeVue CSS through the documented Host CSS keys. Existing embedded
consumer bundles must be rebuilt against the new map.

> **Current facade limitation.** Web Host accepts `AppConfig.tanstack`, and the
> facade config endpoint returns the configured `tanstack` object. The standard
> facade shell does not currently copy that field into the `AppConfig` passed to
> `initWippyApp`. Do not rely on the facade `tanstack` parameter on the standard
> shell path until that forwarding is implemented. A manual embedder can include
> it in the `AppConfig` it assembles.

## Configuration Sources and Priority

The Web Host resolves configuration from multiple sources, in priority order from lowest to highest:

1. **Built-in defaults** — defined in the Web Host bundle itself.
2. **URL query parameters** — `?token=<token>`, `?expiresAt=<timestamp>`, `?persist` for cookie sessions. Useful for direct development access without a parent page.
3. **`initWippyApp()` argument** — the `AppConfig` assembled by the standard facade shell; takes precedence over URL parameters.
4. **PostMessage `SetConfig`** — the manual, facade-less iframe path, used when `?waitForCustomConfig` is present.

In practice, production deployments always use `initWippyApp()` (the facade path) or PostMessage (manual iframe embedding). URL parameters are a development convenience for loading the host directly in the browser with a token.

## Bootstrap Diagram

The standard facade (JS-module) path:

```
facade shell fetches /facade/config (requirement import_map → cfg.importMap)
  │
  ├─ fetches the Host map and loads the shared import-map bootstrap
  ├─ registers the composed import map
  ├─ imports module.js / managed-layout.js
  ├─ module exposes window.initWippyApp
  ├─ shell calls initWippyApp({ ..., importMap: cfg.importMap }, '#app')
  ├─ resolveConfig() → migrate, normalize, and populate config/auth/env state
  ├─ await GET /api/public/pages/routes
  ├─ create Vue app + router
  │     static system routes + validated backend mount routes
  ├─ setupApp() → Pinia, Axios, PrimeVue, theming, and other providers
  ├─ mount App.vue → resolve the current URL
  └─ consuming components request WebSocket clients
```

## See Also

- [Facade Entry Point](./entry-point.md) — how `AppConfig` is constructed and delivered by `wippy/facade`
- [Multi-Panel Layout](./multi-panel-layout.md) — the managed-layout boot path served by `managed-layout.js`
- [Render Engines](./render-engines.md) — how a page renders once loaded (srcdoc iframe vs Web Fragment)

## AppConfig import map

`AppConfig.importMap` is an optional top-level browser import map with standard `imports` and `scopes` fields.

```typescript
interface AppConfig {
  importMap?: {
    imports?: Record<string, string>
    scopes?: Record<string, Record<string, string>>
  } | null
}
```

For srcdoc page documents, the Host composes the page map, generated Host defaults, then `AppConfig.importMap`. Standalone and facade documents, and each Web Fragment occurrence, have no page-provided srcdoc map; they compose Host defaults then `AppConfig.importMap`. Each Web Fragment occurrence runs in its own physical realm iframe. Within `imports` and each scope, the last value for a matching key wins and unrelated entries remain. Configuration can replace page or Host mappings, including Vue, PrimeVue, and Wippy packages. An exact key matches one specifier. A key ending in `/` matches that specifier prefix, and its target must also end in `/`. `scopes` select mappings by the importing module URL. Relative target URLs resolve against the document base URL.

Compose the map before registering the native import map and before loading modules. Omitting `importMap` from an update keeps the current extension. Set it to `null` or `{}` to clear the extension.

An import-map update applies when a document is created. It does not change module resolution in an existing document. Reload that document to use the update; later-created documents use the latest configuration. Each Web Fragment occurrence has its own physical realm iframe and registers its map in that realm before loading modules.

Overriding a shared Vue, PrimeVue, or Wippy entry can split module or service identity between the Host and child code. Test those integrations against the exact released map before deploying an override.

Use this field only with a deployed Host release that documents support for it.
