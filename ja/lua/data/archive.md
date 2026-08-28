---
title: "アーカイブ"
description: "ZIP、TAR、gzip 圧縮 TAR、Zstandard 圧縮 TAR アーカイブを読み取り、走査、展開、作成します。"
---

# アーカイブ
<secondary-label ref="function"/>
<secondary-label ref="io"/>
<secondary-label ref="encoding"/>

`archive` モジュールは、ランダムアクセスリーダー、シーケンシャルストリーム、ファイルシステム上の出力先を通じて、ZIP および TAR 系アーカイブを読み書きします。

このページは、部分的な I/O レシピを含む API リファレンスです。ストリーミング操作ではエントリコピー用バッファーの上限が設定されますが、メタデータ、コーデックの状態、raw バイトソース、`read()` の結果は引き続きメモリを消費します。大きなランダムアクセスアーカイブには seek 可能なファイルまたは range reader を、前方にしか読めない入力には `scan()` を使用し、アプリケーションに適した上限を明示してください。

## 読み込み

```lua
local archive = require("archive")
```

require する前に、実行可能エントリの `modules:` リストへ `archive` を追加します。ファイルシステム、クラウドリーダー、HTTP ストリームを使うレシピには、それらのケイパビリティとセキュリティポリシーも必要です。

## 形式

モジュールは magic byte から組み込み形式を検出するか、`opts.format` で指定された形式を使用します。

| 形式 | ランダム読み取り | シーケンシャル走査 | 書き込み |
|------|:----------------:|:------------------:|:----------:|
| `zip` | 可 | 可（local header） | 可 |
| `tar` | 可 | 可 | 可 |
| `tar.gz` | 不可 | 可 | 可 |
| `tar.zst` | 不可 | 可 | 可 |

`archive.formats()` は登録済み形式名の一覧を返します。

```lua
local names = archive.formats()  -- {"zip", "tar", "tar.gz", "tar.zst", ...}
```

## オプション

すべてのエントリポイントは、省略可能な `opts` テーブルを受け取ります。

| キー | デフォルト | 意味 |
|------|------------|------|
| `format` | auto | `"zip"`、`"tar"`、`"tar.gz"`、`"tar.zst"`。auto は magic を判別し、それ以外では拡張子を使用 |
| `max_entries` | 100000 | これを超えるエントリを持つアーカイブを拒否（decompression bomb 対策） |
| `max_total_bytes` | 2 GiB | `extract_all()` の累積非圧縮出力上限 |
| `max_file_bytes` | 1 GiB | 1 エントリの非圧縮サイズ上限 |
| `max_inline_bytes` | 16 MiB | RAM に展開する `read()` 呼び出しのハード上限。超える場合は `stream()` / `extract()` を使用 |
| `buffer_bytes` | 64 KiB | ストリーミングによる extract/add 経路のコピーバッファー。`read()` の割り当て量は制限しない |

`max_file_bytes` は各エントリを制限します。一方、`max_total_bytes` が適用されるのは reader と walker の `extract_all()` だけです。`read()`、`stream()`、単一エントリの `extract()`、手動 walk を使うアプリケーションでは、独自に累積予算を適用する必要があります。`max_inline_bytes` は `read()` が実体化するエントリデータを制限し、`buffer_bytes` は制限しません。これらの上限には、すべてのメタデータとコーデックの割り当てが含まれるわけではありません。

## 読み取り — ランダムアクセス

`archive.open(source, ...)` は、完全なランダムアクセスのために **seek 可能** なソースを開きます（ZIP の central directory は最初に読み取られ、各エントリは必要時に展開されます）。ソースには、`fs.FS` ハンドルとパス、開いた `fs.File`、クラウドストレージリーダー、raw バイトを指定できます（バイトはアーカイブ全体を RAM に保持するため、小さなアーカイブに限定してください）。

```lua
local fs = require("fs")
local archive = require("archive")

-- Open by fs handle + path (the module opens the file and owns its lifecycle)
local uploads, fs_err = fs.get("app:uploads")
if fs_err then return nil, fs_err end
local r, err = archive.open(uploads, "incoming.zip")
if err then return nil, err end
-- Or from an already-open seekable fs.File
-- local r, err = archive.open(open_file)
-- Or from raw bytes (small archives only)
-- local r, err = archive.open(zip_bytes, { format = "zip" })
```

クラウドストレージ上の大きなアーカイブには、`open_reader` が返す ranged reader を渡します。

```lua
local cloudstorage = require("cloudstorage")

local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end
local source, source_err = storage:open_reader("uploads/large.zip")
if source_err then
    storage:release()
    return nil, source_err
end
local r, archive_err = archive.open(source)
if archive_err then
    source:close()
    storage:release()
    return nil, archive_err
end

-- Read archive entries here.

local _, reader_close_err = r:close()
local _, source_close_err = source:close()
storage:release()
if reader_close_err then return nil, reader_close_err end
if source_close_err then return nil, source_close_err end
```

