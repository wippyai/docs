---
title: "クラウドストレージ"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='io'/ <secondary-label ref='external'/ <secondary-label…"
---

# クラウドストレージ
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

S3互換オブジェクトストレージへのアクセス。オブジェクトのアップロード、ダウンロード、一覧表示、管理に加え、ダウンロード・アップロード・マルチパートパートのURLの署名付き生成、およびランダムアクセスによるオブジェクトの読み取りを行います。

ストレージ設定については[クラウドストレージ](system/cloudstorage.md)を参照。

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
| `options` | table | オプションのメタデータおよび条件付き書き込みオプション |

**戻り値:** `boolean, error`

### アップロードオプション

オプションテーブルでメタデータを付与したり、書き込みをガードしたりできます:

```lua
storage:upload_object("reports/daily.json", body, {
    content_type = "application/json",
    cache_control = "max-age=3600",
    metadata = { owner = "team-a", run_id = "1234" },  -- stored as x-amz-meta-*
    only_if_absent = true                              -- fail if the key already exists
})
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
| `options.if_match` | string | オブジェクト ETag が一致する場合のみダウンロード |
| `options.if_none_match` | string | ETag が一致しない場合のみダウンロード |

**戻り値:** `boolean, error`

前提条件（`if_match`/`if_none_match`）を満たさない場合は `precondition_failed` エラーを返します。

## オブジェクトの一覧

オプションのプレフィックスフィルタリングでオブジェクトを一覧:

```lua
local storage = cloudstorage.get("app.infra:files")

local result, err = storage:list_objects({
    prefix = "reports/2024/",
    max_keys = 100
})

for _, obj in ipairs(result.objects) do
    print(obj.key, obj.size, obj.etag)
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
| `options.include_owner` | boolean | 各オブジェクトの `owner`（`id`、`display_name`）を含める |
| `options.include_versions` | boolean | オブジェクトバージョンを一覧；各項目に `version_id` が含まれる |

**戻り値:** `table, error`

結果には`objects`、`is_truncated`、`next_continuation_token`が含まれる。各オブジェクトには `key`、`size`、`etag`、`storage_class`、およびオプションの `last_modified`、`version_id`、`owner` がある。

<note>
リスト結果では <code>content_type</code> は常に空です — S3 のリスト操作はこれを返しません。オブジェクトのコンテンツタイプとメタデータを読み取るには <code>head_object</code> を使用してください。
</note>

## オブジェクトメタデータ

本体をダウンロードせずに単一オブジェクトのメタデータを取得します:

```lua
local storage = cloudstorage.get("app.infra:files")

local meta, err = storage:head_object("reports/daily.json")
if err then
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

すべてのキーが試行されます。存在しないキーを削除してもエラーにはなりません。プロバイダーがキーごとの失敗を報告した場合、この呼び出しは失敗した各キーとそのプロバイダーエラーコードを列挙した単一のエラーを返します。

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

## マルチパートアップロード

単一の署名付きPUTでは、オブジェクトサイズは5 GiBが上限です。署名付きマルチパートアップロードは、より大きなオブジェクトをパートに分割してクライアントが直接アップロードし、サーバー側で組み立てます。マルチパートはプロバイダーの機能です。S3はこれを実装しており、対応していないプロバイダーは`errors.UNAVAILABLE`を返します。

```lua
local storage = cloudstorage.get("app.infra:files")

local mp, err = storage:create_multipart_upload("backups/huge.zip", {
    content_type = "application/zip",
    metadata = { source = "uploader" },
})
if err then return nil, err end

local urls, err = storage:presigned_part_urls("backups/huge.zip", mp.upload_id, {
    count = 3,
    expiration = 900,
})
if err then
    storage:abort_multipart_upload("backups/huge.zip", mp.upload_id)
    return nil, err
end

-- クライアントは各urlにPUTし、レスポンスヘッダーからETagを返す。
local done, err = storage:complete_multipart_upload("backups/huge.zip", mp.upload_id, {
    { part_number = 1, etag = etag1 },
    { part_number = 2, etag = etag2 },
    { part_number = 3, etag = etag3 },
})

