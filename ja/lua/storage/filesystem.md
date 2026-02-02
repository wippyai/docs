# ファイルシステム
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

サンドボックス化されたファイルシステムボリューム内でファイルを読み取り、書き込み、管理。

ファイルシステム設定については[ファイルシステム](system/filesystem.md)を参照。

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

local content = vol:readfile("/config.json")
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `name` | string | ボリュームレジストリID |

**戻り値:** `FS, error`

<note>
ボリュームは明示的な解放は不要。システムレベルで管理され、ファイルシステムがレジストリから切り離されると利用不可になる。
</note>

## ファイルの読み取り

ファイル内容全体を読み取り:

```lua
local vol = fs.get("app:config")

local data, err = vol:readfile("/settings.json")
if err then
    return nil, err
end

local config = json.decode(data)
```

大きなファイルには`open()`でストリーミングを使用:

```lua
local file = vol:open("/data/large.csv", "r")

while true do
    local chunk = file:read(65536)
    if not chunk or #chunk == 0 then break end
    process(chunk)
end

file:close()
```

## ファイルの書き込み

ファイルにデータを書き込み:

```lua
local vol = fs.get("app:data")

-- 上書き（デフォルト）
vol:writefile("/config.json", json.encode(config))

-- 追記
vol:writefile("/logs/app.log", message .. "\n", "a")

-- 排他的書き込み（存在する場合は失敗）
local ok, err = vol:writefile("/lock.pid", tostring(pid), "wx")
```

| モード | 説明 |
|------|-------------|
| `"w"` | 上書き（デフォルト） |
| `"a"` | 追記 |
| `"wx"` | 排他的書き込み（ファイルが存在する場合は失敗） |

ストリーミング書き込み:

```lua
local file = vol:open("/output/report.txt", "w")
file:write("Header\n")
file:write("Data: " .. value .. "\n")
file:sync()
file:close()
```

## パスのチェック

```lua
local vol = fs.get("app:data")

-- 存在確認
if vol:exists("/cache/results.json") then
    return vol:readfile("/cache/results.json")
end

-- ディレクトリかどうかを確認
if vol:isdir(path) then
    process_directory(path)
end

-- ファイル情報を取得
local info = vol:stat("/documents/report.pdf")
print(info.size, info.modified, info.type)
```

**Statフィールド:** `name`、`size`、`mode`、`modified`、`is_dir`、`type`

## ディレクトリ操作

```lua
local vol = fs.get("app:data")

-- ディレクトリを作成
vol:mkdir("/uploads/" .. user_id)

-- ディレクトリ内容を一覧
for entry in vol:readdir("/documents") do
    print(entry.name, entry.type)
end

-- ファイルまたは空のディレクトリを削除
vol:remove("/temp/file.txt")
```

Entryフィールド: `name`、`type`（"file"または"directory"）

## ファイルハンドルメソッド

ストリーミング用に`vol:open()`を使用する場合:

| メソッド | 説明 |
|--------|-------------|
| `read(size?)` | バイトを読み取り（デフォルト: 4096） |
| `write(data)` | 文字列データを書き込み |
| `seek(whence, offset)` | 位置を設定（"set"、"cur"、"end"） |
| `sync()` | ストレージにフラッシュ |
| `close()` | ファイルハンドルを解放 |
| `scanner(split?)` | 行/単語スキャナを作成 |

ファイルハンドルの使用が終わったら必ず`close()`を呼び出すこと。

## スキャナ

行単位の処理:

```lua
local file = vol:open("/data/users.csv", "r")
local scanner = file:scanner("lines")

scanner:scan()  -- ヘッダーをスキップ

while scanner:scan() do
    local line = scanner:text()
    process(line)
end

file:close()
```

スプリットモード: `"lines"`（デフォルト）、`"words"`、`"bytes"`、`"runes"`

## 定数

```lua
fs.type.FILE      -- "file"
fs.type.DIR       -- "directory"

fs.seek.SET       -- 先頭から
fs.seek.CUR       -- 現在位置から
fs.seek.END       -- 末尾から
```

## FSメソッド

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `readfile(path)` | `string, error` | ファイル全体を読み取り |
| `writefile(path, data, mode?)` | `boolean, error` | ファイルを書き込み |
| `exists(path)` | `boolean, error` | パスが存在するか確認 |
| `stat(path)` | `table, error` | ファイル情報を取得 |
| `isdir(path)` | `boolean, error` | ディレクトリか確認 |
| `mkdir(path)` | `boolean, error` | ディレクトリを作成 |
| `remove(path)` | `boolean, error` | ファイル/空のディレクトリを削除 |
| `readdir(path)` | `iterator` | ディレクトリを一覧 |
| `open(path, mode)` | `File, error` | ファイルハンドルを開く |
| `chdir(path)` | `boolean, error` | 作業ディレクトリを変更 |
| `pwd()` | `string` | 作業ディレクトリを取得 |

## 権限

ファイルシステムアクセスはセキュリティポリシー評価の対象。

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `fs.get` | Volume ID | ファイルシステムボリュームを取得 |

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| パスが空 | `errors.INVALID` | no |
| 無効なモード | `errors.INVALID` | no |
| ファイルがクローズ済み | `errors.INVALID` | no |
| パスが見つからない | `errors.NOT_FOUND` | no |
| パスが既に存在 | `errors.ALREADY_EXISTS` | no |
| 権限拒否 | `errors.PERMISSION_DENIED` | no |

エラーの処理については[エラー処理](lua/core/errors.md)を参照。