archive reader は、`fs.FS` ハンドルとパスから自ら開いたファイルを所有します。外部から渡された `fs.File` または ranged reader は所有しません。最初に archive reader を閉じ、次に呼び出し側が所有する入力とハンドルを閉じてください。

**戻り値：** `Reader, error`

**権限：** `archive.read`

### `entries`

エントリ内容を展開せずにメタデータを反復処理します。

```lua
for e in r:entries() do
    -- e: name, size, compressed_size, is_dir, mode, modified, method, crc32, type
    print(e.name, e.size, e.is_dir)
end
```

### `stat`

内容を展開せずに、名前でエントリのメタデータを読み取ります。

```lua
local info, err = r:stat("docs/readme.md")
if err then return nil, err end
```

### `read`

1 つのエントリを Lua 文字列として実体化します。`max_inline_bytes` を超えるとエラー（`kind = Invalid`）になります。大きなデータには `stream()` または `extract()` を使用してください。

```lua
local data, err = r:read("docs/readme.md")  -- small entries only
if err then return nil, err end
```

### `stream`

必要に応じて展開する `stream.Stream` としてエントリを返します。結果は scan したり、`fs:writefile()` に渡したり、別のストリームコンシューマーに渡したりできます。

```lua
local es, err = r:stream("big.csv")
if err then return nil, err end
while true do
    local chunk, read_err = es:read(65536)
    if read_err then
        es:close()
        return nil, read_err
    end
    if not chunk then break end
    process(chunk)
end
local _, close_err = es:close()
if close_err then return nil, close_err end
```

### `extract`

1 つのエントリを出力先ファイルシステムへストリーミングします。

```lua
local out, fs_err = fs.get("app:out")
if fs_err then return nil, fs_err end
local ok, err = r:extract("docs/readme.md", out)
if err then return nil, err end
-- optional destination path:
-- r:extract("docs/readme.md", out, "readme.md")
```

### `extract_all`

すべてのエントリを出力先ファイルシステムへストリーミングします。

```lua
local out, fs_err = fs.get("app:out")
if fs_err then return nil, fs_err end
local count, err = r:extract_all(out, {
    prefix = "job123/",          -- prepend to each destination path
    strip  = 1,                  -- drop N leading path components
    filter = function(e) return not e.is_dir end,
})
if err then return nil, err end
```

アプリケーションコードで出力先ファイルシステムを別途解決し、`fs.get` のエラーを処理できるようにしてください。単一エントリの `extract` では、安全でない出力先名に対してエラーを返します。`extract_all` は、結果のパスに `..` を含むエントリ、絶対パス、Windows ドライブまたは UNC prefix を持つエントリをスキップします。

### `close`

reader を閉じます。この操作は冪等で、タスクスコープでも自動的に閉じられます。

```lua
local ok, err = r:close()
if err then return nil, err end
```

## 読み取り — シーケンシャル走査

`archive.scan(source, opts?)` は、HTTP アップロード body や multipart ファイルストリームのような **前方にしか読めない** ソースを開きます。エントリはアーカイブ順に処理され、各エントリ reader は walk が次へ進むまでの間だけ有効です。ランダムアクセスの `read(name)` は使用できません。

```lua
local up, stream_err = form.files.upload[1]:stream()        -- stream.Stream
if stream_err then return nil, stream_err end
local s, err = archive.scan(up, { format = "zip" })
if err then
    up:close()
    return nil, err
end

local uploads, fs_err = fs.get("app:uploads")
if fs_err then
    s:close()
    up:close()
    return nil, fs_err
end

local count, extract_err = s:extract_all(uploads, {prefix = "job123/"})
if extract_err then
    s:close()
    up:close()
    return nil, extract_err
end
local _, close_err = s:close()
local _, upload_close_err = up:close()
if close_err then return nil, close_err end
if upload_close_err then return nil, upload_close_err end
```

**戻り値：** `Walker, error`

**権限：** `archive.read`

`extract_all` は、前述したものと同じ出力先パスのサニタイズと合計サイズ上限を適用します。代わりにアプリケーションが `s:walk()` を直接進める場合、iterator のエラーは Lua エラーとして raise され、各エントリストリームは次の反復までしか有効ではありません。タスクスコープのクリーンアップでも walker と現在のエントリストリームは解放されます。アプリケーション側に制御が残る場合、呼び出し側が所有する入力ストリームは明示的に閉じてください。

`tar`、`tar.gz`、`tar.zst` はネイティブにストリーミングされます。`zip` はエントリごとの local header を通じて解析されます。ストリーミング data descriptor（サイズ／CRC がデータの後にある形式）で書かれたエントリは、エントリ境界まで展開して読み取ります。大きな ZIP アップロードを堅牢に扱うには、まずアップロードをファイルとして保存し（上限付きのシーケンシャルコピー）、次に `archive.open` を使用します。

