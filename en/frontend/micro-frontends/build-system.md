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

For example, if the selected release tag is `v1.2.3`, the only canonical
snapshot URL is
`https://web-host.wippy.ai/v1.2.3/import-map.json`. Do not substitute the local
application URL, an unpinned `latest` URL, or a manually reconstructed package
list.
