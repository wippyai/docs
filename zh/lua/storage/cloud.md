---
title: "云存储"
description: "访问 S3 兼容的对象存储。上传、下载、列出和管理对象，为下载、上传和分段 part 生成预签名 URL，并以随机访问方式读取对象。"
---

# 云存储
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

访问 S3 兼容的对象存储。上传、下载、列出和管理对象，为下载、上传和分段 part 生成预签名 URL，并以随机访问方式读取对象。

存储配置请参阅 [云存储](system/cloudstorage.md)。

## 加载

```lua
local cloudstorage = require("cloudstorage")
```

## 获取存储

通过注册表 ID 获取云存储资源：

```lua
local storage, err = cloudstorage.get("app.infra:files")
if err then
    return nil, err
end

storage:upload_object("data/file.txt", "content")
storage:release()
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `id` | string | 存储资源 ID |

**返回:** `Storage, error`

## 上传对象

从字符串或文件上传内容：

```lua
local storage = cloudstorage.get("app.infra:files")

-- 上传字符串内容
local ok, err = storage:upload_object("reports/daily.json", json.encode({
    date = "2024-01-15",
    total = 1234
}))

-- 从文件上传
local fs = require("fs")
local vol = fs.get("app:data")
local file = vol:open("/large-file.bin", "r")

storage:upload_object("backups/large-file.bin", file)
file:close()

storage:release()
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `key` | string | 对象键/路径 |
| `content` | string 或 Reader | 字符串内容或文件读取器 |
| `options` | table | 可选的元数据和条件写入选项 |

**返回:** `boolean, error`

### 上传选项

通过选项表附加元数据或对写入设置前置条件：

```lua
storage:upload_object("reports/daily.json", body, {
    content_type = "application/json",
    cache_control = "max-age=3600",
    metadata = { owner = "team-a", run_id = "1234" },  -- stored as x-amz-meta-*
    only_if_absent = true                              -- fail if the key already exists
})
```

| 选项 | 类型 | 描述 |
|--------|------|-------------|
| `content_type` | string | MIME 类型 |
| `cache_control` | string | Cache-Control 头部 |
| `content_disposition` | string | Content-Disposition 头部 |
| `content_encoding` | string | Content-Encoding 头部 |
| `metadata` | table | 用户元数据（string 键/值），存储为 `x-amz-meta-*` |
| `headers` | table | 额外的请求头部（string 键/值） |
| `if_match` | string | 仅当当前对象 ETag 匹配时写入 |
| `if_none_match` | string | 仅当没有对象匹配该 ETag 时写入（`"*"` 表示任意） |
| `only_if_absent` | boolean | 仅当键不存在时写入（`if_none_match = "*"` 的别名） |

未满足前置条件的条件写入会返回 `precondition_failed` 错误。

## 下载对象

将对象下载到文件写入器：

```lua
local storage = cloudstorage.get("app.infra:files")
local fs = require("fs")
local vol = fs.get("app:temp")

local file = vol:open("/downloaded.json", "w")
local ok, err = storage:download_object("reports/daily.json", file)
file:close()

-- 下载部分内容（前 1KB）
local partial = vol:open("/partial.bin", "w")
storage:download_object("backups/large-file.bin", partial, {
    range = "bytes=0-1023"
})
partial:close()

storage:release()
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `key` | string | 要下载的对象键 |
| `writer` | Writer | 目标文件写入器 |
| `options.range` | string | 字节范围（例如 "bytes=0-1023"） |
| `options.if_match` | string | 仅当对象 ETag 匹配时下载 |
| `options.if_none_match` | string | 仅当 ETag 不匹配时下载 |

**返回:** `boolean, error`

未满足前置条件（`if_match`/`if_none_match`）会返回 `precondition_failed` 错误。

## 列出对象

列出对象并可选按前缀过滤：

```lua
local storage = cloudstorage.get("app.infra:files")

local result, err = storage:list_objects({
    prefix = "reports/2024/",
    max_keys = 100
})

for _, obj in ipairs(result.objects) do
    print(obj.key, obj.size, obj.etag)
end

-- 分页浏览大量结果
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

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `options.prefix` | string | 按键前缀过滤 |
| `options.max_keys` | integer | 返回的最大对象数 |
| `options.continuation_token` | string | 分页令牌 |
| `options.include_owner` | boolean | 包含每个对象的 `owner`（`id`、`display_name`） |
| `options.include_versions` | boolean | 列出对象版本；每项包含 `version_id` |

**返回:** `table, error`

结果包含 `objects`、`is_truncated`、`next_continuation_token`。每个对象都有 `key`、`size`、`etag`、`storage_class`，以及可选的 `last_modified`、`version_id` 和 `owner`。

<note>
在列表结果中 <code>content_type</code> 始终为空——S3 list 操作不返回它。使用 <code>head_object</code> 读取对象的内容类型和元数据。
</note>

## 对象元数据

