# YAMLエンコーディング
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

YAMLドキュメントをLuaテーブルにパースし、Lua値をYAML文字列にシリアライズ。

## ロード

```lua
local yaml = require("yaml")
```

## エンコーディング

### 値のエンコード

LuaテーブルをYAMLフォーマットにエンコード。

```lua
-- シンプルなキー値
local config = {
    name = "myapp",
    port = 8080,
    debug = true
}
local out = yaml.encode(config)
-- name: myapp
-- port: 8080
-- debug: true

-- 配列はYAMLリストになる
local items = {"apple", "banana", "cherry"}
yaml.encode(items)
-- - apple
-- - banana
-- - cherry

-- ネストした構造
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
| `options` | table? | オプションのエンコードオプション |

#### オプション

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `field_order` | string[] | カスタムフィールド順序 - フィールドはこの順序で表示 |
| `sort_unordered` | boolean | `field_order`にないフィールドをアルファベット順にソート |

```lua
-- 出力のフィールド順序を制御
local entry = {
    zebra = 1,
    alpha = 2,
    name = "test",
    kind = "demo"
}

-- フィールドは指定された順序で表示、残りはアルファベット順にソート
local result = yaml.encode(entry, {
    field_order = {"name", "kind"},
    sort_unordered = true
})
-- name: test
-- kind: demo
-- alpha: 2
-- zebra: 1

-- すべてのフィールドをアルファベット順にソート
yaml.encode(entry, {sort_unordered = true})
-- alpha: 2
-- kind: demo
-- name: test
-- zebra: 1
```

**戻り値:** `string, error`

## デコーディング

### 文字列のデコード

YAML文字列をLuaテーブルにパース。

```lua
-- 設定をパース
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

-- ファイル内容からパース
local content = fs.read("config.yaml")
local settings, err = yaml.decode(content)
if err then
    return nil, errors.wrap(err, "invalid config file")
end

-- 混合型を処理
local data = yaml.decode([[
name: test
count: 42
ratio: 3.14
enabled: true
tags:
  - lua
  - wippy
]])
print(type(data.count))    -- "number"
print(type(data.enabled))  -- "boolean"
print(type(data.tags))     -- "table"
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | パースするYAML文字列 |

**戻り値:** `any, error` - YAML内容に応じてtable、array、string、number、またはbooleanを返す

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 入力がテーブルではない（encode） | `errors.INVALID` | no |
| 入力が文字列ではない（decode） | `errors.INVALID` | no |
| 空文字列（decode） | `errors.INVALID` | no |
| 無効なYAML構文 | `errors.INTERNAL` | no |

エラーの処理については[エラー処理](lua/core/errors.md)を参照。

