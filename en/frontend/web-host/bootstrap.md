# Bootstrap Sequence

After the Web Host receives its configuration it runs a fixed initialization sequence before rendering any UI. The sequence differs slightly depending on whether the Web Host is loaded as a JS module that takes over the page (the standard facade path) or runs inside an iframe (the manual, facade-less path), but the internal steps after configuration is available are identical.

## Path A — JS Module (Standard, facade path)

This is the path the current `wippy/facade` uses. The facade serves a page that loads a Web Host JS-module entry — `module.js` for **compat** mode or `managed-layout.js` for **managed** mode — and the module takes over the whole page and its browser history.

1. **Page loads the module.** The script registers `window.initWippyApp` on the page's `window`.

2. **Page calls `initWippyApp(config, rootContainer?)`.** The page has fetched `/facade/config` and passes the payload directly as a function argument. There is no PostMessage handshake.
   ```javascript
   const events = window.initWippyApp(config, '#app')
   events.on('ready', () => console.log('App ready'))
   ```

3. **Initialization proceeds** — see [Internal Init Sequence](#internal-init-sequence) below.

## Path B — Iframe (manual, facade-less)

This is the path taken when you embed the full host inside an iframe yourself — for partial-page embedding with stronger isolation. It loads `iframe.html?waitForCustomConfig` and receives config via a `SetConfig` PostMessage. The current facade does not produce this; it exists for manual insertions.

1. **Iframe loads.** The Web Host loads in the browser. Because `?waitForCustomConfig` is present in the URL, the app mounts a minimal skeleton and suspends — it does not attempt to read auth tokens or call any API endpoints yet.

2. **Parent sends `SetConfig`.** The parent has fetched `/facade/config` (or supplied an equivalent payload) and forwards it via PostMessage:
   ```javascript
   iframe.contentWindow.postMessage(
     { type: '@gen2-chat', action: 'set-config', ...configPayload },
     config.iframe_origin
   )
   ```

3. **Web Host receives `AppConfig`.** The message handler validates the envelope type and action, then extracts the full configuration object.

4. **Initialization proceeds** — the internal path is identical to Path A from this point forward.

## Internal Init Sequence

Once `AppConfig` is available (via either path), the Web Host runs the following steps in order:

**1. Pinia store initialization.**
The root Pinia instance is created and all store modules are registered. Auth state is loaded from `AppConfig.auth` — the token is stored in memory (or in a cookie if `hostConfig.session.type = 'cookie'`). Environment URLs from `AppConfig.env` are written to the store for use by Axios and the WebSocket client.

**2. Axios configuration.**
The Axios instance is configured with `APP_API_URL` as `baseURL` and the auth token injected as a default header. Any `axiosDefaults` from the config are merged in. This instance is the one child iframes receive via the proxy API.

**3. Vue Router initialization.**
The router is created with the history mode specified in `AppConfig.hostConfig.history` (`"hash"` or `"browser"`). System routes (`/c/:id`, `/chat/:id`, `/keeper/:id`, etc.) are registered. This is a static set — dynamic mount routes are added in a later step.

**4. PrimeVue and theme injection.**
PrimeVue is installed on the Vue app. CSS custom properties from `AppConfig.theming.global` and `AppConfig.theming.host` are injected as `:root { --key: value; }` overrides for the appropriate scopes. `customCSS` strings from `theming.global` and `theming.host` are injected as `<style>` tags, and icons from `theming.global` / `theming.host` are registered with Iconify. This step applies before the app mounts so the first render has the correct theme.

**5. Vue app mount.**
The root `App.vue` component is mounted into the DOM. Users see the chrome — sidebar, chat panel, layout skeleton — at this point, though page content may still be loading.

**6. Dynamic route registration.**
The app calls `GET /api/v2/views/pages/routes` to fetch the list of registered view pages. For each page that declares a `mountRoute`, `router.addRoute('app', ...)` is called to add the route to the live router. The `app` named route is the parent layout route that wraps all content.

Any conflict in mount routes (duplicate paths, reserved segments, malformed syntax) at this stage sets a fatal error on the pages store. `App.vue` detects this and renders a fullscreen `<wippy-error>` with a descriptive message instead of the normal UI.

**7. URL resolution.**
The router resolves the current URL (from `window.location` in browser-history mode or from the hash in hash mode). If the URL matches a system route or a registered mount route, the corresponding page renders. If it matches no route, the router falls back to the chat home view.

**8. WebSocket connection.**
The WebSocket client connects to `APP_WEBSOCKET_URL` using the auth token. Real-time events (incoming messages, session updates, artifact state changes) begin flowing. The connection is maintained for the lifetime of the page.

## AppConfig TypeScript Interface

The full configuration type accepted by both `initWippyApp` and `SetConfig`. Note there is no `feature` field and no `fe_mode` field in `AppConfig` — `fe_mode` is a facade requirement parameter that selects the module entry, and managed mode is conveyed to the host through `hostConfig.layout`:

```typescript
interface AppConfig {
  $schema: 'wippy-context-2.0'
  auth: AppAuthConfig
  env: AppEnv
  axiosDefaults?: Partial<AxiosDefaults>
  routePrefix?: string
  apiRoutes?: ApiRoutesOverride
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
  [key: string]: string | undefined
}

interface AppTheming {
  global?: ThemingScope
  host?: ThemingScope
  children?: ThemingScope
}

interface ThemingScope {
  customCSS?: string
  cssVariables?: Record<string, string>
  icons?: Record<string, unknown>
  iconSets?: Record<string, Record<string, unknown>>
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
  additionalNavItems?: PageApi.Page[]
  stateCache?: { maxPages?: number; maxSizePerPage?: number }
  allowAdditionalTags?: string[]
  chat?: {
    convertPasteToFile?: {
      enabled: boolean
      minFileSize: number
      allowHtml: boolean
    }
  }
  layout?: HostLayoutDeclaration
}

interface AppContext {
  resourceId: string
  resourceType: 'page' | 'artifact'
  route?: string
  [key: string]: unknown
}
```

## Configuration Sources and Priority

The Web Host resolves configuration from multiple sources, in priority order from lowest to highest:

1. **Built-in defaults** — defined in the Web Host bundle itself.
2. **URL query parameters** — `?token=<token>`, `?expiresAt=<timestamp>`, `?persist` for cookie sessions. Useful for direct development access without a parent page.
3. **`initWippyApp()` argument** — the standard facade (JS-module) path; takes precedence over URL parameters.
4. **PostMessage `SetConfig`** — the manual, facade-less iframe path, used when `?waitForCustomConfig` is present.

In practice, production deployments always use `initWippyApp()` (the facade path) or PostMessage (manual iframe embedding). URL parameters are a development convenience for loading the host directly in the browser with a token.

## Bootstrap Diagram

The standard facade (JS-module) path:

```
module.js / managed-layout.js loaded on the page
  │
  ├─ window.initWippyApp(config, '#app')
  │     config.AppConfig = { $schema, auth, env, theming, hostConfig, context }
  │
  ├─ Init Pinia (auth store, config store)
  ├─ Configure Axios (baseURL, auth header)
  ├─ Create Vue Router (history mode, system routes)
  ├─ Install PrimeVue, inject theme CSS
  ├─ Mount App.vue
  │
  ├─ GET /api/v2/views/pages/routes
  │     router.addRoute('app', ...) for each mountRoute
  │
  ├─ Resolve current URL → render matching view
  └─ Connect WebSocket
```

## See Also

- [Facade Entry Point](./entry-point.md) — how `AppConfig` is constructed and delivered by `wippy/facade`
- [Multi-Panel Layout](./multi-panel-layout.md) — the managed-layout boot path served by `managed-layout.js`
