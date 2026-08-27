---
title: "Archive"
description: "ZIP, TAR, gzip-compressed TAR, Zstandard-compressed TAR archive를 읽고 scan, extract, 생성합니다."
---

# Archive
<secondary-label ref="function"/>
<secondary-label ref="io"/>
<secondary-label ref="encoding"/>

`archive` 모듈은 random-access reader, sequential stream, 파일 시스템 destination을 통해 ZIP 및 TAR 계열 archive를 읽고 씁니다.

이 페이지는 부분 I/O recipe를 포함하는 API 참조입니다. streaming 작업은 entry copy buffer에 bound를 두지만 metadata, codec state, raw-byte source, `read()` 결과는 여전히 메모리를 사용합니다. 큰 random-access archive에는 seekable file 또는 ranged reader를 사용하고, forward-only input에는 `scan()`을 사용하며, 애플리케이션에 맞는 명시적 limit을 설정하십시오.

## 로딩

```lua
local archive = require("archive")
```

require하기 전에 실행 가능 엔트리의 `modules:` 목록에 `archive`를 추가하십시오. 파일 시스템, cloud reader, HTTP stream을 사용하는 recipe에는 해당 기능과 security policy도 필요합니다.

## Format

모듈은 magic byte에서 built-in format을 감지하거나 `opts.format`으로 지정한 format을 사용합니다.

| Format | Random read | Sequential scan | Write |
|--------|:-----------:|:---------------:|:-----:|
| `zip` | yes | yes (local headers) | yes |
| `tar` | yes | yes | yes |
| `tar.gz` | no | yes | yes |
| `tar.zst` | no | yes | yes |

`archive.formats()`는 등록된 format 이름 목록을 반환합니다.

```lua
local names = archive.formats()  -- {"zip", "tar", "tar.gz", "tar.zst", ...}
```

## Option

모든 entry point는 optional `opts` table을 받습니다.

| Key | Default | Meaning |
|-----|---------|---------|
| `format` | auto | `"zip"`, `"tar"`, `"tar.gz"`, `"tar.zst"`; auto는 magic을 sniff하고 없으면 extension 사용 |
| `max_entries` | 100000 | 더 많은 entry를 가진 archive 거부(decompression bomb 방어) |
| `max_total_bytes` | 2 GiB | `extract_all()`의 누적 uncompressed output cap |
| `max_file_bytes` | 1 GiB | 단일 entry의 uncompressed 크기 cap |
| `max_inline_bytes` | 16 MiB | RAM에 materialize하는 `read()` call의 hard cap. 더 크면 `stream()`/`extract()` 사용 |
| `buffer_bytes` | 64 KiB | streaming extract/add 경로의 copy buffer. `read()` allocation은 제한하지 않음 |

`max_file_bytes`는 각 entry를 제한하고 `max_total_bytes`는 reader 및 walker의 `extract_all()`에서만 적용됩니다. `read()`, `stream()`, 단일 entry `extract()`, manual walking을 사용하는 애플리케이션은 자체 누적 budget을 적용해야 합니다. `max_inline_bytes`는 `read()`가 materialize하는 entry data를 제한하며 `buffer_bytes`는 제한하지 않습니다. 이 limit에는 모든 metadata와 codec allocation이 포함되지는 않습니다.

## 읽기 — Random access

`archive.open(source, ...)`은 완전한 random access를 위해 **seekable** source를 엽니다. zip central directory는 먼저 읽고 entry는 요청할 때 decompress합니다. source는 `fs.FS` handle과 path, 열린 `fs.File`, cloud storage reader 또는 raw byte가 될 수 있습니다. byte는 archive 전체를 RAM에 보관하므로 작은 archive에만 사용하십시오.

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

cloud storage의 큰 archive에는 `open_reader`가 반환한 ranged reader를 전달합니다.

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

archive reader는 `fs.FS` handle과 path로 직접 연 file을 소유합니다. 외부에서 전달한 `fs.File` 또는 ranged reader는 소유하지 않습니다. archive reader를 먼저 닫은 다음 caller-owned input과 handle을 닫으십시오.

**반환값:** `Reader, error`

**권한:** `archive.read`

### `entries`

entry content를 decompress하지 않고 metadata를 iterate합니다.

```lua
for e in r:entries() do
    -- e: name, size, compressed_size, is_dir, mode, modified, method, crc32, type
    print(e.name, e.size, e.is_dir)
end
```

### `stat`

content를 decompress하지 않고 이름으로 entry metadata를 읽습니다.

```lua
local info, err = r:stat("docs/readme.md")
if err then return nil, err end
```

### `read`

단일 entry를 Lua string으로 materialize합니다. `max_inline_bytes`를 넘으면 `kind = Invalid` 오류가 발생합니다. 큰 데이터에는 `stream()` 또는 `extract()`를 사용하십시오.

```lua
local data, err = r:read("docs/readme.md")  -- small entries only
if err then return nil, err end
```

### `stream`

요청 시 decompress하는 `stream.Stream`으로 entry를 반환합니다. 결과를 scan하거나 `fs:writefile()`에 전달하거나 다른 stream consumer에 제공할 수 있습니다.

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

entry 하나를 destination 파일 시스템으로 stream합니다.

```lua
local out, fs_err = fs.get("app:out")
if fs_err then return nil, fs_err end
local ok, err = r:extract("docs/readme.md", out)
if err then return nil, err end
-- optional destination path:
-- r:extract("docs/readme.md", out, "readme.md")
```

### `extract_all`

모든 entry를 destination 파일 시스템으로 stream합니다.

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

