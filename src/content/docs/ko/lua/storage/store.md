---
title: "키-값 스토어"
---

# 키-값 스토어
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

TTL 지원이 있는 빠른 키-값 스토리지. 캐싱, 세션, 임시 상태에 이상적입니다.

스토어 설정은 [스토어](system/store.md)를 참조하세요.

## 로딩

```lua
local store = require("store")
```

## 스토어 획득

레지스트리 ID로 스토어 리소스 가져오기:

```lua
local cache, err = store.get("app:cache")
if err then
    return nil, err
end

cache:set("user:123", {name = "Alice"}, 3600)
local user = cache:get("user:123")

cache:release()
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 스토어 리소스 ID |

**반환:** `Store, error`

## 값 저장

선택적 TTL과 함께 값 저장:

```lua
local cache = store.get("app:cache")

-- 단순 설정
cache:set("user:123:name", "Alice")

-- TTL과 함께 설정 (300초 후 만료)
cache:set("session:abc", {user_id = 123, role = "admin"}, 300)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 키 |
| `value` | any | 값 (테이블, 문자열, 숫자, 불리언) |
| `ttl` | number | TTL 초 (선택적, 0 = 만료 없음) |

**반환:** `boolean, error`

## 값 조회

키로 값 가져오기:

```lua
local user = cache:get("user:123")
if not user then
    -- 키를 찾을 수 없거나 만료됨
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 조회할 키 |

**반환:** `any, error`

키가 존재하지 않으면 `nil` 반환.

## 존재 확인

조회하지 않고 키 존재 확인:

```lua
if cache:has("lock:" .. resource_id) then
    return nil, errors.new("CONFLICT", "Resource is locked")
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 확인할 키 |

**반환:** `boolean, error`

## 키 삭제

스토어에서 키 제거:

```lua
cache:delete("session:" .. session_id)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 삭제할 키 |

**반환:** `boolean, error`

삭제되면 `true`, 키가 존재하지 않았으면 `false` 반환.

## 엔트리 메타데이터 읽기

`entry`는 값과 함께 그 `version`을 반환합니다. `version`은 낙관적 동시성에 사용되는 불투명한 문자열입니다:

```lua
local e, err = cache:entry("user:123")
if e then
    print(e.key, e.value, e.version)
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 읽을 키 |

**반환:** `Entry, error` — `{key: string, value: any, version: string}`

## 키 목록

페이징과 함께 결정적 키 순서로 엔트리 나열:

```lua
local page, err = cache:list({ prefix = "session:", limit = 100 })
for _, e in ipairs(page.items) do
    print(e.key, e.value)
end

-- 다음 페이지
if page.has_more then
    page = cache:list({ prefix = "session:", after = page.cursor })
end
```

| 옵션 | 타입 | 설명 |
|--------|------|------|
| `prefix` | string | 이 접두사를 가진 키만 |
| `after` | string | 이 커서 이후부터 계속(이전 페이지에서) |
| `limit` | integer | 페이지당 최대 항목 수 |

**반환:** `Page, error` — `{items: Entry[], cursor: string, has_more: boolean}`

## 조건부 쓰기

`put`은 값을 쓰고 새 `Entry`를 반환합니다. 옵션으로 낙관적 동시성을 활성화합니다:

```lua
-- 키가 존재하지 않을 때만 생성
local e, err = cache:put("lock:job-1", owner, { only_if_absent = true })
if err and err:kind() == "ALREADY_EXISTS" then
    -- 다른 누군가가 보유 중
end

-- compare-and-set: 버전이 여전히 일치할 때만 쓰기
local cur = cache:entry("config")
local e2, err2 = cache:put("config", new_value, { if_version = cur.version })
if err2 and err2:kind() == "CONFLICT" then
    -- 동시 쓰기가 이를 변경함; 다시 읽고 재시도
end
```

