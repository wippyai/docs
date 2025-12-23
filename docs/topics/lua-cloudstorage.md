# Cloud Storage
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

Access S3-compatible object storage. Upload, download, list, and manage files with presigned URL support.

For storage configuration, see [Cloud Storage](system-cloudstorage.md).

## Loading

```lua
local cloudstorage = require("cloudstorage")
```

## Acquiring Storage

Get a cloud storage resource by registry ID:

```lua
local storage, err = cloudstorage.get("app.infra:files")
if err then
    return nil, err
end

storage:upload_object("data/file.txt", "content")
storage:release()
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Storage resource ID |

**Returns:** `Storage, error`

## Uploading Objects

Upload content from string or file:

```lua
local storage = cloudstorage.get("app.infra:files")

-- Upload string content
local ok, err = storage:upload_object("reports/daily.json", json.encode({
    date = "2024-01-15",
    total = 1234
}))

-- Upload from file
local fs = require("fs")
local vol = fs.get("app:data")
local file = vol:open("/large-file.bin", "r")

storage:upload_object("backups/large-file.bin", file)
file:close()

storage:release()
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Object key/path |
| `content` | string or Reader | Content as string or file reader |

**Returns:** `boolean, error`

## Downloading Objects

Download an object to a file writer:

```lua
local storage = cloudstorage.get("app.infra:files")
local fs = require("fs")
local vol = fs.get("app:temp")

local file = vol:open("/downloaded.json", "w")
local ok, err = storage:download_object("reports/daily.json", file)
file:close()

-- Download partial content (first 1KB)
local partial = vol:open("/partial.bin", "w")
storage:download_object("backups/large-file.bin", partial, {
    range = "bytes=0-1023"
})
partial:close()

storage:release()
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Object key to download |
| `writer` | Writer | Destination file writer |
| `options.range` | string | Byte range (e.g., "bytes=0-1023") |

**Returns:** `boolean, error`

## Listing Objects

List objects with optional prefix filtering:

```lua
local storage = cloudstorage.get("app.infra:files")

local result, err = storage:list_objects({
    prefix = "reports/2024/",
    max_keys = 100
})

for _, obj in ipairs(result.objects) do
    print(obj.key, obj.size, obj.content_type)
end

-- Paginate through large results
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

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.prefix` | string | Filter by key prefix |
| `options.max_keys` | integer | Maximum objects to return |
| `options.continuation_token` | string | Pagination token |

**Returns:** `table, error`

Result contains `objects`, `is_truncated`, `next_continuation_token`.

## Deleting Objects

Remove multiple objects:

```lua
local storage = cloudstorage.get("app.infra:files")

storage:delete_objects({
    "temp/file1.txt",
    "temp/file2.txt",
    "temp/file3.txt"
})

storage:release()
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `keys` | string[] | Array of object keys to delete |

**Returns:** `boolean, error`

## Download URLs

Create a temporary URL that allows downloading an object without credentials. Useful for sharing files with external users or serving content through your application.

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Object key |
| `options.expiration` | integer | Seconds until URL expires (default: 3600) |

**Returns:** `string, error`

## Upload URLs

Create a temporary URL that allows uploading an object without credentials. Enables clients to upload files directly to storage without proxying through your server.

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Object key |
| `options.expiration` | integer | Seconds until URL expires (default: 3600) |
| `options.content_type` | string | Required content type for upload |
| `options.content_length` | integer | Maximum upload size in bytes |

**Returns:** `string, error`

## Storage Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `upload_object(key, content)` | `boolean, error` | Upload string or file content |
| `download_object(key, writer, opts?)` | `boolean, error` | Download to file writer |
| `list_objects(opts?)` | `table, error` | List objects with prefix filter |
| `delete_objects(keys)` | `boolean, error` | Delete multiple objects |
| `presigned_get_url(key, opts?)` | `string, error` | Generate temporary download URL |
| `presigned_put_url(key, opts?)` | `string, error` | Generate temporary upload URL |
| `release()` | `boolean` | Release storage resource |

## Permissions

Cloud storage operations are subject to security policy evaluation.

| Action | Resource | Description |
|--------|----------|-------------|
| `cloudstorage.get` | Storage ID | Acquire a storage resource |

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Empty resource ID | `errors.INVALID` | no |
| Resource not found | `errors.NOT_FOUND` | no |
| Not a cloud storage resource | `errors.INVALID` | no |
| Storage released | `errors.INVALID` | no |
| Empty key | `errors.INVALID` | no |
| Content nil | `errors.INVALID` | no |
| Writer not valid | `errors.INVALID` | no |
| Object not found | `errors.NOT_FOUND` | no |
| Permission denied | `errors.PERMISSION_DENIED` | no |
| Operation failed | `errors.INTERNAL` | no |

See [Error Handling](lua-errors.md) for working with errors.
