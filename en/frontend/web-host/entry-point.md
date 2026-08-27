---
title: "Facade Entry Point"
description: "How wippy/facade serves the Web Host, constructs AppConfig, handles authentication, and supports manual iframe embedding."
---

# Facade Entry Point

This page is an integration reference. The shell bootstrap and manual iframe
blocks isolate specific contracts; they are not substitutes for a complete
login flow or application project.

The `wippy/facade` backend module delivers the Web Host to users. It serves the
HTML shell and `/facade/config`. The shell loads the Web Host module, checks the
browser's stored authentication token, redirects unauthenticated users, and
assembles deployment-specific configuration for the CDN-hosted frontend bundle.
The bundle itself contains no deployment-specific configuration.

![Facade entry point](../diagrams/facade-entry-point.svg)

## The HTML Page

When a user navigates to a Wippy application, the Web Host module takes over the
page and its browser history, so the host runs as the application rather than
inside an iframe.

The facade loads one of two JS-module entries depending on the configured `fe_mode`:

- **`module.js`** — the **compat** shell (default): the standard nav-sidebar + page-area + chat-right-panel layout.
- **`managed-layout.js`** — the **managed** shell (opt-in, early access): the declarative multi-panel layout.

A simplified version of the bootstrap call looks like this. The shipped shell
also loads configured extra scripts, installs the Web Host import map, handles
errors, and applies the persisted theme before this call:

```javascript
const response = await fetch('/api/public/facade/config')
if (!response.ok)
  throw new Error(`Facade config request failed: ${response.status}`)
const cfg = await response.json()

const storedAuth = localStorage.getItem('@wippy_token_info')
if (!storedAuth)
  throw new Error('Authentication is required before bootstrapping the host')
const { token } = JSON.parse(storedAuth)
if (typeof token !== 'string' || token.length === 0)
  throw new Error('Stored authentication does not contain a token')

await import(cfg.facade_url + cfg.module_file)

const appConfig = {
  $schema: `${cfg.facade_url}/schemas/wippy-context-2.0.xsd`,
  auth: {
    token,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  },
  env: cfg.env,
  routePrefix: cfg.routePrefix,
  themeMode: window.wippyThemePersist?.read() || cfg.themeMode,
  apiRoutes: cfg.apiRoutes,
  axiosDefaults: cfg.axiosDefaults,
  theming: cfg.theming,
  hostConfig: cfg.hostConfig,
  context: { resourceId: '', resourceType: 'page' },
}

window.initWippyApp(appConfig, '#app')
```

> **Fetch path.** `/facade/config` is the path the facade registers on the
> public router. The requested URL also includes that router's prefix. With the
> example prefix `/api/public`, request `/api/public/facade/config`, as the
> shipped facade page and bootstrap example do. Contract descriptions below use
> the registry-local path.

## The Config Flow

The config flow has four steps:

1. The page's inline JavaScript calls `GET /facade/config` on the same origin as the page. This endpoint is registered by `wippy/facade` on the public router.
2. The shell reads `@wippy_token_info` from localStorage. If the value is missing or cannot be decoded, the browser redirects to `login_path`.
3. The shell loads `extraScripts`, installs the Web Host import map, and imports the module selected by `module_file`.
4. The shell adds `$schema`, `auth`, and `context` to the supported deployment fields, then calls `window.initWippyApp(appConfig, rootContainer?)`.

The Web Host receives that assembled `AppConfig` and proceeds with full initialization. From this point forward the page script is passive — all user interaction happens inside the mounted host.

The CDN-hosted bundle is identical across deployments; deployment-specific
URLs and branding arrive in the config response, while the bearer token comes
from browser storage.

> **Config response vs `AppConfig`.** `/facade/config` does not return a complete
> `AppConfig`: it has no `$schema`, `auth`, or `context`. Fields such as
> `facade_url`, `iframe_origin`, `iframe_url`, and `login_path` are shell settings,
> while `env`, `theming`, and `hostConfig` are inputs to the assembled `AppConfig`.

## The `/facade/config` Response

The config endpoint returns shell settings and Web Host configuration assembled
by `wippy/facade` from module parameters and the running environment. This is an
example configured response; optional JSON blocks that remain empty are omitted:

