---
title: "클라우드 스토리지"
description: "S3 호환 스토리지에서 오브젝트를 업로드, 다운로드, 조회 및 관리합니다."
---

# 클라우드 스토리지
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

`cloudstorage` 모듈은 S3 호환 스토리지에서 오브젝트를 업로드, 다운로드, 조회 및 관리합니다. 직접 접근을 위한 presigned URL도 생성합니다.

이 페이지는 API 레퍼런스입니다. 예제는 구성된 스토리지 엔트리, 예제에서 지정한 파일시스템 볼륨에 대한 접근 권한, 아래에 나열된 권한을 전제로 합니다. 멀티파트 및 presigned URL 블록은 부분적인 클라이언트 통합 레시피입니다. 애플리케이션이 HTTP 전송을 수행하고 반환된 ETag를 제공해야 합니다. 작업과 리소스 정리가 모두 실패할 수 있는 경우, 주변 애플리케이션은 시작 오류를 유지하면서 정리 실패를 기록하도록 `report_cleanup_error(err)`를 제공합니다.

스토리지 설정은 [클라우드 스토리지](../../system/cloudstorage.md)를 참조하세요.

## 로딩

```lua
local cloudstorage = require("cloudstorage")
```

## 스토리지 획득

레지스트리 ID로 클라우드 스토리지 리소스를 획득합니다:

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 스토리지 리소스 ID |

**반환:** `Storage, error`

## 오브젝트 업로드

문자열 또는 파일에서 콘텐츠를 업로드합니다:

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 오브젝트 키/경로 |
| `content` | string 또는 Reader | 문자열 또는 파일 reader로서의 콘텐츠 |
| `options` | table | 선택적 메타데이터 및 조건부 쓰기 옵션 |

**반환:** `boolean, error`

### 업로드 옵션

옵션 테이블로 메타데이터를 첨부하거나 쓰기를 보호할 수 있습니다:

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

파일 writer로 오브젝트를 다운로드합니다:

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `keys` | string[] | 삭제할 오브젝트 키 배열 |

**반환:** `boolean, error`

## 다운로드 URL

스토리지 자격 증명 없이 오브젝트를 다운로드할 수 있는 임시 URL을 생성합니다. 클라이언트는 만료될 때까지 이 URL을 사용할 수 있습니다.

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 오브젝트 키 |
| `options.expiration` | integer | URL 만료까지 초 (기본값: 3600) |

**반환:** `string, error`

## 업로드 URL

스토리지 자격 증명 없이 오브젝트를 업로드할 수 있는 임시 URL을 생성합니다. 클라이언트는 만료될 때까지 스토리지에 직접 업로드할 수 있습니다.

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

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 오브젝트 키 |
| `options.expiration` | integer | URL 만료까지 초 (기본값: 3600) |
| `options.content_type` | string | 업로드에 필요한 콘텐츠 타입 |
| `options.content_length` | integer | 예상되는 정확한 업로드 길이(바이트) |

**반환:** `string, error`

## 멀티파트 업로드 URL

대용량 클라이언트 업로드에서는 멀티파트 업로드를 생성하고, 각 파트의 presigned URL을 발급한 뒤 파트 요청이 반환한 ETag로 업로드를 완료합니다. 주변 애플리케이션은 업로드 오류를 유지하면서 abort 실패를 관찰할 수 있도록 `report_cleanup_error(err)`를 제공합니다:

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

`presigned_part_urls`는 `count`와 `parts` 중 정확히 하나를 받습니다. 한 번의 호출은 최대 1,000개의 URL을 반환할 수 있으며 파트 번호 범위는 1부터 10,000까지입니다. `expiration` 기본값은 3,600초이고 선택적 `headers`도 서명에 포함됩니다. `create_multipart_upload`는 `content_type`, `cache_control`, `content_disposition`, `content_encoding`, `metadata`, `headers`를 받습니다. 완료 요청의 파트 순서는 자유롭습니다.

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `create_multipart_upload(key, opts?)` | `table, error` | 업로드를 시작하고 `{upload_id}` 반환 |
| `presigned_part_urls(key, upload_id, opts)` | `table[], error` | `{part_number, url}` 레코드 반환 |
| `complete_multipart_upload(key, upload_id, parts)` | `table, error` | 업로드를 완료하고 ETag 및 선택적 버전/위치 반환 |
| `abort_multipart_upload(key, upload_id)` | `boolean, error` | 완료되지 않은 업로드 중단 |

