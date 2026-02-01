# 동적 평가

샌드박스된 환경과 제어된 모듈 접근으로 런타임에 코드를 동적으로 실행합니다.

## 두 가지 시스템

Wippy는 두 가지 평가 시스템을 제공합니다:

| 시스템 | 목적 | 사용 사례 |
|--------|------|-----------|
| `expr` | 표현식 평가 | 설정, 템플릿, 간단한 계산 |
| `eval_runner` | 전체 Lua 실행 | 플러그인, 사용자 스크립트, 동적 코드 |

## expr 모듈

expr-lang 구문을 사용한 경량 표현식 평가.

```lua
local expr = require("expr")

local result, err = expr.eval("x + y * 2", {x = 10, y = 5})
-- result = 20
```

### 표현식 컴파일

한 번 컴파일하고 여러 번 실행:

```lua
local program, err = expr.compile("price * quantity")

local total1 = program:run({price = 10, quantity = 5})
local total2 = program:run({price = 20, quantity = 3})
```

### 지원되는 구문

```lua
-- 산술
expr.eval("1 + 2 * 3")           -- 7
expr.eval("10 / 2 - 1")          -- 4
expr.eval("10 % 3")              -- 1

-- 비교
expr.eval("x > 5", {x = 10})     -- true
expr.eval("x == y", {x = 1, y = 1}) -- true

-- 불리언
expr.eval("a && b", {a = true, b = false})  -- false
expr.eval("a || b", {a = true, b = false})  -- true
expr.eval("!a", {a = false})     -- true

-- 삼항
expr.eval("x > 0 ? 'positive' : 'negative'", {x = 5})

-- 함수
expr.eval("max(1, 5, 3)")        -- 5
expr.eval("min(1, 5, 3)")        -- 1
expr.eval("len([1, 2, 3])")      -- 3

-- 배열
expr.eval("[1, 2, 3][0]")        -- 1

-- 문자열 연결
expr.eval("'hello' + ' ' + 'world'")
```

## eval_runner 모듈

보안 제어가 있는 전체 Lua 실행.

```lua
local runner = require("eval_runner")

local result, err = runner.run({
    source = [[
        local function double(x)
            return x * 2
        end
        return double(input)
    ]],
    args = {21}
})
-- result = 42
```

### 설정

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `source` | string | Lua 소스 코드 (필수) |
| `method` | string | 반환된 테이블에서 호출할 함수 |
| `args` | any[] | 함수에 전달할 인수 |
| `modules` | string[] | 허용된 내장 모듈 |
| `imports` | table | 임포트할 레지스트리 항목 |
| `context` | table | `ctx`로 사용 가능한 값 |
| `allow_classes` | string[] | 추가 모듈 클래스 |
| `custom_modules` | table | 모듈로 사용할 커스텀 테이블 |

### 모듈 접근

허용된 모듈 화이트리스트:

```lua
runner.run({
    source = [[
        local json = require("json")
        return json.encode({hello = "world"})
    ]],
    modules = {"json"}
})
```

목록에 없는 모듈은 require할 수 없습니다.

### 레지스트리 임포트

레지스트리에서 항목 임포트:

```lua
runner.run({
    source = [[
        local utils = require("utils")
        return utils.format(data)
    ]],
    imports = {
        utils = "app.lib:utilities"
    },
    args = {{key = "value"}}
})
```

### 커스텀 모듈

커스텀 테이블 주입:

```lua
runner.run({
    source = [[
        return sdk.version
    ]],
    custom_modules = {
        sdk = {version = "1.0.0", api_key = "xxx"}
    }
})
```

### 컨텍스트 값

`ctx`로 접근 가능한 데이터 전달:

```lua
runner.run({
    source = [[
        return "Hello, " .. ctx.user
    ]],
    context = {user = "Alice"}
})
```

### 프로그램 컴파일

반복 실행을 위해 한 번 컴파일:

```lua
local program, err = runner.compile([[
    local function process(x)
        return x * 2
    end
    return { process = process }
]], "process", {modules = {"json"}})

local result = program:run({10})  -- 20
```

## 보안 모델

### 모듈 클래스

모듈은 기능별로 분류됩니다:

| 클래스 | 설명 | 기본값 |
|--------|------|--------|
| `deterministic` | 순수 함수 | 허용 |
| `encoding` | 데이터 인코딩 | 허용 |
| `time` | 시간 연산 | 허용 |
| `nondeterministic` | 난수 등 | 허용 |
| `process` | 스폰, 레지스트리 | 차단 |
| `storage` | 파일, 데이터베이스 | 차단 |
| `network` | HTTP, 소켓 | 차단 |

### 차단된 클래스 활성화

```lua
runner.run({
    source = [[
        local http = require("http_client")
        return http.get("https://api.example.com")
    ]],
    modules = {"http_client"},
    allow_classes = {"network"}
})
```

### 권한 확인

시스템은 다음에 대한 권한을 확인합니다:

- `eval.compile` - 컴파일 전
- `eval.run` - 실행 전
- `eval.module` - 화이트리스트의 각 모듈
- `eval.import` - 각 레지스트리 임포트
- `eval.class` - 각 허용된 클래스

보안 정책에서 설정합니다.

## 에러 처리

```lua
local result, err = runner.run({...})
if err then
    if err:kind() == errors.PERMISSION_DENIED then
        -- 보안 정책에 의해 접근 거부됨
    elseif err:kind() == errors.INVALID then
        -- 잘못된 소스 또는 설정
    elseif err:kind() == errors.INTERNAL then
        -- 실행 또는 컴파일 에러
    end
end
```

## 사용 사례

### 플러그인 시스템

```lua
local plugins = registry.find({meta = {type = "plugin"}})

for _, plugin in ipairs(plugins) do
    local source = plugin:data().source
    runner.run({
        source = source,
        method = "init",
        modules = {"json", "time"},
        context = {config = app_config}
    })
end
```

### 템플릿 평가

```lua
local template = "Hello, {{name}}! You have {{count}} messages."
local compiled = expr.compile("name")

-- 빠른 반복 평가
for _, user in ipairs(users) do
    local greeting = compiled:run({name = user.name})
end
```

### 사용자 스크립트

```lua
local user_code = request:body()

local result, err = runner.run({
    source = user_code,
    modules = {"json", "text"},  -- 안전한 모듈만
    context = {data = input_data}
})
```

## 참고

- [표현식](lua/dynamic/expression.md) - 표현식 언어 참조
- [실행](lua/dynamic/exec.md) - 시스템 명령 실행
- [보안](lua/security/security.md) - 보안 정책