애플리케이션 코드에서 destination 파일 시스템을 별도로 resolve하여 `fs.get` 오류를 처리하십시오. 단일 entry `extract`에서는 안전하지 않은 destination 이름이 오류를 반환합니다. `extract_all`은 결과 path에 `..`이 있거나 absolute이거나 Windows drive 또는 UNC prefix가 있는 entry를 건너뜁니다.

### `close`

reader를 닫습니다. 작업은 idempotent하며 task scope에서도 자동으로 닫힙니다.

```lua
local ok, err = r:close()
if err then return nil, err end
```

## 읽기 — Sequential scan

`archive.scan(source, opts?)`은 HTTP upload body나 multipart file stream 같은 **forward-only** source를 엽니다. entry는 archive 순서대로 방문하며 각 entry reader는 walk가 다음으로 진행될 때까지만 유효합니다. random `read(name)` access는 사용할 수 없습니다.

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

**반환값:** `Walker, error`

**권한:** `archive.read`

`extract_all`은 위에서 설명한 destination-path sanitization과 total-size bound를 적용합니다. 애플리케이션이 대신 `s:walk()`를 직접 진행하면 iterator error는 Lua error로 raise되고 각 entry stream은 다음 iteration까지만 유효합니다. task-scope cleanup은 walker와 현재 entry stream을 release하지만, 제어가 애플리케이션에 남아 있으면 caller-owned input stream을 명시적으로 닫으십시오.

`tar`, `tar.gz`, `tar.zst`는 native stream을 사용합니다. `zip`은 entry별 local header로 parse하며 streaming data descriptor를 사용해 작성된 entry는 entry boundary까지 decompress해 읽습니다. 큰 upload의 robust한 zip 처리에는 bounded sequential copy로 upload를 file에 기록한 다음 `archive.open`을 사용하십시오.

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

각 요청은 예측할 수 없는 stage 이름을 만들고 exclusive하게 생성하므로 concurrent handler가 서로의 file을 truncate할 수 없습니다. staged file 제거를 시도한 뒤 주요 copy, upload-close, open 또는 archive-operation error를 반환합니다. primary error가 이미 있으면 production handler는 cleanup failure를 별도로 log할 수 있습니다. 이 recipe를 사용하려면 실행 가능 엔트리의 module allowlist에 `uuid`를 추가하십시오.

## 쓰기

`archive.create(dest, ...)`는 entry를 파일 시스템 path, 열린 writable file 또는 writable `stream.Stream`에 stream합니다.

```lua
local tmp, fs_err = fs.get("app:tmp")
if fs_err then return nil, fs_err end
local w, err = archive.create(tmp, "out.zip", { format = "zip" })
if err then return nil, err end
```

**반환값:** `Writer, error`

**권한:** `archive.write`

### `add`

text 또는 byte를 포함하는 Lua string, 열린 `fs.File`, `stream.Stream`에서 entry를 추가합니다.

```lua
local ok, err = w:add("notes.txt", "hello")
if err then return nil, err end
local added, add_err = w:add("from_upload", some_stream, { method = "deflate", mode = 420 }) -- 0644
if add_err then return nil, add_err end
```

### `add_file`

파일 시스템의 file에서 entry를 stream합니다.

```lua
local data_fs, fs_err = fs.get("app:data")
if fs_err then return nil, fs_err end
local ok, err = w:add_file("data/big.bin", data_fs, "big.bin")
if err then return nil, err end
```

### `add_dir`

directory entry를 추가합니다.

```lua
local ok, err = w:add_dir("empty/")
if err then return nil, err end
```

### `close`

ZIP central directory를 포함해 archive를 finalize합니다. 작업은 idempotent하며 writer는 task scope에서도 자동으로 닫힙니다.

```lua
local ok, err = w:close()
if err then return nil, err end
```

`add` option은 `{method = "store"|"deflate", mode, size}`입니다. TAR 계열 archive에 stream을 추가할 때는 `size`가 필요합니다. string 값과 `add_file`은 size를 자동으로 제공합니다. `add_file`은 `method`와 `mode`를 받고 `add_dir`에는 option이 없습니다. ZIP writer는 destination이 non-seekable writable stream이면 data descriptor를 사용합니다.

Lua 숫자 literal은 decimal입니다. 일반적으로 octal `0644`로 쓰는 Unix permission bit에는 `420`을 사용하십시오.

writer는 entry source 또는 archive destination으로 외부에서 전달한 file이나 stream을 닫지 않습니다. `w:close()` 뒤 caller-owned resource를 닫으십시오.

## 오류

| Condition | Kind |
|-----------|------|
| 알 수 없거나 일치하지 않는 format | `errors.INVALID` |
| 현재 Lua wrapper가 보고한 corrupt 또는 truncated archive | `errors.INTERNAL` |
| inline `read()` 또는 `extract_all` total limit 초과 | `errors.INVALID` |
| 현재 Lua wrapper에서 open/read 중 드러난 entry/archive limit | `errors.INTERNAL` |
| stream-only format에 random access(`scan` 사용) | `errors.UNAVAILABLE` |
| entry 이름을 찾지 못함 | `errors.NOT_FOUND` |
| archive policy 거부 | `errors.PERMISSION_DENIED` |
| source 또는 destination I/O 실패 | `errors.INTERNAL` |
| walk가 진행된 뒤 stale streamed entry 읽기 | `errors.INTERNAL` |

오류 사용법은 [오류 처리](../core/errors.md)를 확인하십시오.

## 관련 문서

- [파일 시스템](../storage/filesystem.md) - Source 및 destination 파일 시스템
- [Cloud Storage](../storage/cloud.md) - cloud-hosted archive용 ranged reader
- [Stream](../core/stream.md) - archive에 전달하고 받는 stream object
- [압축](./compress.md) - in-memory gzip/deflate/zstd
