---
title: "YAML 인코딩"
description: "Lua table을 YAML로 encode하고 YAML document를 Lua value로 decode합니다."
---

# YAML 인코딩
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

`yaml` 모듈은 Lua table을 YAML로 serialize하고 YAML document를 Lua value로 parse합니다.

이 페이지는 API reference입니다. 출력 전용 expression은 성공한 encoding을 보여 주며 value를 사용하는 example은 optional second `error` return을 capture합니다.

## 로딩

```lua
local yaml = require("yaml")
```

require하기 전에 executable entry의 `modules:` list에 `yaml`을 추가하십시오.

## 인코딩

### `encode`

Lua 테이블을 YAML 형식으로 인코딩합니다.

```lua
-- Simple key-value
local config = {
    name = "myapp",
    port = 8080,
    debug = true
}
local out, err = yaml.encode(config)
if err then return nil, err end
-- YAML mapping containing name, port, and debug.

-- Arrays become YAML lists
local items = {"apple", "banana", "cherry"}
yaml.encode(items)
-- - apple
-- - banana
-- - cherry

-- Nested structures
local server = {
    http = {
        address = ":8080",
        timeout = "30s"
    },
    database = {
        host = "localhost",
        port = 5432
    }
}
yaml.encode(server)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | table | 인코딩할 Lua 테이블 |
| `options` | table? | 선택적 인코딩 옵션 |

#### 옵션

| 필드 | 타입 | 설명 |
|------|------|------|
| `field_order` | string[] | 커스텀 필드 순서 - 이 순서대로 필드 출력 |
| `sort_unordered` | boolean | `field_order`에 없는 필드를 알파벳순 정렬 |

```lua
-- Control field order in output
local entry = {
    zebra = 1,
    alpha = 2,
    name = "test",
    kind = "demo"
}

-- Fields appear in specified order, remaining sorted alphabetically
local result, encode_err = yaml.encode(entry, {
    field_order = {"name", "kind"},
    sort_unordered = true
})
if encode_err then return nil, encode_err end
-- name: test
-- kind: demo
-- alpha: 2
-- zebra: 1

-- Just sort all fields alphabetically
yaml.encode(entry, {sort_unordered = true})
-- alpha: 2
-- kind: demo
-- name: test
-- zebra: 1
```

**반환:** `string, error`

## 디코딩

### `decode`

YAML 문자열을 Lua 테이블로 파싱합니다.

```lua
-- Parse configuration
local config, err = yaml.decode([[
server:
  host: localhost
  port: 8080
features:
  - auth
  - logging
  - metrics
]])
if err then
    return nil, err
end

print(config.server.host)     -- "localhost"
print(config.server.port)     -- 8080
print(config.features[1])     -- "auth"

-- Parse from file content
local fs = require("fs")
local config_fs = assert(fs.get("app:config"))
local content = assert(config_fs:readfile("config.yaml"))
local settings, err = yaml.decode(content)
if err then
    return nil, errors.wrap(err, "invalid config file")
end

-- Handle mixed types
local data, data_err = yaml.decode([[
name: test
count: 42
ratio: 3.14
enabled: true
tags:
  - lua
  - wippy
]])
if data_err then return nil, data_err end
print(type(data.count))    -- "number"
print(type(data.enabled))  -- "boolean"
print(type(data.tags))     -- "table"
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 파싱할 YAML 문자열 |

**반환:** `any, error` - value type은 YAML content에 따라 달라집니다.

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 입력이 테이블이 아님 (인코딩) | `errors.INVALID` | 아니오 |
| 입력이 문자열이 아님 (디코딩) | `errors.INVALID` | 아니오 |
| 빈 문자열 (디코딩) | `errors.INVALID` | 아니오 |
| 잘못된 YAML 구문 | `errors.INTERNAL` | 아니오 |

[에러 처리](../core/errors.md)에서 error 사용법을 확인하십시오.
