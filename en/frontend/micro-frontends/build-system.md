# Build System

Wippy frontend apps are built with [Vite](https://vitejs.dev/). Every micro frontend app and web component is an independent Vite project — its own `package.json`, `vite.config.ts`, and `node_modules`. There is no shared build graph across projects.

The `@wippy-fe/vite-plugin` package provides two Vite plugins that bridge your Vite project to the Wippy platform: `wippyPagePlugin()` for micro frontend apps, and `wippyComponentPlugin()` for web components. Their primary job is to emit `wippy-meta.json` alongside your build output so that `wippy/views` can read your component's identity, presentation metadata, and capabilities at registration time.

## `@wippy-fe/vite-plugin`

Install as a dev dependency:

```bash
npm install --save-dev @wippy-fe/vite-plugin
```

### `wippyPagePlugin()`

Use this plugin for `view.page` apps (Vue SPAs served in an iframe). It:

- Reads the `wippy` block from `package.json` at build time
- Resolves any `file://<relative>` references in the block (for example, `"file://custom-css.do-not-link.css"` is replaced with the file's UTF-8 contents inline)
- Emits `wippy-meta.json` in the output directory, next to your entry HTML
- Injects the same resolved JSON inline into the HTML as `<script type="application/json" data-role="@wippy/package">` for host-less dev mode

### `wippyComponentPlugin()`

Use this plugin for `view.component` web components (ES modules). It does the same resolution and emission as `wippyPagePlugin()`, minus the HTML injection.

### What `wippy-meta.json` contains

The file is the resolved `wippy` block from `package.json`, written as a JSON object. For a web component it includes:

| Field | Source |
|-------|--------|
| `type` | `wippy.type` — `"widget"` |
| `tagName` | `wippy.tagName` — the custom element tag |
| `props` | `wippy.props` — JSON Schema for the component's props |
| `events` | `wippy.events` — JSON Schema for emitted custom events |
| `title`, `icon` | `wippy.title`, `wippy.icon` |

For a micro frontend app, `tagName`/`props`/`events` are absent and `path` points to the HTML entry.

`wippy/views` ≥ 0.5.0 reads `wippy-meta.json` from the served directory to populate the component registry and API responses. The file must be present; its absence triggers a per-process deprecation warning and a fallback synthesis path that will be removed in a future release.

Starting with `@wippy-fe/vite-plugin` 0.0.32, the plugin enforces the shape at build time and throws on violations such as a missing `name`/`version`/`wippy` block, wrong `wippy.type`, or a malformed `tagName`.

## Micro Frontend App Vite Config

```ts
// frontend/applications/main/vite.config.ts
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    wippyPagePlugin(),
  ],
  base: '',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
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

### `base: ''` — mandatory

Setting `base` to an empty string makes all asset paths relative (`./app-abc123.js` instead of `/app-abc123.js`). This is mandatory because a Wippy micro frontend app is served from a CDN subdirectory whose path changes with every build. Absolute paths break silently — the browser requests `/app-abc123.js` from the origin instead of the CDN bucket, and the app fails to load.

### External dependencies

The Web Host provides a subset of libraries via a browser import map. Bundling them into your app creates version conflicts and inflates bundle size unnecessarily. Mark them `external` so Rollup leaves the `import` statements intact for the browser to resolve at runtime.

**Must always be external:**

| Package | Why |
|---------|-----|
| `vue` | Vue 3 runtime — must be a single instance |
| `pinia` | Vue store — shared with the host store tree |
| `@iconify/vue` | Icon component — host loads the icon registry |
| `@wippy-fe/proxy` | Wippy proxy API (`api`, `host`, `on`) |

**External only if you import them:**

| Package | Version |
|---------|---------|
| `vue-router` | 4.5.0 |
| `axios` | 1.8.3 |
| `nanoevents` | 9.1.0 |
| `luxon` | 3.5.0 |
| `@tanstack/vue-query` | 5.69.0 |
| `@tanstack/query-core` | 5.69.0 |

> **Note:** `@wippy-fe/pinia-persist` is an npm package but is **not** in the host import map. Bundle it — do not add it to `external`.

> **Note:** PrimeVue is not in the host import map. Bundle it as well.

### `entryFileNames: '[name].js'`

This produces a predictable output filename (`app.js` for `input: { app: ... }`). The `wippy.path` field in `package.json` must match this filename — for a micro frontend app, `"path": "dist/app.html"` which is the HTML entry that references the compiled `app.js`.

### `cssCodeSplit: false`

Produces a single CSS file for the app rather than per-chunk CSS files. Simplifies asset management and avoids race conditions with dynamic imports loading styles out of order.

## Web Component Vite Config

```ts
// frontend/web-components/reaction-bar/vite.config.ts
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    wippyComponentPlugin(),
  ],
  build: {
    target: 'esnext',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ReactionBar',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/index.ts'),
      },
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
    },
    sourcemap: true,
  },
})
```

### Key differences from a micro frontend app config

**`lib` mode** — web components are built as ES library bundles, not as HTML-entry SPAs. The `entry` points to the TypeScript source, and `formats: ['es']` produces a single ESM file.

**No `base: ''`** — lib mode does not emit an HTML file, so there are no asset path concerns with `base`.

**Slimmer `external` list** — web components do not use `vue-router` (they are not routable pages), so it is omitted.

### `preserveEntrySignatures` and the facade problem

When Vite builds a lib with multiple chunks, it may emit a small facade module at the entry point that just re-exports from the real chunk. This is controlled by Rollup's `preserveEntrySignatures` option. If you let Vite use its default here (which varies by mode), you may end up with a 175-byte facade that looks like:

```js
// index.js (the facade — wrong)
export { webComponent } from './index-abc123.js'
```

The autoload system that registers web components appends a `?declare-tag=<tag>` query parameter to the module URL when importing it. This query ends up on `index.js`, not on the sub-chunk URL. When the component calls `define(import.meta.url, ...)`, it reads `import.meta.url` — which is the sub-chunk URL without the query — and the tag registration is silently skipped.

> **Note:** The `?declare-tag=<tag>` query — attached to the **component module URL** so `define()` can read the tag — is a different mechanism from the `?auto_register=true` query that appears on the `/api/public/components/list` endpoint (see [Debugging](./debugging.md)). Don't conflate the two: one carries the tag to the module, the other gates whether the registry endpoint includes auto-registered components.

The fix is to set `preserveEntrySignatures: false` **explicitly** under `build.rollupOptions`. Do not rely on the default: Rollup's own default is `'strict'`, and Vite's lib-mode handling of this option has varied across versions, so a developer who omits the line can still hit the facade bug.

```ts
build: {
  // ...
  rollupOptions: {
    // ...
    // Merge deps into the entry chunk instead of emitting a facade +
    // sub-chunk, so define(import.meta.url, ...) stays in the entry where
    // the ?declare-tag= query is attached.
    preserveEntrySignatures: false,
  },
},
```

Verify your build output contains the actual component code in `index.js` and not a one-liner re-export.

## Build Output Location

Vite configs in Wippy FE projects do **not** hardcode `outDir`. The output directory is passed by the build orchestrator on the command line:

```bash
npm run build -- --outDir ../../../static/wc/reaction-bar --emptyOutDir
```

This decouples the build definition from the deployment layout. The same Vite config can target a local `static/` directory for serving via the Wippy backend, a temporary directory for CDN upload, or a staging path — without touching `vite.config.ts`.

The `--emptyOutDir` flag clears the target directory before building, preventing stale files from previous builds from lingering.

## npm Scripts

Both micro frontend apps and web components follow the same script conventions:

```json
{
  "scripts": {
    "build": "vite build",
    "build:debug": "vite build --mode development",
    "dev": "vite build --watch",
    "lint": "eslint src --ext .ts,.vue"
  }
}
```

The `wippy.scripts` block in `package.json` maps these script names for the Wippy build pipeline:

```json
{
  "wippy": {
    "scripts": {
      "build": "build",
      "debug": "build:debug"
    }
  }
}
```

## TypeScript Support — `@wippy-fe/types-global-proxy`

Add this package to `devDependencies` to get TypeScript type definitions for the internal proxy globals — the `window.$W` global and the `getWippyApi()` function. You only need it if you reference those globals directly; ordinary proxy usage via `import { host, api, on } from '@wippy-fe/proxy'` is already fully typed by the package itself and needs nothing extra.

```bash
npm install --save-dev @wippy-fe/types-global-proxy
```

Then reference it in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["@wippy-fe/types-global-proxy"]
  }
}
```

