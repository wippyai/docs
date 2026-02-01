# 圧縮
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

gzip、deflate、zlib、brotli、zstdアルゴリズムを使用してデータを圧縮・解凍。

## ロード

```lua
local compress = require("compress")
```

## GZIP

最も広くサポートされているフォーマット（RFC 1952）。

### 圧縮 {id="gzip-compress"}

```lua
-- HTTPレスポンス用に圧縮
local body = json.encode(large_response)
local compressed, err = compress.gzip.encode(body)
if err then
    return nil, err
end

-- Content-Encodingヘッダーを設定
res:set_header("Content-Encoding", "gzip")
res:write(compressed)

-- ストレージ用の最大圧縮
local archived = compress.gzip.encode(data, {level = 9})

-- リアルタイム用の高速圧縮
local fast = compress.gzip.encode(data, {level = 1})
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
-- HTTPリクエストを解凍
local content_encoding = req:header("Content-Encoding")
if content_encoding == "gzip" then
    local body = req:body()
    local decompressed, err = compress.gzip.decode(body)
    if err then
        return nil, errors.new("INVALID", "Invalid gzip data")
    end
    body = decompressed
end

-- サイズ制限付きで解凍（zip爆弾を防止）
local decompressed, err = compress.gzip.decode(data, {max_size = 10 * 1024 * 1024})
if err then
    return nil, errors.new("INVALID", "Decompressed size exceeds 10MB limit")
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

テキストに最適な圧縮率（RFC 7932）。

### 圧縮 {id="brotli-compress"}

```lua
-- 静的アセットとテキストコンテンツに最適
local compressed = compress.brotli.encode(html_content, {level = 11})

-- 圧縮されたアセットをキャッシュ
cache:set("static:" .. hash, compressed)

-- APIレスポンス用の適度な圧縮
local compressed = compress.brotli.encode(json_data, {level = 4})
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

-- サイズ制限付き
local decompressed = compress.brotli.decode(data, {max_size = 50 * 1024 * 1024})
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

良好な圧縮率での高速圧縮（RFC 8878）。

### 圧縮 {id="zstd-compress"}

```lua
-- 速度と圧縮率のバランスが良い
local compressed = compress.zstd.encode(binary_data)

-- アーカイブ用の高圧縮
local archived = compress.zstd.encode(data, {level = 19})

-- リアルタイムストリーミング用の高速モード
local fast = compress.zstd.encode(data, {level = 1})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `data` | string | 圧縮するデータ |
| `options` | table? | オプションのエンコードオプション |

#### オプション {id="zstd-compress-options"}

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `level` | integer | 圧縮レベル 1-22（デフォルト: 3） |

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

**戻り値:** `string, error`

## Deflate

生のDEFLATE圧縮（RFC 1951）。他のフォーマットで内部的に使用。

### 圧縮 {id="deflate-compress"}

```lua
local compressed = compress.deflate.encode(data, {level = 6})
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
local decompressed = compress.deflate.decode(compressed)
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

ヘッダーとチェックサム付きDEFLATE（RFC 1950）。

### 圧縮 {id="zlib-compress"}

```lua
local compressed = compress.zlib.encode(data, {level = 6})
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
local decompressed = compress.zlib.decode(compressed)
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
| zstd | 大きなファイル、ストリーミング | 高速 | 良好 | 1-22 |
| deflate/zlib | 低レベル、特定のプロトコル | 中 | 良好 | 1-9 |

```lua
-- Accept-Encodingに基づくHTTPレスポンス
local accept = req:header("Accept-Encoding") or ""
local body = json.encode(response_data)

if accept:find("br") then
    res:set_header("Content-Encoding", "br")
    res:write(compress.brotli.encode(body))
elseif accept:find("gzip") then
    res:set_header("Content-Encoding", "gzip")
    res:write(compress.gzip.encode(body))
else
    res:write(body)
end
```

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| 空の入力 | `errors.INVALID` | no |
| レベルが範囲外 | `errors.INVALID` | no |
| 無効な圧縮データ | `errors.INVALID` | no |
| 解凍サイズが制限を超過 | `errors.INTERNAL` | no |

エラーの処理については[エラー処理](lua-errors.md)を参照。

