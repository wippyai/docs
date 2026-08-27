---
title: "クラウドストレージ"
description: "S3 互換ストレージでオブジェクトをアップロード、ダウンロード、一覧表示、管理します。"
---

# クラウドストレージ
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

`cloudstorage` モジュールは、S3 互換ストレージでオブジェクトをアップロード、ダウンロード、一覧表示、管理します。直接アクセス用の署名付き URL も作成できます。

このページは API リファレンスです。スニペットでは、構成済みのストレージエントリ、記載されているファイルシステムボリュームへのアクセス、後述する権限を前提としています。マルチパートと署名付き URL のブロックはクライアント統合の部分的なレシピであり、アプリケーションが HTTP 転送を実行して、返された ETag を提供する必要があります。操作とリソースのクリーンアップがともに失敗し得る箇所では、周囲のアプリケーションが `report_cleanup_error(err)` を提供し、起点となったエラーを保持したままクリーンアップの失敗を記録します。

ストレージの構成については、[クラウドストレージ](../../system/cloudstorage.md)を参照してください。

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

local uploaded, upload_err = storage:upload_object("data/file.txt", "content")
storage:release()
if upload_err then return nil, upload_err end
return uploaded
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `id` | string | ストレージリソースID |

**戻り値:** `Storage, error`

## オブジェクトのアップロード

文字列またはファイルからコンテンツをアップロード:

```lua
local json = require("json")

local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

-- Upload string content
local body, encode_err = json.encode({
    date = "2024-01-15",
    total = 1234
})
if encode_err then
    storage:release()
    return nil, encode_err
end
local ok, err = storage:upload_object("reports/daily.json", body)
if err then
    storage:release()
    return nil, err
end

-- Upload from file
local fs = require("fs")
local vol, fs_err = fs.get("app:data")
if fs_err then
    storage:release()
    return nil, fs_err
end
local file, open_err = vol:open("/large-file.bin", "r")
if open_err then
    storage:release()
    return nil, open_err
end

local uploaded, file_upload_err = storage:upload_object("backups/large-file.bin", file)
local _, close_err = file:close()

storage:release()
if file_upload_err then
    if close_err then report_cleanup_error(close_err) end
    return nil, file_upload_err
end
if close_err then return nil, close_err end
return uploaded
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | オブジェクトキー/パス |
| `content` | string or Reader | 文字列またはファイルリーダーとしてのコンテンツ |
| `options` | table | オプションのメタデータおよび条件付き書き込みオプション |

**戻り値:** `boolean, error`

### アップロードオプション

オプションテーブルでメタデータを付与したり、書き込みをガードしたりできます:

```lua
local uploaded, err = storage:upload_object("reports/daily.json", body, {
    content_type = "application/json",
    cache_control = "max-age=3600",
    metadata = { owner = "team-a", run_id = "1234" },  -- stored as x-amz-meta-*
    only_if_absent = true                              -- fail if the key already exists
})
if err then return nil, err end
return uploaded
```

| オプション | 型 | 説明 |
|--------|------|-------------|
| `content_type` | string | MIME タイプ |
| `cache_control` | string | Cache-Control ヘッダー |
| `content_disposition` | string | Content-Disposition ヘッダー |
| `content_encoding` | string | Content-Encoding ヘッダー |
| `metadata` | table | ユーザーメタデータ（string のキー/値）。`x-amz-meta-*` として保存 |
| `headers` | table | 追加のリクエストヘッダー（string のキー/値） |
| `if_match` | string | 現在のオブジェクト ETag が一致する場合のみ書き込み |
| `if_none_match` | string | ETag に一致するオブジェクトがない場合のみ書き込み（`"*"` は任意を意味する） |
| `only_if_absent` | boolean | キーが存在しない場合のみ書き込み（`if_none_match = "*"` のエイリアス） |

前提条件を満たさない条件付き書き込みは `precondition_failed` エラーを返します。

## オブジェクトのダウンロード

ファイルライターにオブジェクトをダウンロード:

```lua
local fs = require("fs")
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end
local vol, fs_err = fs.get("app:temp")
if fs_err then
    storage:release()
    return nil, fs_err
