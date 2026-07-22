---
title: "Hub"
description: "Wippy Hub 모듈 카탈로그에 대한 읽기 전용 액세스: 모듈 목록 조회, 검색, 메타데이터, 버전, 의존성, README 조회."
---

# Hub

Wippy Hub 모듈 카탈로그에 대한 읽기 전용 액세스: 모듈 목록 조회, 검색, 메타데이터, 버전, 의존성, README 조회.

## 로드

```lua
local hub = require("hub")
```

## 호출별 옵션

모든 호출은 선택적 옵션 테이블을 받습니다. 모든 호출에 공통된 키:

| 키 | 타입 | 설명 |
|-----|------|-------------|
| `registry` | string | Registry URL 재정의 |
| `token` | string | API 토큰 재정의 |
| `timeout` | duration/number | 요청 타임아웃 (예: `"3m"` 또는 초) |

페이지네이션을 지원하는 호출은 `page`와 `page_size`도 받습니다.

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
| `hub.modules.list(opts?)` | 필터로 모듈 목록 조회 |
| `hub.modules.search(query, opts?)` | 쿼리 문자열로 검색 |
| `hub.modules.get(module, opts?)` | `org/name` 또는 모듈 id로 모듈 조회 |
| `hub.modules.readme(module, opts?)` | README 조회; `{content, filename, version}` 반환 |

### List/Search 옵션

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
print(readme.content)
```

`version` 옵션은 버전 문자열 또는 `{id, version, label}` 형태의 테이블을 받습니다.

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
| `hub.versions.list(module, opts?)` | 모듈 버전 목록 조회 |
| `hub.versions.get(module, version, opts?)` | 특정 버전 조회 |
| `hub.versions.inspect(module, version, opts?)` | 버전의 아티팩트 검사(번들을 다운로드하여 읽음) |
| `hub.versions.open(module, version, opts?)` | 버전의 아티팩트를 패키지 핸들로 열기 |

### 패키지 핸들

`hub.versions.open`은 아티팩트를 다운로드하고 `version`, `digest`, `packed` 필드를 가진 핸들을 반환합니다:

```lua
local pkg, err = hub.versions.open("wippy/terminal", "1.2.3")

local entries, err = pkg:entries({
    kind = "function.lua",       -- string or string[], omit for all kinds
    include_data = false,        -- default true
})
-- each entry: { id = "ns:name", kind = "...", meta = {...}, data = <any> }

pkg:close()
```

| 메서드 | 설명 |
|--------|-------------|
| `pkg:metadata()` | 팩 메타데이터 맵 |
| `pkg:entries(opts?)` | 아티팩트 내의 레지스트리 엔트리; `opts.kind`로 필터링, `opts.include_data`(기본값 true)로 `data` 필드 제어 |
| `pkg:resources()` | 임베드된 리소스 목록 |
| `pkg:fs(resource)` | 임베드된 리소스의 파일시스템 핸들 |
| `pkg:close()` | 핸들 해제 |

엔트리의 `data`는 원시 그대로 반환됩니다 — `${env:...}` 참조는 해석되지 않습니다.

## 의존성

```lua
local deps, err = hub.dependencies.get("wippy/terminal", "1.0.0")
local users, err = hub.dependents.get("wippy/terminal")
```

| 함수 | 설명 |
|----------|-------------|
| `hub.dependencies.get(module, version?, opts?)` | 모듈 버전의 의존성 |
| `hub.dependents.get(module, opts?)` | 이 모듈에 의존하는 모듈들 |

## 파일

```lua
local files, err = hub.files.list("wippy/terminal", "1.0.0")
```

| 함수 | 설명 |
|----------|-------------|
| `hub.files.list(module, version, opts?)` | 버전의 파일 목록 조회(`version` 필수); `{items, total, page, page_size}` 반환 |

## 인증

레지스트리 토큰을 실행 중인 프로세스에 푸시합니다 — 모든 hub 소비자가 재시작 없이 다음 호출에서 이를 사용합니다:

```lua
local status, err = hub.auth.authenticate("wpy_xxx")          -- default registry
local status, err = hub.auth.authenticate("wpy_xxx", "https://hub.example.com")

local status, err = hub.auth.status()
local ok, err = hub.auth.logout()
```

| 함수 | 설명 |
|----------|-------------|
| `hub.auth.authenticate(token, registry?)` | 레지스트리에 대해 토큰을 검증하고, 성공 시 런타임 재정의로 설치 |
| `hub.auth.status(registry?)` | 현재 자격 증명을 실시간 검증 |
| `hub.auth.logout(registry?)` | 런타임 토큰 재정의 해제 |

`status`는 `authenticated`, `registry`, `orgs`를 포함합니다; 신원 필드(`username`, `user_id`, `scope`, `expires_at`, `expired`)는 인증된 경우에만 존재합니다. 검증에 실패한 토큰은 저장되지 않습니다 — `authenticate`는 `authenticated = false`를 반환합니다. 이 재정의는 `WIPPY_TOKEN`과 저장된 자격 증명보다 우선합니다.

**권한:** `hub.auth.authenticate`, `hub.auth.status`, `hub.auth.logout`

## 참고

- [CLI Reference](guides/cli.md) — `wippy readme`, `wippy search`, `wippy publish`
- [Publishing Guide](guides/publishing.md)
