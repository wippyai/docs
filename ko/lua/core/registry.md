---
title: "엔트리 레지스트리"
description: "레지스트리 엔트리와 메타데이터를 읽고 버전 및 스냅샷을 검사하며 변경 세트를 적용합니다."
---

# 엔트리 레지스트리
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

`registry` 모듈은 엔트리를 읽고 수정하며 스냅샷과 버전 기록에 접근합니다. 이 페이지는 API 참조입니다. 변경 예시는 예시 ID를 사용하며 해당 리소스와 엔트리 종류를 허용하는 정책이 필요합니다.

## 로드

```lua
local registry = require("registry")
```

## 엔트리 구조

```lua
{
    id = "app.lib:assert",     -- string: "namespace:name"
    kind = "function.lua",     -- string: entry type
    meta = {type = "test"},    -- table: searchable metadata
    data = {...}               -- any: entry payload
}
```

## 엔트리 가져오기

```lua
local entry, err = registry.get("app.lib:assert")
```

**권한:** 엔트리 ID에 대한 `registry.get`

## 엔트리 찾기

```lua
local entries, err = registry.find({[".kind"] = "function.lua"})
local entries, err = registry.find({[".kind"] = "http.endpoint", [".ns"] = "app.api"})
```

루트 선택자는 `.kind`, `.name`, `.ns`, `.id`이며 값은 glob 일치를 지원합니다. 메타데이터 필터는 `{["meta.type"] = "test"}`처럼 `meta.` 접두사를 사용합니다.

## ID 파싱

```lua
local id = registry.parse_id("app.lib:assert")
-- id.ns = "app.lib", id.name = "assert"
```

## 스냅샷

스냅샷은 특정 시점의 레지스트리 뷰입니다:

```lua
local snap, err = registry.snapshot()           -- current state
local snap, err = registry.snapshot_at(5)       -- at version 5
```

### 스냅샷 메서드

| 메서드 | 반환 | 설명 |
|--------|---------|-------------|
| `snap:entries()` | `Entry[], error` | 접근 가능한 모든 엔트리 |
| `snap:get(id)` | `Entry, error` | ID로 단일 엔트리 가져오기 |
| `snap:find(filter)` | `Entry[]` | 엔트리 필터링 |
| `snap:namespace(ns)` | `Entry[]` | 네임스페이스의 엔트리 |
| `snap:version()` | `Version` | 스냅샷 버전 |
| `snap:changes()` | `Changes` | 변경 세트 만들기 |

## 프로세스 로컬 오버레이

`registry.overlay(owner_id)`는 논리 소유자의 프로세스 로컬 오버레이를 엽니다. 유효 레지스트리의 일반 스냅샷을 반환합니다. 이 스냅샷에서 변경 세트를 만든 뒤 영구 변경과 같은 방식으로 적용합니다:

```lua
local snap, err = registry.overlay("controllers:customer-db")
if err then
    return nil, err
end

local changes = snap:changes()
changes:create({
    id = "runtime.data_sources:customer-db",
    kind = "db.sql.postgres",
    data = {host = "db.example.com", database = "customer"}
})

local current_version, err = changes:apply()
```

오버레이 변경은 이 프로세스의 레지스트리 토폴로지와 리소스에 영향을 주지만 영구 기록 버전을 만들지 않습니다. 따라서 `changes:apply()`는 변경되지 않은 현재 영구 버전을 반환합니다. 오버레이는 일반 기록 커밋과 버전 선택 뒤에도 유지되며 콜드 부팅 또는 명시적 레지스트리 상태 로드 시 제거된 뒤 소유자가 다시 조정합니다.

오버레이 스냅샷은 세대 기반 낙관적 동시성을 사용합니다. 오래된 스냅샷의 변경을 적용하면 재시도 가능한 `errors.CONFLICT`로 원자적으로 실패합니다. 오버레이를 다시 열고 변경 세트를 재구성하세요. 변경 세트에는 각 엔트리 ID당 하나의 작업만 포함할 수 있습니다. 소유자 ID는 정규 식별자로 다듬어집니다. 소유자는 엔트리 메타데이터가 아니라 레지스트리 상태이며 확장 지시문이 소유한 엔트리 종류는 오버레이에서 변경할 수 없습니다.

