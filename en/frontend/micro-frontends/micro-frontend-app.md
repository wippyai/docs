---
title: "Page Recipe"
description: "A portable view.page recipe with supported routing, theme delivery, dependencies, and build ownership."
---

# Page Recipe

A page is a Vite-built application rendered in an `about:srcdoc` iframe. Its route and host context come from Wippy AppConfig and packages, not from browser location.

## Required setup

1. Register a `view.page` and its serving filesystem/router entries.
2. Enable required CSS delivery. Keep the `iframe` CSS block enabled for default scrollbar consistency.
3. Use `@wippy-fe/router` for Vue routing.
4. Install PrimeVue and the Wippy PrimeVue plugin when the page renders any PrimeVue-like control.
5. Use the shared Wippy Tailwind preset when the page authors Tailwind utilities.
6. Generate externals from the pinned Web Host import-map snapshot.
7. Build into the deployment-selected output directory.

```ts
import { createApp } from 'vue'
import PrimeVue from '@wippy-fe/theme/primevue-plugin'
import { createAppRouter } from '@wippy-fe/router'
import App from './App.vue'
import { routes } from './routes'

const app = createApp(App)
app.use(PrimeVue)
app.use(createAppRouter(routes))
app.mount('#app')
```

Verify the exact exported signatures against the selected package version. Do not create a local router synchronization layer.

## Theme injection

The page consumes the facade theme delivered into its iframe. Use public PrimeVue components, public theme variables, documented runtime-backed Tailwind utilities, and explicitly invariant compile-time utilities.

Do not use a host query parameter as an application fixture. AppConfig owns host context.

## Build

Invoke the Wippy module repository's Make target. Its recipe supplies the
deployment output with:

```text
npm run build -- --outDir <target> --emptyOutDir
```

`vite.config.ts` keeps relative asset behavior and does not hardcode deployment `outDir`.

Do not invoke the underlying package-manager or Vite build command directly.
On Windows, invoke `make.bat`; it delegates to the target's `make.ps1`
implementation.

See [Build and Dependency Contract](./build-system.md), [Platform Topology](../platform-topology.md), and [Configuration and Casing](./configuration-casing.md).
