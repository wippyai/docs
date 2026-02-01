# クラウドストレージ
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

S3互換オブジェクトストレージへのアクセス。署名付きURLサポート付きでファイルをアップロード、ダウンロード、一覧表示、管理。

ストレージ設定については[クラウドストレージ](system-cloudstorage.md)を参照。

## ロード

```lua
local cloudstorage = require("cloudstorage")
```

## ストレージの取得

レジストリIDでクラウドストレージリソースを取得:

```lua
local storage, err = cloudstorage.get("app.infra:files")
if err then
    return nil, err
end

storage:upload_object("data/file.txt", "content")
storage:release()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `id` | string | ストレージリソースID |

**戻り値:** `Storage, error`

## オブジェクトのアップロード

文字列またはファイルからコンテンツをアップロード:

```lua
local storage = cloudstorage.get("app.infra:files")

-- 文字列コンテンツをアップロード
local ok, err = storage:upload_object("reports/daily.json", json.encode({
    date = "2024-01-15",
    total = 1234
}))

-- ファイルからアップロード
local fs = require("fs")
local vol = fs.get("app:data")
local file = vol:open("/large-file.bin", "r")

storage:upload_object("backups/large-file.bin", file)
file:close()

storage:release()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | オブジェクトキー/パス |
| `content` | string or Reader | 文字列またはファイルリーダーとしてのコンテンツ |

**戻り値:** `boolean, error`

## オブジェクトのダウンロード

ファイルライターにオブジェクトをダウンロード:

```lua
local storage = cloudstorage.get("app.infra:files")
local fs = require("fs")
local vol = fs.get("app:temp")

local file = vol:open("/downloaded.json", "w")
local ok, err = storage:download_object("reports/daily.json", file)
file:close()

-- 部分コンテンツをダウンロード（最初の1KB）
local partial = vol:open("/partial.bin", "w")
storage:download_object("backups/large-file.bin", partial, {
    range = "bytes=0-1023"
})
partial:close()

storage:release()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | ダウンロードするオブジェクトキー |
| `writer` | Writer | 宛先ファイルライター |
| `options.range` | string | バイト範囲（例: "bytes=0-1023"） |

**戻り値:** `boolean, error`

## オブジェクトの一覧

オプションのプレフィックスフィルタリングでオブジェクトを一覧:

```lua
local storage = cloudstorage.get("app.infra:files")

local result, err = storage:list_objects({
    prefix = "reports/2024/",
    max_keys = 100
})

for _, obj in ipairs(result.objects) do
    print(obj.key, obj.size, obj.content_type)
end

-- 大きな結果をページネーション
local token = nil
repeat
    local result = storage:list_objects({
        prefix = "logs/",
        max_keys = 1000,
        continuation_token = token
    })
    for _, obj in ipairs(result.objects) do
        process(obj)
    end
    token = result.next_continuation_token
until not result.is_truncated

storage:release()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `options.prefix` | string | キープレフィックスでフィルター |
| `options.max_keys` | integer | 返す最大オブジェクト数 |
| `options.continuation_token` | string | ページネーショントークン |

**戻り値:** `table, error`

結果には`objects`、`is_truncated`、`next_continuation_token`が含まれる。

## オブジェクトの削除

複数のオブジェクトを削除:

```lua
local storage = cloudstorage.get("app.infra:files")

storage:delete_objects({
    "temp/file1.txt",
    "temp/file2.txt",
    "temp/file3.txt"
})

storage:release()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `keys` | string[] | 削除するオブジェクトキーの配列 |

**戻り値:** `boolean, error`

## ダウンロードURL

認証情報なしでオブジェクトをダウンロードできる一時URLを作成。外部ユーザーとファイルを共有したり、アプリケーション経由でコンテンツを提供するのに便利。

```lua
local storage, err = cloudstorage.get("app.infra:files")
if err then
    return nil, err
end

local url, err = storage:presigned_get_url("reports/quarterly.pdf", {
    expiration = 3600
})

storage:release()

if err then
    return nil, err
end

-- 直接ダウンロード用にクライアントにURLを返す
return {download_url = url}
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | オブジェクトキー |
| `options.expiration` | integer | URLが期限切れになるまでの秒数（デフォルト: 3600） |

**戻り値:** `string, error`

## アップロードURL

認証情報なしでオブジェクトをアップロードできる一時URLを作成。クライアントがサーバーを経由せずに直接ストレージにファイルをアップロードできる。

```lua
local storage, err = cloudstorage.get("app.infra:files")
if err then
    return nil, err
end

local url, err = storage:presigned_put_url("uploads/user-123/avatar.jpg", {
    expiration = 600,
    content_type = "image/jpeg",
    content_length = 1024 * 1024
})

storage:release()

if err then
    return nil, err
end

-- 直接アップロード用にクライアントにURLを返す
return {upload_url = url}
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | オブジェクトキー |
| `options.expiration` | integer | URLが期限切れになるまでの秒数（デフォルト: 3600） |
| `options.content_type` | string | アップロードに必要なコンテンツタイプ |
| `options.content_length` | integer | 最大アップロードサイズ（バイト単位） |

**戻り値:** `string, error`

## ストレージメソッド

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `upload_object(key, content)` | `boolean, error` | 文字列またはファイルコンテンツをアップロード |
| `download_object(key, writer, opts?)` | `boolean, error` | ファイルライターにダウンロード |
| `list_objects(opts?)` | `table, error` | プレフィックスフィルター付きでオブジェクトを一覧 |
| `delete_objects(keys)` | `boolean, error` | 複数のオブジェクトを削除 |
| `presigned_get_url(key, opts?)` | `string, error` | 一時ダウンロードURLを生成 |
| `presigned_put_url(key, opts?)` | `string, error` | 一時アップロードURLを生成 |
| `release()` | `boolean` | ストレージリソースを解放 |

## 権限

クラウドストレージ操作はセキュリティポリシー評価の対象。

| アクション | リソース | 説明 |
|--------|----------|-------------|
| `cloudstorage.get` | Storage ID | ストレージリソースを取得 |

## エラー

| 条件 | 種別 | 再試行可能 |
|-----------|------|-----------|
| リソースIDが空 | `errors.INVALID` | no |
| リソースが見つからない | `errors.NOT_FOUND` | no |
| クラウドストレージリソースではない | `errors.INVALID` | no |
| ストレージが解放済み | `errors.INVALID` | no |
| キーが空 | `errors.INVALID` | no |
| コンテンツがnil | `errors.INVALID` | no |
| ライターが無効 | `errors.INVALID` | no |
| オブジェクトが見つからない | `errors.NOT_FOUND` | no |
| 権限拒否 | `errors.PERMISSION_DENIED` | no |
| 操作失敗 | `errors.INTERNAL` | no |

エラーの処理については[エラー処理](lua-errors.md)を参照。

