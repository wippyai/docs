---
title: "엔트리 레지스트리"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='permissions'/"
---

# 엔트리 레지스트리
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

등록된 엔트리를 쿼리하고 수정합니다. 메타데이터, 스냅샷, 버전 히스토리에 접근합니다.

## 로딩

```lua
local registry = require("registry")
```

## 엔트리 구조

```lua
{
    id = "app.lib:assert",     -- string: "namespace:name"
    kind = "function.lua",     -- string: 엔트리 타입
    meta = {type = "test"},    -- table: 검색 가능한 메타데이터
    data = {...}               -- any: 엔트리 페이로드
}
```

`registry.get`, `registry.find`, `snap:entries()`, `snap:get()`, `snap:namespace()`, `snap:find()`에서 읽어온 엔트리는 이 네 가지 작성자용 필드만 가집니다.

`dependency_root`는 `changes:create()`와 `changes:update()`가 받는 쓰기 측 필드입니다. `ns.dependency` 엔트리를 배포 루트로 표시하는 불리언입니다. 엔트리 API가 이를 반환하는 일은 없으며, 레지스트리 소유 상태는 [`snap:state()`](lua/core/registry.md#snapshot-state)로 읽습니다.

## 엔트리 가져오기

```lua
local entry, err = registry.get("app.lib:assert")
```

**권한:** 엔트리 ID에 대해 `registry.get`

## 엔트리 찾기

```lua
local entries, err = registry.find({[".kind"] = "function.lua"})
local entries, err = registry.find({[".kind"] = "http.endpoint", [".ns"] = "app.api"})
```

필터 필드는 엔트리 메타데이터와 매칭됩니다.

## ID 파싱

```lua
local id = registry.parse_id("app.lib:assert")
-- id.ns = "app.lib", id.name = "assert"
```

## 스냅샷

레지스트리의 특정 시점 뷰:

```lua
local snap, err = registry.snapshot()           -- 현재 상태
local snap, err = registry.snapshot_at(5)       -- 버전 5에서
```

### 스냅샷 메서드

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `snap:entries()` | `Entry[], error` | 접근 가능한 모든 엔트리 |
| `snap:state()` | `State, error` | 레지스트리 소유 메타데이터를 포함한 엔트리와 해결된 모듈 그래프 |
| `snap:get(id)` | `Entry, error` | ID로 단일 엔트리 |
| `snap:find(filter)` | `Entry[]` | 엔트리 필터링 |
| `snap:namespace(ns)` | `Entry[]` | 네임스페이스의 엔트리 |
| `snap:version()` | `Version` | 스냅샷 버전 |
| `snap:changes()` | `Changes` | 변경 세트 생성 |

### 스냅샷 상태 {#snapshot-state}

`snap:state()`는 엔트리 상태와 함께 해당 스냅샷 버전에 대해 선택된 모듈 그래프를 반환합니다. 레지스트리 소유 출처 정보는 `meta`에 병합되지 않고 각 엔트리에 따로 실리므로, 작성된 메타데이터와 혼동될 수 없습니다.

```lua
local snap, err = registry.snapshot()
local state, err = snap:state()

for _, entry in ipairs(state.entries) do
    print(entry.id, entry.registry.owner, entry.registry.root)
end

if state.resolution then
    print(state.resolution.digest, state.resolution.input_digest)
    for _, module in ipairs(state.resolution.modules) do
        print(module.name, module.version)
    end
end
```

`state.entries`의 각 엔트리는 네 가지 작성자용 필드에 더해 다음을 가집니다:

- `registry.owner` - 엔트리를 공급한 배포 소스
- `registry.root` - 엔트리가 배포가 선택한 의존성 선언일 때 `true`

`state.resolution`은 `registry.snapshot()` 뷰의 모듈 그래프를 기술합니다. 자체 그래프를 가지지 않는 스냅샷 — `registry.snapshot_at()`과 오버레이 스냅샷 포함 — 에서는 존재하지 않습니다:

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `digest` | string | 완전한 불변 선택의 콘텐츠 다이제스트 |
| `input_digest` | string | 선언된 루트 집합의 다이제스트 |
| `baseline_digest` | string | 그래프가 해결된 대상 배포 베이스라인의 다이제스트. 바인딩되지 않은 경우 생략됨 |
| `roots` | array | 솔버 입력으로 사용된 작성된 의존성 선언 |
| `references` | array | 같은 컴포넌트의 기존 루트에 접힌 루트 형태의 선언. 비어 있으면 생략됨 |
| `modules` | array | 선택된 모듈 |

`roots`와 `references` 항목은 `id`, `component`, `version`을 가집니다. `modules` 항목은 `name`과 `version`을 가지며, 설정된 경우 `version_id`, `source`, `digest`, `size_bytes`, `protected`도 가집니다.

## 버전

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- 숫자 ID
print(version:string())   -- 표시 문자열
local prev = version:previous()  -- 이전 버전 또는 nil
local next = version:next()      -- 다음 버전 또는 nil
```

## 히스토리

```lua
local hist, err = registry.history()
local versions, err = hist:versions()
local version, err = hist:get_version(5)
local snap, err = hist:snapshot_at(version)
```

## 변경 세트

수정 사항을 빌드하고 적용합니다:

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

**권한:** `changes:apply()`에 대해 `registry.apply`

### 엔트리 삭제

`changes:delete()`는 ID 문자열, `id` 문자열을 가진 테이블, `ns`와 `name` 문자열을 가진 테이블, 또는 그중 어떤 것이든 담은 배열을 받습니다. 배열은 중첩될 수 있고, 중복 ID는 하나의 삭제 작업으로 합쳐집니다.

```lua
changes:delete("test:old_entry")
changes:delete({id = "test:old_entry"})
changes:delete({ns = "test", name = "old_entry"})
changes:delete({"test:a", {ns = "test", name = "b"}, {"test:c"}})
```

빈 목록, 자기 자신을 참조하는 테이블, 문자열도 테이블도 아닌 값은 `errors.INVALID`로 거부됩니다.

### Changes 메서드

| 메서드 | 설명 |
|--------|------|
| `changes:create(entry)` | 생성 작업 추가 |
| `changes:update(entry)` | 업데이트 작업 추가 |
| `changes:delete(id)` | 삭제 작업 추가 |
| `changes:ops()` | 대기 중인 작업 가져오기 |
| `changes:apply()` | 변경 적용, 새 Version 반환 |

## 버전 적용

특정 버전으로 롤백 또는 포워드:

```lua
local prev = current_version:previous()
local ok, err = registry.apply_version(prev)
```

**권한:** `registry.apply_version`

## 델타 빌드

상태 간 전환을 위한 작업 계산:

```lua
local from = {{id = "test:a", kind = "test", meta = {}, data = {}}}
local to = {{id = "test:b", kind = "test", meta = {}, data = {}}}

local ops, err = registry.build_delta(from, to)
for _, op in ipairs(ops) do
    print(op.kind, op.entry.id)  -- "entry.create", "entry.update", "entry.delete"
end
```

## 오버레이

오버레이는 논리적 아이덴티티가 소유하는 프로세스 로컬 레지스트리 엔트리 집합입니다. 오버레이 엔트리는 일반적인 토폴로지 및 핸들러 전환에 참여하므로 서비스가 지속 엔트리와 똑같이 시작되고 중지되지만, 레지스트리 히스토리를 진행시키지 않으며 어떤 버전에도 나타나지 않습니다. 실행 중인 프로세스에만 존재하고 콜드 부트 후에는 비어 있으므로, 소유 제어 서비스가 시작 시 조정합니다.

```lua
local snap, err = registry.overlay("data-sources:crm")
```

**반환:** `Snapshot, error`

이 스냅샷은 일반적인 메서드를 통해 소유자의 오버레이 엔트리를 노출하며, `snap:version()`으로 현재 레지스트리 버전을 보고합니다. 또한 열리는 시점의 오버레이 세대를 포착하는데, 이것이 쓰기를 안전하게 만듭니다.

```lua
local snap, err = registry.overlay("data-sources:crm")
if err then return nil, err end

local changes = snap:changes()
changes:create({
    id = "data.crm:connection",
    kind = "registry.entry",
    meta = {},
    data = {endpoint = "https://crm.internal"}
})

local version, err = changes:apply()
```

오버레이 스냅샷에서 `changes:apply()`는 오버레이를 기록하고 현재 레지스트리 버전을 반환합니다. 히스토리 버전은 생성되지 않으므로, 지속 변경이 동시에 발생하지 않는 한 반환되는 버전은 그대로입니다.

### 동시성

각 오버레이는 성공한 적용마다 증가하는 세대 카운터를 가집니다. `changes:apply()`는 스냅샷이 열릴 때 포착한 세대와 여전히 일치할 때만 성공합니다. 같은 오버레이에 대한 동시 적용은 재시도 가능으로 표시된 `errors.CONFLICT`로 실패합니다: 오버레이를 다시 열고 변경 세트를 다시 만드세요.

```lua
local last_err
for _ = 1, 3 do
    local snap, err = registry.overlay("data-sources:crm")
    if err then return nil, err end

    local _, apply_err = snap:changes():delete("data.crm:connection"):apply()
    if not apply_err then return true end
    if not apply_err:retryable() then return nil, apply_err end
    last_err = apply_err
end
return nil, last_err
```

### 제약

- 소유자 문자열은 필수이며 비어 있을 수 없습니다.
- 변경 세트는 비어 있지 않아야 하며 같은 엔트리를 두 번 지정할 수 없습니다.
- ID가 이미 지속 상태나 다른 오버레이에 존재하면 `create`가 실패합니다.
- `update`와 `delete`는 이 소유자가 만든 엔트리에만 동작합니다. 그 밖의 ID는 `errors.NOT_FOUND`로 실패합니다.
- 오버레이 엔트리는 `dependency_root`나 그 밖의 레지스트리 소유 메타데이터를 설정할 수 없습니다.
- 오버레이 엔트리는 `ns.dependency`처럼 레지스트리 디렉티브가 소유한 종류를 사용할 수 없습니다.
- 살아남는 엔트리가 의존하는 엔트리를 제거하는 삭제는 거부됩니다.
- 의존성은 오버레이 소유자 경계를 넘을 수 없으며, 지속 엔트리는 오버레이 엔트리에 의존할 수 없습니다.

나머지는 `errors.CONFLICT` 또는 `errors.INVALID`로 나타나며 재시도할 수 없습니다. 재시도 가능한 것은 위의 세대 불일치뿐입니다.

**권한:** 열고 읽으려면 소유자에 대한 `registry.overlay.get`, 쓰려면 소유자에 대한 `registry.overlay.apply`, 그리고 변경 세트의 각 엔트리 ID에 대한 `registry.overlay.<create|update|delete>.<kind>`.

## 권한

| 권한 | 리소스 | 설명 |
|------|--------|------|
| `registry.get` | 엔트리 ID | 엔트리 읽기 (find/entries 결과도 필터링) |
| `registry.apply` | - | 변경 세트 적용 |
| `registry.apply_version` | - | 버전 적용/롤백 |
| `registry.overlay.get` | 소유자 ID | 오버레이 스냅샷 열기 및 읽기 |
| `registry.overlay.apply` | 소유자 ID | 오버레이 변경 세트 적용 |
| `registry.overlay.create.<kind>` | 엔트리 ID | 해당 종류의 오버레이 엔트리 생성 |
| `registry.overlay.update.<kind>` | 엔트리 ID | 해당 종류의 오버레이 엔트리 갱신 |
| `registry.overlay.delete.<kind>` | 엔트리 ID | 해당 종류의 오버레이 엔트리 삭제 |

## 에러

| 조건 | 종류 |
|------|------|
| 엔트리를 찾을 수 없음 | `errors.NOT_FOUND` |
| 버전을 찾을 수 없음 | `errors.NOT_FOUND` |
| 권한 거부됨 | `errors.PERMISSION_DENIED` |
| 잘못된 파라미터 | `errors.INVALID` |
| 적용할 변경 없음 | `errors.INVALID` |
| 적용 중 오버레이가 변경됨 | `errors.CONFLICT` (재시도 가능) |
| 오버레이 엔트리가 다른 곳에 소유되었거나 지속 상태와 충돌 | `errors.CONFLICT` |
| 레지스트리 사용 불가 | `errors.INTERNAL` |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.
