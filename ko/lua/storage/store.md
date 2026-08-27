---
title: "키-값 스토어"
description: "선택적 만료 및 조건부 쓰기를 사용해 값을 저장하고 조회합니다."
---

# 키-값 스토어
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

`store` 모듈은 선택적 TTL을 지원하는 키-값 스토리지를 제공합니다. 캐시 데이터, 세션 및 기타 임시 상태를 보관할 수 있습니다.

이 페이지는 API 참조입니다. 코드 조각은 구성된 스토어, 아래에 나열된 권한, `owner` 또는 `new_value` 같은 애플리케이션 제공 값을 가정합니다. 획득 이후의 코드 조각은 기존의 활성 `cache` 핸들을 사용하며 독립 실행 함수가 아닙니다.

스토어 설정은 [스토어](../../system/store.md)를 참조하세요.

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

local _, set_err = cache:set("user:123", {name = "Alice"}, 3600)
if set_err then
    cache:release()
    return nil, set_err
end

local user, get_err = cache:get("user:123")

cache:release()
if get_err then return nil, get_err end
return user
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 스토어 리소스 ID |

**반환:** `Store, error`

## 값 저장

선택적 TTL과 함께 값 저장:

```lua
-- Simple set
local _, err = cache:set("user:123:name", "Alice")
if err then return nil, err end

-- Set with TTL (expires in 300 seconds)
local ok, ttl_err = cache:set("session:abc", {user_id = 123, role = "admin"}, 300)
if ttl_err then return nil, ttl_err end
return ok
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
local errors = require("errors")

local user, err = cache:get("user:123")
if err then
    if err:kind() == errors.NOT_FOUND then
        return nil -- key missing or expired
    end
    return nil, err
end
return user
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 조회할 키 |

**반환:** `any, error`

키가 없거나 만료되면 `nil`과 `errors.NOT_FOUND` 오류를 반환합니다.

## 존재 확인

조회하지 않고 키 존재 확인:

```lua
local errors = require("errors")

local exists, err = cache:has("lock:" .. resource_id)
if err then return nil, err end
if exists then
    return nil, errors.new({
        message = "Resource is locked",
        kind = errors.CONFLICT
    })
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 확인할 키 |

**반환:** `boolean, error`

## 키 삭제

스토어에서 키 제거:

```lua
local deleted, err = cache:delete("session:" .. session_id)
if err then return nil, err end
return deleted
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 삭제할 키 |

**반환:** `boolean, error`

삭제되면 `true`, 키가 존재하지 않았으면 `false` 반환.

## 엔트리 메타데이터 읽기

`entry`는 값과 함께 낙관적 동시성에 사용되는 불투명한 문자열인 `version`을 반환합니다.

```lua
local e, err = cache:entry("user:123")
if err then return nil, err end
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
if err then return nil, err end
for _, e in ipairs(page.items) do
    print(e.key, e.value)
end

-- next page
if page.has_more then
    local next_page, next_err = cache:list({ prefix = "session:", after = page.cursor })
    if next_err then return nil, next_err end
    page = next_page
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
local errors = require("errors")

-- create only if the key does not exist
local e, err = cache:put("lock:job-1", owner, { only_if_absent = true })
if err and err:kind() == errors.ALREADY_EXISTS then
    -- someone else holds it
elseif err then
    return nil, err
end

-- compare-and-set: write only if the version still matches
local cur, read_err = cache:entry("config")
if read_err then return nil, read_err end
local e2, err2 = cache:put("config", new_value, { if_version = cur.version })
if err2 and err2:kind() == errors.CONFLICT then
    -- a concurrent writer changed it; re-read and retry
elseif err2 then
    return nil, err2
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
local info, err = cache:info()
if err then return nil, err end
-- info.backend      -> one of store.backend.* (e.g. "kv.raft")
-- info.consistency  -> one of store.consistency.* (e.g. "linearizable")
-- info.durable / info.list / info.versioned / info.conditional_put / info.ttl  (booleans)
```

**반환:** `Info, error` — `{id, backend, consistency, durable, list, versioned, conditional_put, ttl}`

### 상수

| 상수 | 값 |
|----------|--------|
| `store.backend` | `MEMORY`, `SQL`, `KV_RAFT`, `KV_CRDT`, `UNKNOWN` |
| `store.consistency` | `LINEARIZABLE`, `EVENTUAL`, `LOCAL`, `UNKNOWN` |

```lua
local info, err = cache:info()
if err then return nil, err end
if info.consistency == store.consistency.LINEARIZABLE then
    -- safe to use compare-and-set
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
| `store.info` | 스토어 ID | - | 스토어 기능 검사 |
| `store.key.get` | 스토어 ID | `key` | 키 값 읽기(`entry` 포함) |
| `store.key.set` | 스토어 ID | `key` | 키 값 쓰기(`put` 포함) |
| `store.key.delete` | 스토어 ID | `key` | 키 삭제 |
| `store.key.has` | 스토어 ID | `key` | 키 존재 확인 |
| `store.key.list` | 스토어 ID | `prefix` | 엔트리 목록 조회 |

`store.get`, `get`, `set`, `delete`, `has`에서 권한이 거부되면 Lua 오류가 발생합니다. 반면 `info`, `entry`, `list`, `put` 메서드는 `errors.PERMISSION_DENIED` 오류를 반환합니다. 발생한 거부를 허용할 수 없는 코드를 호출하기 전에 필요한 액션을 허가하세요.

## 에러

입력, 조회, 백엔드 및 기능 실패는 구조화된 오류로 반환됩니다(`err:kind()` 사용). 권한 거부는 위에서 설명한 분할 동작을 따릅니다.

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 빈 리소스 ID | `errors.INVALID` | 아니오 |
| 리소스 레지스트리를 사용할 수 없음 | `errors.NOT_FOUND` | 아니오 |
| 누락된 리소스를 포함한 리소스 획득 실패 | `errors.INTERNAL` | 아니오 |
| 스토어 해제됨 | `errors.INVALID` | 아니오 |
| `info`, `entry`, `list`, `put`의 권한 거부 | `errors.PERMISSION_DENIED` | 아니오 |
| `store.get`, `get`, `set`, `delete`, `has`의 권한 거부 | Lua 오류 발생 | 해당 없음 |
| `only_if_absent`이고 키가 존재함 | `errors.ALREADY_EXISTS` | 아니오 |
| `if_version` 불일치 | `errors.CONFLICT` | 예 |
| 지원하지 않는 스토어에서 조건부 쓰기 | `errors.INVALID` | 아니오 |

에러 처리는 [에러 처리](../core/errors.md)를 참조하세요.
