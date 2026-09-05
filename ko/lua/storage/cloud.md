---
title: "클라우드 스토리지"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='io'/ <secondary-label ref='external'/ <secondary-label…"
---

# 클라우드 스토리지
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

S3 호환 오브젝트 스토리지에 접근합니다. 오브젝트를 업로드, 다운로드, 목록 조회, 관리하고, 다운로드/업로드/멀티파트 파트 URL을 presign하며, 랜덤 액세스로 오브젝트를 읽습니다.

스토리지 설정은 [클라우드 스토리지](system/cloudstorage.md)를 참조하세요.

## 로딩

```lua
local cloudstorage = require("cloudstorage")
```

## 스토리지 획득

레지스트리 ID로 클라우드 스토리지 리소스 가져오기:

```lua
local storage, err = cloudstorage.get("app.infra:files")
if err then
    return nil, err
end

storage:upload_object("data/file.txt", "content")
storage:release()
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 스토리지 리소스 ID |

**반환:** `Storage, error`

## 오브젝트 업로드

문자열 또는 파일에서 콘텐츠 업로드:

```lua
local storage = cloudstorage.get("app.infra:files")

-- 문자열 콘텐츠 업로드
local ok, err = storage:upload_object("reports/daily.json", json.encode({
    date = "2024-01-15",
    total = 1234
}))

-- 파일에서 업로드
local fs = require("fs")
local vol = fs.get("app:data")
local file = vol:open("/large-file.bin", "r")

storage:upload_object("backups/large-file.bin", file)
file:close()

storage:release()
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 오브젝트 키/경로 |
| `content` | string 또는 Reader | 문자열 또는 파일 reader로서의 콘텐츠 |
| `options` | table | 선택적 메타데이터 및 조건부 쓰기 옵션 |

**반환:** `boolean, error`

### 업로드 옵션

옵션 테이블로 메타데이터를 첨부하거나 쓰기를 보호할 수 있습니다:

```lua
storage:upload_object("reports/daily.json", body, {
    content_type = "application/json",
    cache_control = "max-age=3600",
    metadata = { owner = "team-a", run_id = "1234" },  -- stored as x-amz-meta-*
    only_if_absent = true                              -- fail if the key already exists
})
```

| 옵션 | 타입 | 설명 |
|--------|------|------|
| `content_type` | string | MIME 타입 |
| `cache_control` | string | Cache-Control 헤더 |
| `content_disposition` | string | Content-Disposition 헤더 |
| `content_encoding` | string | Content-Encoding 헤더 |
| `metadata` | table | 사용자 메타데이터(문자열 키/값), `x-amz-meta-*`로 저장됨 |
| `headers` | table | 추가 요청 헤더(문자열 키/값) |
| `if_match` | string | 현재 오브젝트 ETag가 일치할 때만 쓰기 |
| `if_none_match` | string | ETag와 일치하는 오브젝트가 없을 때만 쓰기(`"*"`는 모든 오브젝트를 의미) |
| `only_if_absent` | boolean | 키가 존재하지 않을 때만 쓰기(`if_none_match = "*"`의 별칭) |

조건부 쓰기가 전제 조건을 충족하지 못하면 `precondition_failed` 오류를 반환합니다.

## 오브젝트 다운로드

파일 writer로 오브젝트 다운로드:

```lua
local storage = cloudstorage.get("app.infra:files")
local fs = require("fs")
local vol = fs.get("app:temp")

local file = vol:open("/downloaded.json", "w")
local ok, err = storage:download_object("reports/daily.json", file)
file:close()

-- 부분 콘텐츠 다운로드 (처음 1KB)
local partial = vol:open("/partial.bin", "w")
storage:download_object("backups/large-file.bin", partial, {
    range = "bytes=0-1023"
})
partial:close()

storage:release()
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 다운로드할 오브젝트 키 |
| `writer` | Writer | 대상 파일 writer |
| `options.range` | string | 바이트 범위 (예: "bytes=0-1023") |
| `options.if_match` | string | 오브젝트 ETag가 일치할 때만 다운로드 |
| `options.if_none_match` | string | ETag가 일치하지 않을 때만 다운로드 |

**반환:** `boolean, error`

전제 조건(`if_match`/`if_none_match`)을 충족하지 못하면 `precondition_failed` 오류를 반환합니다.

## 오브젝트 목록 조회

선택적 접두사 필터링으로 오브젝트 목록 조회:

```lua
local storage = cloudstorage.get("app.infra:files")

