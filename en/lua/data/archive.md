---
title: "Archive"
description: "Read, scan, extract, and create ZIP, TAR, gzip-compressed TAR, and Zstandard-compressed TAR archives."
---

# Archive
<secondary-label ref="function"/>
<secondary-label ref="io"/>
<secondary-label ref="encoding"/>

The `archive` module reads and writes ZIP and TAR-family archives through random-access readers, sequential streams, and filesystem destinations.

This is an API reference with partial I/O recipes. The streaming operations bound entry-copy buffers, but metadata, codec state, raw-byte sources, and `read()` results still consume memory. Use seekable files or ranged readers for large random-access archives, `scan()` for forward-only input, and explicit limits appropriate to the application.

## Loading

```lua
local archive = require("archive")
```

Add `archive` to the executable entry's `modules:` list before requiring it. Recipes using filesystems, cloud readers, or HTTP streams also require those capabilities and their security policies.

## Formats

The module detects built-in formats from magic bytes or uses the format supplied in `opts.format`.

| Format | Random read | Sequential scan | Write |
|--------|:-----------:|:---------------:|:-----:|
| `zip` | yes | yes (local headers) | yes |
| `tar` | yes | yes | yes |
| `tar.gz` | no | yes | yes |
| `tar.zst` | no | yes | yes |

`archive.formats()` returns the list of registered format names.

```lua
local names = archive.formats()  -- {"zip", "tar", "tar.gz", "tar.zst", ...}
```

## Options

Every entry point accepts an optional `opts` table:

| Key | Default | Meaning |
|-----|---------|---------|
| `format` | auto | `"zip"`, `"tar"`, `"tar.gz"`, `"tar.zst"`; auto = sniff magic, else extension |
| `max_entries` | 100000 | Reject archives with more entries (decompression-bomb defense) |
| `max_total_bytes` | 2 GiB | Cumulative uncompressed-output cap for `extract_all()` |
| `max_file_bytes` | 1 GiB | Cap on a single entry's uncompressed size |
| `max_inline_bytes` | 16 MiB | Hard cap for the RAM-materializing `read()` call; above it, use `stream()`/`extract()` |
| `buffer_bytes` | 64 KiB | Copy buffer for streaming extract/add paths; it does not limit `read()` allocation |

`max_file_bytes` caps each entry, while `max_total_bytes` is enforced only by reader and walker `extract_all()`. Applications using `read()`, `stream()`, one-entry `extract()`, or manual walking must enforce their own cumulative budget. `max_inline_bytes` limits the entry data materialized by `read()`; `buffer_bytes` does not. These limits do not include all metadata and codec allocations.

## Reading — Random Access

`archive.open(source, ...)` opens a **seekable** source for full random access (zip central directory is read up front; entries decompress on demand). The source may be an `fs.FS` handle plus a path, an open `fs.File`, a cloud storage reader, or raw bytes (bytes hold the whole archive in RAM — small archives only).

```lua
local fs = require("fs")
local archive = require("archive")

-- Open by fs handle + path (the module opens the file and owns its lifecycle)
local uploads, fs_err = fs.get("app:uploads")
if fs_err then return nil, fs_err end
local r, err = archive.open(uploads, "incoming.zip")
if err then return nil, err end
-- Or from an already-open seekable fs.File
-- local r, err = archive.open(open_file)
-- Or from raw bytes (small archives only)
-- local r, err = archive.open(zip_bytes, { format = "zip" })
```

For a large archive in cloud storage, pass the ranged reader returned by `open_reader`:

```lua
local cloudstorage = require("cloudstorage")

local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end
local source, source_err = storage:open_reader("uploads/large.zip")
if source_err then
    storage:release()
    return nil, source_err
end
local r, archive_err = archive.open(source)
if archive_err then
    source:close()
    storage:release()
    return nil, archive_err
end

-- Read archive entries here.

local _, reader_close_err = r:close()
local _, source_close_err = source:close()
storage:release()
if reader_close_err then return nil, reader_close_err end
if source_close_err then return nil, source_close_err end
```

The archive reader owns a file it opens from an `fs.FS` handle and path. It does not own an externally supplied `fs.File` or ranged reader; close the archive reader first, then caller-owned inputs and handles.

