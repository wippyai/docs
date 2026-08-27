---
title: "ロギング"
description: "構造化ログメッセージを書き込み、永続フィールドを持つ子ロガーを作成します。"
---

# ロギング
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

`logger` モジュールは debug、info、warn、error レベルの構造化メッセージを書き込みます。

このページは API リファレンスです。各スニペットは独立したログ操作で、必要なロガー設定を持つ実行コンテキストを前提とします。

ログ呼び出しに戻り値はありません。実行コンテキストから取得できる場合は、現在のフレームから導出したプロセス `pid` とソース `location` も追加されます。

## ロード

```lua
local logger = require("logger")
```

## ログレベル

### Debug

```lua
logger:debug("message", {key = "value"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `message` | string | ログメッセージ |
| `fields` | table? | コンテキストのキーバリューペア |

フィールド名になるのは文字列キーだけです。文字列、数値、整数、真偽値、エラー、および構造化された Lua 値はログフィールドに変換され、文字列以外のキーは無視されます。

`logger:error` では、`error` という名前のフィールドはエラーフィールドとして出力され、残りのフィールドを処理する前に渡されたテーブルから削除されます。`error` エントリを保持する必要がある場合、そのテーブルを再利用しないでください。

### Info

```lua
logger:info("message", {key = "value"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `message` | string | ログメッセージ |
| `fields` | table? | コンテキストのキーバリューペア |

### Warn

```lua
logger:warn("message", {key = "value"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `message` | string | ログメッセージ |
| `fields` | table? | コンテキストのキーバリューペア |

### Error

```lua
logger:error("message", {key = "value"})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `message` | string | ログメッセージ |
| `fields` | table? | コンテキストのキーバリューペア |

## ロガーのカスタマイズ

### `logger:with`

永続フィールド付きの子ロガーを作成します。

```lua
local function request_logger(request_id)
    return logger:with({request_id = request_id})
end

request_logger("req-123"):info("message")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `fields` | table | すべてのログに付加するフィールド |

**戻り値:** `Logger`

元のロガーは変更されません。子ロガーにはさらに `with` や `named` を連結できます。

### `logger:named`

名前付きの子ロガーを作成します。

```lua
local named = logger:named("auth")
named:info("message")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | ロガー名 |

**戻り値:** `Logger`

空の名前を指定すると Lua の引数エラーが発生します。構造化された `errors.INVALID` 値として返されるわけではありません。

ログメソッドは構造化エラーを返しません。無効な引数型では Lua の引数エラーが発生します。実行コンテキストにロガーが接続されていない場合、モジュールは no-op ロガーを使用し、メッセージを破棄します。
