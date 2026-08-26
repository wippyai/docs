---
title: "Theme Persistence"
description: "Configure the facade to persist light, dark, or automatic theme mode in a cookie or localStorage."
---

# Theme Persistence

By default, the Web Host resolves light or dark mode from `theme_mode` (the
facade default) and keeps the choice in memory. An explicit user choice is
therefore lost on reload. Theme persistence stores the choice in a **cookie**
or **localStorage** and loads it early so the wrong theme does not flash.

Persistence lives entirely in the facade. The Web Host stays storage-agnostic: it only emits a
`themeChanged` event that the facade (or any embedder) uses to persist the choice.

> **Opt-in.** `theme_persist` defaults to **`none`** — persistence is **off** unless a deployment
> explicitly sets it to `cookie` or `localStorage`. With the default, the theme
> comes from `theme_mode` and is not remembered across reloads. Nothing is
> stored, no cookie is written, and the generated script is a no-op.

## Configuration

Two facade parameters control it (see [Frontend Facade](../../framework/facade.md)):

| Parameter | Default | Values | Description |
|-----------|---------|--------|-------------|
| `theme_persist` | `none` | `none` \| `cookie` \| `localStorage` | Where the chosen mode is stored. `none` = current behavior. |
| `theme_storage_key` | `@wippy-theme-mode` | string | Cookie / localStorage key. |

Both are returned by the public config endpoint as `themePersist` and `themeStorageKey`, so pages
served outside the Web Host can read them too.

```yaml
# in your facade dependency parameters
- name: theme_persist
  value: cookie
- name: theme_storage_key
  value: "@wippy-theme-mode"
```

### Cookie vs localStorage

- **`cookie`** — the Jet-rendered host shell reads the cookie **server-side** and writes the
  `w-theme-*` class onto `<html>` before the response is sent, so the very first paint is already
  themed. This avoids a theme flash and is the preferred default.
- **`localStorage`** — the server can't read localStorage, so the stored value is applied by a
  synchronous inline script as early as possible. A brief flash is technically possible but minimized.

## The generated script

When persistence is enabled the facade **generates and serves** a small script at:

```
GET /api/public/facade/theme-persist.js
```

The configured key and mode are baked in — there is nothing to configure on the page. Include it
once, as early as possible in `<head>`:

```html
<script src="/api/public/facade/theme-persist.js"></script>
```

On load it reads the stored value and applies the `w-theme-*` class, then exposes a small API:

```js
window.wippyThemePersist = {
  mode,            // 'none' | 'cookie' | 'localStorage'
  key,             // the storage key
  read(),          // -> 'auto' | 'light' | 'dark' | null
  write(mode),     // persist a mode (no-op when mode === 'none')
  apply(mode),     // toggle the w-theme-* class on <html>
}
```

The host shell (`index.html` / the Jet `index.jet`) already includes this script,
seeds the stored value into the application, and persists changes. The sections
below apply to **other** pages.

## How it fits together (host shell)

1. **First paint** — cookie mode: the server set `<html class="w-theme-dark">`. localStorage mode:
   the early-apply script set it. Either way the page is themed before the bundle loads.
2. **Bootstrap** — the shell seeds the persisted value into the host:
   `themeMode: window.wippyThemePersist.read() ?? cfg.themeMode`, so the host applies the same mode.
3. **On change** — the host emits `themeChanged(mode)`; the shell persists it:
   `events.on('themeChanged', window.wippyThemePersist.write)`.

### The `themeChanged` host event

`globalEvents` — the emitter returned by `window.initWippyApp(...)` — fires `themeChanged(mode)`
(`'auto' | 'light' | 'dark'`) on init and on every theme change. It is persist-agnostic: the host
never touches storage; embedders decide what to do with it.

```js
const events = window.initWippyApp(config, '#app')
events.on('themeChanged', (mode) => {
  // e.g. persist, or notify a parent window
})
```

## Non-Wippy-hosted pages

A document outside the Wippy portable-module contract can honour and persist
the same theme. The native buttons below are appropriate only for such an
external static document. A Wippy page or component with these controls must
use PrimeVue under the [Portable UI Contract](../portable-ui-contract.md).
Include the generated script and call `write()` from your own switcher:

```html
<head>
  <!-- as early as possible: applies the stored theme + exposes window.wippyThemePersist -->
  <script src="/api/public/facade/theme-persist.js"></script>
  <!-- optional: reuse the facade brand theme too -->
  <link rel="stylesheet" href="/api/public/facade/variables.css">
</head>
<body>
  <button type="button" data-mode="auto">Auto</button>
  <button type="button" data-mode="light">Light</button>
  <button type="button" data-mode="dark">Dark</button>

  <script>
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode
        window.wippyThemePersist.apply(mode)   // update <html> now
        window.wippyThemePersist.write(mode)   // persist for next load / the host
      })
    })
  </script>
</body>
```

Because the key and storage mode are shared, a choice made on the login page
carries into the Web Host, and vice versa. The script receives both values from
the same facade configuration.

> Alternatively, fetch `/api/public/facade/config`, read `themePersist` and
> `themeStorageKey`, and implement storage directly. The generated script keeps
> that logic in one place.

## Server-side cookie rendering (zero flash)

For a custom server-rendered page (e.g. a Jet login template) you can apply the theme server-side,
exactly like the host shell does: read the cookie named by `theme_storage_key` from the request and
emit the matching class on `<html>`:

```html
<html lang="en"{{ if hasTheme }} class="{{ themeClass }}" style="color-scheme: {{ colorScheme }};"{{ end }}>
```

where the handler set `themeClass` to `w-theme-dark` / `w-theme-light` (and `colorScheme` to
`dark` / `light`) based on the cookie. Still include `theme-persist.js` so the page can write
changes back.
