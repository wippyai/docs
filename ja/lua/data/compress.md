---
title: "圧縮"
description: "gzip、Brotli、Zstandard、raw DEFLATE、zlibで文字列を圧縮および解凍します。"
---

# 圧縮
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

`compress`モジュールは、gzip、Brotli、Zstandard、raw DEFLATE、zlibで文字列をエンコードおよびデコードします。

これは、一部にHTTPとストレージのレシピを含むAPIリファレンスです。すべての操作は、入力と出力の全体をLua文字列としてメモリに展開します。データをストリーミングのまま扱う必要がある場合は、アーカイブAPIまたはストリームAPIを使用してください。各例では、エントリで`compress`と、`json`や`http`など個別に必要なモジュールが有効になっていることを前提とします。

## ロード

```lua
local compress = require("compress")
```

使用する前に、実行可能エントリの`modules:`リストに`compress`を追加してください。

## GZIP

GzipはRFC 1952で定義されています。

### 圧縮 {id="gzip-compress"}

```lua
-- Compress for HTTP response
local body, json_err = json.encode(large_response)
if json_err then return nil, json_err end
local compressed, err = compress.gzip.encode(body)
if err then
    return nil, err
end

-- Set Content-Encoding header
local header_err = res:set_header("Content-Encoding", "gzip")
if header_err then return nil, header_err end
local write_err = res:write(compressed)
if write_err then return nil, write_err end

-- Maximum compression for storage
local archived, archive_err = compress.gzip.encode(data, {level = 9})
if archive_err then return nil, archive_err end

-- Fast compression for real-time
local fast, fast_err = compress.gzip.encode(data, {level = 1})
if fast_err then return nil, fast_err end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | 圧縮するデータ |
| `options` | table? | オプションのエンコードオプション |

#### オプション {id="gzip-compress-options"}

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `level` | integer | 圧縮レベル 1-9（デフォルト: 6） |

**戻り値:** `string, error`

### 解凍 {id="gzip-decompress"}

```lua
-- Decompress HTTP request
local content_encoding, header_err = req:header("Content-Encoding")
if header_err then return nil, header_err end
if content_encoding == "gzip" then
    local body, body_err = req:body()
    if body_err then return nil, body_err end
    local decompressed, err = compress.gzip.decode(body)
    if err then
        return nil, errors.wrap(err, "gzip request body could not be decoded")
    end
    body = decompressed
end

-- Decompress with size limit (prevent zip bombs)
local decompressed, err = compress.gzip.decode(data, {max_size = 10 * 1024 * 1024})
if err then
    return nil, errors.wrap(err, "gzip decode failed")
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | GZIP圧縮データ |
| `options` | table? | オプションのデコードオプション |

#### オプション {id="gzip-decompress-options"}

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `max_size` | integer | 最大解凍サイズ（バイト単位）（デフォルト: 128MB、最大: 1GB） |

**戻り値:** `string, error`

## Brotli

BrotliはRFC 7932で定義され、圧縮されたテキストコンテンツで広く使われています。

### 圧縮 {id="brotli-compress"}

```lua
-- Best for static assets and text content
local compressed, err = compress.brotli.encode(html_content, {level = 11})
if err then return nil, err end

-- Store `compressed` through the application's cache contract if needed.

-- Moderate compression for API responses
local compressed, err = compress.brotli.encode(json_data, {level = 4})
if err then return nil, err end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | 圧縮するデータ |
| `options` | table? | オプションのエンコードオプション |

#### オプション {id="brotli-compress-options"}

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `level` | integer | 圧縮レベル 0-11（デフォルト: 6） |

**戻り値:** `string, error`

### 解凍 {id="brotli-decompress"}

```lua
local decompressed, err = compress.brotli.decode(compressed_data)
if err then
    return nil, err
end

-- With size limit
local decompressed, err = compress.brotli.decode(data, {max_size = 50 * 1024 * 1024})
if err then return nil, err end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | Brotli圧縮データ |
| `options` | table? | オプションのデコードオプション |

#### オプション {id="brotli-decompress-options"}

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `max_size` | integer | 最大解凍サイズ（バイト単位）（デフォルト: 128MB、最大: 1GB） |

