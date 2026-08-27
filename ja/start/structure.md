---
title: "YAML & プロジェクト構造"
description: "プロジェクトレイアウト、YAML定義ファイル、命名規則について説明します。"
---

# YAML & プロジェクト構造

プロジェクトレイアウト、YAML定義ファイル、命名規則について説明します。

## ディレクトリレイアウト

```
myapp/
├── .wippy.yaml          # Runtime configuration
├── wippy.lock           # Source directories config
├── .wippy/              # Installed modules
└── src/                 # Application source
    ├── _index.yaml      # Entry definitions
    ├── api/
    │   ├── _index.yaml
    │   └── *.lua
    └── workers/
        ├── _index.yaml
        └── *.lua
```

## YAML定義ファイル

<note>
YAML定義は起動時にレジストリにロードされます。レジストリが真のソースであり、YAMLファイルはそれを設定する一つの方法です。エントリは他のソースから来ることも、プログラムで作成することもできます。
</note>

### Definition file の形式 :id=definition-file-format

definition file には `namespace` と、`entries` array または top-level の `name` / `kind` field が必要です。省略可能な `version` marker は慣例上 `"1.0"` ですが、v0.3.32a loader では必須ではありません。

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    meta:
      comment: Fetches user by ID
    source: file://get_user.lua
    method: handler
    modules:
      - sql
      - json

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      comment: User API endpoint
    method: GET
    path: /users/{id}
    func: get_user
```

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `version` | いいえ | manifest version marker（慣例上 `"1.0"`） |
| `namespace` | はい | この file の entry namespace |
| `entries` | 条件付き | entry definition の array。top-level の `name` と `kind` を使う場合のみ省略 |

### 命名規則

意味的な区切りにはドット（`.`）を、単語の区切りにはアンダースコア（`_`）を使用します：

```yaml
# Function and its endpoint
- name: get_user              # The function
- name: get_user.endpoint     # Its HTTP endpoint

# Multiple endpoints for same function
- name: list_orders
- name: list_orders.endpoint.get
- name: list_orders.endpoint.post

# Routers
- name: api.public            # Public API router
- name: api.admin             # Admin API router
```

<tip>
パターン: <code>base_name.variant</code> - ドットは意味的な部分を区切り、アンダースコアはその部分内の単語を区切ります。
</tip>

### 名前空間

名前空間はドット区切りの識別子です：

```
app
app.api
app.api.v2
app.workers
```

エントリのフルIDは名前空間と名前を組み合わせます：`app.api:get_user`

### ソースディレクトリ

`wippy.lock` file は application source root と、locked module を resolve する base directory を指定します。

```yaml
directories:
  modules: .wippy
  src: ./src
```

Wippy は `directories.src` を application load path に追加します。`directories.modules` は raw source tree として scan されません。locked module は versioned `.wapp` archive または unpacked module path、replacement は設定済み entry root に resolve されます。loader は application source と、選択された directory-based module / replacement root を再帰的に scan し、`.yaml`、`.yml`、`.json` manifest を読み込みます。`.wapp` module は archive として読みます。`namespace` を持つ object-shaped file だけが registry manifest となり、`node_modules` directory は除外されます。`_index.yaml` は project convention であり、唯一の有効 filename ではありません。

## エントリ定義

`entries` array の各 item が 1 つの entry を定義します。kind 固有 field は、次のように `name`、`kind`、`meta` と同じ level に置けます。

```yaml
entries:
  - name: hello
    kind: function.lua
    meta:
      comment: Returns hello world
    source: file://hello.lua
    method: handler
    modules:
      - http
      - json

  - name: hello.endpoint
    kind: http.endpoint
    meta:
      comment: Hello endpoint
    method: GET
    path: /hello
    func: hello
```

明示的な `data:` field も利用できます。指定した場合、その value が kind 固有 payload 全体になるため、sibling の kind 固有 field と混在させないでください。

```yaml
entries:
  - name: config
    kind: registry.entry
    data:
      environment: production
      features:
        dark_mode: true
```

### メタデータ

UI向けの情報には`meta`を使用します：

```yaml
- name: payment_handler
  kind: function.lua
  meta:
    title: Payment Processor
    comment: Handles Stripe payments
  source: file://payment.lua
```

規則：`meta.title`と`meta.comment`は管理UIで適切にレンダリングされます。

### アプリケーションエントリ

アプリケーションレベルの設定には`registry.entry`種別を使用します：

```yaml
- name: config
  kind: registry.entry
  meta:
    title: Application Settings
    type: application
  environment: production
  features:
    dark_mode: true
    beta_access: false
```

## 一般的なエントリ種別

| 種別 | 目的 |
|------|------|
| `registry.entry` | 通常の event dispatch を行わず保存する汎用 data |
| `function.lua` | 呼び出し可能なLua関数 |
| `process.lua` | 長時間実行プロセス |
| `http.service` | HTTPサーバー |
| `http.router` | ルートグループ |
| `http.endpoint` | HTTPハンドラ |
| `process.host` | process execution host |

entry-kind reference は[エントリ種別ガイド](../guides/entry-kinds.md)を参照してください。

## 設定ファイル

### .wippy.yaml

プロジェクトルートのランタイム設定：

```yaml
version: "1.0"

logger:
  encoding: json

logmanager:
  min_level: 0

supervisor:
  host:
    worker_count: 16
```

runtime configuration field は[設定ガイド](../guides/configuration.md)を参照してください。

### wippy.lock

ソースディレクトリを定義します：

```yaml
directories:
  modules: .wippy
  src: ./src
```

## エントリの参照

entry kind が対応する場合、full ID または relative name で entry を参照できます。HTTP router と endpoint は parent 側の child list ではなく、`meta.server` と `meta.router` で attach します。

```yaml
# Router declares itself against a server
- name: api
  kind: http.router
  meta:
    server: app:gateway
  prefix: /api

# Endpoint references router by registry ID (cross-namespace works the same way)
- name: get_user.endpoint
  kind: http.endpoint
  meta:
    router: app.api:api
  method: GET
  path: /users/{id}
  func: app.api:get_user
```

## プロジェクト例

```
myapp/
├── .wippy.yaml
├── wippy.lock
└── src/
    ├── _index.yaml           # namespace: app
    ├── api/
    │   ├── _index.yaml       # namespace: app.api
    │   ├── users.lua
    │   └── orders.lua
    ├── lib/
    │   ├── _index.yaml       # namespace: app.lib
    │   └── database.lua
    └── workers/
        ├── _index.yaml       # namespace: app.workers
        └── email_sender.lua
```

## 関連項目

- [アプリケーションアーキテクチャ](../concepts/architecture.md) — application を slice と layer に整理
- [エントリ種別ガイド](../guides/entry-kinds.md) — 利用可能な entry kind
- [設定ガイド](../guides/configuration.md) — runtime option
- [カスタムエントリ種別](../internals/kinds.md) — handler の実装（上級）
