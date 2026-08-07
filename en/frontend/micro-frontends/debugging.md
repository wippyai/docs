---
title: "Debugging Wippy FE"
description: "When something is broken, start here. Each section lists the most common causes in order of likelihood with the specific DevTools check for each."
---

# Debugging Wippy FE

When something is broken, start here. Each section lists the most common causes in order of likelihood with the specific DevTools check for each.

## Blank screen on load

**1. Check the Console first:**
- `Failed to resolve module specifier 'vue'` — the page externalized a specifier that its active import map does not provide. In hosted mode inspect the import map actually served by the target Web Host release; in host-less mode inspect the map in `app.html`. Compare every Rollup external against that exact map instead of assuming a canonical package list or merge precedence.
- `Proxy globals not found` (or your `@wippy-fe/proxy` imports come back undefined) — `proxy.js` / `dev-proxy.js` did not load before your app script ran, so the runtime never installed its internal globals. Check that `dev-proxy.js` is referenced with `data-role="@wippy/scripts"` in `app.html`.
- Silent hang (no errors, no app) — config is injected synchronously as `window.__WIPPY_APP_CONFIG__` before `proxy.js` runs, so the `@wippy-fe/proxy` getters resolve (or throw `Proxy globals not found`) immediately; they do not await `SetConfig`. A true hang means the runtime never mounted — either `proxy.js` / `dev-proxy.js` failed to load and install its globals (see the `Proxy globals not found` bullet above), or, in host-less mode, the dev overlay is sitting in "waiting" because you haven't clicked **Accept**. Confirm the dev overlay FAB (floating button) appeared; if not, the proxy script did not load. (The `SetConfig` / `GetConfig` handshake only applies to the host-level manual `iframe.html?waitForCustomConfig` embedding, not a hosted or host-less micro frontend.)

**2. Check the Network tab:**
- Confirm `dev-proxy.js` (host-less) or `proxy.js` (hosted) loaded with status 200.
- If 404: the `src` in your `<script data-role="@wippy/scripts">` tag points to the wrong URL.

**3. Check the runtime installed its globals (internal diagnostic):**
```javascript
// Internal globals — app code never reads these; this is only a console smoke test
// that the proxy runtime mounted. App/WC code uses `import { ... } from '@wippy-fe/proxy'`.
window.$W              // should be an object, not undefined
window.__WIPPY_APP_API__ // the resolved proxy instance — present once the runtime installed
```
The `@wippy-fe/proxy` getters read these globals (`window.__WIPPY_APP_API__` is the live host instance); that is separate from how the module URL resolves. If the globals exist but imports fail, inspect the active import map and the network response for the exact `@wippy-fe/proxy` specifier. Fix the map or externalization decision in the environment that serves the page; do not infer hosted behavior from a successful host-less boot.

## Web component never appears

**1. Verify the three gates:**

Run from your backend:
```bash
curl /api/public/components/list?auto_register=true
```
Your component's `tag_name` must appear in the response. If not:
- `announced: true` missing in `_index.yaml` → add it
- `auto_register: true` missing → add it
- Component is not registered with `wippy/views` → check your module deps

**2. Check the Console:**
```javascript
customElements.get('your-tag-name')  // undefined means the element was not registered
```

**3. Check the Network tab:**
- Filter for your component's `index.js` URL
- The URL should contain `?declare-tag=your-tag-name` — this is how the element registers itself
- If the URL has no `?declare-tag=` query: `define(import.meta.url, MyElement)` was not in the entry chunk. This is the `preserveEntrySignatures: false` problem — see [Build System](./build-system.md)

## API calls failing / 401

**1. In host-less mode:**
- The `dev-token` stub in the proxy config is not a real credential — it will always get 401 from a real backend
- Open the dev overlay → find the `auth.token` field in the JSON config → paste a real bearer token
- Confirm `APP_API_URL` in the overlay config points to the running backend (not localhost if your backend is elsewhere)

**2. In hosted mode:**
- Handle 401 by calling `host.handleError('auth-expired', error)` — this triggers the host's re-authentication flow
- If all API calls 401: check that the host's session token is being injected correctly (the proxy handles this automatically via `api.get(...)`)

## Theme looks wrong

**1. In host-less mode:**
The dev overlay starts with `themeConfig`, `primevue`, `markdown`, and `iframe` injection **disabled by default**. Your app will render without any platform CSS until you enable them.

Open the dev overlay FAB → toggle the CSS injections you need → check "Auto-accept on reload".

**2. Compare the complete effective chain:**

