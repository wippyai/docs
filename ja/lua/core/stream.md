---
title: "ストリーム"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/"
---

# ストリーム
<secondary-label ref="function"/>
<secondary-label ref="process"/>

データを効率的に処理するためのストリーム読み書き操作。ストリームオブジェクトは他のモジュール（HTTP、ファイルシステムなど）から取得されます。

## ロード

```lua
-- HTTPリクエストボディから
local stream = req:stream()

-- ファイルシステムから
local fs = require("fs")
local stream = fs.get("app:data"):open("/file.txt", "r")
```

## 読み取り

```lua
local chunk, err = stream:read(size)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `size` | integer | 読み取るバイト数（0 = デフォルトの 32KB チャンク） |

**戻り値:** `string, error` — EOF では `nil, nil`

## 書き込み

```lua
local bytes, err = stream:write(data)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | 書き込むデータ |

**戻り値:** `integer, error` — 書き込まれたバイト数

## シーク

```lua
local pos, err = stream:seek(whence, offset)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `whence` | string | `"set"`、`"cur"`、または`"end"` |
| `offset` | integer | バイト単位のオフセット |

**戻り値:** `integer, error` — 新しい位置

## フラッシュ

```lua
local ok, err = stream:flush()
```

バッファリングされたデータを基礎となるストレージにフラッシュ。

## ストリーム情報

```lua
local info, err = stream:stat()
```

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `size` | integer | 合計サイズ（不明の場合-1） |
| `position` | integer | 現在の位置 |
| `readable` | boolean | 読み取り可能 |
| `writable` | boolean | 書き込み可能 |
| `seekable` | boolean | シーク可能 |

## クローズ

```lua
local ok, err = stream:close()
```

ストリームをクローズしてリソースを解放。複数回呼び出しても安全。

## スキャナ

ストリームコンテンツ用のトークナイザを作成：

```lua
local scanner, err = stream:scanner(split)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `split` | string | `"lines"`、`"words"`、`"bytes"`、`"runes"` |

### スキャナメソッド

```lua
local has_more, err = scanner:scan()  -- 次のトークンに進む
local token = scanner:text()           -- 現在のトークン
local err_msg = scanner:err()          -- スキャナのエラー（あれば）
```

```lua
while true do
    local has_token, err = scanner:scan()
    if err then return nil, err end
    if not has_token then break end  -- EOF
    process(scanner:text())
end
```

## エラー

| 条件 | 種別 |
|-----------|------|
| 無効なwhence/splitタイプ | `INVALID` |
| ストリームがクローズ済み | `INTERNAL` |
| 読み取り/書き込み不可 | `INTERNAL` |
| 読み取り/書き込み失敗 | `INTERNAL` |

