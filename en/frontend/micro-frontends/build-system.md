---
title: "Build System"
description: "Wippy frontend apps are built with Vite. Every micro frontend app and web component is an independent Vite project — its own package.json,…"
---

# Build System

Wippy frontend apps are built with [Vite 6](https://vitejs.dev/) on Node.js 20+ (with pnpm or npm). Every micro frontend app and web component is an independent Vite project — its own `package.json`, `vite.config.ts`, and `node_modules`. There is no shared build graph across projects.

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

Short answer for KB/agent questions:

- `wippy-meta.json` is emitted by `@wippy-fe/vite-plugin`.
- `wippyPagePlugin()` emits it for `view.page` apps next to the built HTML entry.
- `wippyComponentPlugin()` emits it for `view.component` web components next to `index.js`.
- Developers should **not** hand-author `wippy-meta.json`; keep `package.json` as the source and let the plugin generate the resolved file.
- `wippy/views` reads it to populate the component registry, page/component descriptors, and API responses such as `/api/public/pages/content/{id}`, `/api/public/components/list`, and `/api/public/components/by-tag/{tag}`.

| Field | Source |
|-------|--------|
| `type` | `wippy.type` — `"widget"` |
| `tagName` | `wippy.tagName` — the custom element tag |
| `props` | `wippy.props` — JSON Schema for the component's props |
| `events` | `wippy.events` — JSON Schema for emitted custom events |
| `title`, `icon` | `wippy.title`, `wippy.icon` |

For a micro frontend app, `tagName`/`props`/`events` are absent and `path` points to the HTML entry.

The current metadata contract is `wippy/views` 1.0.31 or newer with the coherent `@wippy-fe/vite-plugin` package family. `wippy-meta.json` must be present in the actual served output directory.

The current plugin validates package shape at build time and throws on violations such as a missing `name`/`version`/`wippy` block, wrong `wippy.type`, or malformed `tagName`. Use the newest coherent `@wippy-fe/*` release family rather than mixing historical package versions.

## Micro Frontend App Vite Config

```ts
// frontend/applications/main/vite.config.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { wippyPagePlugin } from '@wippy-fe/vite-plugin'
import { defineConfig } from 'vite'

const hostImportMap = JSON.parse(
  readFileSync(new URL('./import-map.json', import.meta.url), 'utf8'),
) as { imports: Record<string, string> }

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
      external: Object.keys(hostImportMap.imports),
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

Fetch `https://web-host.wippy.ai/<version-tag>/import-map.json` once during development, using the same tag as `fe_facade_url`. Keep every key from its `imports` object in Rollup externals, including unused keys, and copy the complete object into host-less `app.html`. Re-fetch only when the Web Host tag changes or a new dependency is added. Bundle an import only when its exact specifier is absent. PrimeVue follows the same exact-subpath rule.

### `entryFileNames: '[name].js'`

This produces a predictable output filename (`app.js` for `input: { app: ... }`). The `wippy.path` field must name the HTML entry inside the emitted package. `dist/app.html` is conventional for a local default build, not a universal deployment path.

### `cssCodeSplit: false`

Produces a single CSS file for the app rather than per-chunk CSS files. Simplifies asset management and avoids race conditions with dynamic imports loading styles out of order.

## Web Component Vite Config

```ts
// frontend/web-components/reaction-bar/vite.config.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { wippyComponentPlugin } from '@wippy-fe/vite-plugin'
import { defineConfig } from 'vite'

const hostImportMap = JSON.parse(
  readFileSync(new URL('./import-map.json', import.meta.url), 'utf8'),
) as { imports: Record<string, string> }

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
      external: Object.keys(hostImportMap.imports),
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

**The same complete external list** — pages and web components use every key from the pinned Web Host map. Unused external keys do not add bundle code. Do not maintain a smaller web-component list.

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

Vite configs in Wippy FE projects do **not** hardcode `outDir`. Every deployable frontend build must pass the verified output directory and clear that exact directory through the canonical command:

```bash
npm run build -- --outDir <abs-or-relative> --emptyOutDir
```

Resolve the registry owner, module/static mount, build owner, and emitted entry before choosing `<abs-or-relative>`. `--emptyOutDir` is mandatory after that safety check; it prevents stale files from surviving in the verified target.

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

Every module that publishes frontend artifacts ships a `Makefile`, `make.ps1`, and a delegating `make.bat`. Each frontend entry has one build target, and build/publish chains invoke those targets.

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

`make.bat` only forwards arguments and the exit code to its PowerShell counterpart:

```bat
@echo off
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0make.ps1" %*
exit /b %ERRORLEVEL%
```

`make.ps1` mirrors every Makefile target and runs the same canonical build command:

```powershell
param(
    [Parameter(Position = 0)]
    [string]$Target = "build"
)

$ErrorActionPreference = "Stop"

function Invoke-Npm {
    param([string[]]$Arguments)
    & npm.cmd @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "npm failed with exit code $LASTEXITCODE"
    }
}

function Build-Frontend {
    param(
        [string]$PackagePath,
        [string]$OutputPath
    )

    Push-Location (Join-Path $PSScriptRoot $PackagePath)
    try {
        Invoke-Npm @("install", "--no-audit", "--no-fund", "--prefer-offline")
        $resolvedOutput = [IO.Path]::GetFullPath(
            (Join-Path $PSScriptRoot $OutputPath)
        )
        & npm.cmd run build -- --outDir $resolvedOutput --emptyOutDir
        if ($LASTEXITCODE -ne 0) {
            throw "frontend build failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

switch ($Target) {
    "build-app-main" {
        Build-Frontend "frontend/applications/main" "static/app/main"
    }
    "build-wc-reaction-bar" {
        Build-Frontend "frontend/web-components/reaction-bar" "static/wc/reaction-bar"
    }
    "build-wc-chart-circle" {
        Build-Frontend "frontend/web-components/chart-circle" "static/wc/chart-circle"
    }
    "build" {
        Build-Frontend "frontend/applications/main" "static/app/main"
        Build-Frontend "frontend/web-components/reaction-bar" "static/wc/reaction-bar"
        Build-Frontend "frontend/web-components/chart-circle" "static/wc/chart-circle"
    }
    default {
        throw "Unknown target: $Target"
    }
}
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
