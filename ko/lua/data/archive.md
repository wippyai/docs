---
title: "Archive"
description: "<secondary-label ref='function'/ <secondary-label ref='io'/ <secondary-label ref='encoding'/"
---

# Archive
<secondary-label ref="function"/>
<secondary-label ref="io"/>
<secondary-label ref="encoding"/>

제한된 메모리로 zip/tar 아카이브를 읽고 씁니다. 아카이브는 RAM으로 로드되지도, 디스크로 추출되지도 않습니다. 최대 메모리는 아카이브와 항목 크기와 무관하므로, 수 GB 아카이브도 RAM이 적은 서버에서 처리됩니다.

## 로딩

```lua
local archive = require("archive")
```

## 포맷

내장 포맷은 매직 바이트로 감지되거나 `opts.format`으로 강제됩니다:

| 포맷 | 랜덤 읽기 | 순차 스캔 | 쓰기 |
|--------|:-----------:|:---------------:|:-----:|
| `zip` | 예 | 예 (로컬 헤더) | 예 |
| `tar` | 예 | 예 | 예 |
| `tar.gz` | 아니오 | 예 | 예 |
| `tar.zst` | 아니오 | 예 | 예 |

`archive.formats()`는 등록된 포맷 이름 목록을 반환합니다.

```lua
local names = archive.formats()  -- {"zip", "tar", "tar.gz", "tar.zst", ...}
```

## 옵션

모든 진입점은 선택적 `opts` 테이블을 받습니다:

| 키 | 기본값 | 의미 |
|-----|---------|---------|
| `format` | 자동 | `"zip"`, `"tar"`, `"tar.gz"`, `"tar.zst"`, 자동 = 매직 감지, 실패 시 확장자 |
| `max_entries` | 100000 | 항목 수가 더 많은 아카이브를 거부 (압축 폭탄 방어) |
| `max_total_bytes` | 2 GiB | 읽기/추출 중 누적 비압축 출력 상한 |
| `max_file_bytes` | 1 GiB | 단일 항목의 비압축 크기 상한 |
| `max_inline_bytes` | 16 MiB | RAM에 실체화하는 `read()` 호출의 절대 상한, 그 이상은 `stream()`/`extract()` 사용 |
| `buffer_bytes` | 64 KiB | 읽기/추출/추가를 위한 스트리밍 복사 버퍼 |

`max_total_bytes`/`max_file_bytes`는 작업량 상한이지 RAM 상한이 아닙니다. 항목을 스트리밍할 때는 `buffer_bytes`에 코덱의 압축 해제 윈도를 더한 것 이상을 절대 보유하지 않습니다. RAM 크기를 조정하는 유일한 손잡이는 `max_inline_bytes`입니다.

## 읽기 — 랜덤 액세스

`archive.open(source, ...)`은 완전한 랜덤 액세스를 위해 **탐색 가능한(seekable)** 소스를 엽니다(zip 중앙 디렉터리는 미리 읽고, 항목은 필요할 때 압축을 해제합니다). 소스는 `fs.FS` 핸들과 경로, 열린 `fs.File`, 원시 바이트(바이트는 아카이브 전체를 RAM에 보유하므로 작은 아카이브만), 또는 다른 모듈이 넘겨준 임의의 랜덤 액세스 리더일 수 있습니다.

다른 모듈의 리더는 `io.ReaderAt`을 구현하고 `Size`를 보고할 때 자격을 갖춥니다. 선택적 `Name`은 `opts.format`이 생략되었을 때 확장자 감지에 사용됩니다. [`cloudstorage`](lua/storage/cloud.md)의 `open_reader`가 그런 예로, 수 GB 아카이브를 오브젝트 스토리지에서 직접 읽습니다. 이 경우 아카이브는 아무것도 열지 않고 리더를 절대 닫지 않습니다. 리더의 소유자가 닫습니다.

```lua
local fs = require("fs")
local archive = require("archive")

-- fs 핸들 + 경로로 열기 (모듈이 파일을 열고 라이프사이클을 소유)
local r, err = archive.open(fs.get("app:uploads"), "incoming.zip")
-- 또는 이미 열린 탐색 가능한 fs.File에서
-- local r = archive.open(fs:get("app:uploads"):open("x.zip"))
-- 또는 원시 바이트에서 (작은 아카이브만)
-- local r = archive.open(zip_bytes, { format = "zip" })
-- 또는 다른 모듈이 소유한 랜덤 액세스 리더에서
-- local reader = cloudstorage.get("app:files"):open_reader("incoming.zip")
-- local r = archive.open(reader)
```

**반환:** `Reader, error`

**권한:** `archive.read`

### entries

디렉터리를 순회합니다(메타데이터만, 압축 해제 없음):

```lua
for e in r:entries() do
    -- e: name, size, compressed_size, is_dir, mode, modified, method, crc32, type
    print(e.name, e.size, e.is_dir)
end
```

### stat

이름으로 항목 메타데이터를 가져옵니다(압축 해제 없음):

```lua
local info, err = r:stat("docs/readme.md")
```

### read

단일 항목을 Lua 문자열로 실체화합니다. `max_inline_bytes`를 초과하면 오류(`kind = Invalid`)가 발생합니다. 큰 것에는 `stream()`이나 `extract()`를 사용하십시오:

```lua
local data, err = r:read("docs/readme.md")  -- 작은 항목만
```

### stream

항목을 필요할 때 압축을 해제하는 `stream.Stream`으로 반환합니다. 스트림이 쓰이는 모든 곳에 조합됩니다 — `:scanner()`, `fs:writefile()`, 또는 다른 모듈에 전달:

```lua
local es, err = r:stream("big.csv")
while true do
    local chunk = es:read(65536)
    if not chunk then break end
    process(chunk)
end
es:close()
```