end

local file, open_err = vol:open("/downloaded.json", "w")
if open_err then
    storage:release()
    return nil, open_err
end
local ok, err = storage:download_object("reports/daily.json", file)
local _, close_err = file:close()
if err then
    if close_err then report_cleanup_error(close_err) end
    storage:release()
    return nil, err
end
if close_err then
    storage:release()
    return nil, close_err
end

-- Download partial content (first 1KB)
local partial, partial_open_err = vol:open("/partial.bin", "w")
if partial_open_err then
    storage:release()
    return nil, partial_open_err
end
local partial_ok, partial_err = storage:download_object("backups/large-file.bin", partial, {
    range = "bytes=0-1023"
})
local _, partial_close_err = partial:close()

storage:release()
if partial_err then
    if partial_close_err then report_cleanup_error(partial_close_err) end
    return nil, partial_err
end
if partial_close_err then return nil, partial_close_err end
return partial_ok
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | ダウンロードするオブジェクトキー |
| `writer` | Writer | 宛先ファイルライター |
| `options.range` | string | バイト範囲（例: "bytes=0-1023"） |
| `options.if_match` | string | オブジェクト ETag が一致する場合のみダウンロード |
| `options.if_none_match` | string | ETag が一致しない場合のみダウンロード |

**戻り値:** `boolean, error`

前提条件（`if_match`/`if_none_match`）を満たさない場合は `precondition_failed` エラーを返します。

## オブジェクトの一覧

オプションのプレフィックスフィルタリングでオブジェクトを一覧:

```lua
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

local result, err = storage:list_objects({
    prefix = "reports/2024/",
    max_keys = 100
})
if err then
    storage:release()
    return nil, err
end

for _, obj in ipairs(result.objects) do
    print(obj.key, obj.size, obj.etag)
end

-- Paginate through large results
local token = nil
repeat
    local page, page_err = storage:list_objects({
        prefix = "logs/",
        max_keys = 1000,
        continuation_token = token
    })
    if page_err then
        storage:release()
        return nil, page_err
    end
    for _, obj in ipairs(page.objects) do
        process(obj)
    end
    token = page.next_continuation_token
    if not page.is_truncated then break end
until false

storage:release()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `options.prefix` | string | キープレフィックスでフィルター |
| `options.max_keys` | integer | 返す最大オブジェクト数 |
| `options.continuation_token` | string | ページネーショントークン |
| `options.include_owner` | boolean | 各オブジェクトの `owner`（`id`、`display_name`）を含める |
| `options.include_versions` | boolean | オブジェクトバージョンを一覧；各項目に `version_id` が含まれる |

**戻り値:** `table, error`

結果には `objects`、`is_truncated`、`next_continuation_token` が含まれます。各オブジェクトには `key`、`size`、`etag`、`storage_class` があり、必要に応じて `last_modified`、`version_id`、`owner` も含まれます。

<note>
リスト結果では <code>content_type</code> は常に空です — S3 のリスト操作はこれを返しません。オブジェクトのコンテンツタイプとメタデータを読み取るには <code>head_object</code> を使用してください。
</note>

## オブジェクトメタデータ

本体をダウンロードせずに単一オブジェクトのメタデータを取得します:

```lua
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

local meta, err = storage:head_object("reports/daily.json")
if err then
    storage:release()
    return nil, err
end

print(meta.size, meta.etag, meta.content_type)
for k, v in pairs(meta.metadata) do
    print("meta", k, v)
end

storage:release()
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | オブジェクトキー |

**戻り値:** `table, error`

結果フィールド:

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `size` | integer | オブジェクトサイズ（バイト） |
| `etag` | string | エンティティタグ |
| `content_type` | string | MIME タイプ |
| `cache_control` | string | Cache-Control ヘッダー |
| `content_disposition` | string | Content-Disposition ヘッダー |
| `content_encoding` | string | Content-Encoding ヘッダー |
| `storage_class` | string | ストレージクラス |
| `version_id` | string | バージョン ID（バージョニングが有効な場合に存在） |
| `last_modified` | integer | 最終更新時刻（Unix 秒） |
| `metadata` | table | ユーザーメタデータ（`x-amz-meta-*`） |
| `headers` | table | 生のレスポンスヘッダー（キーは小文字化） |

