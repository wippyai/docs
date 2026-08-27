---
title: "Hub"
description: "Lua에서 Wippy Hub 메타데이터와 아티팩트를 탐색하고 자격 증명을 관리하며 로컬 아티팩트 캐시를 검사합니다."
---

# Hub

`hub` 모듈은 Wippy Hub의 모듈, 버전, 의존성, 파일, 아티팩트, README를 읽습니다. 런타임의 Hub 자격 증명 재정의를 관리하고 로컬 캐시에서 고정되지 않은 아티팩트를 제거할 수도 있습니다.

이 페이지는 API 참조입니다. 카탈로그 좌표는 예시이며 아티팩트, 인증, 캐시 작업에는 일치하는 네트워크 접근, 자격 증명, lock 상태, 보안 정책이 필요합니다.

## 로드

```lua
local hub = require("hub")
```

## 호출별 옵션

네트워크 기반 카탈로그 및 아티팩트 호출은 다음 공통 키를 가진 선택적 옵션 테이블을 받습니다:

| 키 | 타입 | 설명 |
|-----|------|-------------|
| `registry` | string | 레지스트리 URL 재정의 |
| `token` | string | API 토큰 재정의 |
| `timeout` | duration/number | 요청 제한 시간(예: `"3m"` 또는 초) |

페이지네이션을 지원하는 호출은 `page`와 `page_size`도 받습니다.

인증 호출은 레지스트리 URL을 직접 받습니다. 캐시 호출과 패키지 핸들 메서드는 아래에서 설명하는 자체 옵션을 사용합니다.

## 모듈

```lua
local result, err = hub.modules.list({
    org = "wippy",
    visibility = "public",
    type = "library",
    sort_order = "downloads_desc",
    page = 1,
    page_size = 20,
})
-- result = { items, total, page, page_size }
```

| 함수 | 설명 |
|----------|-------------|
| `hub.modules.list(opts?)` | 필터를 적용해 모듈 나열 |
| `hub.modules.search(query, opts?)` | 쿼리 문자열로 검색 |
| `hub.modules.get(module, opts?)` | `org/name` 또는 모듈 ID로 모듈 가져오기 |
| `hub.modules.readme(module, opts?)` | README 가져오기. `{content, filename, version}` 반환 |

### 목록/검색 옵션

| 옵션 | 값 |
|--------|--------|
| `organization_id` / `org` | string |
| `visibility` | `public`, `private`, `internal` |
| `type` | `library`, `application`, `agent`, `plugin` |
| `sort_order` | `name_asc`, `name_desc`, `created_desc`, `updated_desc`, `downloads_desc` |
| `keywords` (search) | 문자열 배열 |
| `license` (search) | string |
| `include_deprecated` (search) | boolean |

### README

```lua
local readme, err = hub.modules.readme("wippy/terminal", {
    version = "1.2.3"
})
if err then return nil, err end
print(readme.content)
```

`version` 옵션은 버전 문자열 또는 `{id, version, label}` 같은 테이블을 받습니다.

## 버전

```lua
local versions, err = hub.versions.list("wippy/terminal", {
    include_yanked = false,
    page_size = 50,
})

local v, err = hub.versions.get("wippy/terminal", "1.0.0")
```

| 함수 | 설명 |
|----------|-------------|
| `hub.versions.list(module, opts?)` | 모듈 버전 나열 |
| `hub.versions.get(module, version, opts?)` | 특정 버전 가져오기 |
| `hub.versions.inspect(module, version, opts?)` | 버전 아티팩트 검사(번들을 다운로드하여 읽음) |
| `hub.versions.open(module, version, opts?)` | 버전 아티팩트를 패키지 핸들로 열기 |

### 패키지 핸들

`hub.versions.open`은 아티팩트를 다운로드하고 `version`, `digest`, `packed` 필드가 있는 핸들을 반환합니다:

```lua
local pkg, err = hub.versions.open("wippy/terminal", "1.2.3")
if err then return nil, err end

local entries, entries_err = pkg:entries({
    kind = "function.lua",       -- string or string[], omit for all kinds
    include_data = false,        -- default true
})
-- each entry: { id = "ns:name", kind = "...", meta = {...}, data = <any> }
local _, close_err = pkg:close()
if entries_err then return nil, entries_err end
if close_err then return nil, close_err end
return entries
```

