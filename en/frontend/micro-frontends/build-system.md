---
title: "Build and Dependency Contract"
description: "Canonical output commands, Windows wrappers, Web Host import-map snapshots, and externals."
---

# Build and Dependency Contract

## Canonical Wippy project build contract

In a Wippy application or module repository launched by `wippy.exe`, invoke the
repository Make target. Do not run package-manager or Vite build commands
directly.

The Makefile recipe for every production frontend target uses:

```text
npm run build -- --outDir <target> --emptyOutDir
```

The deployment build owns `<target>`. `vite.config.ts` must not hardcode a deployment output directory.

Platform/package source repositories that are not launched by `wippy.exe`, such
as Web Host source, use the exact scripts and arguments declared by that
repository's `package.json`. The Wippy module `--outDir <target>
--emptyOutDir` recipe does not apply to package-source repositories unless
their own declared script explicitly documents those arguments.

### Makefile

```makefile
FRONTEND_OUTPUT := $(abspath app/src/app/static/example)

.PHONY: frontend-example
frontend-example:
	cd frontend/example && npm run build -- --outDir "$(FRONTEND_OUTPUT)" --emptyOutDir
```

### make.ps1

Windows users invoke the matching target through `make.bat`. `make.ps1`
implements the Makefile target for Windows; it is not a separate public build
interface.

```powershell
param(
  [Parameter(Position = 0)]
  [string]$Target = "help"
)

$ErrorActionPreference = "Stop"
$targets = @("frontend-example")
if ($Target -notin $targets) {
  throw "Unknown target '$Target'. Available targets: $($targets -join ', ')"
}

$Output = "app/src/app/static/example"
$resolvedOutput = [System.IO.Path]::GetFullPath(
  [System.IO.Path]::Combine($PSScriptRoot, $Output)
)
Push-Location (Join-Path $PSScriptRoot "frontend/example")
try {
  npm.cmd run build -- --outDir $resolvedOutput --emptyOutDir
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
  Pop-Location
}
```

### make.bat

`make.bat` only delegates to its PowerShell counterpart, forwards arguments, and returns its exit code.
For the example target, Windows users run `make.bat frontend-example`.

```bat
@powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0make.ps1" %*
@exit /b %ERRORLEVEL%
```

## Import-map snapshot algorithm

The target Web Host release defines host-provided modules.

1. Resolve the target Web Host release tag.
2. Fetch
   `https://web-host.wippy.ai/<release-tag>/import-map.json` once during
   development.
3. Store the release tag, exact resolved URL, complete `imports` object, and
   lowercase SHA-256 of the exact fetched import-map payload bytes.
4. Externalize every key in that `imports` object.
5. Use the same complete snapshot for host-less mode.
6. Re-fetch when the host release changes or when a newly added dependency may now be host-provided.
7. Inspect the built output and reject bare imports absent from the snapshot.

Do not maintain a hand-written package list. Do not mirror the full external set into peer dependencies.

```ts
import hostImportMap from './wippy-import-map.json'

export default {
  build: {
    rollupOptions: {
      external: Object.keys(hostImportMap.imports),
    },
  },
}
```

The snapshot must include its provenance and hash. A dependency absent from the snapshot is bundled unless another documented build rule applies.

For the approved combined Web Host 1.0.63 candidate, the expected snapshot URL is
`https://web-host.wippy.ai/webcomponents-1.0.63/import-map.json`. Confirm the tag
after the release is published. Do not substitute the local
application URL, an unpinned `latest` URL, or a manually reconstructed package
list.

The candidate's PrimeVue 4.5.5 entries are generated from its public export
patterns and recorded in the Host-root `primevue-export-inventory.json`. The
inventory lists concrete package-relative runtime targets. Use its exact
specifier entries; do not replace them with a wildcard external or a manually
maintained subset. See [Host packages](../web-host/packages.md#primevue-455-browser-exports).

### Host build URLs and deployment paths

The Web Host package build requires `APP_URL`. Set it to the public HTTP(S)
origin and optional deployment path. The build rejects a missing or invalid URL,
including credentials, query strings, fragments, and traversal segments.
Preserve a deployment path such as `/wippy`; the Host uses it when it creates
absolute URLs in `dist/import-map.json`.

For a production build served below a path, use the full package build with the
deployment URL. Leave `APP_IGNORE_TAG` unset so the release tag remains in the
URLs:

```powershell
$env:APP_URL = 'https://cdn.example/wippy'
Remove-Item Env:APP_IGNORE_TAG -ErrorAction SilentlyContinue
pnpm run build
```

For a local untagged build, set both environment values explicitly:

```powershell
$env:APP_URL = 'http://localhost:5173'
$env:APP_IGNORE_TAG = '1'
pnpm run build
```

`APP_IGNORE_TAG=1` removes the release-tag prefix. Use it for local testing, not
for a versioned production deployment. `APP_URL` remains required. The
full `pnpm run build` prepares proxy, library, and type artifacts as well as the
site. Use `pnpm run build:site` only for a site-owned incremental change after
those prerequisites exist. The
`build:site` script uses Vite's absolute base `${APP_URL}/${tagPrefix}`. The
`build:site:relative` script uses the tag prefix as Vite's relative asset base;
it still needs `APP_URL` because the import-map values are absolute.

For the candidate, `APP_URL=https://cdn.example/wippy` and tag
`webcomponents-1.0.63` produce the import-map URL
`https://cdn.example/wippy/webcomponents-1.0.63/import-map.json`; mapped vendor
and dynamic-chunk URLs must keep the same origin, deployment path, and tag.
After building, inspect `dist/import-map.json`: every `imports` value must be an
absolute HTTP(S) URL under the configured origin and path, and none may contain
`/undefined/`. Then request the versioned map and its mapped resources through
the actual deployment route. A successful build alone does not verify routing.

## AppConfig import-map URLs

Relative map targets resolve against the created document's base URL. Prefer absolute URLs pinned to the release and deployment path, such as `https://cdn.example/wippy/vendor/` or `http://localhost:5173/vendor/`. If a mapped CDN module imports another bare specifier, map that dependency too or use a self-contained CDN module. Runtime map changes do not rewrite imports already embedded in a consumer bundle. See [Bootstrap Sequence](../web-host/bootstrap.md#appconfig-import-map).

Use this field only with a deployed Host release that documents support for it.

## Release tag source

The build tag comes from `CI_COMMIT_TAG`; when that is unset, `APP_TAG` supplies it. Set `APP_TAG` when building a versioned artifact outside CI.
