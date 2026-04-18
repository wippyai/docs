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
local versions, err = hub.versions.list("wippy/http", {
    include_yanked = false,
    page_size = 50,
})

local v, err = hub.versions.get("wippy/http", "1.0.0")
```

| 함수 | 설명 |
|----------|-------------|
| `hub.versions.list(module, opts?)` | 모듈 버전 목록 조회 |
| `hub.versions.get(module, version, opts?)` | 특정 버전 조회 |

## 의존성

```lua
local deps, err = hub.dependencies.get("wippy/http", "1.0.0")
local users, err = hub.dependents.get("wippy/http")
```

| 함수 | 설명 |
|----------|-------------|
| `hub.dependencies.get(module, version?, opts?)` | 모듈 버전의 의존성 |
| `hub.dependents.get(module, opts?)` | 이 모듈에 의존하는 모듈들 |

## 파일

```lua
local files, err = hub.files.list("wippy/http", "1.0.0")
```

게시된 버전의 파일 목록을 반환합니다.

## 참고

- [CLI Reference](guides/cli.md) — `wippy readme`, `wippy search`, `wippy publish`
- [Publishing Guide](guides/publishing.md)
