---
title: "Frontend Facade"
description: "Serve and configure the Wippy Web Host from a backend application with wippy/facade."
---

# Frontend Facade

Use `wippy/facade` to serve the Wippy Web Host from a backend application. The facade loads the frontend bundle from a CDN and configures it through a JSON endpoint served by the application, without requiring a frontend build step. Dependency parameters control branding, theming, and feature flags.

## What You'll Build

A backend app that serves the Wippy UI:

1. An HTTP server and public router.
2. A `wippy/facade` dependency connected to the server and router, with custom branding.
3. The facade shell at `/` and its configuration at `/api/public/facade/config`.

## Prerequisites

- A Wippy project (clone [app-template](https://github.com/wippyai/app-template), or
  `wippy init`).
- The facade installed:

  ```bash
  wippy add wippy/facade
  wippy install
  ```

## How It Works

1. `index.html` is served as a static file from your HTTP server.
2. On load it fetches `GET /api/public/facade/config`.
3. It checks `localStorage` for an auth token, redirecting to `login_path` if missing.
4. It imports the Web Host bundle from the CDN (`facade_url + '/module.js'`) and calls
   `initWippyApp(...)` with the config.

The application serves the shell and its configuration; the UI bundle comes from the CDN.

## Dependencies

The facade requires an `http.service` for the shell and an `http.router` for its configuration endpoint. Other parameters customize branding and behavior.

```yaml
version: "1.0"
namespace: app

entries:
  - name: gateway
    kind: http.service
    addr: :8087
    lifecycle:
      auto_start: true

  - name: api.public
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api/public

  - name: facade
    kind: ns.dependency
    component: wippy/facade
    parameters:
      - name: server
        value: app:gateway
      - name: router
        value: app:api.public
      - name: app_title
        value: Verify App
```

The shipped `index.html` fetches `/api/public/facade/config`, so the public router's
prefix must be `/api/public` for the default shell to find its config.

## Run It

```bash
wippy run
```

The shell is served at the server root, and the config endpoint returns the runtime
configuration:

```bash
curl http://localhost:8087/api/public/facade/config
```

```json
{
  "facade_url": "https://web-host.wippy.ai/webcomponents-1.0.23",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/webcomponents-1.0.23/iframe.html?waitForCustomConfig",
  "login_path": "/login.html",
  "env": { "APP_API_URL": "", "APP_AUTH_API_URL": "", "APP_WEBSOCKET_URL": "" },
  "theming": {
    "host": { "i18n": { "app": { "title": "Verify App", "icon": "wippy:logo", "appName": "Wippy AI" } } }
  },
  "hostConfig": {
    "showAdmin": true, "allowSelectModel": false, "hideNavBar": false,
    "session": { "type": "non-persistent" }, "history": "hash"
  }
}
```

The `app_title` parameter appears as `theming.host.i18n.app.title` in the response.

## Configuration

Parameters are passed as dependency `parameters` (values are strings; JSON values are
JSON-encoded strings). Common ones:

| Parameter | Purpose |
|---|---|
| `server` / `router` | _(required)_ HTTP server and public router |
| `app_title` / `app_name` / `app_icon` | Branding (icon is an Iconify ref) |
| `show_admin` / `hide_nav_bar` | Feature flags (`"true"` / `"false"`) |
| `login_path` | Where the shell redirects when no auth token is present |
| `session_type` | `non-persistent` or `cookie` |
| `history_mode` | `hash` or `browser` |
| `css_variables` | JSON string of CSS custom properties, e.g. `'{"--p-primary":"#6366f1"}'` |
| `fe_facade_url` | CDN bundle URL (pinned per facade release; leave default unless overriding) |

Two values are derived at runtime from the `PUBLIC_API_URL` environment variable rather
than parameters: the API base URL and the WebSocket URL (`http`→`ws`, `https`→`wss`). If
unset, the browser falls back to `window.location.origin`.

## Limitations

- The facade does not provide authentication. It expects an auth flow that writes a
  token to `localStorage`; without one it redirects to `login_path`. Pair it with
  `userspace/users` or your own auth.
- The UI bundle loads from the CDN (`fe_facade_url`), so the running app needs outbound
  network access to render.

## Next Steps

- [Hello World](tutorials/hello-world.md) — Minimal project layout
- [Authentication](tutorials/auth.md) — Add the login flow expected by the shell
- [HTTP Endpoints](http/endpoint.md) — Routers, static files, and handlers
