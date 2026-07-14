---
title: "モジュールの公開"
---

# モジュールの公開

再利用可能なコードを Wippy Hub で共有します。

## 前提条件

1. [hub.wippy.ai](https://hub.wippy.ai) でアカウントを作成する
2. 組織を作成するか、既存の組織に参加する
3. 組織内でモジュール名を登録する

## モジュール構造

```
mymodule/
├── wippy.yaml      # モジュールマニフェスト
├── src/
│   ├── _index.yaml # エントリ定義
│   └── *.lua       # ソースファイル
└── README.md       # ドキュメント（任意）
```

## wippy.yaml

モジュールマニフェスト：

```yaml
organization: acme
module: http-utils
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
| `description` | いいえ | 短い説明 |
| `license` | いいえ | SPDX 識別子（MIT、Apache-2.0） |
| `repository` | いいえ | ソースリポジトリ URL |
| `homepage` | いいえ | プロジェクトホームページ |
| `keywords` | いいえ | 検索キーワード |

## エントリ定義

エントリは `_index.yaml` で定義します：

```yaml
version: "1.0"
namespace: acme.http

entries:
  - name: definition
    kind: ns.definition
    meta:
      title: HTTP Utilities
      description: Helpers for HTTP operations

  - name: client
    kind: library.lua
    source: file://client.lua
    modules:
      - http_client
      - json
```

## 依存関係

他のモジュールへの依存関係を宣言します：

```yaml
entries:
  - name: __dependency.wippy.test
    kind: ns.dependency
    meta:
      description: Testing framework
    component: wippy/test
    version: ">=0.3.0"
```

バージョン制約：

| 制約 | 意味 |
|------------|---------|
| `*` | 任意のバージョン |
| `1.0.0` | 厳密なバージョン |
| `>=1.0.0` | 最小バージョン |
| `^1.0.0` | 互換性あり（同じメジャーバージョン） |

## 要件

利用者が指定する必要のある設定を定義します：

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

ターゲットは値が注入される場所を指定します：
- `entry` - 設定対象のエントリ ID
- `path` - 値を注入する JSONPath

利用者はオーバーライドで設定します。`-o` フラグは `namespace:entry:field=value` のトリプルを受け取ります：

```bash
wippy run -o acme.http:client:meta.endpoint=https://custom.api.com
```

## インポート

他のエントリを参照します：

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  modules:
    - json
  imports:
    client: acme.http:client           # 同じ名前空間
    utils: acme.utils:helpers          # 異なる名前空間
    base_registry: :registry           # 組み込み
```

Lua 内：

```lua
local client = require("client")
local utils = require("utils")
```

## コントラクト

公開インターフェースを定義します：

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
| `--module-type <t>` | `--create` 用のタイプ：`application`（デフォルト）、`library`、`agent`、または `plugin` |
| `--module-display-name <n>` | `--create` 用の表示名 |

### 静的ファイルの埋め込み

`fs.directory` エントリ（静的アセット、テンプレート、公開ファイル）を含むモジュールは、それらを公開パッケージに含めるために `--embed` を使用する必要があります。これがない場合、`fs.directory` エントリは除外されます。

```bash
wippy publish --version 1.0.0 --embed app:public_files
wippy publish --version 1.0.0 --embed app:assets,app:templates
```

`--embed` フラグは、エントリ ID または `fs.directory` エントリに一致する名前を受け取ります。同じフラグは `wippy pack` でも利用できます。

### 初回公開

モジュールを初めて公開すると、自動的にハブに登録され（デフォルトでは private）、公開が一度リトライされます。事前に登録してプロパティを設定するには `--create` を渡します。

```bash
wippy publish --create --version 0.1.0 \
  --module-visibility public \
  --module-type library \
  --module-display-name "HTTP Utils"
```

`--create` は冪等です — すでに登録済みのモジュールでは create ステップは何もしません。アカウントが組織内でモジュールを作成できない場合、ハブは公開する代わりに権限エラーを返します。

### ローカルハブへの公開

`--registry` をローカルで動作しているハブに向けると、公開とインストールをパブリックレジストリなしで行えます。プレーン HTTP はローカルホストに対してのみ許可されます — `localhost`、`127.0.0.1`、およびコンテナエイリアスの `host.docker.internal`（Docker Desktop / OrbStack）と `host.containers.internal`（Podman）。それ以外のホストは HTTPS を使用する必要があります。

```bash
wippy auth login --registry http://localhost:8080 --token wpy_xxx
wippy publish --registry http://localhost:8080 --create --version 0.1.0
```

レジストリとトークンは、環境変数 `WIPPY_REGISTRY` および `WIPPY_TOKEN` から取得することもできます。未設定の場合、レジストリはデフォルトで `https://hub.wippy.ai` になります。

### クォータ

組織のプライベートモジュールクォータが使い切られている場合、公開は `cannot publish: Private-module quota exhausted (5 of 5)...` のようなメッセージで失敗します。モジュールを public にするか、組織管理者にクォータの引き上げを依頼してください。アップロードとダウンロードは、一時的なネットワークエラー時に自動でリトライされます。

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

## 完全な例

**wippy.yaml:**
```yaml
organization: acme
module: cache
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

  - name: max_size
    kind: ns.requirement
    meta:
      description: Maximum cache entries
    targets:
      - entry: acme.cache:cache
        path: ".meta.max_size"
    default: "1000"

  - name: cache
    kind: library.lua
    meta:
      max_size: 1000
    source: file://cache.lua
    modules:
      - time
```

**src/cache.lua:**
```lua
local time = require("time")

local cache = {}
local store = {}
local max_size = 1000

function cache.set(key, value, ttl)
    if #store >= max_size then
        cache.evict_oldest()
    end
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

公開：

```bash
wippy init && wippy update && wippy lint
wippy publish --version 1.0.0
```

## 関連項目

- [CLI リファレンス](guides/cli.md)
- [エントリ種別](guides/entry-kinds.md)
- [設定](guides/configuration.md)
