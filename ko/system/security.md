# 보안 모델

Wippy는 속성 기반 접근 제어를 구현합니다. 모든 요청은 액터(누가)와 스코프(어떤 정책이 적용되는지)를 전달합니다. 정책은 액션, 리소스, 액터와 리소스의 메타데이터를 기반으로 접근을 평가합니다.

```
Actor + Scope ──► Policy Evaluation ──► Allow/Deny
     │                   │
  Identity          Conditions
  Metadata      (actor, resource, action)
```

## 엔트리 종류

| Kind | 설명 |
|------|-------------|
| `security.policy` | 조건이 있는 선언적 정책 |
| `security.policy.expr` | 표현식 기반 정책 |
| `security.token_store` | 토큰 저장 및 검증 |

## 액터

액터는 액션을 수행하는 주체를 나타냅니다.

```lua
local security = require("security")

-- 메타데이터가 있는 액터 생성
local actor = security.new_actor("user:123", {
    role = "admin",
    team = "backend",
    department = "engineering",
    clearance = 3
})

-- 액터 속성 접근
local id = actor:id()        -- "user:123"
local meta = actor:meta()    -- {role="admin", ...}
```

### 컨텍스트의 액터

```lua
-- 컨텍스트에서 현재 액터 가져오기
local actor = security.actor()
if not actor then
    return nil, errors.new("UNAUTHORIZED", "No actor in context")
end
```

## 정책

정책은 액션, 리소스, 조건, 효과로 접근 규칙을 정의합니다.

### 선언적 정책

```yaml
# src/security/_index.yaml
version: "1.0"
namespace: app.security

entries:
  # 관리자 전체 접근
  - name: admin_policy
    kind: security.policy
    policy:
      actions: "*"
      resources: "*"
      effect: allow
      conditions:
        - field: actor.meta.role
          operator: eq
          value: admin
    groups:
      - admin

  # 읽기 전용 접근
  - name: readonly_policy
    kind: security.policy
    policy:
      actions:
        - "*.read"
        - "*.get"
        - "*.list"
      resources: "*"
      effect: allow
    groups:
      - default

  # 리소스 소유자 접근
  - name: owner_policy
    kind: security.policy
    policy:
      actions:
        - read
        - write
        - delete
      resources: "document:*"
      effect: allow
      conditions:
        - field: meta.owner
          operator: eq
          value_from: actor.id
    groups:
      - default

  # 클리어런스 없이 기밀 거부
  - name: deny_confidential
    kind: security.policy
    policy:
      actions: "*"
      resources: "document:*"
      effect: deny
      conditions:
        - field: meta.classification
          operator: eq
          value: confidential
        - field: actor.meta.clearance
          operator: lt
          value: 3
    groups:
      - security
```

### 정책 구조

```yaml
policy:
  actions: "*" | "action" | ["action1", "action2"]
  resources: "*" | "resource" | ["res1", "res2"]
  effect: allow | deny
  conditions:  # 선택적
    - field: "field.path"
      operator: "eq"
      value: "static_value"
      # 또는
      value_from: "other.field.path"
```

### 표현식 기반 정책

복잡한 로직의 경우 표현식 정책을 사용하세요:

```yaml
- name: flexible_access
  kind: security.policy.expr
  policy:
    actions:
      - read
      - write
    resources: "file:*"
    effect: allow
    expression: |
      (actor.meta.role == "editor" && action == "write") ||
      (action == "read" && meta.public == true) ||
      actor.id == meta.owner
  groups:
    - editors
```

## 조건

조건은 액터, 액션, 리소스, 메타데이터를 기반으로 동적 정책 평가를 허용합니다.

### 필드 경로

| 경로 | 설명 |
|------|-------------|
| `actor.id` | 액터의 고유 식별자 |
| `actor.meta.*` | 액터 메타데이터 (중첩 지원) |
| `action` | 수행 중인 액션 |
| `resource` | 리소스 식별자 |
| `meta.*` | 리소스 메타데이터 |

### 연산자

| 연산자 | 설명 | 예제 |
|----------|-------------|---------|
| `eq` | 같음 | `actor.meta.role eq "admin"` |
| `ne` | 같지 않음 | `meta.status ne "deleted"` |
| `lt` | 미만 | `meta.priority lt 5` |
| `gt` | 초과 | `actor.meta.clearance gt 2` |
| `lte` | 이하 | `meta.size lte 1000` |
| `gte` | 이상 | `actor.meta.level gte 3` |
| `in` | 배열에 값 포함 | `action in ["read", "write"]` |
| `nin` | 배열에 값 미포함 | `meta.status nin ["deleted", "archived"]` |
| `exists` | 필드 존재 | `meta.owner exists true` |
| `nexists` | 필드 부재 | `meta.deleted nexists true` |
| `contains` | 문자열 포함 | `resource contains "sensitive"` |
| `ncontains` | 문자열 미포함 | `resource ncontains "public"` |
| `matches` | 정규식 일치 | `resource matches "^doc:.*"` |
| `nmatches` | 정규식 불일치 | `actor.id nmatches "^system:.*"` |

