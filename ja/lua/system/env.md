# 環境変数
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

設定値、シークレット、ランタイム設定のための環境変数へのアクセス。

変数にアクセスする前に[環境システム](system-env.md)で定義する必要がある。システムは値を提供するストレージバックエンド（OS、ファイル、メモリ）と変数が読み取り専用かどうかを制御。

## ロード

```lua
local env = require("env")
```

## get

環境変数の値を取得。

```lua
-- データベース接続文字列を取得
local db_url = env.get("DATABASE_URL")
if not db_url then
    return nil, errors.new("INVALID", "DATABASE_URL not configured")
end

-- フォールバック付きで取得
local port = env.get("PORT") or "8080"
local host = env.get("HOST") or "localhost"

-- シークレットを取得
local api_key = env.get("API_SECRET_KEY")
local jwt_secret = env.get("JWT_SECRET")

-- 設定
local log_level = env.get("LOG_LEVEL") or "info"
local debug_mode = env.get("DEBUG") == "true"
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | 変数名 |

**戻り値:** `string, error`

変数が存在しない場合は`nil, error`を返す。

## set

環境変数を設定。

```lua
-- ランタイム設定を設定
env.set("APP_MODE", "production")

-- テスト用にオーバーライド
env.set("API_URL", "http://localhost:8080")

-- 条件に基づいて設定
if is_development then
    env.set("LOG_LEVEL", "debug")
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | 変数名 |
| `value` | string | 設定する値 |

**戻り値:** `boolean, error`

## get_all

アクセス可能なすべての環境変数を取得。

```lua
local vars = env.get_all()

-- 設定をログ（シークレットはログしないよう注意）
for key, value in pairs(vars) do
    if not key:match("SECRET") and not key:match("KEY") then
        logger.debug("env", {[key] = value})
    end
end

-- 必須変数を確認
local required = {"DATABASE_URL", "REDIS_URL", "API_KEY"}
for _, key in ipairs(required) do
    if not vars[key] then
        return nil, errors.new("INVALID", "Missing required env var: " .. key)
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
| `env.get_all` | `*` | すべての変数を一覧 |

### アクセス確認

```lua
local security = require("security")

if security.can("env.get", "DATABASE_URL") then
    local url = env.get("DATABASE_URL")
end
```

ポリシー設定については[セキュリティモデル](system-security.md)を参照。

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| キーが空 | `errors.INVALID` | no |
| 変数が見つからない | `errors.NOT_FOUND` | no |
| 権限拒否 | `errors.PERMISSION_DENIED` | no |

エラーの処理については[エラー処理](lua-errors.md)を参照。

## 関連項目

- [環境システム](system-env.md) - ストレージバックエンドと変数定義の設定

