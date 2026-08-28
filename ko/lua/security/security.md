---
title: "보안 및 접근 제어"
description: "현재 액터와 스코프를 확인하고, 정책을 평가하며, 인증 토큰을 관리합니다."
---

# 보안 및 접근 제어
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

`security` 모듈은 인증 액터, 권한 부여 스코프, 정책, 토큰 스토어를 제공합니다. 이 페이지는 부분적인 권한 부여 레시피를 포함한 API 참조입니다. 레지스트리 ID, 액터, 요청 메타데이터, 토큰 값, `user` 및 `doc` 같은 애플리케이션 객체, `show_admin_features` 같은 콜백은 주변 애플리케이션에서 제공되며, 예제만으로 완전한 인증 배포가 구성되지는 않습니다.

Wippy는 기본적으로 엄격한 보안 모드에서 실행됩니다. 실행 엔트리는 `security`를 활성화하고 액터와 스코프를 가지며 호출하는 정확한 작업을 허가해야 합니다. 특히 생성 및 스코프 변경에는 `security.actor.create` 또는 `security.scope.create`, 레지스트리 조회에는 `security.policy.get` 또는 `security.policy_group.get`, 토큰 작업에는 `security.token_store.get`과 작업별 토큰 권한이 필요합니다. `new_actor`, `new_scope`, `scope:with`, `scope:without`, 권한이 거부된 `token_store` 획득은 구조화된 `error`를 반환하지 않고 Lua 오류를 발생시킵니다. 거부 후 복구하려 하지 말고 엔트리의 보안 컨텍스트에서 이러한 사전 요구 사항을 허가하세요. 구성 방법은 [보안 모델](system/security.md)을 참조하세요.

## 로딩

```lua
local security = require("security")
```

## `actor`

실행 컨텍스트에서 현재 보안 액터를 반환합니다.

```lua
local actor = security.actor()
if actor then
    local id = actor:id()
    local meta = actor:meta()
    -- Use only the fields required for authorization or application logic.
    local role = meta.role
end
```

액터 메타데이터에는 식별자나 개인 데이터가 포함될 수 있습니다. 전체 메타데이터 테이블을 기록하거나 비밀 값을 저장하지 마세요.

**반환:** `Actor|nil`

## `scope`

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

## `can`

현재 컨텍스트가 리소스에 대한 액션을 허용하는지 확인합니다.

```lua
-- Check read permission
if not security.can("read", "user:" .. user_id) then
    return nil, errors.new({
        message = "Cannot read user data",
        kind = errors.PERMISSION_DENIED
    })
end

-- Check write permission
if not security.can("write", "order:" .. order_id) then
    return nil, errors.new({
        message = "Cannot modify order",
        kind = errors.PERMISSION_DENIED
    })
end

-- Check with metadata
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

## `new_actor`

ID와 메타데이터로 새 액터를 생성합니다.

```lua
-- Create user actor
local actor = security.new_actor("user:" .. user.id, {
    role = user.role,
    department = user.department,
    email = user.email
})

-- Create service actor
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

## `new_scope`

새 커스텀 스코프를 생성합니다.

```lua
-- Empty scope
local scope = security.new_scope()

-- Scope with policies
local read_policy, read_err = security.policy("app:read-only")
if read_err then
    return nil, read_err
end
local scope = security.new_scope({read_policy})

-- Build scope incrementally
local scope = security.new_scope()
local policy1, policy1_err = security.policy("app:read")
if policy1_err then
    return nil, policy1_err
end
local policy2, policy2_err = security.policy("app:write")
if policy2_err then
    return nil, policy2_err
end
scope = scope:with(policy1):with(policy2)
```

위의 각 대안은 서로 독립적인 생성 패턴입니다. 컨텍스트가 없거나 권한이 거부되면 `new_scope`와 `scope:with`는 오류를 발생시키며, 이러한 검사에서 `nil, error`를 반환하지 않습니다.

**반환:** `Scope`

## `policy`

레지스트리에서 정책을 가져옵니다.

```lua
local policy, err = security.policy("app:admin-access")
if err then
    return nil, err
end

-- Evaluate policy
local result = policy:evaluate(actor, "delete", "user:123")
if result == "allow" then
    -- permitted
elseif result == "deny" then
    -- forbidden
else
    -- undefined, check other policies
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 정책 ID "namespace:name" |

**반환:** `Policy, error`

## `named_scope`

미리 정의된 정책 그룹을 가져옵니다.

```lua
-- Get admin scope
local admin_scope, err = security.named_scope("app:admin")
if err then
    return nil, err
end

-- Use for elevated operations
local result = admin_scope:evaluate(actor, "delete", "user:123")
```

스코프를 로드해도 현재 실행 컨텍스트의 권한이 상승하지는 않습니다. 명시적 평가나 스코프를 받는 API에 사용할 값을 생성할 뿐이며, 호출자는 보호된 작업을 수행할 권한을 여전히 갖추어야 합니다.

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 정책 그룹 ID |

**반환:** `Scope, error`

## `token_store`

인증 토큰 관리를 위한 토큰 스토어를 획득합니다.

```lua
local store, err = security.token_store("app:tokens")
if err then
    return nil, err
end

