# YAML 인코딩
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="encoding"/>

YAML 문서를 Lua 테이블로 파싱하고 Lua 값을 YAML 문자열로 직렬화합니다.

## 로딩

```lua
local yaml = require("yaml")
```

## 인코딩

### 값 인코딩

Lua 테이블을 YAML 형식으로 인코딩합니다.

```lua
-- 단순 키-값
local config = {
    name = "myapp",
    port = 8080,
    debug = true
}
local out = yaml.encode(config)
-- name: myapp
-- port: 8080
-- debug: true

-- 배열은 YAML 리스트가 됨
local items = {"apple", "banana", "cherry"}
yaml.encode(items)
-- - apple
-- - banana
-- - cherry

-- 중첩 구조
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
-- 출력 필드 순서 제어
local entry = {
    zebra = 1,
    alpha = 2,
    name = "test",
    kind = "demo"
}

-- 지정된 순서로 필드 출력, 나머지는 알파벳순 정렬
local result = yaml.encode(entry, {
    field_order = {"name", "kind"},
    sort_unordered = true
})
-- name: test
-- kind: demo
-- alpha: 2
-- zebra: 1

-- 모든 필드를 알파벳순 정렬
yaml.encode(entry, {sort_unordered = true})
-- alpha: 2
-- kind: demo
-- name: test
-- zebra: 1
```

**반환:** `string, error`

## 디코딩

### 문자열 디코딩

YAML 문자열을 Lua 테이블로 파싱합니다.

```lua
-- 설정 파싱
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

-- 파일 내용에서 파싱
local content = fs.read("config.yaml")
local settings, err = yaml.decode(content)
if err then
    return nil, errors.wrap(err, "invalid config file")
end

-- 혼합 타입 처리
local data = yaml.decode([[
name: test
count: 42
ratio: 3.14
enabled: true
tags:
  - lua
  - wippy
]])
print(type(data.count))    -- "number"
print(type(data.enabled))  -- "boolean"
print(type(data.tags))     -- "table"
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | string | 파싱할 YAML 문자열 |

**반환:** `any, error` - YAML 내용에 따라 table, array, string, number 또는 boolean 반환

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 입력이 테이블이 아님 (인코딩) | `errors.INVALID` | 아니오 |
| 입력이 문자열이 아님 (디코딩) | `errors.INVALID` | 아니오 |
| 빈 문자열 (디코딩) | `errors.INVALID` | 아니오 |
| 잘못된 YAML 구문 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](lua-errors.md)를 참조하세요.
