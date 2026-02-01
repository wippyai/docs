# 환경 변수
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

설정 값, 비밀, 런타임 설정을 위한 환경 변수에 접근합니다.

변수는 접근하기 전에 [환경 시스템](system-env.md)에서 정의되어야 합니다. 시스템은 어떤 스토리지 백엔드(OS, 파일, 메모리)가 값을 제공하고 변수가 읽기 전용인지 여부를 제어합니다.

## 로딩

```lua
local env = require("env")
```

## get

환경 변수 값을 가져옵니다.

```lua
-- 데이터베이스 연결 문자열 가져오기
local db_url = env.get("DATABASE_URL")
if not db_url then
    return nil, errors.new("INVALID", "DATABASE_URL not configured")
end

-- 기본값과 함께 가져오기
local port = env.get("PORT") or "8080"
local host = env.get("HOST") or "localhost"

-- 비밀 가져오기
local api_key = env.get("API_SECRET_KEY")
local jwt_secret = env.get("JWT_SECRET")

-- 설정
local log_level = env.get("LOG_LEVEL") or "info"
local debug_mode = env.get("DEBUG") == "true"
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 변수 이름 |

**반환:** `string, error`

변수가 존재하지 않으면 `nil, error` 반환.

## set

환경 변수를 설정합니다.

```lua
-- 런타임 설정
env.set("APP_MODE", "production")

-- 테스트용 오버라이드
env.set("API_URL", "http://localhost:8080")

-- 조건에 따라 설정
if is_development then
    env.set("LOG_LEVEL", "debug")
end
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `key` | string | 변수 이름 |
| `value` | string | 설정할 값 |

**반환:** `boolean, error`

## get_all

접근 가능한 모든 환경 변수를 가져옵니다.

```lua
local vars = env.get_all()

-- 설정 로깅 (비밀 로깅 주의)
for key, value in pairs(vars) do
    if not key:match("SECRET") and not key:match("KEY") then
        logger.debug("env", {[key] = value})
    end
end

-- 필수 변수 확인
local required = {"DATABASE_URL", "REDIS_URL", "API_KEY"}
for _, key in ipairs(required) do
    if not vars[key] then
        return nil, errors.new("INVALID", "Missing required env var: " .. key)
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
| `env.get_all` | `*` | 모든 변수 목록 |

### 접근 확인

```lua
local security = require("security")

if security.can("env.get", "DATABASE_URL") then
    local url = env.get("DATABASE_URL")
end
```

정책 설정은 [보안 모델](system-security.md)을 참조하세요.

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 빈 키 | `errors.INVALID` | 아니오 |
| 변수를 찾을 수 없음 | `errors.NOT_FOUND` | 아니오 |
| 권한 거부됨 | `errors.PERMISSION_DENIED` | 아니오 |

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.

## 참고

- [환경 시스템](system-env.md) - 스토리지 백엔드 및 변수 정의 설정