**戻り値:** `string, error`

## Zstandard

ZstandardはRFC 8878で定義された汎用圧縮形式です。

### 圧縮 {id="zstd-compress"}

```lua
-- Good balance of speed and ratio
local compressed, err = compress.zstd.encode(binary_data)
if err then return nil, err end

-- Higher compression for archival
local archived, archive_err = compress.zstd.encode(data, {level = 19})
if archive_err then return nil, archive_err end

-- Fast mode for latency-sensitive payloads
local fast, fast_err = compress.zstd.encode(data, {level = 1})
if fast_err then return nil, fast_err end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | 圧縮するデータ |
| `options` | table? | オプションのエンコードオプション |

#### オプション {id="zstd-compress-options"}

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `level` | integer | 圧縮レベル 1-22（デフォルト: 3） |
| `dict` | string? | `train_dict` で生成した Zstd 辞書バイト（デフォルト: なし） |

**戻り値:** `string, error`

### 解凍 {id="zstd-decompress"}

```lua
local decompressed, err = compress.zstd.decode(compressed_data)
if err then
    return nil, err
end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | Zstandard圧縮データ |
| `options` | table? | オプションのデコードオプション |

#### オプション {id="zstd-decompress-options"}

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `max_size` | integer | 最大解凍サイズ（バイト単位）（デフォルト: 128MB、最大: 1GB） |
| `dict` | string? | Zstd 辞書バイト（エンコードに使用したものと一致する必要があります） |

**戻り値:** `string, error`

### 辞書 {id="zstd-dictionaries"}

似たサンプルペイロードから辞書を学習し、`encode`と`decode`の`dict`オプションに渡します。デコードには、エンコードに使用したものと同じ辞書が必要です。

```lua
local dict, err = compress.zstd.train_dict(samples, { size = 112640 })
if err then return nil, err end
local packed, pack_err = compress.zstd.encode(data, { dict = dict })
if pack_err then return nil, pack_err end
local original, decode_err = compress.zstd.decode(packed, { dict = dict })
if decode_err then return nil, decode_err end
```

#### train_dict(samples, options?)

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `samples` | string[] | 学習サンプル（少なくとも 1 つは 8 バイト以上） |
| `options` | table? | `size`（integer、目標辞書バイト数、256-1048576、デフォルト 114688）、`id`（integer、デフォルト 0）、`level`（integer、1-22） |

**戻り値:** `string, error`（辞書バイト）

#### inspect_dict(dict)

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `dict` | string | 辞書バイト |

**戻り値:** `table, error` — `{id: integer, content_size: integer}`

## Deflate

raw DEFLATEはRFC 1951で定義され、他の形式の内部でも使用されます。

### 圧縮 {id="deflate-compress"}

```lua
local compressed, err = compress.deflate.encode(data, {level = 6})
if err then return nil, err end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | 圧縮するデータ |
| `options` | table? | オプションのエンコードオプション |

#### オプション {id="deflate-compress-options"}

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `level` | integer | 圧縮レベル 1-9（デフォルト: 6） |

**戻り値:** `string, error`

### 解凍 {id="deflate-decompress"}

```lua
local decompressed, err = compress.deflate.decode(compressed)
if err then return nil, err end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | DEFLATE圧縮データ |
| `options` | table? | オプションのデコードオプション |

#### オプション {id="deflate-decompress-options"}

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `max_size` | integer | 最大解凍サイズ（バイト単位）（デフォルト: 128MB、最大: 1GB） |

**戻り値:** `string, error`

## Zlib

Zlibは、RFC 1950で定義されたヘッダーとチェックサムでDEFLATEデータをラップします。

### 圧縮 {id="zlib-compress"}

```lua
local compressed, err = compress.zlib.encode(data, {level = 6})
if err then return nil, err end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | 圧縮するデータ |
| `options` | table? | オプションのエンコードオプション |

#### オプション {id="zlib-compress-options"}

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `level` | integer | 圧縮レベル 1-9（デフォルト: 6） |

**戻り値:** `string, error`

### 解凍 {id="zlib-decompress"}

```lua
local decompressed, err = compress.zlib.decode(compressed)
if err then return nil, err end
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | Zlib圧縮データ |
| `options` | table? | オプションのデコードオプション |