storage:release()
```

### create_multipart_upload

キーに対するマルチパートアップロードを開始します。

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | 最終的なオブジェクトのオブジェクトキー |
| `options` | table | `content_type`、`cache_control`、`content_disposition`、`content_encoding`、`metadata`、`headers` — `upload_object`と同じ意味 |

**戻り値:** `table, error` — テーブルには`upload_id`が含まれ、以降のすべてのパート、完了、中止の呼び出しでこのアップロードを識別します。

条件付き書き込み（`if_match`、`if_none_match`、`only_if_absent`）はマルチパートプロトコルの一部ではなく、ここでは受け付けられません。

### presigned_part_urls

進行中のアップロードのパート用に、署名付きPUT URLを生成します。各URLへは通常のHTTP PUTでアップロードします。アップローダーは`complete_multipart_upload`のために、各パートの`ETag`レスポンスヘッダーを保持する必要があります。

| パラメータ | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `key` | string | 必須 | オブジェクトキー |
| `upload_id` | string | 必須 | `create_multipart_upload`から取得 |
| `options.parts` | int[] | - | 明示的なパート番号（1〜10000、重複不可）|
| `options.count` | int | - | パート`1..count`に署名付きURLを生成 |
| `options.headers` | table | - | 各パートリクエストに必要なヘッダー。署名対象となり、アップローダーも同じヘッダーを送信する必要がある |
| `options.expiration` | int | 3600 | URLが期限切れになるまでの秒数 |

`parts`と`count`のいずれか一方が必須です。1回の呼び出しで署名できるURLは最大1000個であるため、非常に大きなオブジェクトではページ単位で署名してください。

**戻り値:** `table, error` — `{ part_number, url }`の配列。

最後のパートを除くすべてのパートは5 MiB以上である必要があります。プロバイダーは完了時にこれを強制します。

### complete_multipart_upload

アップロード済みのパートから最終的なオブジェクトを組み立てます。パートは任意の順序で報告でき、完了前にパート番号でソートされます。

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | オブジェクトキー |
| `upload_id` | string | `create_multipart_upload`から取得 |
| `parts` | table | `{ part_number = int, etag = string }`の配列 |

**戻り値:** `table, error` — `etag`、およびプロバイダーが報告する場合は`version_id`と`location`。未知のアップロードIDは`errors.NOT_FOUND`を返します。

### abort_multipart_upload

進行中のアップロードを破棄し、保存されているパートを解放します。

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `key` | string | オブジェクトキー |
| `upload_id` | string | `create_multipart_upload`から取得 |

**戻り値:** `boolean, error`

完了されなかったアップロードは、中止されるまでパートが保存されたまま残り、課金対象になります。すべての失敗経路で中止し、最後の防波堤としてバケットのライフサイクルルールを設定してください — [クラウドストレージ](system/cloudstorage.md#multipart-uploads)を参照。

## 範囲指定リーダー

`open_reader`は範囲指定GETを使ってオブジェクトへのランダムアクセスを開きます。ローカルへの一時保存も全体のダウンロードも行いません。主な利用者は[`archive.open`](lua/data/archive.md)で、数GBのアーカイブを限られたメモリでオブジェクトストレージから直接読み取ります。

```lua
local archive = require("archive")
local storage = cloudstorage.get("app.infra:files")

local reader, err = storage:open_reader("uploads/huge.zip", {
    block_size = 8 * 1024 * 1024,
    cache_blocks = 4,
})
if err then return nil, err end

local r = assert(archive.open(reader))
for e in r:entries() do
    print(e.name, e.size)
end
r:close()
reader:close()

storage:release()
```

| パラメータ | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `key` | string | 必須 | オブジェクトキー |
| `options.block_size` | int | 8388608 | 範囲指定GETの単位（バイト、64 KiB〜128 MiB）|
| `options.cache_blocks` | int | 4 | メモリ上に保持するLRUブロック数（1〜64）|

`block_size * cache_blocks`は256 MiBを超えられません。オブジェクトが存在しない場合は`errors.NOT_FOUND`を返します。

**戻り値:** `Reader, error`

リーダーを開いた時点でオブジェクトのETagが固定され、範囲指定読み取りのたびに`If-Match`として送信されます。そのため読み取り中に上書きされたオブジェクトは、2つのオブジェクト世代を混在させて返すのではなく`errors.CONFLICT`で失敗します。ETagを提供できないプロバイダーは`errors.UNAVAILABLE`を返します。リーダーが固定されていないオブジェクトを提供することはありません。

キャッシュミス時の読み取りは呼び出し元のタスク内でブロッキングのネットワークIOを行い、並行するリーダーを直列化します。したがってエントリごとの逐次アクセス — アーカイブのパターン — が想定された使い方です。

### Readerメソッド

| メソッド | 戻り値 | 説明 |
|---------|--------|------|
| `size()` | `integer` | オープン時のstatによるオブジェクトサイズ（バイト）|
| `key()` | `string` | リーダーが読み取るオブジェクトキー |
| `close()` | `boolean, error` | ブロックキャッシュを解放する。冪等 |

明示的にクローズされなかった場合、リーダーはタスクスコープで自動的にクローズされます。

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
| `create_multipart_upload(key, opts?)` | `table, error` | 署名付きマルチパートアップロードを開始 |
| `presigned_part_urls(key, upload_id, opts)` | `table, error` | アップロードパート用の署名付きPUT URLを生成 |
| `complete_multipart_upload(key, upload_id, parts)` | `table, error` | アップロード済みパートからオブジェクトを組み立て |
| `abort_multipart_upload(key, upload_id)` | `boolean, error` | 進行中のマルチパートアップロードを破棄 |
| `open_reader(key, opts?)` | `Reader, error` | 範囲指定のランダムアクセスリーダーを開く |
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
| 未知のアップロードID | `errors.NOT_FOUND` | no |
| 条件付き前提条件の失敗 | `errors.CONFLICT` | no |
| 範囲指定読み取り中にオブジェクトが上書きされた | `errors.CONFLICT` | no |
| プロバイダーがマルチパートアップロードに対応していない | `errors.UNAVAILABLE` | no |
| プロバイダーが`open_reader`用のETagを提供しない | `errors.UNAVAILABLE` | no |
| 権限拒否 | `errors.PERMISSION_DENIED` | no |
| 操作失敗 | `errors.INTERNAL` | no |

エラーの処理については[エラー処理](lua/core/errors.md)を参照。