local result, err = storage:list_objects({
    prefix = "reports/2024/",
    max_keys = 100
})

for _, obj in ipairs(result.objects) do
    print(obj.key, obj.size, obj.etag)
end

-- 대용량 결과 페이징
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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `options.prefix` | string | 키 접두사로 필터 |
| `options.max_keys` | integer | 반환할 최대 오브젝트 수 |
| `options.continuation_token` | string | 페이징 토큰 |
| `options.include_owner` | boolean | 각 오브젝트의 `owner`(`id`, `display_name`) 포함 |
| `options.include_versions` | boolean | 오브젝트 버전 나열; 각 항목에 `version_id` 포함 |

**반환:** `table, error`

결과는 `objects`, `is_truncated`, `next_continuation_token`을 포함합니다. 각 오브젝트에는 `key`, `size`, `etag`, `storage_class`가 있으며, 선택적으로 `last_modified`, `version_id`, `owner`가 포함됩니다.

<note>
목록 결과에서 <code>content_type</code>은 항상 비어 있습니다 — S3 list 작업은 이를 반환하지 않습니다. 오브젝트의 콘텐츠 타입과 메타데이터를 읽으려면 <code>head_object</code>를 사용하세요.
</note>

## 오브젝트 메타데이터

본문을 다운로드하지 않고 단일 오브젝트의 메타데이터를 가져옵니다:

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 오브젝트 키 |

**반환:** `table, error`

결과 필드:

| 필드 | 타입 | 설명 |
|------|------|------|
| `size` | integer | 오브젝트 크기(바이트) |
| `etag` | string | 엔티티 태그 |
| `content_type` | string | MIME 타입 |
| `cache_control` | string | Cache-Control 헤더 |
| `content_disposition` | string | Content-Disposition 헤더 |
| `content_encoding` | string | Content-Encoding 헤더 |
| `storage_class` | string | 스토리지 클래스 |
| `version_id` | string | 버전 ID(버전 관리가 활성화된 경우 존재) |
| `last_modified` | integer | 마지막 수정 시각(Unix 초) |
| `metadata` | table | 사용자 메타데이터(`x-amz-meta-*`) |
| `headers` | table | 원시 응답 헤더(소문자 키) |

존재하지 않는 오브젝트는 `not_found` 오류를 반환합니다.

## 오브젝트 삭제

여러 오브젝트 제거:

```lua
local storage = cloudstorage.get("app.infra:files")

storage:delete_objects({
    "temp/file1.txt",
    "temp/file2.txt",
    "temp/file3.txt"
})

storage:release()
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `keys` | string[] | 삭제할 오브젝트 키 배열 |

**반환:** `boolean, error`

모든 키가 시도됩니다. 존재하지 않는 키를 삭제하는 것은 에러가 아닙니다. 제공자가 키별 실패를 보고하면, 호출은 실패한 각 키와 그 제공자 에러 코드를 명시하는 단일 에러를 반환합니다.

## 다운로드 URL

자격 증명 없이 오브젝트를 다운로드할 수 있는 임시 URL을 생성합니다. 외부 사용자와 파일을 공유하거나 애플리케이션을 통해 콘텐츠를 제공하는 데 유용합니다.

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

-- 직접 다운로드를 위해 클라이언트에 URL 반환
return {download_url = url}
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 오브젝트 키 |
| `options.expiration` | integer | URL 만료까지 초 (기본값: 3600) |

**반환:** `string, error`

## 업로드 URL

자격 증명 없이 오브젝트를 업로드할 수 있는 임시 URL을 생성합니다. 클라이언트가 서버를 프록시하지 않고 스토리지에 직접 파일을 업로드할 수 있게 합니다.

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

-- 직접 업로드를 위해 클라이언트에 URL 반환
return {upload_url = url}
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 오브젝트 키 |
| `options.expiration` | integer | URL 만료까지 초 (기본값: 3600) |
| `options.content_type` | string | 업로드에 필요한 콘텐츠 타입 |
| `options.content_length` | integer | 최대 업로드 크기 바이트 |

**반환:** `string, error`

## 멀티파트 업로드

단일 presigned PUT은 오브젝트를 5 GiB로 제한합니다. presigned 멀티파트 업로드는 더 큰 오브젝트를 여러 파트로 분할해 클라이언트가 직접 업로드한 다음 서버 측에서 조립합니다. 멀티파트는 제공자 기능입니다: S3는 이를 구현하며, 지원하지 않는 제공자는 `errors.UNAVAILABLE`을 반환합니다.

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

-- 클라이언트는 각 url에 PUT하고 응답 헤더의 ETag를 반환합니다.
local done, err = storage:complete_multipart_upload("backups/huge.zip", mp.upload_id, {
    { part_number = 1, etag = etag1 },
    { part_number = 2, etag = etag2 },
    { part_number = 3, etag = etag3 },
})

storage:release()
```

