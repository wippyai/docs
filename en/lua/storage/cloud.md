---
title: "Cloud Storage"
description: "Upload, download, list, and manage objects in S3-compatible storage."
---

# Cloud Storage
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

The `cloudstorage` module uploads, downloads, lists, and manages objects in S3-compatible storage. It also creates presigned URLs for direct access.

For storage configuration, see [Cloud Storage](system/cloudstorage.md).

## Loading

```lua
local cloudstorage = require("cloudstorage")
```

## Acquiring Storage

Acquire a cloud storage resource by registry ID:

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

Upload content from a string or file:

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
| `options` | table | Optional metadata and conditional write options |

**Returns:** `boolean, error`

### Upload Options

Attach metadata or guard the write with an options table:

```lua
storage:upload_object("reports/daily.json", body, {
    content_type = "application/json",
    cache_control = "max-age=3600",
    metadata = { owner = "team-a", run_id = "1234" },  -- stored as x-amz-meta-*
    only_if_absent = true                              -- fail if the key already exists
})
```

| Option | Type | Description |
|--------|------|-------------|
| `content_type` | string | MIME type |
| `cache_control` | string | Cache-Control header |
| `content_disposition` | string | Content-Disposition header |
| `content_encoding` | string | Content-Encoding header |
| `metadata` | table | User metadata (string keys/values), stored as `x-amz-meta-*` |
| `headers` | table | Additional request headers (string keys/values) |
| `if_match` | string | Write only if the current object ETag matches |
| `if_none_match` | string | Write only if no object matches the ETag (`"*"` means any) |
| `only_if_absent` | boolean | Write only if the key does not exist (alias for `if_none_match = "*"`) |

A conditional write that fails its precondition returns a `precondition_failed` error.

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
| `options.if_match` | string | Download only if the object ETag matches |
| `options.if_none_match` | string | Download only if the ETag does not match |

**Returns:** `boolean, error`

A failed precondition (`if_match`/`if_none_match`) returns a `precondition_failed` error.

## Listing Objects

List objects with optional prefix filtering:

```lua
local storage = cloudstorage.get("app.infra:files")

local result, err = storage:list_objects({
    prefix = "reports/2024/",
    max_keys = 100
})

for _, obj in ipairs(result.objects) do
    print(obj.key, obj.size, obj.etag)
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
| `options.include_owner` | boolean | Include each object's `owner` (`id`, `display_name`) |
| `options.include_versions` | boolean | List object versions; each item includes `version_id` |

**Returns:** `table, error`

Result contains `objects`, `is_truncated`, `next_continuation_token`. Each object has `key`, `size`, `etag`, `storage_class`, and optional `last_modified`, `version_id`, and `owner`.

<note>
In list results <code>content_type</code> is always empty — S3 list operations do not return it. Use <code>head_object</code> to read an object's content type and metadata.
</note>

## Object Metadata

Fetch a single object's metadata without downloading its body:

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Object key |

**Returns:** `table, error`

Result fields:

| Field | Type | Description |
|-------|------|-------------|
| `size` | integer | Object size in bytes |
| `etag` | string | Entity tag |
| `content_type` | string | MIME type |
| `cache_control` | string | Cache-Control header |
| `content_disposition` | string | Content-Disposition header |
| `content_encoding` | string | Content-Encoding header |
| `storage_class` | string | Storage class |
| `version_id` | string | Version ID (present when versioning is enabled) |
| `last_modified` | integer | Last modified time (Unix seconds) |
| `metadata` | table | User metadata (`x-amz-meta-*`) |
| `headers` | table | Raw response headers (lowercased keys) |

A missing object returns a `not_found` error.

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

Create a temporary URL that permits downloading an object without storage credentials. A client can use the URL until it expires.

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

Create a temporary URL that permits uploading an object without storage credentials. A client can upload directly to storage until the URL expires.

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

## Multipart Upload URLs

For large client uploads, create a multipart upload, issue presigned URLs for its parts, and complete the upload with the ETags returned by the part requests:

```lua
local key = "uploads/user-123/video.mp4"
local upload, err = storage:create_multipart_upload(key, {
    content_type = "video/mp4"
})
if err then
    return nil, err
end

local urls, err = storage:presigned_part_urls(key, upload.upload_id, {
    count = 3,
    expiration = 900
})
if err then
    storage:abort_multipart_upload(key, upload.upload_id)
    return nil, err
end