在不下载对象正文的情况下获取单个对象的元数据：

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

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `key` | string | 对象键 |

**返回:** `table, error`

结果字段：

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `size` | integer | 对象大小（字节） |
| `etag` | string | 实体标签 |
| `content_type` | string | MIME 类型 |
| `cache_control` | string | Cache-Control 头部 |
| `content_disposition` | string | Content-Disposition 头部 |
| `content_encoding` | string | Content-Encoding 头部 |
| `storage_class` | string | 存储类别 |
| `version_id` | string | 版本 ID（启用版本控制时存在） |
| `last_modified` | integer | 最后修改时间（Unix 秒） |
| `metadata` | table | 用户元数据（`x-amz-meta-*`） |
| `headers` | table | 原始响应头部（键名为小写） |

不存在的对象会返回 `not_found` 错误。

## 删除对象

删除多个对象：

```lua
local storage = cloudstorage.get("app.infra:files")

storage:delete_objects({
    "temp/file1.txt",
    "temp/file2.txt",
    "temp/file3.txt"
})

storage:release()
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `keys` | string[] | 要删除的对象键数组 |

**返回:** `boolean, error`

每个键都会被尝试删除。删除不存在的键不算错误。当提供方报告了逐键失败时，该调用返回单个错误，其中列出每个失败的键及其提供方错误码。

## 下载 URL

创建允许无凭证下载对象的临时 URL。适用于与外部用户共享文件或通过应用程序提供内容。

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

-- 将 URL 返回给客户端直接下载
return {download_url = url}
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `key` | string | 对象键 |
| `options.expiration` | integer | URL 过期秒数（默认：3600） |

**返回:** `string, error`

## 上传 URL

创建允许无凭证上传对象的临时 URL。使客户端能够直接上传文件到存储而无需通过服务器代理。

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

-- 将 URL 返回给客户端直接上传
return {upload_url = url}
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `key` | string | 对象键 |
| `options.expiration` | integer | URL 过期秒数（默认：3600） |
| `options.content_type` | string | 上传所需的内容类型 |
| `options.content_length` | integer | 预期的上传大小（字节） |

**返回:** `string, error`

## 分段上传

单个预签名 PUT 的对象上限是 5 GiB。预签名分段上传把更大的对象拆分成多个 part，由客户端直接上传，然后在服务端组装。分段上传是提供方的能力：S3 实现了它，不支持的提供方返回 `errors.UNAVAILABLE`。

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

-- 客户端对每个 url 执行 PUT，并从响应头部取回 ETag。
local done, err = storage:complete_multipart_upload("backups/huge.zip", mp.upload_id, {
    { part_number = 1, etag = etag1 },
    { part_number = 2, etag = etag2 },
    { part_number = 3, etag = etag3 },
})

storage:release()
```

### create_multipart_upload

为某个键启动分段上传。

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `key` | string | 最终对象的对象键 |
| `options` | table | `content_type`、`cache_control`、`content_disposition`、`content_encoding`、`metadata`、`headers`——语义与 `upload_object` 相同 |

**返回:** `table, error` — 该表携带 `upload_id`，用于标识此次上传的后续每次 part、complete 和 abort 调用。

条件写入（`if_match`、`if_none_match`、`only_if_absent`）不属于分段协议，这里不接受这些参数。

### presigned_part_urls

为进行中的上传的各个 part 生成预签名 PUT URL。每个 URL 通过普通 HTTP PUT 上传；上传方必须保留每个 part 响应的 `ETag` 头部，供 `complete_multipart_upload` 使用。

| 参数 | 类型 | 默认值 | 描述 |
|-----------|------|--------|-------------|
| `key` | string | 必填 | 对象键 |
| `upload_id` | string | 必填 | 来自 `create_multipart_upload` |
| `options.parts` | int[] | - | 显式指定的 part 编号（1-10000，不可重复） |
| `options.count` | int | - | 为 `1..count` 的 part 生成预签名 URL |
| `options.headers` | table | - | 每个 part 请求所需的头部；它们会被签名，上传方也必须发送 |
| `options.expiration` | int | 3600 | URL 过期前的秒数 |

`parts` 和 `count` 必须且只能提供其中之一，且单次调用最多预签名 1000 个 URL——超大对象请分页预签名。

**返回:** `table, error` — 由 `{ part_number, url }` 组成的数组。

除最后一个之外的每个 part 至少为 5 MiB；提供方会在完成时强制该限制。

### complete_multipart_upload

用已上传的 part 组装出最终对象。part 可以按任意顺序上报，完成前会按 part 编号排序。

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `key` | string | 对象键 |
| `upload_id` | string | 来自 `create_multipart_upload` |
| `parts` | table | 由 `{ part_number = int, etag = string }` 组成的数组 |

**返回:** `table, error` — `etag`，以及提供方报告时的 `version_id` 和 `location`。未知的 upload ID 返回 `errors.NOT_FOUND`。

