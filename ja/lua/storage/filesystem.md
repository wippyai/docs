---
title: "ファイルシステム"
description: "構成済みのファイルシステムボリューム内でファイルを読み取り、書き込み、管理します。"
---

# ファイルシステム
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

`fs` モジュールは、構成済みのファイルシステムボリューム内でファイルを読み取り、書き込み、管理します。

このページは API リファレンスです。スニペットでは、構成済みのボリュームと、そのボリュームを取得する権限を前提としています。各ブロックは独立した操作または部分的なレシピです。`config`、`message`、`process`、`report_cleanup_error` などのアプリケーション値やコールバックは、あらかじめ存在している必要があります。`report_cleanup_error(err)` は、すでに発生した操作エラーを置き換えずにクローズの失敗を記録します。

ファイルシステムの構成については、[ファイルシステム](system/filesystem.md)を参照してください。

## ロード

```lua
local fs = require("fs")
```

## ボリュームの取得

レジストリIDでファイルシステムボリュームを取得:

```lua
local vol, err = fs.get("app:storage")
if err then
    return nil, err
end

local content, read_err = vol:readfile("/config.json")
if read_err then return nil, read_err end
return content
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | ボリュームレジストリID |

**戻り値:** `FS, error`

<note>
ボリュームを明示的に解放する必要はありません。ボリュームはシステムによって管理され、ファイルシステムがレジストリから切り離されると利用できなくなります。
</note>

## ファイルの読み取り

ファイル内容全体を読み取り:

```lua
local json = require("json")

local vol, get_err = fs.get("app:config")
if get_err then return nil, get_err end

local data, err = vol:readfile("/settings.json")
if err then
    return nil, err
end

local config, decode_err = json.decode(data)
if decode_err then return nil, decode_err end
return config
```

大きなファイルには`open()`でストリーミングを使用:

```lua
local errors = require("errors")

local file, err = vol:open("/data/large.csv", "r")
if err then
    return nil, err
end

while true do
    local chunk, err = file:read(65536)
    if err then
        if err:kind() == errors.NOT_FOUND then
            break -- EOF
        end
        local _, close_err = file:close()
        if close_err then report_cleanup_error(close_err) end
        return nil, err
    end
    process(chunk)
end

local _, close_err = file:close()
if close_err then return nil, close_err end
```

## ファイルの書き込み

文字列またはリーダーが供給するストリームをファイルに書き込みます:

```lua
local json = require("json")

local vol, get_err = fs.get("app:data")
if get_err then return nil, get_err end

-- Overwrite (default)
local encoded, encode_err = json.encode(config)
if encode_err then return nil, encode_err end
local _, write_err = vol:writefile("/config.json", encoded)
if write_err then return nil, write_err end

-- Append
local _, append_err = vol:writefile("/logs/app.log", message .. "\n", "a")
if append_err then return nil, append_err end

-- Exclusive write (fails if exists)
local ok, err = vol:writefile("/lock.pid", tostring(pid), "wx")
if err then return nil, err end

-- Copy from an open file or another reader-backed value
local source, err = vol:open("/incoming/report.csv", "r")
if err then
    return nil, err
end
local copied, err = vol:writefile("/archive/report.csv", source)
local _, close_err = source:close()
if err then
    if close_err then report_cleanup_error(close_err) end
    return nil, err
end
if close_err then return nil, close_err end
return copied
```

| モード | 説明 |
|------|-------------|
| `"w"` | 上書き（デフォルト） |
| `"a"` | 追記 |
| `"wx"` | 排他的書き込み（ファイルが存在する場合は失敗） |

ストリーミング書き込みにはファイルハンドルを使用します:

```lua
local file, open_err = vol:open("/output/report.txt", "w")
if open_err then return nil, open_err end
local _, header_err = file:write("Header\n")
if header_err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, header_err
end
local _, data_err = file:write("Data: " .. value .. "\n")
if data_err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, data_err
end
local _, sync_err = file:sync()
if sync_err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, sync_err
end
local _, close_err = file:close()
if close_err then return nil, close_err end
```

## パスのチェック

```lua
local vol, get_err = fs.get("app:data")
if get_err then return nil, get_err end

-- Check existence
local exists, exists_err = vol:exists("/cache/results.json")
if exists_err then return nil, exists_err end
if exists then
    return vol:readfile("/cache/results.json")
end

-- Check if directory
local is_dir, isdir_err = vol:isdir(path)
if isdir_err then return nil, isdir_err end
if is_dir then
    process_directory(path)
end

-- Get file info
local info, stat_err = vol:stat("/documents/report.pdf")
if stat_err then return nil, stat_err end
print(info.size, info.modified, info.type)
```

**Stat フィールド:** `name`、`size`、`mode`、`modified`、`is_dir`、`type`

## ディレクトリ操作

```lua
local vol, get_err = fs.get("app:data")
if get_err then return nil, get_err end

