# 로깅
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

debug, info, warn, error 레벨을 지원하는 구조화된 로깅입니다.

## 로딩

```lua
local logger = require("logger")
```

## 로그 레벨

### Debug

```lua
logger:debug("message", {key = "value"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `message` | string | 로그 메시지 |
| `fields` | table? | 컨텍스트 키-값 쌍 |

### Info

```lua
logger:info("message", {key = "value"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `message` | string | 로그 메시지 |
| `fields` | table? | 컨텍스트 키-값 쌍 |

### Warn

```lua
logger:warn("message", {key = "value"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `message` | string | 로그 메시지 |
| `fields` | table? | 컨텍스트 키-값 쌍 |

### Error

```lua
logger:error("message", {key = "value"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `message` | string | 로그 메시지 |
| `fields` | table? | 컨텍스트 키-값 쌍 |

## 로거 커스터마이징

### 필드 포함

영구 필드를 포함한 자식 로거를 생성합니다.

```lua
local child = logger:with({request_id = id})
child:info("message")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `fields` | table | 모든 로그에 첨부할 필드 |

**반환:** `Logger`

### 명명된 로거

명명된 자식 로거를 생성합니다.

```lua
local named = logger:named("auth")
named:info("message")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 로거 이름 |

**반환:** `Logger`

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 빈 이름 문자열 | `errors.INVALID` | 아니오 |

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.
