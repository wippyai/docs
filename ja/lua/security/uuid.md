# UUID生成
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

ユニバーサル一意識別子を生成。ワークフロー向けに適応 - ランダムUUIDはリプレイ時に一貫した値を返す。

## ロード

```lua
local uuid = require("uuid")
```

## ランダムUUID

### バージョン1

タイムスタンプとノードIDを持つ時間ベースUUID。

```lua
local id, err = uuid.v1()
```

**戻り値:** `string, error`

### バージョン4

ランダムUUID。

```lua
local id, err = uuid.v4()
```

**戻り値:** `string, error`

### バージョン7

時間順序UUID。作成時刻でソート可能。

```lua
local id, err = uuid.v7()
```

**戻り値:** `string, error`

## 決定論的UUID

### バージョン3

MD5を使用した名前空間と名前からの決定論的UUID。

```lua
local id, err = uuid.v3(namespace, name)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `namespace` | string | 有効なUUID文字列 |
| `name` | string | ハッシュする値 |

**戻り値:** `string, error`

### バージョン5

SHA-1を使用した名前空間と名前からの決定論的UUID。

```lua
local NS_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
local id, err = uuid.v5(NS_URL, "https://example.com/resource")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `namespace` | string | 有効なUUID文字列 |
| `name` | string | ハッシュする値 |

**戻り値:** `string, error`

## 検査

### 検証

```lua
local valid = uuid.validate(input)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `input` | any | チェックする値 |

**戻り値:** `boolean`

### バージョン取得

```lua
local ver, err = uuid.version(id)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `uuid` | string | 有効なUUID文字列 |

**戻り値:** `integer, error`

### バリアント取得

```lua
local var, err = uuid.variant(id)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `uuid` | string | 有効なUUID文字列 |

**戻り値:** `string, error`（RFC4122、Microsoft、NCS、またはInvalid）

### パース

```lua
local info, err = uuid.parse(id)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `uuid` | string | 有効なUUID文字列 |

**戻り値:** `table, error`

返されるテーブルのフィールド:
- `version`（integer）: UUIDバージョン（1、3、4、5、または7）
- `variant`（string）: RFC4122、Microsoft、NCS、またはInvalid
- `timestamp`（integer）: Unixタイムスタンプ（v1とv7のみ）
- `node`（string）: ノードID（v1のみ）

### フォーマット

```lua
local formatted, err = uuid.format(id, "standard")
local formatted, err = uuid.format(id, "simple")
local formatted, err = uuid.format(id, "urn")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `uuid` | string | 有効なUUID文字列 |
| `format` | string? | standard（デフォルト）、simple、またはurn |

**戻り値:** `string, error`

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 無効な入力型 | `errors.INVALID` | no |
| 無効なUUIDフォーマット | `errors.INVALID` | no |
| サポートされていないフォーマットタイプ | `errors.INVALID` | no |
| 生成失敗 | `errors.INTERNAL` | no |

エラーの処理については[エラー処理](lua-errors.md)を参照。

