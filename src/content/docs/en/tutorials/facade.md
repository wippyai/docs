---
title: "Frontend Facade"
---

# Frontend Facade

Serve the Wippy web UI from a backend-only app with `wippy/facade`. The facade is a
thin static shell: it loads the Wippy Web Host frontend bundle from a CDN and
configures it from a JSON endpoint your app serves — no frontend build step in your
project. Branding, theming, and feature flags are all driven by dependency parameters.

## What You'll Build

A backend app that serves the Wippy UI:

1. An HTTP server and a public router.
2. The `wippy/facade` dependency, wired to that server and router, with custom branding.
3. A running shell at `/` and its config at `/api/public/facade/config`.

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

Your app only ships the shell and the config; the UI itself comes from the CDN.

## Dependencies

The facade needs two things from your app: an `http.service` to serve files from, and
the `http.router` its config endpoint mounts on. Everything else is optional branding
with sensible defaults.

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

Note how the `app_title` parameter surfaces as `theming.host.i18n.app.title`.

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

## Notes

- The facade does not provide authentication. It expects an auth flow that writes a
  token to `localStorage`; without one it redirects to `login_path`. Pair it with
  `userspace/users` or your own auth.
- The UI bundle loads from the CDN (`fe_facade_url`), so the running app needs outbound
  network access to render.

## Next Steps

- [Hello World](tutorials/hello-world.md) — the minimal project layout
- [Authentication](tutorials/auth.md) — wire up the login flow the shell expects
- [HTTP Endpoints](http/endpoint.md) — routers, static files, and handlers
