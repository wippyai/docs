# 보안 및 접근 제어
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

인증 액터, 권한 스코프, 접근 정책을 관리합니다.

## 로딩

```lua
local security = require("security")
```

## actor

실행 컨텍스트에서 현재 보안 액터를 반환합니다.

```lua
local actor = security.actor()
if actor then
    local id = actor:id()
    local meta = actor:meta()

    logger:info("Request from", {
        user_id = id,
        role = meta.role
    })
end
```

**반환:** `Actor|nil`

## scope

실행 컨텍스트에서 현재 보안 스코프를 반환합니다.

```lua
local scope = security.scope()
if scope then
    local policies = scope:policies()
    for _, policy in ipairs(policies) do
        print("Active policy:", policy:id())
    end
end
```

**반환:** `Scope|nil`

## can

현재 컨텍스트가 리소스에 대한 액션을 허용하는지 확인합니다.

```lua
-- 읽기 권한 확인
if not security.can("read", "user:" .. user_id) then
    return nil, errors.new("PERMISSION_DENIED", "Cannot read user data")
end

-- 쓰기 권한 확인
if not security.can("write", "order:" .. order_id) then
    return nil, errors.new("PERMISSION_DENIED", "Cannot modify order")
end

-- 메타데이터와 함께 확인
local allowed = security.can("delete", "document:" .. doc_id, {
    owner_id = doc.owner_id,
    department = doc.department
})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `action` | string | 확인할 액션 |
| `resource` | string | 리소스 식별자 |
| `meta` | table | 추가 메타데이터 (선택적) |

**반환:** `boolean`

## new_actor

ID와 메타데이터로 새 액터를 생성합니다.

```lua
-- 사용자 액터 생성
local actor = security.new_actor("user:" .. user.id, {
    role = user.role,
    department = user.department,
    email = user.email
})

-- 서비스 액터 생성
local service_actor = security.new_actor("service:payment-processor", {
    type = "service",
    version = "1.0.0"
})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 고유 액터 식별자 |
| `meta` | table | 메타데이터 키-값 쌍 |

**반환:** `Actor`

## new_scope

새 커스텀 스코프를 생성합니다.

```lua
-- 빈 스코프
local scope = security.new_scope()

-- 정책이 있는 스코프
local read_policy = security.policy("app:read-only")
local scope = security.new_scope({read_policy})

-- 점진적으로 스코프 구축
local scope = security.new_scope()
local policy1 = security.policy("app:read")
local policy2 = security.policy("app:write")
scope = scope:with(policy1):with(policy2)
```

**반환:** `Scope`

## policy

레지스트리에서 정책을 가져옵니다.

```lua
local policy, err = security.policy("app:admin-access")
if err then
    return nil, err
end

-- 정책 평가
local result = policy:evaluate(actor, "delete", "user:123")
if result == "allow" then
    -- 허용됨
elseif result == "deny" then
    -- 거부됨
else
    -- 정의되지 않음, 다른 정책 확인
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 정책 ID "namespace:name" |

**반환:** `Policy, error`

## named_scope

미리 정의된 정책 그룹을 가져옵니다.

```lua
-- 관리자 스코프 가져오기
local admin_scope, err = security.named_scope("app:admin")
if err then
    return nil, err
end

-- 권한 상승 작업에 사용
local result = admin_scope:evaluate(actor, "delete", "user:123")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 정책 그룹 ID |

**반환:** `Scope, error`

## token_store

인증 토큰 관리를 위한 토큰 스토어를 획득합니다.

```lua
local store, err = security.token_store("app:tokens")
if err then
    return nil, err
end

-- 스토어 사용...
store:close()
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 토큰 스토어 ID "namespace:name" |

**반환:** `TokenStore, error`

## Actor 메서드

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `actor:id()` | string | 액터 식별자 |
| `actor:meta()` | table | 액터 메타데이터 |

## Scope 메서드

### with / without

스코프에서 정책을 추가하거나 제거합니다.

```lua
local scope = security.new_scope()