일반 `registry.get`, `find`, `snapshot` 호출은 합성된 유효 레지스트리를 보고 각 엔트리에 계속 `registry.get` 권한을 요구합니다. 소유자 수준 오버레이 권한은 읽기 권한을 대체하지 않습니다.

## 버전

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- numeric ID
print(version:string())   -- display string
local prev = version:previous()  -- previous version or nil
local next = version:next()      -- next version or nil
```

## 기록

```lua
local hist, err = registry.history()
local versions, err = hist:versions()
local version, err = hist:get_version(5)
local snap, err = hist:snapshot_at(version)
```

## 변경 세트

create, update, delete 작업으로 변경 세트를 만든 뒤 적용합니다:

```lua
local snap, err = registry.snapshot()
local changes = snap:changes()

changes:create({
    id = "test:new_entry",
    kind = "test.kind",
    meta = {type = "test"},
    data = {config = "value"}
})

changes:update({
    id = "test:existing",
    kind = "test.kind",
    meta = {updated = true},
    data = {new_value = true}
})

changes:delete("test:old_entry")

local new_version, err = changes:apply()
```

**권한:** `changes:apply()`에 대한 `registry.apply`

### Changes 메서드

| 메서드 | 설명 |
|--------|-------------|
| `changes:create(entry)` | create 작업 추가 |
| `changes:update(entry)` | update 작업 추가 |
| `changes:delete(id)` | delete 작업 추가(문자열 또는 `{ns, name}`) |
| `changes:ops()` | 대기 중인 작업 가져오기 |
| `changes:apply()` | 변경 적용 후 새 Version 반환 |

## 버전 적용

특정 버전을 적용해 레지스트리를 이전 또는 이후 상태로 이동합니다:

```lua
local prev = current_version:previous()
local ok, err = registry.apply_version(prev)
```

**권한:** `registry.apply_version`

## 델타 빌드

두 엔트리 집합 사이를 전환하는 데 필요한 작업을 계산합니다:

```lua
local from = {{id = "test:a", kind = "test", meta = {}, data = {}}}
local to = {{id = "test:b", kind = "test", meta = {}, data = {}}}

local ops, err = registry.build_delta(from, to)
for _, op in ipairs(ops) do
    print(op.kind, op.entry.id)  -- "entry.create", "entry.update", "entry.delete"
end
```

## 권한

| 권한 | 리소스 | 설명 |
|------------|----------|-------------|
| `registry.get` | 엔트리 ID | 엔트리 읽기(find/entries 결과도 필터링) |
| `registry.apply` | - | 변경 세트 적용 |
| `registry.apply_version` | - | 버전 적용/롤백 |
| `registry.overlay.get` | 소유자 ID | 소유자의 오버레이 열기 |
| `registry.overlay.apply` | 소유자 ID | 오버레이 변경 세트 적용 |
| `registry.overlay.create.<kind>` | 엔트리 ID | 오버레이에서 지정 종류의 엔트리 만들기 |
| `registry.overlay.update.<kind>` | 엔트리 ID | 오버레이에서 지정 종류의 엔트리 업데이트 |
| `registry.overlay.delete.<kind>` | 엔트리 ID | 오버레이에서 지정 종류의 엔트리 삭제 |

## 오류

| 조건 | 종류 |
|-----------|------|
| 엔트리를 찾을 수 없음 | `errors.NOT_FOUND` |
| 버전을 찾을 수 없음 | `errors.NOT_FOUND` |
| 권한 거부 | `errors.PERMISSION_DENIED` |
| 잘못된 매개변수 | `errors.INVALID` |
| 적용할 변경 없음 | `errors.INVALID` |
| 빈 오버레이 소유자 또는 지시문 소유 종류 | `errors.INVALID` |
| 오래된 오버레이 스냅샷 | `errors.CONFLICT` (재시도 가능) |
| 레지스트리 사용 불가 | `errors.INTERNAL` |

오류 작업 방법은 [오류 처리](lua/core/errors.md)를 참고하세요.