### create_multipart_upload

키에 대한 멀티파트 업로드를 시작합니다.

| 파라미터 | 타입 | 설명 |
|-----------|------|-------------|
| `key` | string | 최종 오브젝트의 오브젝트 키 |
| `options` | table | `content_type`, `cache_control`, `content_disposition`, `content_encoding`, `metadata`, `headers` - `upload_object`와 동일한 의미 |

**반환:** `table, error` - 테이블에는 이후의 모든 파트, 완료, 중단 호출에서 업로드를 식별하는 `upload_id`가 담깁니다.

조건부 쓰기(`if_match`, `if_none_match`, `only_if_absent`)는 멀티파트 프로토콜의 일부가 아니며 여기서 받지 않습니다.

### presigned_part_urls

진행 중인 업로드의 파트에 대한 presigned PUT URL을 생성합니다. 각 URL에는 일반 HTTP PUT으로 업로드하며, 업로더는 `complete_multipart_upload`를 위해 각 파트의 `ETag` 응답 헤더를 보관해야 합니다.

| 파라미터 | 타입 | 기본값 | 설명 |
|-----------|------|---------|-------------|
| `key` | string | 필수 | 오브젝트 키 |
| `upload_id` | string | 필수 | `create_multipart_upload`에서 얻음 |
| `options.parts` | int[] | - | 명시적 파트 번호 (1-10000, 중복 불가) |
| `options.count` | int | - | 파트 `1..count`를 presign |
| `options.headers` | table | - | 각 파트 요청에 필요한 헤더; 서명되며 업로더도 함께 전송해야 함 |
| `options.expiration` | int | 3600 | URL 만료까지의 초 |

`parts`와 `count` 중 정확히 하나가 필요하며, 한 번의 호출은 최대 1000개의 URL을 presign합니다 - 매우 큰 오브젝트는 페이지 단위로 presign하세요.

**반환:** `table, error` - `{ part_number, url }`의 배열.

마지막을 제외한 모든 파트는 최소 5 MiB여야 하며; 제공자가 완료 시점에 이를 강제합니다.

### complete_multipart_upload

업로드된 파트로부터 최종 오브젝트를 조립합니다. 파트는 순서에 상관없이 보고할 수 있으며 완료 전에 파트 번호로 정렬됩니다.

| 파라미터 | 타입 | 설명 |
|-----------|------|-------------|
| `key` | string | 오브젝트 키 |
| `upload_id` | string | `create_multipart_upload`에서 얻음 |
| `parts` | table | `{ part_number = int, etag = string }`의 배열 |

**반환:** `table, error` - `etag`, 그리고 제공자가 보고하는 경우 `version_id`와 `location`. 알 수 없는 업로드 ID는 `errors.NOT_FOUND`를 반환합니다.

### abort_multipart_upload

진행 중인 업로드를 폐기하고 저장된 파트를 해제합니다.

| 파라미터 | 타입 | 설명 |
|-----------|------|-------------|
| `key` | string | 오브젝트 키 |
| `upload_id` | string | `create_multipart_upload`에서 얻음 |

**반환:** `boolean, error`

