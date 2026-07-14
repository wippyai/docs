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

S3 호환 오브젝트 스토리지에 접근합니다. presigned URL 지원으로 업로드, 다운로드, 목록 조회, 파일 관리를 수행합니다.

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
| 조건부 전제 조건 실패 | `errors.CONFLICT` | 아니오 |
| 권한 거부됨 | `errors.PERMISSION_DENIED` | 아니오 |
| 작업 실패 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.