-- Create directory
local _, mkdir_err = vol:mkdir("/uploads/" .. user_id)
if mkdir_err then return nil, mkdir_err end

-- List directory contents
local iter, state = vol:readdir("/documents")
if not iter then return nil, state end
for entry in iter, state do
    print(entry.name, entry.type)
end

-- Remove file or empty directory
local removed, remove_err = vol:remove("/temp/file.txt")
if remove_err then return nil, remove_err end
return removed
```

Entry フィールド: `name`、`type`（"file" または "directory"）

`mkdir` は 1 つのディレクトリを作成しますが、存在しない親ディレクトリは作成しません。`remove` が対象にできるのは、ファイルと空のディレクトリだけです。

## ファイルハンドルメソッド

ストリーミング用に`vol:open()`を使用する場合:

| メソッド | 説明 |
|--------|-------------|
| `read(size?)` | バイトを読み取り（デフォルト: 4096） |
| `write(data)` | 文字列データを書き込み |
| `seek(whence, offset)` | 位置を設定（"set"、"cur"、"end"） |
| `stat()` | ファイル情報を取得（フィールドは `vol:stat` と同じ） |
| `sync()` | ストレージにフラッシュ |
| `close()` | ファイルハンドルを解放 |
| `scanner(split?)` | 行/単語スキャナを作成 |

ファイルハンドルの使用が終わったら `close()` を呼び出してください。

## スキャナ

行単位の処理:

```lua
local file, err = vol:open("/data/users.csv", "r")
if err then
    return nil, err
end
local scanner, err = file:scanner("lines")
if err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, err
end

scanner:scan()  -- skip header

while scanner:scan() do
    local line = scanner:text()
    process(line)
end

local scan_err = scanner:err()
if scan_err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, scan_err
end

local _, close_err = file:close()
if close_err then return nil, close_err end
```

スプリットモード: `"lines"`（デフォルト）、`"words"`、`"bytes"`、`"runes"`

`scanner:scan()` はブール値だけを返します。`false` が返された場合は `scanner:err()` を呼び出し、正常な EOF と、トークン化または基盤の読み取りの失敗を区別してください。`scanner:err()` は構造化された `INTERNAL` エラーまたは `nil` を返します。ストリームスキャナとは異なり、ファイルスキャナには独立したスキャンディスパッチエラーの戻り値はありません。

## 定数

```lua
fs.type.FILE      -- "file"
fs.type.DIR       -- "directory"

fs.seek.SET       -- from start
fs.seek.CUR       -- from current
fs.seek.END       -- from end
```

## FSメソッド

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `readfile(path)` / `read_file(path)` | `string, error` | ファイル全体を読み取り |
| `writefile(path, data, mode?)` / `write_file(path, data, mode?)` | `boolean, error` | 文字列またはリーダーが供給する値を書き込み |
| `exists(path)` | `boolean, error` | パスが存在するか確認 |
| `stat(path)` | `table, error` | ファイル情報を取得 |
| `isdir(path)` | `boolean, error` | ディレクトリか確認 |
| `mkdir(path)` | `boolean, error` | ディレクトリを作成 |
| `remove(path)` | `boolean, error` | ファイル/空のディレクトリを削除 |
| `readdir(path)` | `iterator, state` | ディレクトリを一覧表示（汎用 `for` ループで使用） |
| `open(path, mode)` | `File, error` | ファイルハンドルを開く |
| `chdir(path)` | `boolean, error` | 作業ディレクトリを変更 |
| `pwd()` | `string, error` | 作業ディレクトリを取得 |

## 権限

ボリュームの取得時に、セキュリティポリシーが評価されます。

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `fs.get` | Volume ID | ファイルシステムボリュームを取得 |

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| パスが空 | `errors.INVALID` | unspecified |
| パスに null バイトが含まれる | `errors.INVALID` | いいえ |
| 無効なモード | `errors.INVALID` | unspecified |
| クローズ済みファイルで `scanner()` を呼び出した | `errors.INVALID` | unspecified |
| クローズ済みファイルで read、write、seek、stat、sync を呼び出した | `errors.INTERNAL` | いいえ |
| すでにクローズ済みのファイルで `close()` を呼び出した | 成功 | 該当なし |
| ファイルハンドルの読み取りが EOF に達した | `errors.NOT_FOUND` | unspecified |
| パスが見つからない | `errors.NOT_FOUND` | 利用可能な場合は基盤のエラーから引き継ぐ |
| パスがすでに存在する | `errors.ALREADY_EXISTS` | unspecified |
| 権限拒否 | `errors.PERMISSION_DENIED` | いいえ |
| ファイルスキャナのトークン化または読み取りが失敗した | `errors.INTERNAL` | 利用可能な場合は基盤のエラーから引き継ぐ |

`unspecified` は `err:retryable()` が `nil` を返すことを意味します。`false` と同じではありません。

エラーの処理については、[エラー処理](lua/core/errors.md)を参照してください。