存在しないオブジェクトは `not_found` エラーを返します。

## オブジェクトの削除

複数のオブジェクトを削除:

```lua
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

local deleted, err = storage:delete_objects({
    "temp/file1.txt",
    "temp/file2.txt",
    "temp/file3.txt"
})

storage:release()
if err then return nil, err end
return deleted
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `keys` | string[] | 削除するオブジェクトキーの配列 |

**戻り値:** `boolean, error`

## ダウンロードURL

ストレージの認証情報なしでオブジェクトのダウンロードを許可する一時 URL を作成します。クライアントは URL の有効期限まで使用できます。

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

-- Return URL to client for direct download
return {download_url = url}
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | オブジェクトキー |
| `options.expiration` | integer | URLが期限切れになるまでの秒数（デフォルト: 3600） |

**戻り値:** `string, error`

## アップロードURL

ストレージの認証情報なしでオブジェクトのアップロードを許可する一時 URL を作成します。クライアントは URL の有効期限までストレージに直接アップロードできます。

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

-- Return URL to client for direct upload
return {upload_url = url}
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | オブジェクトキー |
| `options.expiration` | integer | URLが期限切れになるまでの秒数（デフォルト: 3600） |
| `options.content_type` | string | アップロードに必要なコンテンツタイプ |
| `options.content_length` | integer | 想定される正確なアップロード長（バイト） |

**戻り値:** `string, error`

## マルチパートアップロード URL

クライアントから大きなファイルをアップロードする場合は、マルチパートアップロードを作成し、各パートの署名付き URL を発行して、パートのリクエストで返された ETag を使ってアップロードを完了します。周囲のアプリケーションは `report_cleanup_error(err)` を提供します。これにより、アボートの失敗を観測可能にしながら、起点となったアップロードエラーを置き換えずに済みます:

```lua
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

local key = "uploads/user-123/video.mp4"
local upload, err = storage:create_multipart_upload(key, {
    content_type = "video/mp4"
})
if err then
    storage:release()
    return nil, err
end

local urls, err = storage:presigned_part_urls(key, upload.upload_id, {
    count = 3,
    expiration = 900
})
if err then
    local _, abort_err = storage:abort_multipart_upload(key, upload.upload_id)
    storage:release()
    if abort_err then
        report_cleanup_error(abort_err)
    end
    return nil, err
end

-- Upload each part to its URL and retain the ETag response header.
local completed, err = storage:complete_multipart_upload(key, upload.upload_id, {
    {part_number = 1, etag = part_1_etag},
    {part_number = 2, etag = part_2_etag},
    {part_number = 3, etag = part_3_etag}
})
if err then
    local _, abort_err = storage:abort_multipart_upload(key, upload.upload_id)
    storage:release()
    if abort_err then
        report_cleanup_error(abort_err)
    end
    return nil, err
end

storage:release()
return completed
```

`presigned_part_urls` は `count` または `parts` のどちらか一方だけを受け付けます。1 回の呼び出しで返せる URL は最大 1,000 件で、パート番号は 1 から 10,000 までです。`expiration` のデフォルトは 3,600 秒で、必要に応じて指定した `headers` も署名に含まれます。`create_multipart_upload` は `content_type`、`cache_control`、`content_disposition`、`content_encoding`、`metadata`、`headers` を受け付けます。完了リクエスト内のパートの順序は問いません。

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `create_multipart_upload(key, opts?)` | `table, error` | アップロードを開始し、`{upload_id}` を返す |
| `presigned_part_urls(key, upload_id, opts)` | `table[], error` | `{part_number, url}` レコードを返す |
| `complete_multipart_upload(key, upload_id, parts)` | `table, error` | アップロードを完了し、ETag と必要に応じてバージョン/場所を返す |
| `abort_multipart_upload(key, upload_id)` | `boolean, error` | 未完了のアップロードをアボートする |

完了しないアップロードはアボートしてください。バケットのライフサイクルルールは放棄されたアップロードに対する予備策であり、明示的なクリーンアップの代わりにはなりません。構成済みのプロバイダーが必要な機能をサポートしない場合、マルチパートメソッドは `errors.UNAVAILABLE` を返します。

## ランダムアクセスリーダー

`open_reader` は、オブジェクト全体をダウンロードせずにシーク可能な読み取り専用オブジェクトを公開します。キャッシュミス時に範囲を取得し、オブジェクトを開いた時点の ETag を `If-Match` 条件として送信します。条件を適用するプロバイダーでは、オブジェクトが変更されると、複数バージョンを混在させずに `errors.CONFLICT` を返します。

```lua
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