### extract

항목 하나를 대상 파일 시스템으로 스트리밍합니다:

```lua
local ok, err = r:extract("docs/readme.md", fs.get("app:out"))
-- 선택적 대상 경로:
-- r:extract("docs/readme.md", fs.get("app:out"), "readme.md")
```

### extract_all

모든 항목을 대상 파일 시스템으로 스트리밍합니다:

```lua
local count, err = r:extract_all(fs.get("app:out"), {
    prefix = "job123/",          -- 각 대상 경로 앞에 붙임
    strip  = 1,                  -- 앞쪽 경로 구성요소 N개 제거
    filter = function(e) return not e.is_dir end,
})
```

항목 이름은 추출 시 정리됩니다. `..` 세그먼트, 절대 경로, Windows 드라이브/UNC 접두사는 거부됩니다(zip-slip 방어).

### close

리더를 닫습니다. 멱등하며, 태스크 스코프에서 자동으로도 닫힙니다.

```lua
r:close()
```

## 읽기 — 순차 스캔

`archive.scan(source, opts?)`은 **전진 전용** 스트림(HTTP 업로드 본문, multipart 파일 스트림)을 엽니다. 항목은 아카이브 순서대로 방문되며, 각 항목의 리더는 다음으로 진행하기 전까지만 유효합니다. 랜덤 `read(name)`은 없습니다.

```lua
local up = form.files.upload[1]:stream()        -- stream.Stream
local s, err = archive.scan(up, { format = "zip" })

for e, entry in s:walk() do                      -- entry는 stream.Stream
    if not e.is_dir then
        fs.get("app:uploads"):writefile("job123/" .. e.name, entry)
    end
end
s:close()
```

**반환:** `Walker, error`

**권한:** `archive.read`

`tar`, `tar.gz`, `tar.zst`는 네이티브로 스트리밍됩니다. `zip`은 항목별 로컬 헤더로 파싱되며, 스트리밍 데이터 디스크립터(크기/CRC가 데이터 뒤에 오는)로 작성된 항목은 항목 경계까지 압축을 해제해 읽습니다. 큰 업로드의 견고한 zip 처리를 위해서는 업로드를 먼저 파일로 내려놓은 뒤(제한된 순차 복사) `archive.open`을 사용하십시오:

```lua
local dst = fs.get("app:tmp")
dst:writefile("u.zip", req:stream())   -- 업로드 → fs 파일 스트리밍 복사
local r = archive.open(dst, "u.zip")   -- 견고한 랜덤 액세스
-- ... entries / extract_all ...
r:close()
dst:remove("u.zip")
```

## 쓰기

`archive.create(dest, ...)`은 항목을 대상으로 스트리밍해 아카이브를 만듭니다. 대상은 fs 안의 파일(경로와 함께)이거나 쓰기 가능한 `stream.Stream`(예: HTTP 응답)이므로, 다운로드용 `.zip`이 제한된 메모리로 곧장 전송선까지 생성됩니다.

```lua
local w, err = archive.create(fs.get("app:tmp"), "out.zip", { format = "zip" })
-- 또는 응답으로 스트리밍:
-- local w = archive.create(res:stream(), { format = "zip" })
```

**반환:** `Writer, error`

**권한:** `archive.write`

### add

문자열, 바이트, 리더, 또는 `stream.Stream`에서 항목을 추가합니다:

```lua
w:add("notes.txt", "hello")
w:add("from_upload", some_stream, { method = "deflate", mode = 0644 })
```

### add_file

파일 시스템의 파일에서 항목을 스트리밍합니다:

```lua
w:add_file("data/big.bin", fs.get("app:data"), "big.bin")
```

### add_dir

디렉터리 항목을 추가합니다:

```lua
w:add_dir("empty/")
```

### close

아카이브를 마무리합니다(zip의 경우 중앙 디렉터리를 씁니다). 멱등하며, 태스크 스코프에서 자동으로도 닫힙니다.

```lua
w:close()
```

`add*` 옵션: `{ method = "store"|"deflate", mode, modified }`. zip 라이터는 데이터 디스크립터를 사용해 탐색 불가능한 라이터로도 스트리밍하므로, 응답 스트림에 쓰는 것도 동작합니다.

## 오류

| 조건 | 종류 |
|-----------|------|
| 소스가 fs 핸들, fs 파일, 바이트, 랜덤 액세스 리더 중 어느 것도 아님 | `errors.INVALID` |
| 알 수 없거나 일치하지 않는 포맷 | `errors.INVALID` |
| 손상되었거나 잘린 아카이브 | `errors.INVALID` |
| 한도 초과 (항목 수 / 전체 / 파일 / 인라인) | `errors.INVALID` |
| 스트림 전용 포맷에 대한 랜덤 액세스 (`scan` 사용) | `errors.UNAVAILABLE` |
| 항목 이름을 찾을 수 없음 | `errors.NOT_FOUND` |
| 소스를 읽을 수 없거나 대상에 쓸 수 없음 | `errors.PERMISSION_DENIED` |
| 순회가 진행된 뒤 오래된 스트리밍 항목을 읽음 | `errors.INTERNAL` |

오류를 다루는 방법은 [오류 처리](lua/core/errors.md)를 참조하십시오.

## 참고

- [파일 시스템](lua/storage/filesystem.md) - 소스 및 대상 파일 시스템
- [스트림](lua/core/stream.md) - 아카이브에 주고받는 스트림 객체
- [압축](lua/data/compress.md) - 인메모리 gzip/deflate/zstd
- [클라우드 스토리지](lua/storage/cloud.md) - 랜덤 액세스 아카이브 소스로서의 `open_reader`
