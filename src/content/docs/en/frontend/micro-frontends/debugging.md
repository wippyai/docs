---
title: "Debugging Wippy FE"
---

# Debugging Wippy FE

When something is broken, start here. Each section lists the most common causes in order of likelihood with the specific DevTools check for each.

## Blank screen on load

**1. Check the Console first:**
- `Failed to resolve module specifier 'vue'` — the import map is missing. In hosted mode, the host injects it; in host-less mode, confirm your `app.html` `<script type="importmap">` block includes `vue`, `pinia`, and `vue-router`. (Do NOT list `@wippy-fe/proxy` there. It IS a real ES module — it's in your vite `rollupOptions.external` and IS resolved via an importmap entry — but you don't author that entry: in hosted mode the Web Host injects `@wippy-fe/proxy` → `<host>/<tag>/@wippy-fe/proxy.js` into the merged importmap (and the host's entries override yours), and in host-less mode `dev-proxy` provides the mapping. Omit it because the host / dev-proxy OWNS that mapping — not because the proxy is "resolved only via globals.")
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
The `@wippy-fe/proxy` getters READ these globals (`window.__WIPPY_APP_API__` is the live host instance) — that is separate from how the `@wippy-fe/proxy` module URL itself resolves. If these globals are present but your `@wippy-fe/proxy` imports still come back undefined, you have a wrong/stale `@wippy-fe/proxy` entry in your `app.html` importmap pointing the module at a URL that never installs the runtime globals (the host's own entry overrides yours, so this only bites in host-less mode). Remove your entry and let `dev-proxy` / the host supply it.

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

**2. Verify CSS variables are active:**

For micro frontend apps — open DevTools, select the **inner iframe** context (not the outer page) in the frame selector:
```javascript
getComputedStyle(document.documentElement).getPropertyValue('--p-primary-color')
// non-empty = themeConfig injection is working
```

For web components — in DevTools, select your custom element's **shadow root** context:
```javascript
getComputedStyle(document.documentElement).getPropertyValue('--p-primary-color')
// custom properties cross shadow boundary; empty = something wrong upstream
```

**3. Web component specific:**
- If CSS vars are empty inside shadow root: check that `hostCssKeys` includes `'themeConfigUrl'` in your `wippyConfig`
- If PrimeVue components render unstyled: add `'primeVueCssUrl'` to `hostCssKeys`

See [Theming: Micro Frontend Apps](./micro-frontend-app-theming.md) or [Theming: Web Components](./web-component-theming.md) for the full injection pipeline.

## Host URL bar doesn't update

Your micro frontend app must call `host.onRouteChanged` in every `router.afterEach` and subscribe to `@history` events to sync back. If either is missing, the URL bar freezes and the back button breaks.

**Check:**
```typescript
import { host, on } from '@wippy-fe/proxy'

// Must exist in app.ts / router setup
router.afterEach((to) => {
  host.onRouteChanged(to.fullPath)  // notifies host of new child route
})

// Must exist to receive host-initiated navigation
on('@history', ({ path }) => {
  router.push(path)
})
```

In host-less mode: the dev overlay Monitor tab shows the current route the proxy thinks the app is on. If it's not updating, `onRouteChanged` isn't being called.

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
Your `app.html` may have an inline import map that pins specific versions. In hosted mode, the host replaces this with its own import map. If your inline map pins different versions, you get conflicts. Remove or keep your inline map in sync with the host's version.

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
