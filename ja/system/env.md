---
title: "環境変数システム"
description: "メモリ、ファイル、オペレーティングシステム、静的な値、ストレージルーターをバックエンドとして環境変数を定義します。"
---

# 環境変数システム

環境変数エントリを使用すると、ランタイムコードは公開変数名またはレジストリエントリ ID で設定を参照できます。

このページは設定リファレンスです。YAML のコードブロックは、外側のドキュメントを含む場合を除いてエントリの断片です。

## ストレージとアクセス

このモデルでは、ストレージとアクセスを分離します。

- **ストレージ** - 値を保存する場所（OS、ファイル、メモリ）
- **変数** - ストレージ内の値への名前付き参照

変数は次の方法で参照できます。
- **公開名** - `variable` フィールドの値
- **エントリ ID** - 完全な `namespace:name` 参照

変数をエントリ ID でのみアクセス可能にする場合は、`variable` フィールドを省略します。
公開名を最初に取得した変数が、その短縮名を保持します。同じ公開名を持つ後続の変数も登録され、エントリ ID では引き続きアクセスできますが、既存の短縮名を置き換えることはありません。

## エントリ種別

| 種別 | 説明 |
|------|------|
| `env.storage.memory` | インメモリキーバリューストレージ |
| `env.storage.file` | ファイルベースのストレージ（.env 形式） |
| `env.storage.os` | 読み取り専用の OS 環境変数アクセス |
| `env.storage.static` | 読み取り専用の静的キーバリューストレージ |
| `env.storage.router` | 複数のストレージを連結 |
| `env.variable` | ストレージを参照する名前付き変数 |

## ストレージバックエンド

### メモリストレージ

揮発性のインメモリストレージです。

```yaml
- name: runtime_env
  kind: env.storage.memory
```

### ファイルストレージ

単純な `KEY=VALUE` 形式を使用する永続ストレージです。空行と `#` で始まる行は無視され、値の行にある `#` 以降のテキストはコメントとして扱われます。引用符で囲まれた値やエスケープシーケンスは特別に解析されません。

```yaml
- name: app_config
  kind: env.storage.file
  file_path: /etc/app/config.env
  auto_create: true
  file_mode: 0600
  dir_mode: 0700
```

| プロパティ | 型 | デフォルト | 説明 |
|-----------|-----|------------|------|
| `file_path` | string | 必須 | .env ファイルへのパス |
| `auto_create` | boolean | false | 存在しない場合にファイルを作成 |
| `file_mode` | integer | 0644 | ファイルのパーミッション |
| `dir_mode` | integer | 0755 | ディレクトリのパーミッション |

### OS ストレージ

オペレーティングシステムの環境変数への読み取り専用アクセスです。

```yaml
- name: os_env
  kind: env.storage.os
```

常に読み取り専用です。Set 操作は `PERMISSION_DENIED` を返します。

### 静的ストレージ

静的ストレージでは、設定内に値を直接定義します。値はエントリの一部であり、実行時には読み取り専用です。モジュールやパックとともに配布する公開定数を保持できます。

```yaml
- name: defaults
  kind: env.storage.static
  values:
    PUBLIC_API_HOST: "https://api.example.com"
    PUBLIC_WS_HOST: "wss://api.example.com/ws"
    APP_ENV: "production"
```

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `values` | map | キーバリューペア（string から string） |

常に読み取り専用です。Set 操作は `PERMISSION_DENIED` を返します。

### ルーターストレージ

ルーターは複数のストレージを連結します。キャッシュミス時、読み取りは値が見つかるまでストレージを順番に検索します。見つかった値はルーターにキャッシュされるため、それ以降にバックエンドストレージを直接変更しても、そのルーターからは変更が見えません。`NOT_FOUND` 以外のエラーが発生するとフォールバック検索は停止します。書き込み先は最初のストレージだけです。

```yaml
- name: config
  kind: env.storage.router
  storages:
    - app.config:memory    # Primary (writes here)
    - app.config:file      # Fallback
    - app.config:os        # Fallback
```

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `storages` | array | 必須の空でない、順序付きストレージ参照リスト |

## 変数

変数は、公開名またはエントリ ID をストレージバックエンド内の値にマッピングします。