Or add it to the `include` array if you prefer explicit file resolution:

```json
{
  "include": ["src", "node_modules/@wippy-fe/types-global-proxy"]
}
```

Without this package, TypeScript will not know the shape of the internal proxy globals (`window.$W`, `window.getWippyApi()`, `window.__WIPPY_*`) if you reference them directly. This is only needed for that rare, discouraged case — ordinary proxy usage via `import { host, api, on } from '@wippy-fe/proxy'` is already fully typed by `@wippy-fe/proxy` itself and requires nothing extra.

## Multi-Project Builds

Repos that contain several apps and web components (like the app template) build each project independently and collect the outputs into a shared `static/` directory. A Makefile is a common orchestrator:

```makefile
build: build-app-main build-wc-reaction-bar build-wc-chart-circle

build-app-main:
    cd frontend/applications/main && npm install && npm run build -- \
        --outDir ../../../static/app/main --emptyOutDir

build-wc-reaction-bar:
    cd frontend/web-components/reaction-bar && npm install && npm run build -- \
        --outDir ../../../static/wc/reaction-bar --emptyOutDir

build-wc-chart-circle:
    cd frontend/web-components/chart-circle && npm install && npm run build -- \
        --outDir ../../../static/wc/chart-circle --emptyOutDir
```

The `static/` directory is then served by the Wippy backend, and each registry entry's `url` or `base_path` field points into the appropriate subdirectory.

Each project installs its own `node_modules` — there is no hoisting or workspace protocol between them. This keeps dependency trees isolated and avoids version conflicts between apps that share a package name but need different versions.

## Debug Builds

The `build:debug` script runs Vite in development mode:

```bash
npm run build:debug
# equivalent to:
vite build --mode development
```

This disables minification and keeps readable variable names in the output. Use it when investigating proxy injection issues, inspecting how `import.meta.url` resolves, or checking that `define()` receives the expected URL query parameters. The `sourcemap: true` in `vite.config.ts` ensures source maps are always emitted regardless of mode.