```json
{
  "facade_url": "https://web-host.wippy.ai/<release-tag>",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
  "login_path": "/login.html",
  "login_redirect_param": "return_to",
  "mode": "compat",
  "module_file": "/module.js",
  "env": {
    "APP_API_URL": "https://api.example.com",
    "APP_AUTH_API_URL": "https://api.example.com",
    "APP_WEBSOCKET_URL": "wss://api.example.com"
  },
  "routePrefix": "https://api.example.com",
  "themeMode": "auto",
  "themePersist": "localStorage",
  "themeStorageKey": "@wippy-theme-mode",
  "axiosDefaults": { "timeout": 30000 },
  "apiRoutes": { "agents": { "list": "/custom/agents" } },
  "tanstack": { "lists": { "refetchOnWindowFocus": true } },
  "extraScripts": ["/monitoring.js"],
  "theming": {
    "global": {
      "customCSS": "@import url('https://fonts.googleapis.com/...');",
      "cssVariables": { "--p-primary": "#6366f1" },
      "iconSets": {}
    },
    "host": {
      "customCSS": ".wippy-host-app .chat-container { background: var(--p-content-background); }",
      "cssVariables": {},
      "iconSets": {},
      "i18n": {
        "app": {
          "title": "My App",
          "icon": "wippy:logo",
          "appName": "My Application"
        }
      }
    },
    "children": {
      "customCSS": "",
      "cssVariables": {}
    }
  },
  "hostConfig": {
    "session": { "type": "non-persistent" },
    "history": "hash",
    "renderEngine": "iframe",
    "showAdmin": true,
    "allowSelectModel": false,
    "startNavOpen": false,
    "hideNavBar": false,
    "disableRightPanel": false,
    "hideSessionSelector": false,
    "additionalNavItems": [
      { "id": "reports", "name": "Reports", "title": "Reports", "icon": "tabler:report", "order": 10 }
    ],
    "stateCache": { "maxPages": 50, "maxSizePerPage": 1048576 },
    "allowAdditionalTags": { "w-chart": ["data", "type"] },
    "chat": { "convertPasteToFile": { "enabled": true, "minFileSize": 1024, "allowHtml": false } }
  }
}
```

### Field Reference

**Shell and integration fields** — used by the standard shell or a custom embedder:

| Field | Description |
|-------|-------------|
| `facade_url` | Base CDN URL for the Web Host bundle. Used to resolve the module entry and vendor scripts. |
| `iframe_origin` | `Origin` header value of the CDN. Used as the `targetOrigin` for PostMessage in manual iframe embeddings (see below). |
| `iframe_url` | Full iframe `src` including `?waitForCustomConfig`. Used only by manual, facade-less iframe embeddings (see below). |
| `login_path` | Path on the page's origin to redirect unauthenticated users to. |
| `login_redirect_param` | Optional query parameter that receives the requested relative URL during the client-side login redirect. |
| `mode` | Normalized frontend mode: `compat` or `managed`. |
| `module_file` | Module selected by `mode`: `/module.js` or `/managed-layout.js`. |
| `themePersist` | Configured theme persistence mode, also available to external pages. |
| `themeStorageKey` | Configured cookie or localStorage key, also available to external pages. |
| `extraScripts` | Optional scripts the shell loads before the Web Host module. |

**Web Host fields returned by the endpoint** — copied selectively into the
`AppConfig` assembled by the page:

| Field | Description |
|-------|-------------|
| `env` | Runtime URLs injected as top-level `AppConfig.env`. |
| `routePrefix` | API URL prefix forwarded to child apps. |
| `themeMode` | Initial theme mode: `auto`, `light`, or `dark`. A persisted choice takes precedence in the standard shell. |
| `axiosDefaults` | Axios instance defaults forwarded to child apps. |
| `apiRoutes` | Override individual API endpoint paths (top-level `AppConfig` field). |
| `tanstack` | TanStack Query defaults returned by the endpoint. See the forwarding limitation below. |
| `theming` | CSS customization split into three scopes. |
| `hostConfig` | Web Host feature flags and UI configuration. |

The standard shell itself adds these required `AppConfig` fields:

| Field | Source |
|-------|--------|
| `$schema` | `<facade_url>/schemas/wippy-context-2.0.xsd` |
| `auth` | Token read from `@wippy_token_info`; the current shell synthesizes an expiry one day from initialization. |
| `context` | `{ resourceId: '', resourceType: 'page' }` |

> **Current `tanstack` forwarding limitation.** The config handler returns a
> configured `tanstack` object, and Web Host accepts `AppConfig.tanstack`. The
> standard facade shell does not currently copy `cfg.tanstack` into its
> `initWippyApp` argument, so the facade parameter has no effect on that path.
> A manual embedder may include `tanstack: cfg.tanstack` in its assembled
> `AppConfig`.