| 옵션 | 타입 | 설명 |
|--------|------|------|
| `ttl` | number | TTL 초 |
| `only_if_absent` | boolean | 키가 존재하지 않을 때만 쓰기 |
| `if_version` | string | 현재 버전이 일치할 때만 쓰기 |

`only_if_absent`와 `if_version`은 상호 배타적입니다.

**반환:** `Entry, error`

<warning>
조건부 쓰기는 <code>info().conditional_put</code>이 true인 스토어가 필요합니다(메모리 및 <code>store.kv.raft</code> 스토어). <code>store.kv.crdt</code>와 <code>store.sql</code>에서는 <code>errors.INVALID</code> 오류를 반환합니다. 조건부 쓰기가 필요할 때는 <code>store.kv.raft</code>를 사용하세요.
</warning>

## 스토어 기능

`info`는 백엔드와 지원하는 기능을 보고하므로, 코드가 바인딩된 스토어에 맞춰 적응할 수 있습니다:

```lua
local info = cache:info()
-- info.backend      -> store.backend.* 중 하나 (예: "kv.raft")
-- info.consistency  -> store.consistency.* 중 하나 (예: "linearizable")
-- info.durable / info.list / info.versioned / info.conditional_put / info.ttl  (불리언)
```

**반환:** `Info, error` — `{id, backend, consistency, durable, list, versioned, conditional_put, ttl}`

### 상수

| 상수 | 값 |
|----------|--------|
| `store.backend` | `MEMORY`, `SQL`, `KV_RAFT`, `KV_CRDT`, `UNKNOWN` |
| `store.consistency` | `LINEARIZABLE`, `EVENTUAL`, `LOCAL`, `UNKNOWN` |

```lua
if cache:info().consistency == store.consistency.LINEARIZABLE then
    -- compare-and-set 사용 안전
end
```

## 스토어 메서드

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `get(key)` | `any, error` | 키로 값 조회 |
| `entry(key)` | `Entry, error` | 버전 메타데이터와 함께 값 조회 |
| `set(key, value, ttl?)` | `boolean, error` | 선택적 TTL과 함께 값 저장 |
| `put(key, value, opts?)` | `Entry, error` | 조건부/버전 관리 쓰기, 새 엔트리 반환 |
| `list(opts?)` | `Page, error` | 키 순서로 페이징된 목록 |
| `has(key)` | `boolean, error` | 키 존재 확인 |
| `delete(key)` | `boolean, error` | 키 제거 |
| `info()` | `Info, error` | 백엔드, 일관성, 기능 플래그 |
| `release()` | `boolean` | 스토어를 풀로 반환 |

## 권한

스토어 작업은 보안 정책 평가 대상입니다.

| 액션 | 리소스 | 속성 | 설명 |
|------|--------|------|------|
| `store.get` | 스토어 ID | - | 스토어 리소스 획득 |
| `store.key.get` | 스토어 ID | `key` | 키 값 읽기 |
| `store.key.set` | 스토어 ID | `key` | 키 값 쓰기 |
| `store.key.delete` | 스토어 ID | `key` | 키 삭제 |
| `store.key.has` | 스토어 ID | `key` | 키 존재 확인 |

## 에러

`store.get()`과 스토어 핸들의 모든 메서드(`get`, `set`, `has`, `delete`)는 구조화된 오류를 반환합니다(`err:kind()` 사용).

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 빈 리소스 ID | `errors.INVALID` | 아니오 |
| 리소스를 찾을 수 없음 | `errors.NOT_FOUND` | 아니오 |
| 스토어 해제됨 | `errors.INVALID` | 아니오 |
| 권한 거부됨 | `errors.PERMISSION_DENIED` | 아니오 |
| `only_if_absent`이고 키가 존재함 | `errors.ALREADY_EXISTS` | 아니오 |
| `if_version` 불일치 | `errors.CONFLICT` | 예 |
| 지원하지 않는 스토어에서 조건부 쓰기 | `errors.INVALID` | 아니오 |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.
