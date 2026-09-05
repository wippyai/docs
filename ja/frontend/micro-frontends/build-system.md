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

例えば、選択したリリースタグが `v1.2.3` なら、正典のスナップショット URL は `https://web-host.wippy.ai/v1.2.3/import-map.json` のみです。ローカルのアプリケーション URL、ピン留めされていない `latest` の URL、手作業で再構成したパッケージ一覧で代用しないでください。
