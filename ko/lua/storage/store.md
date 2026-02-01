# 키-값 스토어
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

TTL 지원이 있는 빠른 키-값 스토리지. 캐싱, 세션, 임시 상태에 이상적입니다.

스토어 설정은 [스토어](system-store.md)를 참조하세요.

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

## 스토어 메서드

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `get(key)` | `any, error` | 키로 값 조회 |
| `set(key, value, ttl?)` | `boolean, error` | 선택적 TTL과 함께 값 저장 |
| `has(key)` | `boolean, error` | 키 존재 확인 |
| `delete(key)` | `boolean, error` | 키 제거 |
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

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 빈 리소스 ID | `errors.INVALID` | 아니오 |
| 리소스를 찾을 수 없음 | `errors.NOT_FOUND` | 아니오 |
| 스토어 해제됨 | `errors.INVALID` | 아니오 |
| 권한 거부됨 | `errors.PERMISSION_DENIED` | 아니오 |

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.