완료하지 않을 업로드는 중단해야 합니다. 버킷 수명 주기 규칙은 버려진 업로드를 위한 보조 수단일 뿐 명시적 정리를 대신하지 않습니다. 구성된 제공자가 필요한 기능을 지원하지 않으면 멀티파트 메서드는 `errors.UNAVAILABLE`을 반환합니다.

## 랜덤 액세스 Reader

`open_reader`는 전체 오브젝트를 다운로드하지 않고도 seek 가능한 읽기 전용 오브젝트를 제공합니다. 캐시 미스에서 범위를 가져오고 오브젝트를 열 때의 ETag를 `If-Match` 조건으로 전송합니다. 이 조건을 강제하는 제공자는 오브젝트가 변경되면 서로 다른 버전을 섞는 대신 `errors.CONFLICT`를 반환합니다.

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

| 옵션 | 기본값 | 유효 범위 |
|------|--------|-----------|
| `block_size` | 8 MiB | 64 KiB~128 MiB |
| `cache_blocks` | 4 | 1~64 |

캐시(`block_size * cache_blocks`)는 256 MiB를 초과할 수 없습니다. 캐시 미스는 블로킹 네트워크 I/O를 수행하며 직렬화되므로, 이 reader는 아카이브 reader와 같은 순차적 랜덤 액세스 소비자를 위한 것입니다. 제공자는 ETag를 제공해야 하며, 그렇지 않으면 reader 열기는 `errors.UNAVAILABLE`을 반환합니다. ETag를 제공하지만 범위 읽기 전제 조건을 무시하는 제공자는 덮어쓰기 감지 보장을 제공할 수 없습니다.

| Reader 메서드 | 반환 | 설명 |
|---------------|------|------|
| `size()` | `number` | 오브젝트 크기(바이트) |
| `key()` | `string` | 오브젝트 키 |
| `close()` | `boolean, error` | reader 닫기. 멱등적 |

Reader는 작업 종료 시 자동으로 닫히지만 작업이 끝나면 명시적으로 닫으세요.

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
| `create_multipart_upload(key, opts?)` | `table, error` | 멀티파트 업로드 시작 |
| `presigned_part_urls(key, upload_id, opts)` | `table[], error` | 멀티파트 업로드 URL 생성 |
| `complete_multipart_upload(key, upload_id, parts)` | `table, error` | 멀티파트 업로드 완료 |
| `abort_multipart_upload(key, upload_id)` | `boolean, error` | 멀티파트 업로드 중단 |
| `open_reader(key, opts?)` | `Reader, error` | seek 가능한 범위 reader 열기 |
| `release()` | `boolean` | 스토리지 리소스 해제 |

## 권한

클라우드 스토리지 작업에는 보안 정책 평가가 적용됩니다.

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
| 조건부 전제 조건 실패 | `errors.CONFLICT` | 아니오 |
| 범위 reader가 열린 동안 오브젝트가 변경됨 | `errors.CONFLICT` | 아니오 |
| 멀티파트 업로드를 찾을 수 없음 | `errors.NOT_FOUND` | 아니오 |
| 제공자에 멀티파트 또는 범위 reader 기능이 없음 | `errors.UNAVAILABLE` | 아니오 |
| `cloudstorage.get`이 권한을 거부함 | 발생한 Lua 오류 | 해당 없음 |
| 제공자 작업 실패 | 가능한 경우 제공자 오류를 유지하며, 그렇지 않으면 미지정 | 상황에 따라 다름 |

에러 처리는 [에러 처리](../core/errors.md)를 참조하세요.