```lua
local uuid = require("uuid")

local dst, fs_err = fs.get("app:tmp")
if fs_err then return nil, fs_err end
local upload, stream_err = req:stream()
if stream_err then return nil, stream_err end
local stage_id, id_err = uuid.v7()
if id_err then
    upload:close()
    return nil, id_err
end
local stage_path = stage_id .. ".zip"
local copied, copy_err = dst:writefile(stage_path, upload, "wx")
local _, upload_close_err = upload:close()
if copy_err or upload_close_err then
    dst:remove(stage_path)
    return nil, copy_err or upload_close_err
end
local r, open_err = archive.open(dst, stage_path)   -- robust random access
if open_err then
    dst:remove(stage_path)
    return nil, open_err
end

-- Replace this operation with the random-access work the handler needs.
local info, operation_err = r:stat("manifest.json")
local _, close_err = r:close()
local removed, remove_err = dst:remove(stage_path)
if operation_err then return nil, operation_err end
if close_err then return nil, close_err end
if remove_err then return nil, remove_err end
return info
```

各リクエストは予測不能なステージ名を生成し、排他的に作成するため、同時実行するハンドラーが互いのファイルを切り詰めることはありません。主要な copy、upload-close、open、archive-operation エラーは、ステージファイルの削除を試みた後に返されます。主要エラーがすでにある場合、本番ハンドラーはクリーンアップ失敗を別途ログに記録できます。このレシピでは、実行可能エントリのモジュール許可リストに `uuid` を追加してください。

## 書き込み

`archive.create(dest, ...)` は、ファイルシステム上のパス、書き込み可能な開いたファイル、書き込み可能な `stream.Stream` へエントリをストリーミングします。

```lua
local tmp, fs_err = fs.get("app:tmp")
if fs_err then return nil, fs_err end
local w, err = archive.create(tmp, "out.zip", { format = "zip" })
if err then return nil, err end
```

**戻り値：** `Writer, error`

**権限：** `archive.write`

### `add`

テキストまたはバイトを含む Lua 文字列、開いた `fs.File`、`stream.Stream` からエントリを追加します。

```lua
local ok, err = w:add("notes.txt", "hello")
if err then return nil, err end
local added, add_err = w:add("from_upload", some_stream, { method = "deflate", mode = 420 }) -- 0644
if add_err then return nil, add_err end
```

### `add_file`

ファイルシステム内のファイルからエントリをストリーミングします。

```lua
local data_fs, fs_err = fs.get("app:data")
if fs_err then return nil, fs_err end
local ok, err = w:add_file("data/big.bin", data_fs, "big.bin")
if err then return nil, err end
```

### `add_dir`

ディレクトリエントリを追加します。

```lua
local ok, err = w:add_dir("empty/")
if err then return nil, err end
```

### `close`

ZIP の central directory を含めてアーカイブを確定します。この操作は冪等で、writer もタスクスコープで自動的に閉じられます。

```lua
local ok, err = w:close()
if err then return nil, err end
```

`add` のオプションは `{method = "store"|"deflate", mode, size}` です。TAR 系アーカイブにストリームを追加するときは `size` が必須です。文字列値と `add_file` はサイズを自動的に与えます。`add_file` は `method` と `mode` を受け付け、`add_dir` にはオプションがありません。ZIP writer は、出力先が seek 不可能な書き込みストリームの場合に data descriptor を使用します。

Lua の数値リテラルは 10 進数です。一般に 8 進数の `0644` と表記される Unix パーミッションビットには `420` を使用します。

writer は、エントリソースまたはアーカイブ出力先として外部から渡されたファイルやストリームを閉じません。`w:close()` の後に、呼び出し側が所有するリソースを閉じてください。

## エラー

| 条件 | 種別 |
|------|------|
| 未知または不一致の形式 | `errors.INVALID` |
| 現在の Lua ラッパーが報告する破損または切り詰められたアーカイブ | `errors.INTERNAL` |
| inline `read()` または `extract_all` の合計上限超過 | `errors.INVALID` |
| 現在の Lua ラッパーを通じて open/read 中に表面化したエントリ／アーカイブ上限 | `errors.INTERNAL` |
| ストリーム専用形式へのランダムアクセス（`scan` を使用） | `errors.UNAVAILABLE` |
| エントリ名が見つからない | `errors.NOT_FOUND` |
| アーカイブポリシーによる拒否 | `errors.PERMISSION_DENIED` |
| ソースまたは出力先の I/O 失敗 | `errors.INTERNAL` |
| walk が進んだ後に古いストリームエントリを読み取り | `errors.INTERNAL` |

エラーの扱い方は[エラー処理](../core/errors.md)を参照してください。

## 関連項目

- [ファイルシステム](../storage/filesystem.md) - ソースおよび出力先ファイルシステム
- [クラウドストレージ](../storage/cloud.md) - クラウド上のアーカイブ用 ranged reader
- [ストリーム](../core/stream.md) - アーカイブとの間で受け渡すストリームオブジェクト
- [圧縮](./compress.md) - インメモリの gzip/deflate/zstd