local reader, err = storage:open_reader("archives/large.zip", {
    block_size = 8 * 1024 * 1024,
    cache_blocks = 4
})
if err then
    storage:release()
    return nil, err
end

print(reader:key(), reader:size())

local _, close_err = reader:close()
storage:release()
if close_err then return nil, close_err end
```

| オプション | デフォルト | 有効範囲 |
|--------|---------|-------------|
| `block_size` | 8 MiB | 64 KiB から 128 MiB |
| `cache_blocks` | 4 | 1 から 64 |

キャッシュ（`block_size * cache_blocks`）は 256 MiB を超えられません。キャッシュミスはブロッキングネットワーク I/O を実行し、直列化されるため、このリーダーはアーカイブリーダーのような逐次的ランダムアクセスのコンシューマを想定しています。プロバイダーは ETag を提供する必要があり、提供しない場合はリーダーを開くと `errors.UNAVAILABLE` が返されます。ETag を提供しても範囲読み取りの前提条件を無視するプロバイダーは、上書き検出を保証できません。

| リーダーメソッド | 戻り値 | 説明 |
|---------------|---------|-------------|
| `size()` | `number` | オブジェクトのサイズ（バイト） |
| `key()` | `string` | オブジェクトキー |
| `close()` | `boolean, error` | リーダーを閉じる（冪等） |

リーダーはタスク終了時に自動的に閉じますが、作業が終わったら明示的に閉じてください。

## ストレージメソッド

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `upload_object(key, content, opts?)` | `boolean, error` | 文字列またはファイルコンテンツをアップロード |
| `download_object(key, writer, opts?)` | `boolean, error` | ファイルライターにダウンロード |
| `head_object(key)` | `table, error` | オブジェクトメタデータを取得 |
| `list_objects(opts?)` | `table, error` | プレフィックスフィルター付きでオブジェクトを一覧 |
| `delete_objects(keys)` | `boolean, error` | 複数のオブジェクトを削除 |
| `presigned_get_url(key, opts?)` | `string, error` | 一時ダウンロードURLを生成 |
| `presigned_put_url(key, opts?)` | `string, error` | 一時アップロードURLを生成 |
| `create_multipart_upload(key, opts?)` | `table, error` | マルチパートアップロードを開始 |
| `presigned_part_urls(key, upload_id, opts)` | `table[], error` | マルチパートアップロード URL を生成 |
| `complete_multipart_upload(key, upload_id, parts)` | `table, error` | マルチパートアップロードを完了 |
| `abort_multipart_upload(key, upload_id)` | `boolean, error` | マルチパートアップロードをアボート |
| `open_reader(key, opts?)` | `Reader, error` | シーク可能な範囲リーダーを開く |
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
| 条件付き前提条件の失敗 | `errors.CONFLICT` | no |
| 範囲リーダーを開いている間にオブジェクトが変更された | `errors.CONFLICT` | no |
| マルチパートアップロードが見つからない | `errors.NOT_FOUND` | no |
| プロバイダーにマルチパートまたは範囲リーダー機能がない | `errors.UNAVAILABLE` | no |
| `cloudstorage.get` による権限拒否 | Lua エラーを送出 | 該当なし |
| プロバイダー操作の失敗 | 利用可能な場合はプロバイダーから引き継ぐ。それ以外は unspecified | 状況による |

エラーの処理については、[エラー処理](../core/errors.md)を参照してください。