**`env` fields:**

| Field | Source | Description |
|-------|--------|-------------|
| `APP_API_URL` | `PUBLIC_API_URL` env var | Base URL for all backend HTTP calls |
| `APP_AUTH_API_URL` | Same as `APP_API_URL` | Auth endpoint URL (may differ in custom setups) |
| `APP_WEBSOCKET_URL` | Derived from `APP_API_URL` | `http://` → `ws://`, `https://` → `wss://` |

**`theming` scopes:**

| Scope | Applied to |
|-------|-----------|
| `global` | Both the host chrome and all child page render contexts |
| `host` | Host chrome only. Also carries `i18n.app` for the app title, icon, and name shown in the sidebar. |
| `children` | Child page render contexts (srcdoc iframes or Web Fragments) |

**`hostConfig` fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `session.type` | `"non-persistent"` \| `"cookie"` | `"non-persistent"` | Token storage mode |
| `history` | `"hash"` \| `"browser"` | `"hash"` | Vue Router history mode |
| `renderEngine` | `"iframe"` \| `"fragment"` | `"iframe"` | Render engine for packaged `view.page` applications |
| `showAdmin` | boolean | `true` | Show admin features in UI |
| `allowSelectModel` | boolean | `false` | Show LLM model picker |
| `startNavOpen` | boolean | `false` | Expand nav sidebar on load |
| `hideNavBar` | boolean | `false` | Hide left navigation sidebar entirely |
| `disableRightPanel` | boolean | `false` | Disable right artifact panel |
| `hideSessionSelector` | boolean | `false` | Hide the chat session picker |
| `additionalNavItems` | array | `[]` | Extra items injected into the sidebar |
| `stateCache` | object | `{}` | LRU cache config for child page state |
| `allowAdditionalTags` | object | `{}` | HTML sanitizer tag whitelist (`Record<string, string[]>`, tag → allowed attributes) |
| `chat` | object | `{}` | Chat UI overrides (paste-to-file behavior, etc.) |

## Authentication Flow

The facade serves the HTML shell and public config response before it knows the
client-held bearer token. In the browser, the shell reads
`@wippy_token_info` from localStorage. A missing value or invalid JSON triggers a
redirect to `login_path`. If `login_redirect_param` is configured, the shell
adds the current path, query, and hash so the login flow can return the user to
the requested URL.

For a valid stored value, the shell copies its `token` into `AppConfig.auth` and
synthesizes `expiresAt` as one day after initialization. The config endpoint
itself contains neither the token nor user-specific auth state. `APP_API_URL`
and `APP_WEBSOCKET_URL` are deployment settings, not per-user values.

## The Module Init Function

Both JS-module entries register the same `window.initWippyApp` function. The
choice of module determines which shell renders and is independent of the
embedding style (JS-module page vs manual iframe).

`initWippyApp(appConfig, rootContainer?)` returns a simple event emitter:

```javascript
const events = window.initWippyApp(appConfig, '#app')
events.on('ready', () => console.log('Wippy loaded'))
events.on('error', err => console.error('Failed to load:', err))
```

When called without a root container, the host mounts into a default element.

## Manual (facade-less) iframe embedding

The JS-module page above is the standard, recommended path and the one the current facade uses. There is also a second embedding mechanism for cases where you want to run the full host **inside an iframe** — for example to occupy only part of a page with stronger isolation from the surrounding application. In this mode you embed the host yourself; the facade does not produce this page.

![Manual iframe embedding](../diagrams/manual-iframe-embedding.svg)

You can still reuse the facade's `/facade/config` endpoint to obtain deployment
settings. Its `iframe_url` (the host's `iframe.html` entry with
`?waitForCustomConfig` appended) and `iframe_origin` (the PostMessage
`targetOrigin`) support this path. The parent must obtain auth through its own
client flow and assemble a complete `AppConfig` before answering the handshake.

Unlike the JS-module path, the host inside the iframe **requests** its config: it boots and posts a `get-config` message to the parent, and the parent replies with `set-config`. Given an `<iframe id="wippy"></iframe>` in the parent document, listen for the request rather than pushing config blindly on `load`:

```javascript
async function mountWippyIframe(auth) {
  const response = await fetch('/api/public/facade/config')
  if (!response.ok)
    throw new Error(`Facade config request failed: ${response.status}`)
  const cfg = await response.json()
  const iframe = document.getElementById('wippy')
  if (!(iframe instanceof HTMLIFrameElement))
    throw new Error('Expected <iframe id="wippy">')

  const iframeUrl = new URL(cfg.iframe_url)
  if (iframeUrl.origin !== cfg.iframe_origin)
    throw new Error('iframe_url and iframe_origin must identify the same origin')

  const appConfig = {
    $schema: `${cfg.facade_url}/schemas/wippy-context-2.0.xsd`,
    auth,
    env: cfg.env,
    routePrefix: cfg.routePrefix,
    themeMode: cfg.themeMode,
    apiRoutes: cfg.apiRoutes,
    axiosDefaults: cfg.axiosDefaults,
    tanstack: cfg.tanstack,
    theming: cfg.theming,
    hostConfig: cfg.hostConfig,
    context: { resourceId: '', resourceType: 'page' },
  }

  function onMessage(event) {
    if (event.origin !== cfg.iframe_origin || event.source !== iframe.contentWindow)
      return

    let message
    try {
      message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
    }
    catch {
      return
    }
    if (message?.type === '@gen2-chat' && message.action === 'get-config') {
      event.source.postMessage(
        JSON.stringify({ type: '@gen2-chat', action: 'set-config', ...appConfig }),
        cfg.iframe_origin,
      )
    }
  }

  window.addEventListener('message', onMessage)

  // iframe_url already includes ?waitForCustomConfig
  iframe.src = iframeUrl.href

  return function unmount() {
    window.removeEventListener('message', onMessage)
    iframe.remove()
  }
}
```

Call `mountWippyIframe` with an `auth` object containing the current bearer
`token` and an ISO 8601 `expiresAt`. Do not source that token from
`/facade/config`; the endpoint does not return one. Retain the returned
`unmount` function and call it when the embedding surface is removed so the
window listener and iframe do not survive their owner.

The parent-side checks above protect the parent from accepting messages from a
different frame. At Web Host 1.0.56, the iframe's inbound `SetConfig` handler
checks only the envelope `type` and `action`; it does not authenticate
`event.origin` or `event.source`, and a later matching message can replace the
configuration. Treat every script or window that can message the iframe as part
of the trusted configuration boundary. Iframe DOM and style isolation is not
configuration-authority isolation.

The `?waitForCustomConfig` query parameter (already present in `iframe_url`) is the key signal. It tells the Web Host to pause initialization — the app mounts but deliberately does not attempt to resolve authentication or load routes until it receives a `set-config` message. Without it the Web Host would try to read auth tokens from URL parameters or defaults, which is not appropriate for embedded deployments.

The handshake uses the `@gen2-chat` PostMessage protocol:

1. The parent fetches `GET /facade/config` (or supplies equivalent deployment settings), assembles a complete `AppConfig`, and creates the iframe pointing at `iframe_url`.
2. The booting iframe posts `{ type: '@gen2-chat', action: 'get-config' }` to the parent.
3. The parent's `message` listener responds with `{ type: '@gen2-chat', action: 'set-config', ...appConfig }`, targeted at `iframe_origin`.

The Web Host extracts the `AppConfig` payload and proceeds with full initialization. For the full message protocol (`@gen2-chat` envelope and the `IFrameMessageType` enum), see [Proxy & Isolation](./proxy-isolation.md). This `SetConfig` handshake is specific to manual, facade-less embedding; the `wippy/facade` module loads the Web Host as a JS module instead.

## Configuring the Facade Module

Set the `wippy/facade` parameters that produce the config response in
`_index.yaml`. This example comes from `app-template`:

```yaml
- name: facade
  kind: ns.dependency
  component: wippy/facade
  version: '0.6.37'
  parameters:
    - name: server
      value: app:gateway
    - name: router
      value: app:api.public
    - name: app_title
      value: Wippy App
    - name: app_name
      value: Wippy App
    - name: app_icon
      value: "wippy:logo"
    - name: show_admin
      value: "false"
    - name: hide_nav_bar
      value: "true"
    - name: login_path
      value: /app/login.html
    - name: session_type
      value: non-persistent
    - name: history_mode
      value: browser
    - name: custom_css
      value: "@import url('https://fonts.googleapis.com/css2?family=Poppins...');
             body { font-family: 'Poppins', sans-serif; }"
    - name: css_variables
      value: '{"--p-primary":"#6366f1"}'
    - name: host_custom_css
      value: ".wippy-host-app .chat-container { background: var(--p-content-background); }"
```

For the full list of available parameters and their defaults, see the [Facade module reference](../../framework/facade.md).
