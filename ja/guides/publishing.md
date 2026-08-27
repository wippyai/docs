---
title: "モジュールの公開"
description: "Wippy Hubを通じてモジュールを準備、検証、公開、設定、利用します。"
---

# モジュールの公開

公開ではモジュールをパッケージ化し、バージョンまたは可変ラベルをWippy Hubから利用できるようにします。

このページは、公開ワークフローとリファレンスです。`acme/*` モジュール、URL、トークン、認証情報、サンプルソースは例示用です。所属する組織が所有するリソースに置き換えてください。

## 前提条件

1. [hub.wippy.ai](https://hub.wippy.ai) でアカウントを作成します。
2. 組織を作成するか、既存の組織に参加します。
3. モジュール名を選択します。アカウントに権限があれば、初回公開時に存在しない名前を登録できます。アップロード前に登録してプロパティを明示的に設定するには `--create` を使用します。

## モジュール構造

```
mymodule/
├── wippy.yaml      # Module manifest
├── src/
│   ├── _index.yaml # Entry definitions
│   └── *.lua       # Source files
└── README.md       # Documentation (optional)
```

## wippy.yaml

`wippy.yaml` にモジュールのメタデータを定義します。

```yaml
organization: acme
module: http-utils
type: library
description: HTTP utilities and helpers
license: MIT
repository: https://github.com/acme/http-utils
homepage: https://acme.dev
keywords:
  - http
  - utilities
```

| フィールド | 必須 | 説明 |
|-------|----------|-------------|
| `organization` | はい | Hub 上の組織名 |
| `module` | はい | モジュール名 |
| `type` | いいえ | モジュールタイプ：`library`、`application`、`agent`、または `plugin` |
| `description` | いいえ | 短い説明 |
| `license` | いいえ | SPDX 識別子（MIT、Apache-2.0） |
| `repository` | いいえ | ソースリポジトリ URL |
| `homepage` | いいえ | プロジェクトホームページ |
| `keywords` | いいえ | 検索キーワード |

`type` はHubでのモジュール分類を制御し、後から公開する際に変更できます。`--module-type` フラグは、1回の公開に限りこの値を上書きします。省略した場合、新しく作成されるモジュールは非推奨の警告とともにデフォルトで `application` になります。

## エントリ定義

モジュールのエントリは `_index.yaml` で定義します。

```yaml
version: "1.0"
namespace: acme.http

entries:
  - name: definition
    kind: ns.definition
    meta:
      title: HTTP Utilities
      description: Helpers for HTTP operations
    readme: file://README.md
    wiki:
      GUIDE.md: file://docs/GUIDE.md
      examples/auth.md: file://docs/auth.md

  - name: client
    kind: library.lua
    source: file://client.lua
    modules:
      - http_client
      - json
```

`ns.definition` の `wiki:` マップは、READMEとともにドキュメントページを公開します。キーはページパス、値は `file://` 参照です。内容はパッキング時にインライン化され、HubからモジュールWikiとして提供されます。

## 依存関係

他のモジュールへの依存関係を宣言します。

```yaml
entries:
  - name: __dependency.wippy.test
    kind: ns.dependency
    meta:
      description: Testing framework
    component: wippy/test
    version: ">=0.3.0"
```

バージョン制約:

| 制約 | 意味 |
|------------|---------|
| `*` | 任意のバージョン |
| `1.0.0` | 厳密なバージョン |
| `>=1.0.0` | 最小バージョン |
| `^1.0.0` | 互換性あり（同じメジャーバージョン） |

## 要件

利用者が指定する必要のある設定を定義します。

```yaml
entries:
  - name: api_endpoint
    kind: ns.requirement
    meta:
      description: API endpoint URL
    targets:
      - entry: acme.http:client
        path: ".meta.endpoint"
    default: "https://api.example.com"
```

ターゲットは値を注入する場所を指定します。

- `entry` — 設定対象の完全なエントリID
- `path` — 値を注入する対象エントリ内のドットパス

`default` は任意のスカラー型を受け付けます — `default: 20` は数値ターゲットに文字列ではなく数値として流れ込みます。同じことは `ns.dependency` エントリの `parameters[].value` にも当てはまり、どちらも `${env:NAME}` 参照を受け付けます。参照はそのまま保持され、ターゲットエントリのデコード時に解決されます。

利用者はオーバーライドを通じて対象を設定できます。`-o` フラグは `namespace:entry:field=value` 形式の値を受け取ります。

```bash
wippy run -o acme.http:client:meta.endpoint=https://custom.api.com
```

## インポート

他のエントリを参照します。

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  modules:
    - json
  imports:
    client: acme.http:client           # Same namespace
    utils: acme.utils:helpers          # Different namespace
    base_registry: :registry           # Built-in
```

Luaでは次のように使用します。

```lua
local client = require("client")
local utils = require("utils")
```

## コントラクト

公開インターフェースを定義します。

```yaml
- name: http_contract
  kind: contract.definition
  meta:
    name: HTTP Client Contract
  methods:
    - name: get
      description: Perform GET request
    - name: post
      description: Perform POST request

- name: http_contract_binding
  kind: contract.binding
  contracts:
    - contract: acme.http:http_contract
      methods:
        get: acme.http:get_handler
        post: acme.http:post_handler
```

## 公開ワークフロー

### 1. 認証

```bash
wippy auth login
```

### 2. 準備

```bash
wippy init
wippy update
wippy lint
```

### 3. 検証

```bash
wippy publish --dry-run
```

### 4. 公開

```bash
wippy publish --version 1.0.0
```

リリースノート付き：

```bash
wippy publish --version 1.0.0 --release-notes "Initial release"
```

### 追加フラグ

| フラグ | 説明 |
|------|-------------|
| `--label <name>` | イミュータブルなバージョンの代わりに、可変ラベル（例：`latest`、`beta`）として公開する |
| `--protected` | 公開バージョンを保護対象としてマークする（削除や上書きが不可になる） |
| `--registry <url>` | この公開時のみレジストリ URL を上書きする |
| `--config <dir>` | `wippy.yaml` を含むディレクトリ（デフォルト：カレントディレクトリ） |
| `--create` | モジュールがまだ存在しない場合はハブに登録してから公開する |
| `--module-visibility <v>` | `--create` 用の可視性：`private`（デフォルト）または `public` |
| `--module-type <t>` | モジュールタイプ：`library`、`application`、`agent`、または `plugin`（wippy.yaml の `type:` を上書き） |
| `--module-display-name <n>` | `--create` 用の表示名 |

### 静的ファイルの埋め込み

埋め込み対象の `fs.directory` エントリは、`--embed` またはプロジェクトマニフェストの永続的な `embed:` リストで選択します。選択されたエントリは `fs.embed` リソースへ変換されます。選択されていない `fs.directory` エントリはパックに残りますが、参照先ディレクトリの内容は含まれません。

```yaml
# wippy.yaml
embed:
  - app:public_files
  - app:assets
```

```bash
wippy publish --version 1.0.0 --embed app:public_files
wippy publish --version 1.0.0 --embed app:assets,app:templates
```

マニフェストのリストと `--embed` フラグは、`fs.directory` エントリに一致するエントリIDまたは名前を受け付けます。同じCLIフラグは `wippy pack` でも使用でき、CLIでの選択はその呼び出しに限りマニフェストのリストを上書きします。

### 初回公開

初回公開時、モジュールはデフォルトでprivateとしてHubに登録され、公開が1回再試行されます。公開前に登録してプロパティを設定するには `--create` を使用します。

```bash
wippy publish --create --version 0.1.0 \
  --module-visibility public \
  --module-type library \
  --module-display-name "HTTP Utils"
```

`--create` は冪等です。すでに登録済みのモジュールでは作成ステップは何も行いません。アカウントが組織内でモジュールを作成できない場合、Hubは公開せず権限エラーを返します。

### ローカルハブへの公開

`--registry` をローカルで動作しているハブに向けると、公開とインストールをパブリックレジストリなしで行えます。プレーン HTTP はローカルホストに対してのみ許可されます — `localhost`、`127.0.0.1`、およびコンテナエイリアスの `host.docker.internal`（Docker Desktop / OrbStack）と `host.containers.internal`（Podman）。それ以外のホストは HTTPS を使用する必要があります。

```bash
wippy auth login --registry http://localhost:8080 --token wpy_xxx
wippy publish --registry http://localhost:8080 --create --version 0.1.0
```

レジストリとトークンは、環境変数 `WIPPY_REGISTRY` および `WIPPY_TOKEN` から取得することもできます。未設定の場合、レジストリはデフォルトで `https://hub.wippy.ai` になります。

### クォータ

組織のプライベートモジュールクォータが使い切られている場合、公開は `cannot publish: Private-module quota exhausted (5 of 5)...` のようなメッセージで失敗します。モジュールを public にするか、組織管理者にクォータの引き上げを依頼してください。アップロードとダウンロードは、一時的なネットワークエラー時に自動でリトライされます。

## 公開時のランタイムデフォルト {#publishing-runtime-defaults}

`type: application` のアプリケーションは、`wippy.yaml` の `publish.runtime` を通じて、ランタイム設定のデフォルトをパックに含めることができます。

```yaml
type: application
publish:
  runtime:
    source: .wippy.yaml            # default: .wippy.yaml
    sections: [security, registry, override]
    vars: [public_url]
```

| フィールド | 説明 |
|-------|-------------|
| `source` | セクションの読み取り元となる設定ファイル（デフォルト：`.wippy.yaml`） |
| `sections` | デフォルトとしてパックメタデータにコピーされるランタイム設定セクション |
| `vars` | 参照されていなくてもパックする変数の明示的な許可リスト |

ルール：

- パックされるのは、選択されたセクションまたは公開されるプロファイルから参照される変数のみです（推移的に辿られます）。それ以外はすべて `vars` エントリが必要です。
- エクスポートされる設定内の `${env:...}` 参照は拒否されます — 公開者の環境がパックに漏れることはありません。
- マシンローカルのセクション `boot`、`extensions`、`workspace` はエクスポートできません。
- ホストのランタイムデフォルトを提供するのはメインのアプリケーションパックのみで、依存パック内のランタイムメタデータは無視されます。

利用先での設定優先順位は、アプリケーションパックのデフォルト、ランタイムデフォルト、ローカル設定ファイル、選択したプロファイル、最後にCLIオーバーライドの順です。

## プロファイルの公開 {#publishing-profiles}

ルートアプリケーションのプロファイルは、パックの `runtime.profiles` メタデータにエクスポートされます。公開時にプロファイルが選択されたり焼き込まれたりすることはありません — 利用者が実行時に `wippy run --profile <name>` で選択します：

```yaml
publish:
  profiles:
    enabled: true
    source: config/profiles.yaml   # default: .wippy.yaml
    include: [production]          # omit to publish all non-workspace profiles
```

`include: []` では何も公開されず、未知の名前を指定すると公開に失敗します。`workspace` サブセクションは、公開されるプロファイル内にあってもエクスポートされません。プロファイルの宣言については、[設定](./configuration.md#profiles)を参照してください。

## 公開モジュールの利用

### 依存関係の追加

```bash
wippy add acme/http-utils
wippy add acme/http-utils@1.0.0
wippy install
```

### 要件の設定

ランタイム時に値をオーバーライドします：

```bash
wippy run -o acme.http:client:meta.endpoint=https://my.api.com
```

または `.wippy.yaml` 内：

```yaml
override:
  acme.http:client:meta.endpoint: "https://my.api.com"
```

### コードでのインポート

```yaml
# your src/_index.yaml
entries:
  - name: __dependency.acme.http
    kind: ns.dependency
    component: acme/http-utils
    version: ">=1.0.0"

  - name: my_handler
    kind: function.lua
    source: file://handler.lua
    imports:
      http: acme.http:client
```

## サンプルモジュール

**wippy.yaml:**
```yaml
organization: acme
module: cache
type: library
description: In-memory caching with TTL
license: MIT
keywords:
  - cache
  - memory
```

**src/_index.yaml:**
```yaml
version: "1.0"
namespace: acme.cache

entries:
  - name: definition
    kind: ns.definition
    meta:
      title: Cache Module

  - name: cache
    kind: library.lua
    source: file://cache.lua
    modules:
      - time
```

**src/cache.lua:**
```lua
local time = require("time")

local cache = {}
local store = {}

function cache.set(key, value, ttl)
    store[key] = {
        value = value,
        expires = ttl and (time.now():unix() + ttl) or nil
    }
end

function cache.get(key)
    local entry = store[key]
    if not entry then return nil end
    if entry.expires and time.now():unix() > entry.expires then
        store[key] = nil
        return nil
    end
    return entry.value
end

return cache
```

公開:

```bash
wippy init
wippy update
wippy lint
wippy publish --version 1.0.0
```

## 関連項目

- [CLIリファレンス](./cli.md) — 公開コマンドとフラグ
- [エントリ種別](./entry-kinds.md) — モジュールと依存関係のエントリ
- [設定](./configuration.md) — ランタイム設定とプロファイル
