---
title: "로깅"
description: "structured log message를 작성하고 persistent context가 있는 child logger를 만듭니다."
---

# 로깅
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

`logger` 모듈은 debug, info, warn 및 error level에서 structured message를 작성합니다.

이 페이지는 API 레퍼런스입니다. 각 snippet은 독립적인 logging operation이며 원하는 logger 설정을 가진 execution context를 전제로 합니다.

log 호출은 값을 반환하지 않습니다. execution context에서 제공되는 경우 각 호출은 현재 frame에서 파생된 process `pid`와 source `location`도 추가합니다.

## 로딩

```lua
local logger = require("logger")
```

## 로그 레벨

### `logger:debug`

debug-level log message를 작성합니다.

```lua
logger:debug("message", {key = "value"})
```

### `logger:info`

info-level log message를 작성합니다.

```lua
logger:info("message", {key = "value"})
```

### `logger:warn`

warning-level log message를 작성합니다.

```lua
logger:warn("message", {key = "value"})
```

### `logger:error`

error-level log message를 작성합니다.

```lua
logger:error("message", {key = "value"})
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `message` | string | 로그 메시지 |
| `fields` | table? | 컨텍스트 키-값 쌍 |

네 가지 log-level method는 모두 같은 parameter를 받습니다.

string key만 field name이 됩니다. string, number, integer, boolean, error 및 structured Lua value는 log field로 변환되고 non-string key는 무시됩니다.

`logger:error`에서 이름이 `error`인 field는 error field로 emit되고 나머지 field를 처리하기 전에 제공된 table에서 제거됩니다. `error` entry를 그대로 유지해야 한다면 해당 table을 재사용하지 마십시오.

## 로거 커스터마이징

### `logger:with`

영구 필드를 포함한 자식 로거를 생성합니다.

```lua
local function request_logger(request_id)
    return logger:with({request_id = request_id})
end

request_logger("req-123"):info("message")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `fields` | table | 모든 로그에 첨부할 필드 |

**반환:** `Logger`

원본 logger는 변경되지 않습니다. child logger는 추가 `with` 및 `named` 호출로 chain할 수 있습니다.

### `logger:named`

명명된 자식 로거를 생성합니다.

```lua
local named = logger:named("auth")
named:info("message")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 로거 이름 |

**반환:** `Logger`

빈 name은 Lua argument error를 raise합니다. structured `errors.INVALID` 값으로 반환되지 않습니다.

logging method는 structured error를 반환하지 않습니다. invalid argument type은 Lua argument error를 raise합니다. execution context에 logger가 연결되지 않았으면 module은 no-op logger를 사용하고 message를 discard합니다.
