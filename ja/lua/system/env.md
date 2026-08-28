---
title: "環境変数"
description: "構成済み環境システムが公開する環境変数を読み取り、更新します。"
---

# 環境変数
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

`env` モジュールは、ランタイムが公開する環境変数を読み取り、更新します。

このページは API リファレンスです。各スニペットは独立した操作であり、指定した変数とセキュリティポリシーがすでに存在することを前提とします。

変数にアクセスする前に[環境システム](system/env.md)で定義する必要がある。システムは値を提供するストレージバックエンド（OS、ファイル、メモリ）と変数が読み取り専用かどうかを制御。

## ロード

```lua
local env = require("env")
```

## get

環境変数の値を取得。

```lua
-- Get database connection string
local db_url, db_err = env.get("DATABASE_URL")
if db_err then return nil, db_err end

-- Apply a fallback only to a missing variable. Permission and backend errors
-- still propagate to the caller.
local function get_or(key, fallback)
    local value, err = env.get(key)
    if not err then return value end
    if errors.is(err, errors.NOT_FOUND) then return fallback end
    return nil, err
end

local port, port_err = get_or("PORT", "8080")
if port_err then return nil, port_err end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | 変数名 |

**戻り値:** `string, error`

変数が存在しない場合は`nil, error`を返す。

## set

環境変数を設定。

```lua
-- Set runtime configuration
local updated, set_err = env.set("APP_MODE", "production")
if set_err then return nil, set_err end
return updated
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | 変数名 |
| `value` | string | 設定する値 |

**戻り値:** `boolean, error`

## get_all

アクセス可能なすべての環境変数を取得。

```lua
local logger = require("logger")

local vars, vars_err = env.get_all()
if vars_err then return nil, vars_err end

-- Log names only. Values such as connection URLs may contain credentials even
-- when their keys do not include words like SECRET or KEY.
local accessible_keys = {}
for key in pairs(vars) do table.insert(accessible_keys, key) end
logger:debug("accessible environment variables", {keys = accessible_keys})

-- Check required variables
local required = {"DATABASE_URL", "REDIS_URL", "API_KEY"}
for _, key in ipairs(required) do
    if not vars[key] then
        return nil, errors.new({
            message = "Missing required env var: " .. key,
            kind = errors.INVALID
        })
    end
end
```

**戻り値:** `table, error`

## 権限

環境アクセスはセキュリティポリシー評価の対象。

### セキュリティアクション

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `env.get` | 変数名 | 環境変数を読み取り |
| `env.set` | 変数名 | 環境変数を書き込み |

`get_all` 専用のセキュリティアクションはありません。各変数名を `env.get` でフィルタリングし、呼び出し元に `env.get` が許可された変数だけを返します。

### アクセス確認

```lua
local security = require("security")

if security.can("env.get", "DATABASE_URL") then
    local url = env.get("DATABASE_URL")
end
```

ポリシー設定については[セキュリティモデル](system/security.md)を参照。

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| キーが空 | `errors.INVALID` | いいえ |
| 変数が見つからない | `errors.NOT_FOUND` | いいえ |
| 権限拒否 | `errors.PERMISSION_DENIED` | いいえ |

エラーの処理については[エラー処理](lua/core/errors.md)を参照。

## 関連項目

- [環境システム](system/env.md) - ストレージバックエンドと変数定義の設定