-- Upload each part to its URL and retain the ETag response header.
local completed, err = storage:complete_multipart_upload(key, upload.upload_id, {
    {part_number = 1, etag = part_1_etag},
    {part_number = 2, etag = part_2_etag},
    {part_number = 3, etag = part_3_etag}
})
```

`presigned_part_urls` accepts exactly one of `count` or `parts`. A call can return at most 1,000 URLs, and part numbers range from 1 through 10,000. The `expiration` default is 3,600 seconds, and optional `headers` are included in the signature. `create_multipart_upload` accepts `content_type`, `cache_control`, `content_disposition`, `content_encoding`, `metadata`, and `headers`. Complete requests may list parts in any order.

| Method | Returns | Description |
|--------|---------|-------------|
| `create_multipart_upload(key, opts?)` | `table, error` | Start an upload and return `{upload_id}` |
| `presigned_part_urls(key, upload_id, opts)` | `table[], error` | Return `{part_number, url}` records |
| `complete_multipart_upload(key, upload_id, parts)` | `table, error` | Complete the upload and return its ETag and optional version/location |
| `abort_multipart_upload(key, upload_id)` | `boolean, error` | Abort an incomplete upload |

Abort uploads that will not be completed. Bucket lifecycle rules are a backstop for abandoned uploads, not a replacement for explicit cleanup. Multipart methods return `errors.UNAVAILABLE` when the configured provider does not support the required capability.

## Random-Access Reader

`open_reader` exposes a seekable, read-only object without downloading it in full. It fetches ranges on cache misses and sends the object's open-time ETag as an `If-Match` condition. Providers that enforce the condition return `errors.CONFLICT` if the object changes instead of mixing versions.

```lua
local reader, err = storage:open_reader("archives/large.zip", {
    block_size = 8 * 1024 * 1024,
    cache_blocks = 4
})
if err then
    return nil, err
end

print(reader:key(), reader:size())

reader:close()
storage:release()
```

| Option | Default | Valid range |
|--------|---------|-------------|
| `block_size` | 8 MiB | 64 KiB to 128 MiB |
| `cache_blocks` | 4 | 1 to 64 |

The cache (`block_size * cache_blocks`) cannot exceed 256 MiB. Cache misses perform blocking network I/O and are serialized, so the reader is intended for sequential random-access consumers such as archive readers. The provider must supply an ETag; otherwise opening the reader returns `errors.UNAVAILABLE`. A provider that supplies an ETag but ignores ranged-read preconditions cannot provide the overwrite-detection guarantee.

| Reader method | Returns | Description |
|---------------|---------|-------------|
| `size()` | `number` | Object size in bytes |
| `key()` | `string` | Object key |
| `close()` | `boolean, error` | Close the reader; idempotent |

Readers close automatically at task end, but close them explicitly when work finishes.

## Storage Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `upload_object(key, content, opts?)` | `boolean, error` | Upload string or file content |
| `download_object(key, writer, opts?)` | `boolean, error` | Download to file writer |
| `head_object(key)` | `table, error` | Fetch object metadata |
| `list_objects(opts?)` | `table, error` | List objects with prefix filter |
| `delete_objects(keys)` | `boolean, error` | Delete multiple objects |
| `presigned_get_url(key, opts?)` | `string, error` | Generate temporary download URL |
| `presigned_put_url(key, opts?)` | `string, error` | Generate temporary upload URL |
| `create_multipart_upload(key, opts?)` | `table, error` | Start a multipart upload |
| `presigned_part_urls(key, upload_id, opts)` | `table[], error` | Generate multipart upload URLs |
| `complete_multipart_upload(key, upload_id, parts)` | `table, error` | Complete a multipart upload |
| `abort_multipart_upload(key, upload_id)` | `boolean, error` | Abort a multipart upload |
| `open_reader(key, opts?)` | `Reader, error` | Open a seekable ranged reader |
| `release()` | `boolean` | Release storage resource |

## Permissions

Security policy evaluation applies to cloud storage operations.

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
| Conditional precondition failed | `errors.CONFLICT` | no |
| Object changed while a ranged reader was open | `errors.CONFLICT` | no |
| Multipart upload not found | `errors.NOT_FOUND` | no |
| Provider lacks multipart or ranged-reader capability | `errors.UNAVAILABLE` | no |
| Permission denied | `errors.PERMISSION_DENIED` | no |
| Operation failed | `errors.INTERNAL` | no |

See [Error Handling](lua/core/errors.md) for working with errors.
