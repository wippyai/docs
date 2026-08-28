---
title: "Hub"
description: "Wippy Hub のメタデータとアーティファクトを参照し、認証情報を管理し、ローカルアーティファクトキャッシュを検査します。"
---

# Hub

`hub` モジュールは、Wippy Hub のモジュール、バージョン、依存関係、ファイル、アーティファクト、README を読み取ります。また、ランタイムの Hub 認証情報オーバーライドを管理し、ローカルキャッシュから未固定のアーティファクトを削除できます。

このページは API リファレンスです。カタログ座標は説明用です。アーティファクト、認証、キャッシュの各操作には、一致するネットワークアクセス、認証情報、ロック状態、セキュリティポリシーが必要です。

## 読み込み

```lua
local hub = require("hub")
```

## 呼び出しごとのオプション

ネットワーク経由のカタログおよびアーティファクト呼び出しは、次の共通キーを持つオプションテーブルを受け取れます。

| キー | 型 | 説明 |
|-----|------|-------------|
| `registry` | string | レジストリ URL の上書き |
| `token` | string | API トークンの上書き |
| `timeout` | duration/number | リクエストのタイムアウト（例: `"3m"` または秒数） |

ページネーション対応の呼び出しでは `page` と `page_size` も指定できます。

認証呼び出しにはレジストリ URL を直接渡します。キャッシュ呼び出しとパッケージハンドルのメソッドには、それぞれ以下で説明する専用オプションがあります。

## モジュール

```lua
local result, err = hub.modules.list({
    org = "wippy",
    visibility = "public",
    type = "library",
    sort_order = "downloads_desc",
    page = 1,
    page_size = 20,
})
-- result = { items, total, page, page_size }
```

| 関数 | 説明 |
|----------|-------------|
| `hub.modules.list(opts?)` | フィルタでモジュールを一覧表示 |
| `hub.modules.search(query, opts?)` | クエリ文字列で検索 |
| `hub.modules.get(module, opts?)` | `org/name` またはモジュール id でモジュールを取得 |
| `hub.modules.readme(module, opts?)` | README を取得。`{content, filename, version}` を返す |

### List/Search オプション

| オプション | 値 |
|--------|--------|
| `organization_id` / `org` | string |
| `visibility` | `public`, `private`, `internal` |
| `type` | `library`, `application`, `agent`, `plugin` |
| `sort_order` | `name_asc`, `name_desc`, `created_desc`, `updated_desc`, `downloads_desc` |
| `keywords` (search) | 文字列の配列 |
| `license` (search) | string |
| `include_deprecated` (search) | boolean |

### README

```lua
local readme, err = hub.modules.readme("wippy/terminal", {
    version = "1.2.3"
})
if err then return nil, err end
print(readme.content)
```

`version` オプションにはバージョン文字列、または `{id, version, label}` のようなテーブルを渡せます。

## バージョン

```lua
local versions, err = hub.versions.list("wippy/terminal", {
    include_yanked = false,
    page_size = 50,
})

local v, err = hub.versions.get("wippy/terminal", "1.0.0")
```

| 関数 | 説明 |
|----------|-------------|
| `hub.versions.list(module, opts?)` | モジュールのバージョン一覧 |
| `hub.versions.get(module, version, opts?)` | 特定のバージョンを取得 |
| `hub.versions.inspect(module, version, opts?)` | バージョンのアーティファクトを検査（バンドルをダウンロードして読み取る） |
| `hub.versions.open(module, version, opts?)` | バージョンのアーティファクトをパッケージハンドルとして開く |

### パッケージハンドル

`hub.versions.open` はアーティファクトをダウンロードし、`version`、`digest`、`packed` フィールドを持つハンドルを返します：

```lua
local pkg, err = hub.versions.open("wippy/terminal", "1.2.3")
if err then return nil, err end

local entries, entries_err = pkg:entries({
    kind = "function.lua",       -- string or string[], omit for all kinds
    include_data = false,        -- default true
})
-- each entry: { id = "ns:name", kind = "...", meta = {...}, data = <any> }
local _, close_err = pkg:close()
if entries_err then return nil, entries_err end
if close_err then return nil, close_err end
return entries
```

