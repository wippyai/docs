---
title: "YAMLエンコーディング"
description: "LuaテーブルをYAMLとしてエンコードし、YAMLドキュメントをLuaの値にデコードします。"
---

# YAMLエンコーディング
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

`yaml`モジュールは、LuaテーブルをYAMLとしてシリアライズし、YAMLドキュメントをLuaの値として解析します。

これはAPIリファレンスです。出力のみを示す式は成功時のエンコード結果を例示し、値を利用する例では省略可能な2番目の戻り値`error`を受け取ります。

## ロード

```lua
local yaml = require("yaml")
```

使用する前に、実行可能エントリの`modules:`リストに`yaml`を追加してください。

## エンコーディング

### `encode`

LuaテーブルをYAMLとしてエンコードします。

```lua
-- Simple key-value
local config = {
    name = "myapp",
    port = 8080,
    debug = true
}
local out, err = yaml.encode(config)
if err then return nil, err end
-- YAML mapping containing name, port, and debug.

-- Arrays become YAML lists
local items = {"apple", "banana", "cherry"}
yaml.encode(items)
-- - apple
-- - banana
-- - cherry

-- Nested structures
local server = {
    http = {
        address = ":8080",
        timeout = "30s"
    },
    database = {
        host = "localhost",
        port = 5432
    }
}
yaml.encode(server)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | table | エンコードするLuaテーブル |
| `options` | table? | 省略可能なエンコードオプション |

#### オプション

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `field_order` | string[] | フィールドの表示順。指定したフィールドがこの順序で並ぶ |
| `sort_unordered` | boolean | `field_order`にないフィールドをアルファベット順にソート |

```lua
-- Control field order in output
local entry = {
    zebra = 1,
    alpha = 2,
    name = "test",
    kind = "demo"
}

-- Fields appear in specified order, remaining sorted alphabetically
local result, encode_err = yaml.encode(entry, {
    field_order = {"name", "kind"},
    sort_unordered = true
})
if encode_err then return nil, encode_err end
-- name: test
-- kind: demo
-- alpha: 2
-- zebra: 1

-- Just sort all fields alphabetically
yaml.encode(entry, {sort_unordered = true})
-- alpha: 2
-- kind: demo
-- name: test
-- zebra: 1
```

**戻り値:** `string, error`

## デコーディング

### `decode`

YAML文字列をLuaの値として解析します。

```lua
-- Parse configuration
local config, err = yaml.decode([[
server:
  host: localhost
  port: 8080
features:
  - auth
  - logging
  - metrics
]])
if err then
    return nil, err
end

print(config.server.host)     -- "localhost"
print(config.server.port)     -- 8080
print(config.features[1])     -- "auth"

-- Parse from file content
local fs = require("fs")
local config_fs = assert(fs.get("app:config"))
local content = assert(config_fs:readfile("config.yaml"))
local settings, err = yaml.decode(content)
if err then
    return nil, errors.wrap(err, "invalid config file")
end

-- Handle mixed types
local data, data_err = yaml.decode([[
name: test
count: 42
ratio: 3.14
enabled: true
tags:
  - lua
  - wippy
]])
if data_err then return nil, data_err end
print(type(data.count))    -- "number"
print(type(data.enabled))  -- "boolean"
print(type(data.tags))     -- "table"
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | パースするYAML文字列 |

**戻り値:** `any, error` — 値の型はYAMLの内容によって異なります

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 入力がテーブルではない（encode） | `errors.INVALID` | いいえ |
| 入力が文字列ではない（decode） | `errors.INVALID` | いいえ |
| 空文字列（decode） | `errors.INVALID` | いいえ |
| 無効なYAML構文 | `errors.INTERNAL` | いいえ |

エラーの処理については、[エラー処理](lua/core/errors.md)を参照してください。
