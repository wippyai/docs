# 云存储
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

访问 S3 兼容的对象存储。支持上传、下载、列出和管理文件，以及预签名 URL。

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

**返回:** `boolean, error`

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

**返回:** `boolean, error`

## 列出对象

列出对象并可选按前缀过滤：

```lua
local storage = cloudstorage.get("app.infra:files")

local result, err = storage:list_objects({
    prefix = "reports/2024/",
    max_keys = 100
})

for _, obj in ipairs(result.objects) do
    print(obj.key, obj.size, obj.content_type)
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

**返回:** `table, error`

结果包含 `objects`、`is_truncated`、`next_continuation_token`。

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
| `options.content_length` | integer | 最大上传大小（字节） |

**返回:** `string, error`

## 存储方法

| 方法 | 返回 | 描述 |
|--------|---------|-------------|
| `upload_object(key, content)` | `boolean, error` | 上传字符串或文件内容 |
| `download_object(key, writer, opts?)` | `boolean, error` | 下载到文件写入器 |
| `list_objects(opts?)` | `table, error` | 列出对象并按前缀过滤 |
| `delete_objects(keys)` | `boolean, error` | 删除多个对象 |
| `presigned_get_url(key, opts?)` | `string, error` | 生成临时下载 URL |
| `presigned_put_url(key, opts?)` | `string, error` | 生成临时上传 URL |
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
| 权限被拒绝 | `errors.PERMISSION_DENIED` | 否 |
| 操作失败 | `errors.INTERNAL` | 否 |

错误处理请参阅 [错误处理](lua/core/errors.md)。