A non-empty token is not sufficient. Use distinct values so a stock-palette reset or accidental family alias is obvious:

```yaml
css_variables:
  "--p-primary": "#dc2626"
  "--p-secondary": "#7c3aed"
  "--p-accent": "#0d9488"
  "--p-danger": "#be123c"
  "--p-success": "#15803d"
  "--p-warn": "#c2410c"
  "--p-info": "#0369a1"
  "--p-help": "#9333ea"
  "--theme-diagnostic-sentinel": "#123456"
```

Then compare, in this order:

1. **Effective configured map:** inspect `config.theming.global.cssVariables` and confirm the base plus the active `@light` / `@dark` replacements.
2. **Page root:** read the exact token with `getComputedStyle(document.documentElement).getPropertyValue(name).trim()`.
3. **WC host:** read the same token from `getComputedStyle(customElement)`.
4. **WC inner root:** read it from `getComputedStyle(customElement.shadowRoot.querySelector('[data-wippy-theme-root]'))`.
5. **Rendered semantic color:** put `background-color: var(--p-<family>-color)` on a probe and compare its computed `backgroundColor`; this physically resolves `color-mix()`.

Repeat in Auto-light, Auto-dark, forced Light, and forced Dark. For each configured family verify its base, all 50–950 shades, `color`, `contrast-color`, `hover-color`, and `active-color`; also verify a direct shade/alias override, a surface token, and the sentinel. Page, host, and inner values must agree.

Interpret the first divergence: wrong effective map means configuration/merge; wrong page root means variable compilation/injection; correct page but wrong WC host means host propagation; correct WC host but wrong inner root means the forced-theme bridge or local defaults; equal tokens but wrong rendered color means the consuming selector or semantic alias is wrong.

**3. Web component specific:**
- If the platform defaults are absent, check that `hostCssKeys` includes `'themeConfigUrl'`.
- If the host is correct but the inner root resets to stock values, verify a current `@wippy-fe/webcomponent-core`; do not copy a palette into component CSS.
- If PrimeVue components render unstyled, add `'primeVueCssUrl'` to `hostCssKeys`.

See [Theming: Micro Frontend Apps](./micro-frontend-app-theming.md) or [Theming: Web Components](./web-component-theming.md) for the full injection pipeline.

## Host URL bar doesn't update

Portable micro frontend apps must use the `createAppRouter()` factory from `@wippy-fe/router`. The package owns both directions of host synchronization; application code must not reproduce `router.afterEach` and `@history` wiring.

**Check:**
```typescript
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import { routes } from './routes'

const router = createAppRouter(routes, {
  initialPath: config.context?.route ?? '/',
})
```

If the host URL still does not update, confirm the current `@wippy-fe/router` family is installed coherently and that no local wrapper replaces the factory. In host-less mode, the dev overlay Monitor tab shows the route the package reports.

## Works locally, breaks when hosted

**1. Check `document.baseURI`:**
```javascript
document.baseURI  // should be <url>/<base_path>/ from your registry entry
```
If empty or wrong: the `<base>` tag was not injected. Check that `base_path` in `_index.yaml` matches the actual directory structure of your built output.

**2. Check proxy globals (internal diagnostic):**
```javascript
window.__WIPPY_PROXY_CONFIG__  // internal — must exist in iframe-hosted mode
```
Undefined means the proxy was not injected before your app ran. App code never reads this directly; see [Proxy & Isolation § Internals](../web-host/proxy-isolation.md#internals--do-not-read-or-override).

**3. Confirm `base: ''` in vite.config.ts:**
Without `base: ''`, Vite emits absolute asset paths. The app loads fine on your local dev server (which serves from `/`) but 404s when served from a CDN subdirectory.

**4. Import map mismatch:**
Re-fetch `<version-tag>/import-map.json` from the Web Host release pinned by
`fe_facade_url`. Replace the complete `imports` object in host-less `app.html`
and regenerate Vite externals from all of its keys. Do not remove the host-less
map or patch individual entries. Bundle a newly imported exact specifier only
when it is absent from the fetched map.

## Using the logger as a debugging tool

`logger.debug()` and `logger.info()` output appears in the browser Console during development — not just in production transports. Use it to trace the boot sequence:

```typescript
import { logger, config, host, api } from '@wippy-fe/proxy'

export function createMainApp() {
  logger.debug('App bootstrap started')
  logger.debug('Host services resolved', { hasConfig: !!config })
  // ... use config, host, api directly
}
```

`logger.captureException(error)` also logs to Console in dev mode and is caught by the host's error capture system in production.
