---
title: "ビルドと依存関係の契約"
description: "正典となる出力コマンド、Windows 用ラッパー、Web ホストのインポートマップスナップショット、externals。"
---

# ビルドと依存関係の契約

## Wippy プロジェクトの正典ビルド契約

`wippy.exe` によって起動される Wippy アプリケーションまたはモジュールのリポジトリでは、リポジトリの Make ターゲットを呼び出してください。パッケージマネージャーや Vite のビルドコマンドを直接実行してはいけません。

本番向けフロントエンドの各ターゲットについて、Makefile のレシピは次を使用します。

```text
npm run build -- --outDir <target> --emptyOutDir
```

`<target>` はデプロイビルドが所有します。`vite.config.ts` はデプロイ用の出力ディレクトリをハードコードしてはいけません。

Web ホストのソースのように、`wippy.exe` によって起動されないプラットフォーム／パッケージのソースリポジトリでは、そのリポジトリの `package.json` が宣言しているスクリプトと引数をそのまま使用してください。Wippy モジュールの `--outDir <target> --emptyOutDir` というレシピは、パッケージソースのリポジトリ自身が宣言するスクリプトがそれらの引数を明示的にドキュメント化していない限り、適用されません。

### Makefile

```makefile
FRONTEND_OUTPUT := $(abspath app/src/app/static/example)

.PHONY: frontend-example
frontend-example:
	cd frontend/example && npm run build -- --outDir "$(FRONTEND_OUTPUT)" --emptyOutDir
```

### make.ps1

Windows ユーザーは、対応するターゲットを `make.bat` 経由で呼び出します。`make.ps1` は Makefile のターゲットを Windows 向けに実装したものであり、独立した公開ビルドインターフェースではありません。

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

`make.bat` は対応する PowerShell スクリプトへ委譲し、引数を転送し、その終了コードを返すだけです。
example ターゲットの場合、Windows ユーザーは `make.bat frontend-example` を実行します。

```bat
@powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0make.ps1" %*
@exit /b %ERRORLEVEL%
```

## インポートマップのスナップショットアルゴリズム

対象となる Web ホストのリリースが、ホスト提供モジュールを定義します。

1. 対象の Web ホストのリリースタグを確定します。
2. 開発中に一度だけ `https://web-host.wippy.ai/<release-tag>/import-map.json` を取得します。
3. リリースタグ、解決された正確な URL、完全な `imports` オブジェクト、そして取得したインポートマップのペイロードバイト列の小文字 SHA-256 を保存します。
4. その `imports` オブジェクトのすべてのキーを external にします。
5. ホストレスモードでも同じ完全なスナップショットを使用します。
6. ホストのリリースが変わったとき、または新しく追加した依存関係がホスト提供になった可能性があるときに再取得します。
7. ビルド出力を検査し、スナップショットに存在しないベアインポートを拒否します。

手書きのパッケージ一覧を維持しないでください。external の集合全体を peer dependencies へミラーしないでください。

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

スナップショットには出所とハッシュを含めなければなりません。スナップショットに存在しない依存関係は、別のドキュメント化されたビルドルールが当てはまらない限りバンドルされます。

承認済みの統合候補 Web Host 1.0.63 では、スナップショット URL は
`https://web-host.wippy.ai/webcomponents-1.0.63/import-map.json` の予定です。
リリース後にタグを確認してください。local application URL、unpinned `latest` URL、
手動で再構成した list に置換しないでください。

候補の PrimeVue 4.5.5 map entry は公開 export pattern から生成します。Host の
`primevue-export-inventory.json` に具体的な runtime target を記録します。Wildcard
や手作業の subset ではなく、正確な指定子を使ってください。[Host パッケージ](../web-host/packages.md)を参照してください。

### Host URL とデプロイパス

Web Host package の build には `APP_URL` が必要です。公開 HTTP(S) origin と
必要に応じてデプロイパスを設定します。未設定または無効な URL、認証情報、
query、fragment、path traversal は build で拒否されます。`/wippy` のような
パスを保持してください。Host は `dist/import-map.json` の絶対 URL にこのパスを
含めます。

パス配下へ production build するには、デプロイ URL を指定して package 全体を
build します。release tag を保持するため、`APP_IGNORE_TAG` は設定しません。

```powershell
$env:APP_URL = 'https://cdn.example/wippy'
Remove-Item Env:APP_IGNORE_TAG -ErrorAction SilentlyContinue
pnpm run build
```

tag なしの local build では両方を明示します。

```powershell
$env:APP_URL = 'http://localhost:5173'
$env:APP_IGNORE_TAG = '1'
pnpm run build
```

`APP_IGNORE_TAG=1` は release-tag prefix を除きます。local test 用であり、
versioned production deployment には使いません。`APP_URL` は常に必要です。
完全な `pnpm run build` は proxy、library、types の成果物も準備します。
`pnpm run build:site` はこれらの前提がそろった後、site のみを変更した場合の
incremental build に使います。
`build:site` は Vite の absolute base に `${APP_URL}/${tagPrefix}` を使います。
`build:site:relative` は Vite の relative asset base に tag prefix を使いますが、
import-map value は引き続き absolute URL です。

候補では `APP_URL=https://cdn.example/wippy` と tag
`webcomponents-1.0.63` から
`https://cdn.example/wippy/webcomponents-1.0.63/import-map.json` が生成されます。
vendor と dynamic chunk の URL も origin、デプロイパス、tag を保持します。
build 後に `dist/import-map.json` を確認してください。全 `imports` value が設定した
origin とパス配下の絶対 HTTP(S) URL であり、`/undefined/` を含まないことを確認します。
次に実際のデプロイルートから map と参照先 resource を取得します。build 成功だけでは
route を確認できません。

## AppConfig import map の URL

相対 target URL は作成されたドキュメントの base URL に対して解決されます。CDN とローカル mirror には、version と配置 path を固定した絶対 URL を使います。例は `https://cdn.example/wippy/vendor/` と `http://localhost:5173/vendor/` です。CDN module が別の bare specifier を import する場合は、その依存にも map が必要です。実行時 map は bundle 済み import を書き換えません。[ブートストラップの手順](../web-host/bootstrap.md#appconfig-import-map)を参照してください。

このフィールドは、対応が文書化された Host リリースでのみ使用してください。

## Release tag source

build tag は `CI_COMMIT_TAG` を使用し、未設定の場合は `APP_TAG` を使用します。CI 外でバージョン付き成果物を作る場合は `APP_TAG` を設定してください。
