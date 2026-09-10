---
title: "YAML & プロジェクト構造"
description: "プロジェクトレイアウト、YAML定義ファイル、命名規則について説明します。"
---

# YAML & プロジェクト構造

プロジェクトレイアウト、YAML定義ファイル、命名規則について説明します。

## ディレクトリレイアウト

```
myapp/
├── .wippy.yaml          # ランタイム設定
├── wippy.lock           # ソースディレクトリとロックされたモジュール
├── .wippy/              # インストール済みモジュール
└── src/                 # アプリケーションソース
    ├── _index.yaml      # エントリ定義
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

`namespace`に加えて、`entries`配列またはトップレベルの`name`+`kind`のいずれかを持つYAMLファイルは有効な定義ファイルです。`version`は省略可能です：

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
| `version` | いいえ | スキーマバージョン（現在は`"1.0"`） |
| `namespace` | はい | このファイルのエントリ名前空間 |
| `entries` | はい | エントリ定義の配列 |

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

### ロックファイル

`wippy.lock`は、Wippyが定義をロードする場所と、選択されたモジュールのバージョンを記録します：

```yaml
directories:
  modules: .wippy
  src: ./src
options:
  unpack_modules: false
modules:
  - name: acme/http
    version: v1.2.0
    hash: 4ea816fe84ca58a1f0869e5ca6afa93d6ddd72fa09e1162d9e600a7fbf39f0a2
```

| フィールド | 説明 |
|------------|------|
| `directories.src` | アプリケーションのソースディレクトリ。YAML定義ファイルを再帰的にスキャンする |
| `directories.modules` | ベンダリングされたモジュールのベースディレクトリ。パックは`<modules>/vendor/`配下に配置される |
| `options.unpack_modules` | 各`.wapp`をパックのまま読み込むのではなく、その隣のディレクトリへ展開する（デフォルトは`false`）|
| `modules[].name` | `org/module`形式のモジュール識別子 |
| `modules[].version` | 選択されたバージョン |
| `modules[].hash` | ベンダリングされたパックが一致しなければならないアーティファクトのダイジェスト |
| `modules[].root` | 選択されたデプロイメントルートを示す。これを持てるモジュールは最大1つ |

ベンダリングされたパックは`.wapp`ファイルとして保持されます。`unpack_modules: true`の場合、各モジュールはディレクトリへも展開され、検証済みの`.wapp`はその隣に残ります。インストール処理はパックを探すため、パックが失われたディレクトリは再度ダウンロードされます。

`wippy.lock`内の`replacements:`セクションは非推奨です。警告付きで引き続きロードされますが、ローカルモジュールのオーバーライドはランタイム設定ファイルの`workspace.replacements`配下で宣言してください。[依存関係管理](guides/dependency-management.md#local-development-with-replacements)を参照してください。

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

entry-kind reference は[エントリ種別ガイド](guides/entry-kinds.md)を参照してください。

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

runtime configuration field は[設定ガイド](guides/configuration.md)を参照してください。

### wippy.lock

ソースディレクトリと選択されたモジュールグラフ — 上記の[ロックファイル](#the-lock-file)を参照してください。

## エントリの参照

エントリはフルIDまたは相対名で参照できます。子は親側のリストではなく、`meta`を通じて親に紐付きます：

```yaml
# ルーターは自身をサーバーに対して宣言する
- name: api
  kind: http.router
  meta:
    server: app:gateway
  prefix: /api

# エンドポイントはレジストリIDでルーターを参照する（名前空間をまたぐ場合も同じ）
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

- [アプリケーションアーキテクチャ](concepts/architecture.md) — application を slice と layer に整理
- [エントリ種別ガイド](guides/entry-kinds.md) — 利用可能な entry kind
- [設定ガイド](guides/configuration.md) — runtime option
- [カスタムエントリ種別](internals/kinds.md) — handler の実装（上級）
