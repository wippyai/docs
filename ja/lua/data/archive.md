---
title: "Archive"
description: "zip/tarアーカイブを有限のメモリで読み書きします。アーカイブはRAMに読み込まれることも、ディスクへ展開されることもありません。ピークメモリはアーカイブやエントリのサイズに依存しないため、数GBのアーカイブも低RAMのサーバーで扱えます。"
---

# Archive
<secondary-label ref="function"/>
<secondary-label ref="io"/>
<secondary-label ref="encoding"/>

zip/tarアーカイブを有限のメモリで読み書きします。アーカイブはRAMに読み込まれることも、ディスクへ展開されることもありません。ピークメモリはアーカイブやエントリのサイズに依存しないため、数GBのアーカイブも低RAMのサーバーで扱えます。

## ロード

```lua
local archive = require("archive")
```

## フォーマット

組み込みフォーマットはマジックバイトで検出されるか、`opts.format`で強制されます:

| フォーマット | ランダム読み取り | 逐次スキャン | 書き込み |
|--------|:-----------:|:---------------:|:-----:|
| `zip` | 可 | 可（ローカルヘッダー） | 可 |
| `tar` | 可 | 可 | 可 |
| `tar.gz` | 不可 | 可 | 可 |
| `tar.zst` | 不可 | 可 | 可 |

`archive.formats()`は登録済みフォーマット名の一覧を返します。

```lua
local names = archive.formats()  -- {"zip", "tar", "tar.gz", "tar.zst", ...}
```

## オプション

すべてのエントリポイントは任意の`opts`テーブルを受け取ります:

| キー | デフォルト | 意味 |
|-----|---------|---------|
| `format` | auto | `"zip"`、`"tar"`、`"tar.gz"`、`"tar.zst"`。auto = マジックバイトを判定し、なければ拡張子 |
| `max_entries` | 100000 | これを超えるエントリ数のアーカイブを拒否（解凍爆弾への防御） |
| `max_total_bytes` | 2 GiB | 読み取り/展開中の非圧縮出力の累積上限 |
| `max_file_bytes` | 1 GiB | 単一エントリの非圧縮サイズの上限 |
| `max_inline_bytes` | 16 MiB | RAM上に実体化する`read()`呼び出しの厳格な上限。これを超える場合は`stream()`/`extract()`を使用 |
| `buffer_bytes` | 64 KiB | 読み取り/展開/追加のストリーミングコピー用バッファ |

`max_total_bytes`/`max_file_bytes`は作業量の上限であり、RAMの上限ではありません。エントリのストリーミングが保持するのは、`buffer_bytes`とコーデックの解凍ウィンドウを超えることはありません。RAMサイズを調整するつまみは`max_inline_bytes`のみです。

## 読み取り — ランダムアクセス

`archive.open(source, ...)`は**シーク可能な**ソースを開き、完全なランダムアクセスを提供します（zipの中央ディレクトリは事前に読み込まれ、エントリは要求に応じて解凍されます）。ソースには、`fs.FS`ハンドルとパスの組み合わせ、開いている`fs.File`、生のバイト列（バイト列はアーカイブ全体をRAMに保持するため小さなアーカイブのみ）、または他のモジュールから渡された任意のランダムアクセスリーダーを指定できます。

他モジュールのリーダーは、`io.ReaderAt`を実装し`Size`を報告する場合に条件を満たします。`opts.format`が省略されたとき、任意の`Name`は拡張子の判定に使われます。[`cloudstorage`](lua/storage/cloud.md)の`open_reader`はその1つで、数GBのアーカイブをオブジェクトストレージから直接読み取ります。その場合、archiveは何も開かず、リーダーを閉じることもありません。それは所有者の役目です。

```lua
local fs = require("fs")
local archive = require("archive")

-- fsハンドル + パスで開く（モジュールがファイルを開き、そのライフサイクルを所有する）
local r, err = archive.open(fs.get("app:uploads"), "incoming.zip")
-- または、すでに開いているシーク可能な fs.File から
-- local r = archive.open(fs:get("app:uploads"):open("x.zip"))
-- または、生のバイト列から（小さなアーカイブのみ）
-- local r = archive.open(zip_bytes, { format = "zip" })
-- または、他のモジュールが所有するランダムアクセスリーダーから
-- local reader = cloudstorage.get("app:files"):open_reader("incoming.zip")
-- local r = archive.open(reader)
```

**戻り値:** `Reader, error`

**権限:** `archive.read`

### entries

ディレクトリを反復します（メタデータのみ — 解凍なし）:

```lua
for e in r:entries() do
    -- e: name, size, compressed_size, is_dir, mode, modified, method, crc32, type
    print(e.name, e.size, e.is_dir)
end
```

### stat

名前でエントリのメタデータを取得します（解凍なし）:

```lua
local info, err = r:stat("docs/readme.md")
```

### read

単一のエントリをLua文字列として実体化します。`max_inline_bytes`を超えるとエラー（`kind = Invalid`）になります。大きなものには`stream()`または`extract()`を使用してください:

```lua
local data, err = r:read("docs/readme.md")  -- 小さなエントリのみ
```

### stream

エントリを、要求に応じて解凍する`stream.Stream`として返します。ストリームが使える場所ならどこでも組み合わせられます — `:scanner()`、`fs:writefile()`、あるいは他のモジュールへの受け渡し:

```lua
local es, err = r:stream("big.csv")
while true do
    local chunk = es:read(65536)
    if not chunk then break end
    process(chunk)
end
es:close()
```

### extract

1つのエントリを宛先のファイルシステムへストリーミングします:

```lua
local ok, err = r:extract("docs/readme.md", fs.get("app:out"))
-- 宛先パスは任意:
-- r:extract("docs/readme.md", fs.get("app:out"), "readme.md")
```

### extract_all

すべてのエントリを宛先のファイルシステムへストリーミングします:

```lua
local count, err = r:extract_all(fs.get("app:out"), {
    prefix = "job123/",          -- 各宛先パスの先頭に付加する
    strip  = 1,                  -- 先頭のパス構成要素をN個取り除く
    filter = function(e) return not e.is_dir end,
})
```

エントリ名は展開時にサニタイズされます。`..`セグメント、絶対パス、Windowsのドライブ/UNCプレフィックスは拒否されます（zip slipへの防御）。

### close

リーダーを閉じます。冪等であり、タスクスコープでも自動的に閉じられます。

```lua
r:close()
```

## 読み取り — 逐次スキャン

`archive.scan(source, opts?)`は**前方向のみ**のストリーム（HTTPアップロードのボディ、マルチパートのファイルストリーム）を開きます。エントリはアーカイブ内の順序で訪問され、各エントリのリーダーは次へ進めるまでの間のみ有効です。ランダムな`read(name)`はできません。

```lua
local up = form.files.upload[1]:stream()        -- stream.Stream
local s, err = archive.scan(up, { format = "zip" })

for e, entry in s:walk() do                      -- entry は stream.Stream
    if not e.is_dir then
        fs.get("app:uploads"):writefile("job123/" .. e.name, entry)
    end
end
s:close()
```

**戻り値:** `Walker, error`

**権限:** `archive.read`

ウォーカーもランダムアクセスリーダーと同じオプションで`extract_all`をサポートし、すべてのエントリを1回の呼び出しで宛先ファイルシステムへストリーミングします:

```lua
local count, err = s:extract_all(fs.get("app:uploads"), { prefix = "job123/" })
```

`tar`、`tar.gz`、`tar.zst`はネイティブにストリーミングされます。`zip`はエントリごとのローカルヘッダーで解析されます。ストリーミング用のデータディスクリプタ（サイズ/CRCがデータの後に続く）で書かれたエントリは、エントリ境界まで解凍することで読み取られます。大きなアップロードでzipを堅牢に扱うには、まずアップロードをファイルとして受け取り（有限の逐次コピー）、その後に`archive.open`を使ってください:

```lua
local dst = fs.get("app:tmp")
dst:writefile("u.zip", req:stream())   -- アップロードをfsのファイルへストリーミングコピー
local r = archive.open(dst, "u.zip")   -- 堅牢なランダムアクセス
-- ... entries / extract_all ...
r:close()
dst:remove("u.zip")
```

## 書き込み

`archive.create(dest, ...)`は、エントリを宛先へストリーミングしてアーカイブを構築します。宛先はfs内のファイル（パス付き）または書き込み可能な`stream.Stream`（例: HTTPレスポンス）であり、ダウンロード用の`.zip`を有限のメモリで直接ネットワークへ生成できます。

```lua
local w, err = archive.create(fs.get("app:tmp"), "out.zip", { format = "zip" })
-- またはレスポンスへストリーミング:
-- local w = archive.create(res:stream(), { format = "zip" })
```

**戻り値:** `Writer, error`

**権限:** `archive.write`

### add

文字列、バイト列、リーダー、または`stream.Stream`からエントリを追加します:

```lua
w:add("notes.txt", "hello")
w:add("from_upload", some_stream, { method = "deflate", mode = tonumber("644", 8) })
```

### add_file

ファイルシステム内のファイルからエントリをストリーミングします:

```lua
w:add_file("data/big.bin", fs.get("app:data"), "big.bin")
```

### add_dir

ディレクトリエントリを追加します:

```lua
w:add_dir("empty/")
```

### close

アーカイブを確定します（zipでは中央ディレクトリを書き込みます）。冪等であり、タスクスコープでも自動的に閉じられます。

```lua
w:close()
```

`add*`のオプション: `{ method = "store"|"deflate", mode, size }`。tar系のフォーマットはエントリサイズを事前に必要とするため、ストリームやリーダーから`tar*`アーカイブへ`add()`する場合は`size`が必須です（文字列と`add_file`は自動的に供給します）。zipのライターはデータディスクリプタを用いてシーク不可能なライターへストリーミングするため、レスポンスストリームへの書き込みも動作します。

## エラー

| 条件 | 種別 |
|-----------|------|
| ソースがfsハンドル、fsファイル、バイト列、ランダムアクセスリーダーのいずれでもない | `errors.INVALID` |
| 未知の / 一致しないフォーマット | `errors.INVALID` |
| 破損または切り詰められたアーカイブ | `errors.INVALID` |
| 制限の超過（エントリ / 合計 / ファイル / インライン） | `errors.INVALID` |
| ストリーム専用フォーマットへのランダムアクセス（`scan`を使用） | `errors.UNAVAILABLE` |
| エントリ名が見つからない | `errors.NOT_FOUND` |
| ソースが読み取り不可 / 宛先が書き込み不可 | `errors.PERMISSION_DENIED` |
| ウォークが進んだ後に古いストリーミングエントリを読み取った | `errors.INTERNAL` |

エラーの処理については[エラー処理](lua/core/errors.md)を参照。

## 関連項目

- [ファイルシステム](lua/storage/filesystem.md) - ソースおよび宛先のファイルシステム
- [Stream](lua/core/stream.md) - アーカイブへ渡す、またはアーカイブから受け取るストリームオブジェクト
- [圧縮](lua/data/compress.md) - メモリ上でのgzip/deflate/zstd
- [クラウドストレージ](lua/storage/cloud.md) - ランダムアクセスのアーカイブソースとしての`open_reader`