**Returns:** `Reader, error`

**Permission:** `archive.read`

### `entries`

Iterate over entry metadata without decompressing entry contents:

```lua
for e in r:entries() do
    -- e: name, size, compressed_size, is_dir, mode, modified, method, crc32, type
    print(e.name, e.size, e.is_dir)
end
```

### `stat`

Read entry metadata by name without decompressing its contents:

```lua
local info, err = r:stat("docs/readme.md")
if err then return nil, err end
```

### `read`

Materialize a single entry as a Lua string. Errors (`kind = Invalid`) above `max_inline_bytes` — for anything large, use `stream()` or `extract()`:

```lua
local data, err = r:read("docs/readme.md")  -- small entries only
if err then return nil, err end
```

### `stream`

Return an entry as a `stream.Stream` that decompresses on demand. The result can be scanned, passed to `fs:writefile()`, or supplied to another stream consumer:

```lua
local es, err = r:stream("big.csv")
if err then return nil, err end
while true do
    local chunk, read_err = es:read(65536)
    if read_err then
        es:close()
        return nil, read_err
    end
    if not chunk then break end
    process(chunk)
end
local _, close_err = es:close()
if close_err then return nil, close_err end
```

### `extract`

Stream one entry into a destination filesystem:

```lua
local out, fs_err = fs.get("app:out")
if fs_err then return nil, fs_err end
local ok, err = r:extract("docs/readme.md", out)
if err then return nil, err end
-- optional destination path:
-- r:extract("docs/readme.md", out, "readme.md")
```

### `extract_all`

Stream every entry into a destination filesystem:

```lua
local out, fs_err = fs.get("app:out")
if fs_err then return nil, fs_err end
local count, err = r:extract_all(out, {
    prefix = "job123/",          -- prepend to each destination path
    strip  = 1,                  -- drop N leading path components
    filter = function(e) return not e.is_dir end,
})
if err then return nil, err end
```

Resolve the destination filesystem separately in application code so `fs.get` errors can be handled. For one-entry `extract`, unsafe destination names return an error. `extract_all` skips entries whose resulting path contains `..`, is absolute, or has a Windows drive or UNC prefix.

### `close`

Close the reader. The operation is idempotent, and the reader also closes automatically at task scope.

```lua
local ok, err = r:close()
if err then return nil, err end
```

## Reading — Sequential Scan

`archive.scan(source, opts?)` opens a **forward-only** source such as an HTTP upload body or multipart file stream. Entries are visited in archive order, and each entry reader remains valid only until the walk advances. Random `read(name)` access is unavailable.

```lua
local up, stream_err = form.files.upload[1]:stream()        -- stream.Stream
if stream_err then return nil, stream_err end
local s, err = archive.scan(up, { format = "zip" })
if err then
    up:close()
    return nil, err
end

local uploads, fs_err = fs.get("app:uploads")
if fs_err then
    s:close()
    up:close()
    return nil, fs_err
end

local count, extract_err = s:extract_all(uploads, {prefix = "job123/"})
if extract_err then
    s:close()
    up:close()
    return nil, extract_err
end
local _, close_err = s:close()
local _, upload_close_err = up:close()
if close_err then return nil, close_err end
if upload_close_err then return nil, upload_close_err end
```

**Returns:** `Walker, error`

**Permission:** `archive.read`

`extract_all` applies the same destination-path sanitization and total-size bound described above. When an application instead advances `s:walk()` directly, iterator errors are raised as Lua errors and each entry stream is valid only until the next iteration. Task-scope cleanup still releases the walker and its current entry stream; close caller-owned input streams explicitly when control remains in the application.

`tar`, `tar.gz`, and `tar.zst` stream natively. `zip` is parsed via per-entry local headers; entries written with a streaming data descriptor (size/CRC trailing the data) are read by decompressing to the entry boundary. For robust zip handling of large uploads, land the upload as a file first (a bounded sequential copy) then use `archive.open`:

