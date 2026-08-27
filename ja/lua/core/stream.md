---
title: "ストリーム"
description: "I/O モジュールが返すストリームオブジェクトの読み取り、書き込み、シーク、検査、スキャン、クローズを行います。"
---

# ストリーム
<secondary-label ref="function"/>
<secondary-label ref="process"/>

ストリームは、HTTP、ファイルシステム、その他のモジュールに対する増分 I/O を提供します。基になるデータを所有するモジュールがストリームオブジェクトを作成します。このページは API リファレンスです。スキャナーループの `process(token)` はアプリケーション側で定義するコールバックです。

## ストリームの取得

```lua
-- From HTTP request body
local stream, err = req:stream()
if err then return nil, err end

-- From filesystem
local fs = require("fs")
local volume, err = fs.get("app:data")
if err then return nil, err end

local stream, err = volume:open("/file.txt", "r")
if err then return nil, err end
```

## 読み取り

```lua
local chunk, err = stream:read(size)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `size` | integer | 読み取るバイト数（0 = 既定の 32 KB チャンク） |

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

`flush` はバッファリングされたデータを基になる出力先へ書き込みます。

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

`close` はストリームのリソースを解放します。複数回呼び出せます。

## スキャナ

ストリームの内容をトークン化するスキャナーを作成します。

```lua
local scanner, err = stream:scanner(split)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `split` | string | `"lines"`、`"words"`、`"bytes"`、`"runes"` |

### スキャナメソッド

```lua
local has_more, err = scanner:scan()  -- advance to next token
local token = scanner:text()           -- current token
local err_msg = scanner:err()          -- scanner error if any
```

```lua
while true do
    local has_token, err = scanner:scan()
    if err then return nil, err end
    if not has_token then
        local scan_err = scanner:err()
        if scan_err then return nil, scan_err end  -- raw scanner error string
        break  -- clean EOF
    end
    process(scanner:text())
end
```

`scan()` が `false` を返した場合は、EOF と判断する前に `scanner:err()` を確認してください。トークン化や基になる読み取りの失敗はスキャナーに保存され、`scan()` の第 2 戻り値には現れません。

## エラー

| 条件 | 種別 |
|-----------|------|
| ストリームがクローズ済み | `errors.INTERNAL` |
| 読み取り/書き込み不可 | `errors.INTERNAL` |
| 読み取り/書き込み/シーク失敗 | `errors.INTERNAL` |
| シーク非対応ストリームでのシーク | `errors.INTERNAL` |
| クローズ、フラッシュ、または stat の失敗 | `errors.INTERNAL` |
| スキャナーの作成または scan ディスパッチの失敗 | `errors.INTERNAL` |
| スキャナーのトークン化または基になる読み取りの失敗 | `scanner:err()` が返す非構造化文字列 |

未対応の `whence` またはスキャナー分割値を指定すると、構造化エラー値ではなく Lua の引数エラーが発生します。
