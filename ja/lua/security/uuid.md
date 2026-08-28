---
title: "UUID生成"
description: "UUIDの生成、検証、情報取得、パース、フォーマットを行います。"
---

# UUID生成
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

`uuid`モジュールは、UUIDの生成、検証、情報取得、パース、フォーマットを行います。決定論的ワークフローでは、v1、v4、v7の生成は記録される副作用として実行され、リプレイ時には記録済みの値を返します。名前空間に基づくv3とv5の生成は決定論的であり、直接実行されます。

このページは独立した呼び出しを示すAPIリファレンスです。`namespace`、`name`、`input`、`id`などの値は周囲のアプリケーションから渡されます。生成、パース、情報取得、フォーマットの結果を使う前に、2番目の`error`戻り値を取得して処理してください。UUIDは識別子であり、Bearer認証情報ではありません。どのバージョンのUUIDも認証トークンやシークレットとして使用しないでください。

## ロード

```lua
local uuid = require("uuid")
```

## 非決定論的UUID

### バージョン1

タイムスタンプとノードIDを持つ時間ベースのUUIDです。

バージョン1は作成時刻とノード識別子を公開します。これらの情報が機密となる場合は避け、不透明な識別子だけが必要な場合はv4を使用してください。

```lua
local id, err = uuid.v1()
```

**戻り値:** `string, error`

### バージョン4

ランダムなUUIDです。

```lua
local id, err = uuid.v4()
```

**戻り値:** `string, error`

### バージョン7

作成時刻をエンコードし、時系列インデックスに利用できる時間順序UUIDです。特に同じタイムスタンプ区間内で生成された値について、厳密に単調増加するシーケンスとして扱わないでください。

```lua
local id, err = uuid.v7()
```

**戻り値:** `string, error`

## 決定論的UUID

### バージョン3

MD5を使用して名前空間と名前から生成する決定論的UUIDです。

```lua
local id, err = uuid.v3(namespace, name)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `namespace` | string | 有効なUUID文字列 |
| `name` | string | ハッシュする値 |

**戻り値:** `string, error`

### バージョン5

SHA-1を使用して名前空間と名前から生成する決定論的UUIDです。

```lua
local NS_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
local id, err = uuid.v5(NS_URL, "https://example.com/resource")
if err then
    return nil, err
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `namespace` | string | 有効なUUID文字列 |
| `name` | string | ハッシュする値 |

**戻り値:** `string, error`

## 検査

### `validate`

```lua
local valid = uuid.validate(input)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `input` | any | チェックする値 |

**戻り値:** `boolean, nil`。文字列以外または不正な形式の入力では`false`を返します。検証時に構造化エラーは発生しません。

### `version`

```lua
local ver, err = uuid.version(id)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `uuid` | string | 有効なUUID文字列 |

**戻り値:** `integer, error`

### `variant`

```lua
local var, err = uuid.variant(id)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `uuid` | string | 有効なUUID文字列 |

**戻り値:** `string, error`（RFC4122、Reserved、Microsoft、Future、NCS、またはInvalid）

### `parse`

```lua
local info, err = uuid.parse(id)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `uuid` | string | 有効なUUID文字列 |

**戻り値:** `table, error`

返されるテーブルのフィールド:
- `version`（integer）: UUIDバージョン（1、3、4、5、または7）
- `variant`（string）: RFC4122、Reserved、Microsoft、Future、NCS、またはInvalid
- `timestamp`（integer）: Unixタイムスタンプ（v1とv7のみ）
- `node`（string）: 生の6バイトのノード識別子（v1のみ）。表示またはテキスト保存の前にエンコードしてください

### `format`

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
| 無効な入力型 | `errors.INVALID` | いいえ |
| 無効なUUIDフォーマット | `errors.INVALID` | いいえ |
| サポートされていないフォーマットタイプ | `errors.INVALID` | いいえ |
| 生成失敗 | `errors.INTERNAL` | いいえ |

エラーの扱いについては、[エラー処理](../core/errors.md)を参照してください。