### 조건 예제

```yaml
# 액터 역할 일치
conditions:
  - field: actor.meta.role
    operator: eq
    value: admin

# 필드 비교
conditions:
  - field: meta.owner
    operator: eq
    value_from: actor.id

# 숫자 비교
conditions:
  - field: actor.meta.clearance
    operator: gte
    value: 3

# 배열 멤버십
conditions:
  - field: actor.meta.role
    operator: in
    value:
      - admin
      - moderator

# 패턴 매칭
conditions:
  - field: resource
    operator: matches
    value: "^api:/v[0-9]+/admin/.*"

# 다중 조건 (AND)
conditions:
  - field: actor.meta.department
    operator: eq
    value: engineering
  - field: meta.environment
    operator: eq
    value: production
```

## 스코프

스코프는 여러 정책을 보안 컨텍스트로 결합합니다.

```lua
local security = require("security")

-- 정책 가져오기
local admin_policy = security.policy("app.security:admin_policy")
local readonly_policy = security.policy("app.security:readonly_policy")

-- 정책으로 스코프 생성
local scope = security.new_scope()
scope = scope:with(admin_policy)
scope = scope:with(readonly_policy)

-- 스코프는 불변 - :with()는 새 스코프 반환
```

### 명명된 스코프 (정책 그룹)

그룹의 모든 정책 로드:

```lua
-- 그룹의 모든 정책으로 스코프 로드
local scope, err = security.named_scope("app.security:admin")
```

정책은 `groups` 필드를 통해 그룹에 할당됩니다:

```yaml
- name: admin_policy
  kind: security.policy
  policy:
    # ...
  groups:
    - admin      # 이 정책은 "admin" 그룹에 있음
    - default    # 여러 그룹에 있을 수 있음
```

### 스코프 작업

```lua
-- 정책 추가
local new_scope = scope:with(policy)

-- 정책 제거
local new_scope = scope:without("app.security:temp_policy")

-- 정책이 스코프에 있는지 확인
local has = scope:contains("app.security:admin_policy")

-- 모든 정책 가져오기
local policies = scope:policies()
```

## 정책 평가

### 평가 흐름

```
1. 스코프의 각 정책 확인
2. 어떤 정책이라도 Deny 반환 → 결과는 Deny
3. 최소 하나의 Allow이고 Deny 없음 → 결과는 Allow
4. 해당 정책 없음 → 결과는 Undefined
```

### 평가 결과

| 결과 | 의미 |
|--------|---------|
| `allow` | 접근 허용 |
| `deny` | 접근 명시적 거부 |
| `undefined` | 일치하는 정책 없음 |

```lua
-- 직접 평가
local result = scope:evaluate(actor, "read", "document:123", {
    owner = "user:456",
    classification = "internal"
})

if result == "deny" then
    return nil, errors.new("FORBIDDEN", "Access denied")
elseif result == "undefined" then
    -- 일치하는 정책 없음 - 엄격 모드에 따라 다름
end
```

### 빠른 권한 확인

```lua
-- 현재 컨텍스트의 액터와 스코프에 대해 확인
local allowed = security.can("read", "document:123", {
    owner = "user:456"
})

if not allowed then
    return nil, errors.new("FORBIDDEN", "Access denied")
end
```

## 토큰 스토어

토큰 스토어는 안전한 토큰 생성, 검증, 취소를 제공합니다.

### 설정

```yaml
# src/auth/_index.yaml
version: "1.0"
namespace: app.auth

entries:
  # 환경 변수 등록
  - name: os_env
    kind: env.storage.os

  - name: AUTH_SECRET_KEY
    kind: env.variable
    variable: AUTH_SECRET_KEY
    storage: app.auth:os_env

  # 토큰용 백킹 스토어
  - name: token_data
    kind: store.memory
    lifecycle:
      auto_start: true

  # 토큰 스토어
  - name: tokens
    kind: security.token_store
    store: app.auth:token_data
    token_length: 32
    default_expiration: "24h"
    token_key_env: "AUTH_SECRET_KEY"
```

### 토큰 스토어 옵션

| 옵션 | 기본값 | 설명 |
|--------|---------|-------------|
| `store` | 필수 | 백킹 키-값 스토어 참조 |
| `token_length` | 32 | 토큰 크기 (바이트, 256비트) |
| `default_expiration` | 24h | 기본 토큰 TTL |
| `token_key` | 없음 | HMAC-SHA256 서명 키 (직접 값) |
| `token_key_env` | 없음 | 서명 키용 환경 변수 이름 |

프로덕션에서는 `token_key_env`를 사용하여 엔트리에 시크릿을 포함시키지 마세요. 환경 변수 등록은 [환경 시스템](system-env.md)을 참조하세요.

### 토큰 생성