-- 정책 추가
local write_policy = security.policy("app:write")
scope = scope:with(write_policy)

-- 정책 제거
scope = scope:without("app:read-only")
```

### evaluate

스코프 내 모든 정책을 평가합니다.

```lua
local result = scope:evaluate(actor, "read", "document:123")
-- "allow", "deny", 또는 "undefined"

if result ~= "allow" then
    return nil, errors.new("PERMISSION_DENIED", "Access denied")
end
```

### contains

스코프에 정책이 포함되어 있는지 확인합니다.

```lua
if scope:contains("app:admin") then
    show_admin_features()
end
```

### policies

스코프 내 모든 정책을 반환합니다.

```lua
local policies = scope:policies()
for _, policy in ipairs(policies) do
    print(policy:id())
end
```

**반환:** `Policy[]`

## Policy 메서드

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `policy:id()` | string | 정책 식별자 |
| `policy:evaluate(actor, action, resource, meta?)` | string | `"allow"`, `"deny"`, 또는 `"undefined"` |

## TokenStore 메서드

### create

인증 토큰을 생성합니다.

```lua
local actor = security.new_actor("user:123", {role = "user"})
local scope = security.named_scope("app:default")

local token, err = store:create(actor, scope, {
    expiration = "24h",  -- 또는 밀리초
    meta = {
        login_ip = request_ip,
        user_agent = user_agent
    }
})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `actor` | Actor | 토큰의 액터 |
| `scope` | Scope | 권한 스코프 |
| `options.expiration` | string/number | 기간 문자열 또는 ms |
| `options.meta` | table | 토큰 메타데이터 |

**반환:** `string, error`

### validate

토큰을 검증하고 actor/scope를 가져옵니다.

```lua
local actor, scope, err = store:validate(token)
if err then
    return nil, errors.new("UNAUTHENTICATED", "Invalid token")
end
```

**반환:** `Actor, Scope, error`

### revoke

토큰을 무효화합니다.

```lua
local ok, err = store:revoke(token)
```

**반환:** `boolean, error`

### close

토큰 스토어 리소스를 해제합니다.

```lua
store:close()
```

**반환:** `boolean`

## 권한

보안 작업은 보안 정책 평가 대상입니다.

### 보안 액션

| 액션 | 리소스 | 설명 |
|------|--------|------|
| `security.policy.get` | 정책 ID | 정책 정의 접근 |
| `security.policy_group.get` | 그룹 ID | 명명된 스코프 접근 |
| `security.scope.create` | `custom` | 커스텀 스코프 생성 |
| `security.actor.create` | 액터 ID | 액터 생성 |
| `security.token_store.get` | 스토어 ID | 토큰 스토어 접근 |
| `security.token.validate` | 스토어 ID | 토큰 검증 |
| `security.token.create` | 스토어 ID | 토큰 생성 |
| `security.token.revoke` | 스토어 ID | 토큰 폐기 |

정책 설정은 [보안 모델](system-security.md)을 참조하세요.

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 컨텍스트 없음 | `errors.INTERNAL` | 아니오 |
| 빈 토큰 스토어 ID | `errors.INVALID` | 아니오 |
| 권한 거부됨 | `errors.INVALID` | 아니오 |
| 정책을 찾을 수 없음 | `errors.INTERNAL` | 아니오 |
| 토큰 스토어를 찾을 수 없음 | `errors.INTERNAL` | 아니오 |
| 토큰 스토어 닫힘 | `errors.INTERNAL` | 아니오 |
| 잘못된 만료 형식 | `errors.INVALID` | 아니오 |
| 토큰 검증 실패 | `errors.INTERNAL` | 아니오 |

```lua
local store, err = security.token_store("app:tokens")
if err then
    if errors.is(err, errors.INVALID) then
        print("Invalid request:", err:message())
    end
    return nil, err
end
```

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.

## 참고

- [보안 모델](system-security.md) - 액터, 정책, 스코프 설정
- [HTTP 미들웨어](http-middleware.md) - 엔드포인트 및 리소스 방화벽
