---
title: "ロギング"
description: "debug、info、warn、errorレベル付きの構造化ロギングを提供します。"
---

# ロギング
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

debug、info、warn、errorレベル付きの構造化ロギングを提供します。

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

### Withフィールド

永続フィールド付きの子ロガーを作成します。

```lua
local child = logger:with({request_id = id})
child:info("message")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `fields` | table | すべてのログに付加するフィールド |

**戻り値:** `Logger`

### 名前付きロガー

名前付きの子ロガーを作成します。

```lua
local named = logger:named("auth")
named:info("message")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | ロガー名 |

**戻り値:** `Logger`

## エラー

`logger:named("")` はエラー値を返す代わりに Lua の引数エラー（`name cannot be empty`）を送出します。ロギングメソッドは何も返しません。

エラーの処理については[エラー処理](lua/core/errors.md)を参照。

