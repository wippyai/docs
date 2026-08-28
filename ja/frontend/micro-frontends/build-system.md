---
title: "Build と dependency の契約"
description: "canonical output command、Windows wrapper、Web Host import-map snapshot、external。"
---

# Build と dependency の契約

既存 repository 向け reference contract です。Makefile、PowerShell、batch、Vite block は focused fragment で、standalone project scaffold ではありません。

## Wippy の標準 production build 契約

`wippy.exe` が起動する Wippy application/module repository の production artifact では repository Make target を呼びます。documented な `npm run dev` 等の local watch-mode command は有効ですが deployment build の代わりにはなりません。

全 production frontend target の Makefile recipe は次を使います。

```text
npm run build -- --outDir <target> --emptyOutDir
```

deployment build が `<target>` を所有します。`vite.config.ts` に deployment output directory を hardcode しません。

Web Host source など `wippy.exe` が起動しない platform/package-source repository は、その repository の `package.json` が宣言する exact script/argument を使います。自身の script が明記しない限り Wippy module の `--outDir <target> --emptyOutDir` recipe は適用しません。

### Makefile

```makefile
FRONTEND_OUTPUT := $(abspath app/src/app/static/example)

.PHONY: frontend-example
frontend-example:
	cd frontend/example && npm run build -- --outDir "$(FRONTEND_OUTPUT)" --emptyOutDir
```

### make.ps1

Windows user は matching target を `make.bat` から呼びます。`make.ps1` は Windows で Makefile target を実装するもので、別の public build interface ではありません。

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

`make.bat` は PowerShell counterpart に委譲し、argument と exit code を転送するだけです。例では `make.bat frontend-example` を実行します。

```bat
@powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0make.ps1" %*
@exit /b %ERRORLEVEL%
```

## Import-map snapshot algorithm

target Web Host release が host-provided module を定義します。

1. target Web Host release tag を解決する。
2. 開発中に `https://web-host.wippy.ai/<release-tag>/import-map.json` を一度取得する。
3. release tag、exact resolved URL、完全な `imports` object、取得 payload byte の lowercase SHA-256 を保存する。
4. `imports` の全 key を externalize する。
5. host-less mode に同じ完全 snapshot を使う。
6. host release change 時、または新 dependency が host-provided になり得るとき再取得する。
7. built output を検査し、snapshot にない bare import を拒否する。

hand-written package list を維持せず、external 全件を peer dependency に copy しません。

web-component entry build では entry module の registration side effect を保持します。

```ts
export default {
  build: {
    rollupOptions: {
      preserveEntrySignatures: 'strict',
    },
  },
}
```

`false` は `define(import.meta.url, Component)` を entry chunk 外へ移し、Host の `?declare-tag=` import から登録できなくなる場合があります。

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

snapshot には provenance と hash が必要です。不在 dependency は別の documented build rule がない限り bundle します。

Web Host 1.0.56 baseline の canonical URL は `https://web-host.wippy.ai/webcomponents-1.0.56/import-map.json` です。local application URL、unpinned `latest` URL、手動再構成 list に置換しないでください。

この Host release は public `@wippy-fe/*` 0.0.56 と coordination します。`@wippy-fe/vite-plugin` 0.0.56 は Vite 5/6/7 に対応します。example は Node 22.12+ と Vite 7 を使い、Vite 5/6 を選ぶ consumer は各 release の Node requirement に従います。Web Host source repository 自体は Node 22+ と Vite 7 を宣言します。
