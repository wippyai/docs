# モジュールのパブリッシング

Wippy Hubで再利用可能なコードを共有します。

## 前提条件

1. [hub.wippy.ai](https://hub.wippy.ai)でアカウントを作成
2. 組織を作成するか、既存の組織に参加
3. 組織の下にモジュール名を登録

## モジュール構造

```
mymodule/
├── wippy.yaml      # モジュールマニフェスト
├── src/
│   ├── _index.yaml # エントリ定義
│   └── *.lua       # ソースファイル
└── README.md       # ドキュメント（オプション）
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
|-----------|------|------|
| `organization` | はい | ハブ上の組織名 |
| `module` | はい | モジュール名 |
| `description` | はい | 短い説明 |
| `license` | いいえ | SPDX識別子（MIT, Apache-2.0） |
| `repository` | いいえ | ソースリポジトリURL |
| `homepage` | いいえ | プロジェクトホームページ |
| `keywords` | いいえ | 検索キーワード |

## エントリ定義

エントリは`_index.yaml`で定義します：

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

他のモジュールへの依存関係を宣言：

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
|------|------|
| `*` | 任意のバージョン |
| `1.0.0` | 正確なバージョン |
| `>=1.0.0` | 最小バージョン |
| `^1.0.0` | 互換性あり（同じメジャー） |

## 要件

コンシューマが提供する必要がある設定を定義：

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

ターゲットは値が注入される場所を指定：
- `entry` - 設定するフルエントリID
- `path` - 値注入用のJSONPath

コンシューマはオーバーライドで設定：

```bash
wippy run -o acme.http:api_endpoint=https://custom.api.com
```

## インポート

他のエントリを参照：

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

Luaで：

```lua
local client = require("client")
local utils = require("utils")
```

## コントラクト

パブリックインターフェースを定義：

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

## パブリッシングワークフロー

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

### 保護されたバージョン

本番リリースを保護済みとしてマーク（yankできない）：

```bash
wippy publish --version 1.0.0 --protected
```

## 公開されたモジュールの使用

### 依存関係の追加

```bash
wippy add acme/http-utils
wippy add acme/http-utils@1.0.0
wippy install
```

### 要件の設定

実行時に値をオーバーライド：

```bash
wippy run -o acme.http:api_endpoint=https://my.api.com
```

または`.wippy.yaml`で：

```yaml
override:
  acme.http:api_endpoint: "https://my.api.com"
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

- [CLIリファレンス](guides/cli.md)
- [エントリ種別](guides/entry-kinds.md)
- [設定](guides/configuration.md)