### abort_multipart_upload

丢弃进行中的上传并释放其已存储的 part。

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `key` | string | 对象键 |
| `upload_id` | string | 来自 `create_multipart_upload` |

**返回:** `boolean, error`

从未完成的上传会一直保留其 part 并持续计费，直到被中止。请在每条失败路径上执行中止，并配置存储桶生命周期规则作为兜底——参见 [Cloud Storage](system/cloudstorage.md#multipart-uploads)。

## 范围读取器

`open_reader` 使用范围 GET 打开对象的随机访问——不做本地暂存，也不整体下载。它的主要使用方是 [`archive.open`](lua/data/archive.md)，后者以有界内存直接从对象存储读取数 GB 的归档文件。

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

| 参数 | 类型 | 默认值 | 描述 |
|-----------|------|--------|-------------|
| `key` | string | 必填 | 对象键 |
| `options.block_size` | int | 8388608 | 范围 GET 的单位字节数（64 KiB 到 128 MiB） |
| `options.cache_blocks` | int | 4 | 驻留的 LRU 块数（1 到 64） |

`block_size * cache_blocks` 不得超过 256 MiB。对象不存在时返回 `errors.NOT_FOUND`。

**返回:** `Reader, error`

读取器打开时会固定对象的 ETag，并在每次范围读取时以 `If-Match` 发送，因此读取过程中被覆盖的对象会以提供方的前置条件错误使读取失败，而不会提供混合了两个对象版本的数据；`archive` 将其表现为 `errors.INTERNAL`。无法提供 ETag 的提供方返回 `errors.UNAVAILABLE`；读取器绝不提供未固定版本的对象。

缓存未命中的读取会在调用任务中执行阻塞式网络 IO，并使并发读取串行化，因此按条目顺序访问——即归档的使用模式——才是预期的用法。

### Reader 方法

| 方法 | 返回 | 描述 |
|--------|---------|-------------|
| `size()` | `integer` | 对象字节大小，取自打开时的 stat |
| `key()` | `string` | 读取器所读取的对象键 |
| `close()` | `boolean, error` | 释放块缓存；幂等 |

如果没有显式关闭，读取器会在任务作用域结束时自动关闭。

## 存储方法

| 方法 | 返回 | 描述 |
|--------|---------|-------------|
| `upload_object(key, content, opts?)` | `boolean, error` | 上传字符串或文件内容 |
| `download_object(key, writer, opts?)` | `boolean, error` | 下载到文件写入器 |
| `head_object(key)` | `table, error` | 获取对象元数据 |
| `list_objects(opts?)` | `table, error` | 列出对象并按前缀过滤 |
| `delete_objects(keys)` | `boolean, error` | 删除多个对象 |
| `presigned_get_url(key, opts?)` | `string, error` | 生成临时下载 URL |
| `presigned_put_url(key, opts?)` | `string, error` | 生成临时上传 URL |
| `create_multipart_upload(key, opts?)` | `table, error` | 启动预签名分段上传 |
| `presigned_part_urls(key, upload_id, opts)` | `table, error` | 为上传的 part 生成预签名 PUT URL |
| `complete_multipart_upload(key, upload_id, parts)` | `table, error` | 用已上传的 part 组装对象 |
| `abort_multipart_upload(key, upload_id)` | `boolean, error` | 丢弃进行中的分段上传 |
| `open_reader(key, opts?)` | `Reader, error` | 打开范围随机访问读取器 |
| `release()` | `boolean` | 释放存储资源 |

## 权限

云存储操作受安全策略评估约束。

| 操作 | 资源 | 描述 |
|--------|----------|-------------|
| `cloudstorage.get` | 存储 ID | 获取存储资源 |

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 资源 ID 为空 | `errors.INVALID` | 否 |
| 资源未找到 | `errors.NOT_FOUND` | 否 |
| 不是云存储资源 | `errors.INVALID` | 否 |
| 存储已释放 | `errors.INVALID` | 否 |
| 键为空 | `errors.INVALID` | 否 |
| 内容为 nil | `errors.INVALID` | 否 |
| 写入器无效 | `errors.INVALID` | 否 |
| 对象未找到 | `errors.NOT_FOUND` | 否 |
| 未知的 upload ID | `errors.NOT_FOUND` | 否 |
| 条件前置条件失败 | `errors.CONFLICT` | 否 |
| 范围读取期间对象被覆盖（由 `archive` 表现） | `errors.INTERNAL` | 否 |
| 提供方不支持分段上传 | `errors.UNAVAILABLE` | 否 |
| 提供方未为 `open_reader` 提供 ETag | `errors.UNAVAILABLE` | 否 |
| 权限被拒绝 | 抛出为 Lua 错误，而非返回 | - |
| 提供方操作失败 | `errors.UNKNOWN` | 未设置 |

错误处理请参阅 [错误处理](lua/core/errors.md)。