```yaml
- name: DATABASE_URL
  kind: env.variable
  variable: DATABASE_URL
  storage: app.config:file
  default: postgres://localhost/app
  readonly: false
```

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `variable` | string | 省略可能な公開変数名 |
| `storage` | string | 必須のストレージ参照（`namespace:name`） |
| `default` | string | 見つからない場合のデフォルト値 |
| `readonly` | boolean | 変更を禁止 |

### 変数の命名

変数名に使用できる文字は `a-z`、`A-Z`、`0-9`、`_` だけです。

### アクセスパターン

```yaml
# Public variable - accessible by name "PORT"
- name: port_var
  kind: env.variable
  variable: PORT
  storage: app.config:os
  default: "8080"

# Private variable - accessible only by ID "app.config:internal_key"
- name: internal_key
  kind: env.variable
  storage: app.config:secrets
```

## プレースホルダー補間

登録済み変数は `${env:NAME}` プレースホルダーを使用してエントリ設定に取り込まれ、デコード時にこのレジストリに対して一元的に解決されます。エントリ種別によってフィールドが不透明と指定されていない限り、エントリ設定内の文字列は解決の対象です。`template.jet.source` のようなソースフィールドは不透明であるため、テンプレートやプログラムのテキストは書き換えられません。

| 構文 | 意味 |
|------|------|
| `${env:NAME}` | env レジストリを通じて `NAME` を解決。未設定でデフォルトがない場合はエラー |
| `${env:NAME\|default}` | `NAME` を解決し、未設定の場合は `default` にフォールバック |
| `${NAME\|default}` | 短縮形。`NAME` は大文字スネークケース（`A-Z0-9_`）で、`\|default` は必須。裸の `${VAR}` はそのまま残るため、埋め込まれたシェルやテンプレートの断片が参照と誤認されない |
| `$${` | リテラルの `${`（エスケープ） |

`NAME` は登録済み変数の公開名またはエントリ ID（ドットやコロンを含むレジストリ ID 形式、例: `app.env:tls_cert`）です。生の OS 環境変数**ではありません**。OS の値にアクセスできるのは、その名前で `env.storage.os` をバックエンドとする変数が登録されている場合だけです。

```yaml
- name: api
  kind: http.service
  addr: ":443"
  tls:
    mode: manual
    cert: ${env:app.env:tls_cert}
    key:  ${env:app.env:tls_key}
```

値全体が単一のプレースホルダーであるフィールドは、インラインデフォルトの型を取ります。たとえば `${env:PORT|8080}` は整数を生成し、保存されている値を整数に変換します。一方、`${env:PORT|"8080"}` は文字列のままです。周囲のテキストと混在するプレースホルダーは常に文字列になります。変数自身の `default` は、プレースホルダーのインライン `|default` より先に適用されます。解決結果がなくデフォルトもない参照は、デコードを失敗させます。

解決はデコード時にのみ行われます。保存されたレジストリエントリは生のプレースホルダーを保持するため、解決済みのシークレットが `registry.get` の結果や永続化された状態に現れることはありません。`${env:...}` を参照するエントリは、ブート時に依存先の env ストレージおよび変数より後になるよう自動的に順序付けられます。

<note>
古い設定では、同じ方法で解決される兄弟キーの <code>&lt;field&gt;_env</code> ディレクティブ（例: <code>cert_env: app.env:tls_cert</code>）を使用します。この形式は<b>非推奨</b>です。<code>${env:NAME}</code> プレースホルダーに移行してください。未登録の変数を指定する <code>&lt;field&gt;_env</code> キーはディレクティブとして扱われず、そのまま残されます。登録済みだが空の変数を指定した場合は、インラインの <code>&lt;field&gt;</code> 値が保持されます。変数の欠落でハードフェイルするのは、デフォルトのない明示的な <code>${env:NAME}</code> だけです。
</note>

## エラー

| 条件 | 種別 | リトライ可能 |
|------|------|-------------|
| 変数が見つからない | `errors.NOT_FOUND` | いいえ |
| ストレージが見つからない | `errors.NOT_FOUND` | いいえ |
| 変数が読み取り専用 | `errors.PERMISSION_DENIED` | いいえ |
| ストレージが読み取り専用 | `errors.PERMISSION_DENIED` | いいえ |
| 無効な変数名 | `errors.INVALID` | いいえ |

## ランタイムアクセス

- [env モジュール](../lua/system/env.md) - Lua ランタイムアクセス

## 関連項目

- [セキュリティモデル](./security.md) - 環境変数のアクセス制御
- [設定ガイド](../guides/configuration.md) - アプリケーション設定パターン