-- Use store...
return store:close()
```

획득한 토큰 스토어는 `close()`를 호출할 때까지 호출자가 소유합니다. 검사된 모든 성공 및 오류 경로에서 마지막 작업 후 닫으세요. 반복해서 닫아도 안전합니다. 획득 중 권한 거부는 Lua 오류를 발생시키지만, 조회 및 리소스 실패는 `nil, error`를 반환합니다.

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 토큰 스토어 ID "namespace:name" |

**반환:** `TokenStore, error`

## `Actor` 메서드

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `actor:id()` | string | 액터 식별자 |
| `actor:meta()` | table | 액터 메타데이터 |

## `Scope` 메서드

### `with` / `without`

스코프에서 정책을 추가하거나 제거합니다.

```lua
local scope = security.new_scope()

-- Add policy
local write_policy, err = security.policy("app:write")
if err then
    return nil, err
end
scope = scope:with(write_policy)

-- Remove policy
scope = scope:without("app:read-only")
```

`with`와 `without`은 새로운 불변 스코프 값을 반환하며, `with` 또는 `without` 리소스에 `security.scope.create`가 허용되지 않으면 오류를 발생시킵니다.

### `evaluate`

스코프 내 모든 정책을 평가합니다.

```lua
local result = scope:evaluate(actor, "read", "document:123")
-- "allow", "deny", or "undefined"

if result ~= "allow" then
    return nil, errors.new({
        message = "Access denied",
        kind = errors.PERMISSION_DENIED
    })
end
```

### `contains`

스코프에 정책이 포함되어 있는지 확인합니다.

```lua
if scope:contains("app:admin") then
    show_admin_features()
end
```

### `policies`

스코프 내 모든 정책을 반환합니다.

```lua
local policies = scope:policies()
for _, policy in ipairs(policies) do
    print(policy:id())
end
```

**반환:** `Policy[]`

## `Policy` 메서드

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `policy:id()` | string | 정책 식별자 |
| `policy:evaluate(actor, action, resource, meta?)` | string | `"allow"`, `"deny"`, 또는 `"undefined"` |

## `TokenStore` 메서드

### `create`

인증 토큰을 생성합니다.

```lua
local actor = security.new_actor("user:123", {role = "user"})
local scope, scope_err = security.named_scope("app:default")
if scope_err then
    return nil, scope_err
end
local store, store_err = security.token_store("app:tokens")
if store_err then
    return nil, store_err
end

local token, err = store:create(actor, scope, {
    expiration = "24h",  -- or milliseconds
    meta = {
        login_ip = request_ip,
        user_agent = user_agent
    }
})
store:close()
if err then
    return nil, err
end
return token
```

`request_ip`와 `user_agent`는 애플리케이션이 제공하는 요청 값입니다. 보안 결정에 필요한 메타데이터만 저장하고 보존 한도를 적용하며, 반환된 베어러 토큰을 의도한 자격 증명 저장소 밖에 기록하거나 보관하지 마세요.

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `actor` | Actor | 토큰의 액터 |
| `scope` | Scope | 권한 스코프 |
| `options.expiration` | string/number | 기간 문자열 또는 ms |
| `options.meta` | table | 토큰 메타데이터 |

**반환:** `string, error`

### `validate`

토큰을 검증하고 actor/scope를 가져옵니다.

```lua
local actor, scope, err = store:validate(token)
store:close()
if err then
    return nil, err
end
```

여기와 아래에서 `store`는 소유 중인 활성 핸들이고 `token`은 호출자가 제공하는 신뢰할 수 없는 베어러 자격 증명입니다. 검증 또는 폐기 오류가 발생하더라도 토큰을 기록하지 마세요.

**반환:** `Actor, Scope, error`

### `revoke`

토큰을 무효화합니다.

```lua
local ok, err = store:revoke(token)
store:close()
if err then
    return nil, err
end
```

**반환:** `boolean, error`

### `close`

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
| `security.scope.create` | `custom` | `new_scope`으로 커스텀 스코프 생성 |
| `security.scope.create` | `with` | `scope:with`로 정책 추가 |
| `security.scope.create` | `without` | `scope:without`으로 정책 제거 |
| `security.actor.create` | 액터 ID | 액터 생성 |
| `security.token_store.get` | 스토어 ID | 토큰 스토어 접근 |
| `security.token.validate` | 스토어 ID | 토큰 검증 |
| `security.token.create` | 스토어 ID | 토큰 생성 |
| `security.token.revoke` | 스토어 ID | 토큰 폐기 |

정책 설정은 [보안 모델](system/security.md)을 참조하세요.

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 컨텍스트 없음 | `errors.INTERNAL` | 아니오 |
| 빈 토큰 스토어 ID | `errors.INVALID` | 아니오 |
| 정책, 명명된 스코프 또는 토큰 작업 권한 거부 | `errors.INVALID` | 아니오 |
| 액터/스코프 생성, 스코프 변경 또는 토큰 스토어 획득 거부 | Lua 오류 발생 | 아니오 |
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
store:close()
```

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.

## 참고

- [보안 모델](../../system/security.md) - 액터, 정책, 스코프 설정
- [HTTP 미들웨어](http/middleware.md) - 엔드포인트 및 리소스 방화벽
