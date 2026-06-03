# Hub

Wippy Hub モジュールカタログへの読み取り専用アクセス。モジュールの一覧取得、検索、メタデータ・バージョン・依存関係・README の取得を行います。

## 読み込み

```lua
local hub = require("hub")
```

## 呼び出しごとのオプション

すべての呼び出しはオプションテーブルを受け取れます。すべての呼び出しに共通するキー：

| キー | 型 | 説明 |
|-----|------|-------------|
| `registry` | string | レジストリ URL の上書き |
| `token` | string | API トークンの上書き |
| `timeout` | duration/number | リクエストのタイムアウト（例: `"3m"` または秒数） |

ページネーション対応の呼び出しでは `page` と `page_size` も指定できます。

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
print(readme.content)
```

`version` オプションにはバージョン文字列、または `{id, version, label}` のようなテーブルを渡せます。

## バージョン

```lua
local versions, err = hub.versions.list("wippy/http", {
    include_yanked = false,
    page_size = 50,
})

local v, err = hub.versions.get("wippy/http", "1.0.0")
```

| 関数 | 説明 |
|----------|-------------|
| `hub.versions.list(module, opts?)` | モジュールのバージョン一覧 |
| `hub.versions.get(module, version, opts?)` | 特定のバージョンを取得 |
| `hub.versions.inspect(module, version, opts?)` | バージョンのアーティファクトを検査（バンドルをダウンロードして読み取る） |

## 依存関係

```lua
local deps, err = hub.dependencies.get("wippy/http", "1.0.0")
local users, err = hub.dependents.get("wippy/http")
```

| 関数 | 説明 |
|----------|-------------|
| `hub.dependencies.get(module, version?, opts?)` | モジュールバージョンの依存関係 |
| `hub.dependents.get(module, opts?)` | このモジュールに依存するモジュール |

## ファイル

```lua
local files, err = hub.files.list("wippy/http", "1.0.0")
```

| 関数 | 説明 |
|----------|-------------|
| `hub.files.list(module, version, opts?)` | バージョンのファイル一覧（`version` は必須）。`{items, total, page, page_size}` を返す |

## 関連項目

- [CLI Reference](guides/cli.md) — `wippy readme`、`wippy search`、`wippy publish`
- [Publishing Guide](guides/publishing.md)