| メソッド | 説明 |
|--------|-------------|
| `pkg:metadata()` | パックのメタデータマップ |
| `pkg:entries(opts?)` | アーティファクト内のレジストリエントリ。`opts.kind` でフィルタ、`opts.include_data`（デフォルト true）で `data` フィールドを制御 |
| `pkg:resources()` | 埋め込みリソースの一覧 |
| `pkg:fs(resource)` | 埋め込みリソースのファイルシステムハンドル |
| `pkg:close()` | ハンドルを解放 |

エントリの `data` は生のまま返されます — `${env:...}` 参照は解決されません。

## ローカルアーティファクトキャッシュ

```lua
local entries, err = hub.cache.list()

local removed, err = hub.cache.remove("wippy/terminal", "1.2.3", {
    force = false,
})

local candidates, err = hub.cache.prune({
    dry_run = true,
})
```

| 関数 | 説明 |
|----------|-------------|
| `hub.cache.list()` | キャッシュ済みアーティファクトを `{module, version, size, pinned}` レコードとして一覧表示 |
| `hub.cache.remove(module, version, opts?)` | キャッシュ済みアーティファクトを 1 つ削除。`opts.force = true` を指定するとロックファイルで固定されていても削除可能 |
| `hub.cache.prune(opts?)` | ロックファイルから参照されていないアーティファクトを削除。`opts.dry_run = true` では候補のみを報告 |

`hub.cache.remove` と `hub.cache.prune` は、ドライランまたは固定保護が適用されない限り、ロックから解決された vendor ディレクトリ内のファイルを削除します。

## 依存関係

```lua
local deps, err = hub.dependencies.get("wippy/terminal", "1.0.0")
local users, err = hub.dependents.get("wippy/terminal")
```

| 関数 | 説明 |
|----------|-------------|
| `hub.dependencies.get(module, version?, opts?)` | モジュールバージョンの依存関係 |
| `hub.dependents.get(module, opts?)` | このモジュールに依存するモジュール |

## ファイル

```lua
local files, err = hub.files.list("wippy/terminal", "1.0.0")
```

| 関数 | 説明 |
|----------|-------------|
| `hub.files.list(module, version, opts?)` | バージョンのファイル一覧（`version` は必須）。`{items, total, page, page_size}` を返す |

## 認証

実行中のプロセスにレジストリトークンをプッシュします — すべてのハブ利用側が次回の呼び出しから、再起動なしでそのトークンを使用します：

```lua
local status, err = hub.auth.authenticate("wpy_xxx")          -- default registry
local status, err = hub.auth.authenticate("wpy_xxx", "https://hub.example.com")

local status, err = hub.auth.status()
local ok, err = hub.auth.logout()
```

上のトークン文字列はプレースホルダーです。実際の認証情報は、シークレットで保護された環境エントリまたは別の保護されたソースから読み込んでください。Lua やレジストリ YAML にコミットしてはいけません。

| 関数 | 説明 |
|----------|-------------|
| `hub.auth.authenticate(token, registry?)` | トークンをレジストリに対して検証し、成功時にランタイムのオーバーライドとしてインストール |
| `hub.auth.status(registry?)` | 現在の認証情報をライブ検証 |
| `hub.auth.logout(registry?)` | ランタイムのトークンオーバーライドをクリア |

`status` には `authenticated`、`registry`、`orgs` が含まれます。アイデンティティフィールド（`username`、`user_id`、`scope`、`expires_at`、`expired`）は認証済みの場合にのみ存在します。検証に失敗したトークンは保存されず、`authenticate` は `authenticated = false` を返します。このオーバーライドは `WIPPY_TOKEN` および保存済みの認証情報より優先されます。

## 権限

各トップレベルの `hub.*` 操作は、`hub.modules.list`、`hub.versions.open`、`hub.dependencies.get`、`hub.files.list`、`hub.auth.status`、`hub.cache.prune` のように対応するアクション名を検査します。モジュールを指定するアクションは指定されたモジュール参照をセキュリティリソースとして使い、認証アクションはレジストリ URL を使用します。認可済みの `hub.versions.open` 呼び出し後、パッケージハンドルのメソッドでは再度の権限検査を行いません。

## 関連項目

- [CLI リファレンス](guides/cli.md) — `wippy readme`、`wippy search`、`wippy publish`
- [公開ガイド](guides/publishing.md)
