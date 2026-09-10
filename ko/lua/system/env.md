---
title: "환경 변수"
description: "설정 값, 비밀, 런타임 설정을 위한 환경 변수에 접근합니다."
---

# 환경 변수
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

`env` 모듈은 runtime이 노출하는 environment variable을 읽고 업데이트합니다.

이 페이지는 API reference입니다. snippet은 독립된 operation이며 이름이 지정된 variable과 security policy가 이미 존재한다고 가정합니다.

variable은 접근하기 전에 [환경 시스템](system/env.md)에서 정의해야 합니다. system은 value를 제공할 storage backend(OS, file, memory)와 variable의 read-only 여부를 제어합니다.

## 로딩

```lua
local env = require("env")
```

## `get`

환경 변수 값을 가져옵니다.

```lua
-- 데이터베이스 연결 문자열 가져오기
local db_url = env.get("DATABASE_URL")
if not db_url then
    return nil, errors.new({ kind = errors.INVALID, message = "DATABASE_URL not configured" })
end

local port, port_err = get_or("PORT", "8080")
if port_err then return nil, port_err end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 변수 이름 |

**반환:** `string, error`

변수가 존재하지 않으면 `nil, error` 반환.

## `set`

환경 변수를 설정합니다.

```lua
-- Set runtime configuration
local updated, set_err = env.set("APP_MODE", "production")
if set_err then return nil, set_err end
return updated
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 변수 이름 |
| `value` | string | 설정할 값 |

**반환:** `boolean, error`

## `get_all`

접근 가능한 모든 환경 변수를 가져옵니다.

```lua
local logger = require("logger")

local vars, vars_err = env.get_all()
if vars_err then return nil, vars_err end

-- Log names only. Values such as connection URLs may contain credentials even
-- when their keys do not include words like SECRET or KEY.
local accessible_keys = {}
for key in pairs(vars) do table.insert(accessible_keys, key) end
logger:debug("accessible environment variables", {keys = accessible_keys})

-- Check required variables
local required = {"DATABASE_URL", "REDIS_URL", "API_KEY"}
for _, key in ipairs(required) do
    if not vars[key] then
        return nil, errors.new({ kind = errors.INVALID, message = "Missing required env var: " .. key })
    end
end
```

**반환:** `table, error`

## 권한

환경 접근은 보안 정책 평가 대상입니다.

### 보안 액션

| 액션 | 리소스 | 설명 |
|------|--------|------|
| `env.get` | 변수 이름 | 환경 변수 읽기 |
| `env.set` | 변수 이름 | 환경 변수 쓰기 |

`get_all`에는 전용 보안 액션이 없습니다. 각 변수 이름을 `env.get`으로 필터링하여 `env.get` 액션이 허용된 변수만 반환합니다.

### 접근 확인

```lua
local security = require("security")

if security.can("env.get", "DATABASE_URL") then
    local url = env.get("DATABASE_URL")
end
```

policy configuration은 [보안 모델](system/security.md)을 참조하십시오.

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 빈 키 | `errors.INVALID` | 아니오 |
| 변수를 찾을 수 없음 | `errors.NOT_FOUND` | 아니오 |
| 권한 거부됨 | `errors.PERMISSION_DENIED` | 아니오 |

[에러 처리](lua/core/errors.md)에서 error 사용법을 확인하십시오.

## 참고

- [환경 시스템](system/env.md) - storage backend와 variable definition 구성
