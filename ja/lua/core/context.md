---
title: "リクエストコンテキスト"
description: "関数呼び出しやプロセス呼び出しを通じて伝播される、リクエストスコープの値を読み取ります。"
---

# リクエストコンテキスト
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

リクエストスコープのコンテキスト値にアクセス。コンテキストは[Funcs](lua/core/funcs.md)または[Process](lua/core/process.md)経由で設定されます。

## ロード

```lua
local ctx = require("ctx")
```

## コンテキストアクセス

### 値を取得

```lua
local value, err = ctx.get("key")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | コンテキストキー |

**戻り値:** `any, error`

### すべての値を取得

```lua
local values, err = ctx.all()
```

**戻り値:** `table, error`

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 空のキー | `errors.INVALID` | いいえ |
| キーが見つからない | `errors.NOT_FOUND` | いいえ |
| コンテキストが利用不可 | `errors.INTERNAL` | いいえ |

エラーの処理については[エラー処理](lua/core/errors.md)を参照。