| 메서드 | 설명 |
|--------|-------------|
| `pkg:metadata()` | 팩 메타데이터 맵 |
| `pkg:entries(opts?)` | 아티팩트의 레지스트리 엔트리. `opts.kind`로 필터링하고 `opts.include_data`(기본값 true)로 `data` 필드 제어 |
| `pkg:resources()` | 내장 리소스 목록 |
| `pkg:fs(resource)` | 내장 리소스의 파일시스템 핸들 |
| `pkg:close()` | 핸들 해제 |

엔트리 `data`는 `${env:...}` 참조를 해석하지 않고 반환됩니다.

## 로컬 아티팩트 캐시

```lua
local entries, err = hub.cache.list()

local removed, err = hub.cache.remove("wippy/terminal", "1.2.3", {
    force = false,
})

local candidates, err = hub.cache.prune({
    dry_run = true,
})
```

| 함수 | 설명 |
|----------|-------------|
| `hub.cache.list()` | 캐시된 아티팩트를 `{module, version, size, pinned}` 레코드로 나열 |
| `hub.cache.remove(module, version, opts?)` | 캐시된 아티팩트 하나 제거. `opts.force = true`이면 lock 파일이 고정한 항목도 제거 허용 |
| `hub.cache.prune(opts?)` | lock 파일이 참조하지 않는 아티팩트 제거. `opts.dry_run = true`이면 후보만 보고 |

`hub.cache.remove`와 `hub.cache.prune`은 dry-run 또는 고정 보호가 적용되지 않는 한 lock이 해석한 vendor 디렉터리에서 파일을 삭제합니다.

## 의존성

```lua
local deps, err = hub.dependencies.get("wippy/terminal", "1.0.0")
local users, err = hub.dependents.get("wippy/terminal")
```

| 함수 | 설명 |
|----------|-------------|
| `hub.dependencies.get(module, version?, opts?)` | 모듈 버전의 의존성 |
| `hub.dependents.get(module, opts?)` | 이 모듈에 의존하는 모듈 |

## 파일

```lua
local files, err = hub.files.list("wippy/terminal", "1.0.0")
```

| 함수 | 설명 |
|----------|-------------|
| `hub.files.list(module, version, opts?)` | 버전의 파일 나열(`version` 필수). `{items, total, page, page_size}` 반환 |

## 인증

레지스트리 토큰을 런타임 재정의로 설치합니다. 이후 Hub 소비자는 재시작하지 않고도 이 토큰을 사용합니다:

```lua
local status, err = hub.auth.authenticate("wpy_xxx")          -- default registry
local status, err = hub.auth.authenticate("wpy_xxx", "https://hub.example.com")

local status, err = hub.auth.status()
local ok, err = hub.auth.logout()
```

위 토큰 문자열은 자리표시자입니다. 실제 자격 증명은 비밀 기반 환경 엔트리나 다른 보호된 소스에서 로드하세요. Lua 또는 레지스트리 YAML에 커밋하지 마세요.

| 함수 | 설명 |
|----------|-------------|
| `hub.auth.authenticate(token, registry?)` | 레지스트리에서 토큰을 검증하고 성공하면 런타임 재정의로 설치 |
| `hub.auth.status(registry?)` | 현재 자격 증명을 실시간 검증 |
| `hub.auth.logout(registry?)` | 런타임 토큰 재정의 제거 |

`status`에는 `authenticated`, `registry`, `orgs`가 포함됩니다. 신원 필드(`username`, `user_id`, `scope`, `expires_at`, `expired`)는 인증된 경우에만 존재합니다. 검증에 실패한 토큰은 저장되지 않으며 `authenticate`는 `authenticated = false`를 반환합니다. 런타임 재정의는 `WIPPY_TOKEN`과 저장된 자격 증명보다 우선합니다.

## 권한

각 최상위 `hub.*` 작업은 `hub.modules.list`, `hub.versions.open`, `hub.dependencies.get`, `hub.files.list`, `hub.auth.status`, `hub.cache.prune`처럼 일치하는 작업 이름을 검사합니다. 모듈을 대상으로 하는 작업은 제공된 모듈 참조를 보안 리소스로 사용하고 인증 작업은 레지스트리 URL을 사용합니다. 패키지 핸들 메서드는 권한을 얻은 `hub.versions.open` 호출 뒤에 추가 권한 검사를 수행하지 않습니다.

## 참고 항목

- [CLI 참조](../../guides/cli.md) — `wippy readme`, `wippy search`, `wippy publish`
- [게시 가이드](../../guides/publishing.md)