```lua
local uuid = require("uuid")

local dst, fs_err = fs.get("app:tmp")
if fs_err then return nil, fs_err end
local upload, stream_err = req:stream()
if stream_err then return nil, stream_err end
local stage_id, id_err = uuid.v7()
if id_err then
    upload:close()
    return nil, id_err
end
local stage_path = stage_id .. ".zip"
local copied, copy_err = dst:writefile(stage_path, upload, "wx")
local _, upload_close_err = upload:close()
if copy_err or upload_close_err then
    dst:remove(stage_path)
    return nil, copy_err or upload_close_err
end
local r, open_err = archive.open(dst, stage_path)   -- robust random access
if open_err then
    dst:remove(stage_path)
    return nil, open_err
end

-- Replace this operation with the random-access work the handler needs.
local info, operation_err = r:stat("manifest.json")
local _, close_err = r:close()
local removed, remove_err = dst:remove(stage_path)
if operation_err then return nil, operation_err end
if close_err then return nil, close_err end
if remove_err then return nil, remove_err end
return info
```

Each request generates an unpredictable stage name and creates it exclusively, so concurrent handlers cannot truncate one another's files. The primary copy, upload-close, open, or archive-operation error is returned after attempting to remove the staged file. Production handlers can log a cleanup failure separately when a primary error already exists. Add `uuid` to the executable entry's module allowlist for this recipe.

## Writing

`archive.create(dest, ...)` streams entries into a filesystem path, open writable file, or writable `stream.Stream`.

```lua
local tmp, fs_err = fs.get("app:tmp")
if fs_err then return nil, fs_err end
local w, err = archive.create(tmp, "out.zip", { format = "zip" })
if err then return nil, err end
```

**Returns:** `Writer, error`

**Permission:** `archive.write`

### `add`

Add an entry from a Lua string containing text or bytes, an open `fs.File`, or a `stream.Stream`:

```lua
local ok, err = w:add("notes.txt", "hello")
if err then return nil, err end
local added, add_err = w:add("from_upload", some_stream, { method = "deflate", mode = 420 }) -- 0644
if add_err then return nil, add_err end
```

### `add_file`

Stream an entry from a file in a filesystem:

```lua
local data_fs, fs_err = fs.get("app:data")
if fs_err then return nil, fs_err end
local ok, err = w:add_file("data/big.bin", data_fs, "big.bin")
if err then return nil, err end
```

### `add_dir`

Add a directory entry:

```lua
local ok, err = w:add_dir("empty/")
if err then return nil, err end
```

### `close`

Finalize the archive, including the ZIP central directory. The operation is idempotent, and the writer also closes automatically at task scope.

```lua
local ok, err = w:close()
if err then return nil, err end
```

`add` options are `{method = "store"|"deflate", mode, size}`. `size` is required when adding a stream to a TAR-family archive; string values and `add_file` supply their size automatically. `add_file` accepts `method` and `mode`, and `add_dir` has no options. The ZIP writer uses data descriptors when its destination is a non-seekable writable stream.

Lua numeric literals are decimal; use `420` for the Unix permission bits commonly written as octal `0644`.

The writer does not close an externally supplied file or stream used as an entry source or archive destination. Close caller-owned resources after `w:close()`.

## Errors

| Condition | Kind |
|-----------|------|
| Unknown / mismatched format | `errors.INVALID` |
| Corrupt or truncated archive reported by the current Lua wrapper | `errors.INTERNAL` |
| Inline `read()` or `extract_all` total limit exceeded | `errors.INVALID` |
| Entry/archive limit surfaced while opening or reading through the current Lua wrapper | `errors.INTERNAL` |
| Random access on a stream-only format (use `scan`) | `errors.UNAVAILABLE` |
| Entry name not found | `errors.NOT_FOUND` |
| Archive policy denied | `errors.PERMISSION_DENIED` |
| Source or destination I/O failure | `errors.INTERNAL` |
| Read a stale streamed entry after the walk advanced | `errors.INTERNAL` |

See [Error Handling](lua/core/errors.md) for working with errors.

## See Also

- [Filesystem](lua/storage/filesystem.md) - Source and destination filesystems
- [Cloud Storage](../storage/cloud.md) - Ranged readers for cloud-hosted archives
- [Stream](lua/core/stream.md) - Stream objects handed to and from archives
- [Compression](lua/data/compress.md) - In-memory gzip/deflate/zstd