완료되지 않은 업로드는 중단될 때까지 파트가 저장된 채로 남아 과금됩니다. 모든 실패 경로에서 중단하고, 최후의 보루로 버킷 수명 주기 규칙을 설정하세요 - [클라우드 스토리지](system/cloudstorage.md#multipart-uploads)를 참조하세요.

## 범위 리더

`open_reader`는 범위 GET을 사용해 오브젝트에 랜덤 액세스를 엽니다 - 로컬 스테이징도, 전체 다운로드도 없습니다. 주요 소비자는 [`archive.open`](lua/data/archive.md)으로, 제한된 메모리로 수 GB 아카이브를 오브젝트 스토리지에서 바로 읽습니다.

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

| 파라미터 | 타입 | 기본값 | 설명 |
|-----------|------|---------|-------------|
| `key` | string | 필수 | 오브젝트 키 |
| `options.block_size` | int | 8388608 | 범위 GET 단위, 바이트 (64 KiB에서 128 MiB) |
| `options.cache_blocks` | int | 4 | 상주 LRU 블록 수 (1에서 64) |

`block_size * cache_blocks`는 256 MiB를 초과할 수 없습니다. 존재하지 않는 오브젝트는 `errors.NOT_FOUND`를 반환합니다.

**반환:** `Reader, error`

리더가 열릴 때 오브젝트의 ETag가 고정되고 모든 범위 읽기에 `If-Match`로 전송되므로, 읽는 도중 덮어써진 오브젝트는 두 세대의 오브젝트가 섞여 제공되는 대신 `errors.CONFLICT`로 실패합니다. ETag를 제공할 수 없는 제공자는 `errors.UNAVAILABLE`을 반환하며; 리더는 고정되지 않은 오브젝트를 절대 제공하지 않습니다.

캐시 미스 읽기는 호출 태스크에서 블로킹 네트워크 IO를 수행하고 동시 리더를 직렬화하므로, 엔트리별 순차 접근 - 아카이브 패턴 - 이 의도된 형태입니다.

### Reader 메서드

| 메서드 | 반환 | 설명 |
|--------|---------|-------------|
| `size()` | `integer` | 오픈 시점 stat에서 얻은 오브젝트 크기, 바이트 |
| `key()` | `string` | 리더가 읽는 오브젝트 키 |
| `close()` | `boolean, error` | 블록 캐시 해제; 멱등 |

명시적으로 닫지 않으면 리더는 태스크 스코프에서 자동으로 닫힙니다.

## 스토리지 메서드

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `upload_object(key, content, opts?)` | `boolean, error` | 문자열 또는 파일 콘텐츠 업로드 |
| `download_object(key, writer, opts?)` | `boolean, error` | 파일 writer로 다운로드 |
| `head_object(key)` | `table, error` | 오브젝트 메타데이터 가져오기 |
| `list_objects(opts?)` | `table, error` | 접두사 필터로 오브젝트 목록 |
| `delete_objects(keys)` | `boolean, error` | 여러 오브젝트 삭제 |
| `presigned_get_url(key, opts?)` | `string, error` | 임시 다운로드 URL 생성 |
| `presigned_put_url(key, opts?)` | `string, error` | 임시 업로드 URL 생성 |
| `create_multipart_upload(key, opts?)` | `table, error` | presigned 멀티파트 업로드 시작 |
| `presigned_part_urls(key, upload_id, opts)` | `table, error` | 업로드 파트용 PUT URL presign |
| `complete_multipart_upload(key, upload_id, parts)` | `table, error` | 업로드된 파트로 오브젝트 조립 |
| `abort_multipart_upload(key, upload_id)` | `boolean, error` | 진행 중인 멀티파트 업로드 폐기 |
| `open_reader(key, opts?)` | `Reader, error` | 범위 랜덤 액세스 리더 열기 |
| `release()` | `boolean` | 스토리지 리소스 해제 |

## 권한

클라우드 스토리지 작업은 보안 정책 평가 대상입니다.

| 액션 | 리소스 | 설명 |
|------|--------|------|
| `cloudstorage.get` | 스토리지 ID | 스토리지 리소스 획득 |

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 빈 리소스 ID | `errors.INVALID` | 아니오 |
| 리소스를 찾을 수 없음 | `errors.NOT_FOUND` | 아니오 |
| 클라우드 스토리지 리소스가 아님 | `errors.INVALID` | 아니오 |
| 스토리지 해제됨 | `errors.INVALID` | 아니오 |
| 빈 키 | `errors.INVALID` | 아니오 |
| 콘텐츠 nil | `errors.INVALID` | 아니오 |
| writer가 유효하지 않음 | `errors.INVALID` | 아니오 |
| 오브젝트를 찾을 수 없음 | `errors.NOT_FOUND` | 아니오 |
| 알 수 없는 업로드 ID | `errors.NOT_FOUND` | 아니오 |
| 조건부 전제 조건 실패 | `errors.CONFLICT` | 아니오 |
| 범위 읽기 중 오브젝트가 덮어써짐 | `errors.CONFLICT` | 아니오 |
| 제공자가 멀티파트 업로드를 지원하지 않음 | `errors.UNAVAILABLE` | 아니오 |
| 제공자가 `open_reader`용 ETag를 제공하지 않음 | `errors.UNAVAILABLE` | 아니오 |
| 권한 거부됨 | `errors.PERMISSION_DENIED` | 아니오 |
| 작업 실패 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.
