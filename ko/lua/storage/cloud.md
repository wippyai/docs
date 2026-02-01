# 클라우드 스토리지
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

S3 호환 오브젝트 스토리지에 접근합니다. presigned URL 지원으로 업로드, 다운로드, 목록 조회, 파일 관리를 수행합니다.

스토리지 설정은 [클라우드 스토리지](system-cloudstorage.md)를 참조하세요.

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

**반환:** `boolean, error`

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

**반환:** `boolean, error`

## 오브젝트 목록 조회

선택적 접두사 필터링으로 오브젝트 목록 조회:

```lua
local storage = cloudstorage.get("app.infra:files")

local result, err = storage:list_objects({
    prefix = "reports/2024/",
    max_keys = 100
})

for _, obj in ipairs(result.objects) do
    print(obj.key, obj.size, obj.content_type)
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

**반환:** `table, error`

결과는 `objects`, `is_truncated`, `next_continuation_token`을 포함합니다.

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
| `upload_object(key, content)` | `boolean, error` | 문자열 또는 파일 콘텐츠 업로드 |
| `download_object(key, writer, opts?)` | `boolean, error` | 파일 writer로 다운로드 |
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
| 권한 거부됨 | `errors.PERMISSION_DENIED` | 아니오 |
| 작업 실패 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.
