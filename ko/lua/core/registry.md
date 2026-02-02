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

## 엔트리 가져오기

```lua
local entry, err = registry.get("app.lib:assert")
```

**권한:** 엔트리 ID에 대해 `registry.get`

## 엔트리 찾기

```lua
local entries, err = registry.find({kind = "function.lua"})
local entries, err = registry.find({kind = "http.endpoint", namespace = "app.api"})
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
| `snap:get(id)` | `Entry, error` | ID로 단일 엔트리 |
| `snap:find(filter)` | `Entry[]` | 엔트리 필터링 |
| `snap:namespace(ns)` | `Entry[]` | 네임스페이스의 엔트리 |
| `snap:version()` | `Version` | 스냅샷 버전 |
| `snap:changes()` | `Changes` | 변경 세트 생성 |

## 버전

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- 숫자 ID
print(version:string())   -- 표시 문자열
local prev = version:previous()  -- 이전 버전 또는 nil
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

### Changes 메서드

| 메서드 | 설명 |
|--------|------|
| `changes:create(entry)` | 생성 작업 추가 |
| `changes:update(entry)` | 업데이트 작업 추가 |
| `changes:delete(id)` | 삭제 작업 추가 (문자열 또는 `{ns, name}`) |
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

## 권한

| 권한 | 리소스 | 설명 |
|------|--------|------|
| `registry.get` | 엔트리 ID | 엔트리 읽기 (find/entries 결과도 필터링) |
| `registry.apply` | - | 변경 세트 적용 |
| `registry.apply_version` | - | 버전 적용/롤백 |

## 에러

| 조건 | 종류 |
|------|------|
| 엔트리를 찾을 수 없음 | `errors.NOT_FOUND` |
| 버전을 찾을 수 없음 | `errors.NOT_FOUND` |
| 권한 거부됨 | `errors.PERMISSION_DENIED` |
| 잘못된 파라미터 | `errors.INVALID` |
| 적용할 변경 없음 | `errors.INVALID` |
| 레지스트리 사용 불가 | `errors.INTERNAL` |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.