#### オプション {id="zlib-decompress-options"}

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `max_size` | integer | 最大解凍サイズ（バイト単位）（デフォルト: 128MB、最大: 1GB） |

**戻り値:** `string, error`

## アルゴリズムの選択

| アルゴリズム | 最適な用途 | 速度 | 圧縮率 | レベル範囲 |
|-----------|----------|-------|-------|-------------|
| gzip | HTTP、幅広い互換性 | 中 | 良好 | 1-9 |
| brotli | 静的アセット、テキスト | 遅い | 最高 | 0-11 |
| zstd | バイナリペイロード、高速圧縮 | 高速 | 良好 | 1-22 |
| deflate/zlib | 低レベル、特定のプロトコル | 中 | 良好 | 1-9 |

```lua
-- HTTP response based on Accept-Encoding
local accept, header_err = req:header("Accept-Encoding")
if header_err then return nil, header_err end
accept = accept or ""
local body, json_err = json.encode(response_data)
if json_err then return nil, json_err end

local qualities = {}
for item in accept:gmatch("[^,]+") do
    local coding = item:match("^%s*([^;%s]+)")
    local has_q = item:match(";%s*[qQ]%s*=") ~= nil
    local q_text = item:match(";%s*[qQ]%s*=%s*([^;%s,]+)")
    local q
    if not has_q then
        q = 1
    elseif q_text == "0" or q_text == "1" or
           (q_text and q_text:match("^0%.%d?%d?%d?$")) or
           (q_text and q_text:match("^1%.0?0?0?$")) then
        q = tonumber(q_text)
    end
    if coding and q and q >= 0 and q <= 1 then
        coding = coding:lower()
        qualities[coding] = math.max(qualities[coding] or 0, q)
    end
end

local function quality(coding)
    if qualities[coding] ~= nil then return qualities[coding] end
    if coding == "identity" then
        return qualities["*"] == 0 and 0 or 1
    end
    return qualities["*"] or 0
end

local selected, selected_q = nil, -1
for _, coding in ipairs({"br", "gzip", "identity"}) do
    local q = quality(coding)
    if q > selected_q then
        selected, selected_q = coding, q
    end
end

-- Include every field used by this handler or its surrounding middleware.
local vary_fields = {"Accept-Encoding"}
local vary_err = res:set_header("Vary", table.concat(vary_fields, ", "))
if vary_err then return nil, vary_err end

if selected_q <= 0 then
    local status_err = res:set_status(http.STATUS.NOT_ACCEPTABLE)
    if status_err then return nil, status_err end
    local write_err = res:write("No acceptable content encoding")
    if write_err then return nil, write_err end
elseif selected == "br" then
    local compressed, compress_err = compress.brotli.encode(body)
    if compress_err then return nil, compress_err end
    local set_err = res:set_header("Content-Encoding", "br")
    if set_err then return nil, set_err end
    local write_err = res:write(compressed)
    if write_err then return nil, write_err end
elseif selected == "gzip" then
    local compressed, compress_err = compress.gzip.encode(body)
    if compress_err then return nil, compress_err end
    local set_err = res:set_header("Content-Encoding", "gzip")
    if set_err then return nil, set_err end
    local write_err = res:write(compressed)
    if write_err then return nil, write_err end
else
    local write_err = res:write(body)
    if write_err then return nil, write_err end
end
```

この部分的なハンドラーは、正確なコーディングトークンとRFCのq値を解析し、`br;q=0`のような明示的な拒否を尊重して、`Vary: Accept-Encoding`を出力します。`set_header`は既存の`Vary`値を置き換えるため、設定する前に、周囲のミドルウェアが使用する他のすべてのフィールドを`vary_fields`に追加してください。完全なHTTPスタックでは、共有のネゴシエーションヘルパーが提供される場合があります。

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 空の入力 | `errors.INVALID` | いいえ |
| レベルが範囲外 | `errors.INVALID` | いいえ |
| 無効な圧縮データ | `errors.INVALID` | いいえ |
| 解凍サイズが制限を超過 | `errors.INTERNAL` | いいえ |

エラーの処理については、[エラー処理](../core/errors.md)を参照してください。
