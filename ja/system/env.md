# 環境変数システム

設定可能なストレージバックエンドを通じて環境変数を管理します。

## 概要

環境変数システムはストレージとアクセスを分離します：

- **ストレージ** - 値が保存される場所（OS、ファイル、メモリ）
- **変数** - ストレージ内の値への名前付き参照

変数は以下で参照できます：
- **パブリック名** - `variable`フィールドの値（システム全体で一意である必要があります）
- **エントリID** - 完全な`namespace:name`参照

変数を名前でパブリックにアクセス可能にしたくない場合は、`variable`フィールドを省略してください。

## エントリ種別

| 種別 | 説明 |
|------|------|
| `env.storage.memory` | インメモリキーバリューストレージ |
| `env.storage.file` | ファイルベースストレージ（.env形式） |
| `env.storage.os` | 読み取り専用OS環境変数アクセス |
| `env.storage.router` | 複数のストレージをチェーン |
| `env.variable` | ストレージを参照する名前付き変数 |

## ストレージバックエンド

### メモリストレージ

揮発性インメモリストレージ。

```yaml
- name: runtime_env
  kind: env.storage.memory
```

### ファイルストレージ

`.env`ファイル形式（`#`コメント付き`KEY=VALUE`）を使用した永続ストレージ。

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
| `file_path` | string | 必須 | .envファイルへのパス |
| `auto_create` | boolean | false | 存在しない場合はファイルを作成 |
| `file_mode` | integer | 0644 | ファイルパーミッション |
| `dir_mode` | integer | 0755 | ディレクトリパーミッション |

### OSストレージ

オペレーティングシステムの環境変数への読み取り専用アクセス。

```yaml
- name: os_env
  kind: env.storage.os
```

常に読み取り専用。Set操作は`PERMISSION_DENIED`を返します。

### ルーターストレージ

複数のストレージをチェーン。読み取りは見つかるまで順番に検索。書き込みは最初のストレージにのみ送信。

```yaml
- name: config
  kind: env.storage.router
  storages:
    - app.config:memory    # プライマリ（ここに書き込み）
    - app.config:file      # フォールバック
    - app.config:os        # フォールバック
```

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `storages` | array | ストレージ参照の順序付きリスト |

## 変数

変数はストレージ値への名前付きアクセスを提供します。

```yaml
- name: DATABASE_URL
  kind: env.variable
  variable: DATABASE_URL
  storage: app.config:file
  default: postgres://localhost/app
  read_only: false
```

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `variable` | string | パブリック変数名（オプション、一意である必要があります） |
| `storage` | string | ストレージ参照（`namespace:name`） |
| `default` | string | 見つからない場合のデフォルト値 |
| `read_only` | boolean | 変更を防止 |

### 変数の命名

変数名には次の文字のみ含めることができます：`a-z`、`A-Z`、`0-9`、`_`

### アクセスパターン

```yaml
# パブリック変数 - 名前"PORT"でアクセス可能
- name: port_var
  kind: env.variable
  variable: PORT
  storage: app.config:os
  default: "8080"

# プライベート変数 - ID "app.config:internal_key"でのみアクセス可能
- name: internal_key
  kind: env.variable
  storage: app.config:secrets
```

## エラー

| 条件 | 種別 | リトライ可能 |
|------|------|-------------|
| 変数が見つからない | `errors.NOT_FOUND` | いいえ |
| ストレージが見つからない | `errors.NOT_FOUND` | いいえ |
| 変数が読み取り専用 | `errors.PERMISSION_DENIED` | いいえ |
| ストレージが読み取り専用 | `errors.PERMISSION_DENIED` | いいえ |
| 無効な変数名 | `errors.INVALID` | いいえ |

## ランタイムアクセス

- [envモジュール](lua-env.md) - Luaランタイムアクセス

## 関連項目

- [セキュリティモデル](system-security.md) - 環境変数のアクセス制御
- [設定ガイド](guide-configuration.md) - アプリケーション設定パターン
