# YAML & プロジェクト構造

プロジェクトレイアウト、YAML定義ファイル、命名規則について説明します。

## ディレクトリレイアウト

```
myapp/
├── .wippy.yaml          # ランタイム設定
├── wippy.lock           # ソースディレクトリ設定
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

### ファイル構造

`version`と`namespace`を持つYAMLファイルは有効です：

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    meta:
      comment: IDでユーザーを取得
    source: file://get_user.lua
    method: handler
    modules:
      - sql
      - json

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      comment: ユーザーAPIエンドポイント
    method: GET
    path: /users/{id}
    func: get_user
```

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `version` | はい | スキーマバージョン（現在は`"1.0"`） |
| `namespace` | はい | このファイルのエントリ名前空間 |
| `entries` | はい | エントリ定義の配列 |

### 命名規則

意味的な区切りにはドット（`.`）を、単語の区切りにはアンダースコア（`_`）を使用します：

```yaml
# 関数とそのエンドポイント
- name: get_user              # 関数
- name: get_user.endpoint     # そのHTTPエンドポイント

# 同じ関数に対する複数のエンドポイント
- name: list_orders
- name: list_orders.endpoint.get
- name: list_orders.endpoint.post

# ルーター
- name: api.public            # パブリックAPIルーター
- name: api.admin             # 管理者用APIルーター
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

`wippy.lock`ファイルはWippyが定義をロードする場所を定義します：

```yaml
directories:
  modules: .wippy
  src: ./src
```

WippyはこれらのディレクトリからYAMLファイルを再帰的にスキャンします。

## エントリ定義

各エントリは`entries`配列内に定義します。プロパティはルートレベルにあります（`data:`ラッパーなし）：

```yaml
entries:
  - name: hello
    kind: function.lua
    meta:
      comment: Hello Worldを返す
    source: file://hello.lua
    method: handler
    modules:
      - http
      - json

  - name: hello.endpoint
    kind: http.endpoint
    meta:
      comment: Helloエンドポイント
    method: GET
    path: /hello
    func: hello
```

### メタデータ

UI向けの情報には`meta`を使用します：

```yaml
- name: payment_handler
  kind: function.lua
  meta:
    title: 決済プロセッサ
    comment: Stripe決済を処理
  source: file://payment.lua
```

規則：`meta.title`と`meta.comment`は管理UIで適切にレンダリングされます。

### アプリケーションエントリ

アプリケーションレベルの設定には`registry.entry`種別を使用します：

```yaml
- name: config
  kind: registry.entry
  meta:
    title: アプリケーション設定
    type: application
  environment: production
  features:
    dark_mode: true
    beta_access: false
```

## 一般的なエントリ種別

| 種別 | 目的 |
|------|------|
| `registry.entry` | 汎用データ |
| `function.lua` | 呼び出し可能なLua関数 |
| `process.lua` | 長時間実行プロセス |
| `http.service` | HTTPサーバー |
| `http.router` | ルートグループ |
| `http.endpoint` | HTTPハンドラ |
| `process.host` | プロセススーパーバイザ |

完全なリファレンスは[エントリ種別ガイド](guide-entry-kinds.md)を参照してください。

## 設定ファイル

### .wippy.yaml

プロジェクトルートのランタイム設定：

```yaml
logger:
  level: info
  mode: production

host:
  worker_count: 16

http:
  address: :8080
```

すべてのオプションについては[設定ガイド](guide-configuration.md)を参照してください。

### wippy.lock

ソースディレクトリを定義します：

```yaml
directories:
  modules: .wippy
  src: ./src
```

## エントリの参照

エントリはフルIDまたは相対名で参照できます：

```yaml
# フルID（名前空間をまたぐ場合）
- name: main.router
  kind: http.router
  endpoints:
    - app.api:get_user.endpoint
    - app.api:list_orders.endpoint

# 同じ名前空間内 - 名前だけで参照
- name: get_user.endpoint
  kind: http.endpoint
  func: get_user
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

- [エントリ種別ガイド](guide-entry-kinds.md) - 利用可能なエントリ種別
- [設定ガイド](guide-configuration.md) - ランタイムオプション
- [カスタムエントリ種別](internal-kinds.md) - ハンドラの実装（上級）
