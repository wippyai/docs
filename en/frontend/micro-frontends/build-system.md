---
title: "Build and Dependency Contract"
description: "Canonical output commands, Windows wrappers, Web Host import-map snapshots, and externals."
---

# Build and Dependency Contract

## Canonical Wippy production build contract

For a production artifact in a Wippy application or module repository launched
by `wippy.exe`, invoke the repository Make target. Local watch-mode commands
such as `npm run dev` remain valid when the repository documents them, but they
do not replace the deployment build.

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

For web-component entry builds, preserve the entry module's registration side effect:

```ts
export default {
  build: {
    rollupOptions: {
      preserveEntrySignatures: 'strict',
    },
  },
}
```

Using `false` can move `define(import.meta.url, Component)` out of the entry chunk, leaving the Host's `?declare-tag=` import unable to register the element.

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

For the Web Host 1.0.56 baseline, the canonical snapshot URL is
`https://web-host.wippy.ai/webcomponents-1.0.56/import-map.json`. Do not substitute the local
application URL, an unpinned `latest` URL, or a manually reconstructed package
list.

This Host release coordinates with public `@wippy-fe/*` 0.0.56 packages.
`@wippy-fe/vite-plugin` 0.0.56 supports Vite 5, 6, and 7. The examples in this
documentation use Vite 7 with Node 22.12 or newer; consumers that deliberately
remain on Vite 5 or 6 must follow that Vite release's Node requirements. The
Web Host source repository separately declares Node 22+ and uses Vite 7.