```lua
local security = require("security")

-- 토큰 스토어 가져오기
local store, err = security.token_store("app.auth:tokens")
if err then
    return nil, err
end

-- 액터와 스코프 생성
local actor = security.new_actor("user:123", {
    role = "user",
    email = "user@example.com"
})

local scope, _ = security.named_scope("app.security:default")

-- 토큰 생성
local token, err = store:create(actor, scope, {
    expiration = "7d",  -- 기본 만료 오버라이드
    meta = {
        device = "mobile",
        ip = "192.168.1.1"
    }
})

if err then
    return nil, err
end

-- 토큰 형식: base64_token.hmac_signature (token_key가 설정된 경우)
-- 예: "dGVzdHRva2VuMTIz.a1b2c3d4e5f6"
```

### 토큰 검증

```lua
-- 토큰 검증
local actor, scope, err = store:validate(token)
if err then
    return nil, errors.new("UNAUTHORIZED", "Invalid token")
end

-- 액터와 스코프가 저장된 데이터에서 재구성됨
print(actor:id())  -- "user:123"
```

### 토큰 취소

```lua
-- 단일 토큰 취소
local ok, err = store:revoke(token)

-- 완료 시 스토어 닫기
store:close()
```

## 컨텍스트 흐름

보안 컨텍스트는 함수 호출을 통해 전파됩니다.

### 컨텍스트 설정

```lua
local funcs = require("funcs")

-- 보안 컨텍스트로 함수 호출
local result, err = funcs.new()
    :with_actor(actor)
    :with_scope(scope)
    :call("app.api:protected_endpoint", data)
```

### 컨텍스트 상속

| 컴포넌트 | 상속 |
|-----------|----------|
| 액터 | 예 - 자식 호출로 전달 |
| 스코프 | 예 - 자식 호출로 전달 |
| 엄격 모드 | 아니오 - 애플리케이션 전체 |

함수는 호출자의 보안 컨텍스트를 상속합니다. 스폰된 프로세스는 새로 시작합니다.

## 서비스 레벨 보안

서비스에 대한 기본 보안 설정:

```yaml
- name: worker_service
  kind: process.lua
  source: file://worker.lua
  lifecycle:
    auto_start: true
    security:
      actor:
        id: "service:worker"
        meta:
          role: worker
          service: true
      policies:
        - app.security:worker_policy
      groups:
        - workers
```

## 엄격 모드

보안 컨텍스트가 없을 때 접근을 거부하려면 엄격 모드를 활성화하세요:

```yaml
# wippy.yaml
security:
  strict_mode: true
```

| 모드 | 컨텍스트 없음 | 동작 |
|------|-----------------|----------|
| 일반 | 액터/스코프 없음 | 허용 (관대) |
| 엄격 | 액터/스코프 없음 | 거부 (보안 기본값) |

## 인증 흐름

HTTP 핸들러에서 토큰 검증:

```lua
local http = require("http")
local security = require("security")

local function protected_handler()
    local req = http.request()
    local res = http.response()

    -- 토큰 추출 및 검증
    local auth = req:header("Authorization")
    if not auth then
        return res:set_status(401):write_json({error = "Missing authorization"})
    end

    local token = auth:gsub("^Bearer%s+", "")
    local store, _ = security.token_store("app.auth:tokens")
    local actor, scope, err = store:validate(token)
    if err then
        return res:set_status(401):write_json({error = "Invalid token"})
    end

    -- 권한 확인
    if not security.can("api.users.read", "users") then
        return res:set_status(403):write_json({error = "Forbidden"})
    end

    res:write_json({user = actor:id()})
end

return { handler = protected_handler }
```

로그인 시 토큰 생성:

```lua
local actor = security.new_actor("user:" .. user.id, {role = user.role})
local scope, _ = security.named_scope("app.security:" .. user.role)

local store, _ = security.token_store("app.auth:tokens")
local token, err = store:create(actor, scope, {expiration = "24h"})
```

## 모범 사례

1. **최소 권한** - 필요한 최소 권한만 부여
2. **기본 거부** - 명시적 허용 정책 사용, 엄격 모드 활성화
3. **정책 그룹 사용** - 역할/기능별로 정책 구성
4. **토큰 서명** - 프로덕션에서 항상 `token_key_env` 설정
5. **짧은 만료** - 민감한 작업에 더 짧은 토큰 수명 사용
6. **컨텍스트 조건** - 정적 정책보다 동적 조건 사용
7. **민감한 액션 감사** - 보안 관련 작업 로깅

## 보안 모듈 참조

| 함수 | 설명 |
|----------|-------------|
| `security.actor()` | 컨텍스트에서 현재 액터 가져오기 |
| `security.scope()` | 컨텍스트에서 현재 스코프 가져오기 |
| `security.can(action, resource, meta?)` | 권한 확인 |
| `security.new_actor(id, meta?)` | 새 액터 생성 |
| `security.new_scope(policies?)` | 빈 또는 시드된 스코프 생성 |
| `security.policy(id)` | ID로 정책 가져오기 |
| `security.named_scope(group_id)` | 모든 그룹 정책으로 스코프 가져오기 |
| `security.token_store(id)` | 토큰 스토어 가져오기 |
