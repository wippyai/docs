---
title: "동적 평가"
description: "구성된 모듈 및 레지스트리 접근 권한으로 표현식을 평가하거나 기능이 제한된 Lua 코드를 실행합니다."
---

# 동적 평가

Wippy는 런타임에 제공된 코드를 위해 표현식 평가와 기능이 제한된 Lua 실행을 제공합니다. 이 페이지는 API 가이드입니다. 예제는 기존 Wippy Lua 프로세스 안에서 실행되며 호출자가 사용하는 모듈을 엔트리에 선언했다고 가정합니다. 레지스트리 ID, 정책, 애플리케이션 데이터는 주변 애플리케이션이 제공하는 자리표시자입니다.

`eval_runner`는 평가된 코드가 접근할 수 있는 Wippy 모듈을 제한하지만, 적대적 코드를 완전히 격리하지는 않습니다. 특히 `limits.max_steps`는 Lua 명령이 아니라 스케줄러 재개 횟수를 세므로, 양보하지 않는 무한 루프는 이 제한으로 중단되지 않습니다.

## 평가 시스템 선택

실행할 코드에 따라 평가 시스템을 선택하세요:

| 시스템 | 목적 | 사용 사례 |
|--------|------|-----------|
| `expr` | 표현식 평가 | 설정, 템플릿, 간단한 계산 |
| `eval_runner` | 기능이 제한된 Lua 실행 | 신뢰할 수 있는 플러그인과 제어된 동적 코드 |

## `expr`를 사용한 표현식 평가

`expr` 모듈은 expr-lang 문법으로 작성된 표현식을 평가합니다. 전체 Lua 프로그램이 아니라 표현식에 사용하세요. [표현식 언어](./expression.md)는 전체 Lua API 및 문법 레퍼런스입니다.

```lua
local expr = require("expr")

local result, err = expr.eval("x + y * 2", {x = 10, y = 5})
if err then
    return nil, err
end
-- result = 20
```

### 컴파일된 표현식 재사용

반복 평가할 표현식을 컴파일합니다:

```lua
local program, err = expr.compile("price * quantity")
if err then
    return nil, err
end

local total1, first_err = program:run({price = 10, quantity = 5})
if first_err then
    return nil, first_err
end

local total2, second_err = program:run({price = 20, quantity = 3})
if second_err then
    return nil, second_err
end
```

### 문법 요약

| 기능 | 표현식 | 결과 |
|------|--------|------|
| 산술 | `1 + 2 * 3` | `7` |
| 나머지 | `10 % 3` | `1` |
| 비교 | `{x = 10}`으로 `x > 5` | `true` |
| 불리언 | `{a = true, b = false}`로 `a && b` | `false` |
| 삼항 | `{x = 5}`로 `x > 0 ? 'positive' : 'negative'` | `"positive"` |
| 함수 | `max(1, 5, 3)` | `5` |
| 배열 인덱스 | `[1, 2, 3][0]` | `1` |
| 연결 | `'hello' + ' ' + 'world'` | `"hello world"` |

## `eval_runner`를 사용한 기능 제한 Lua

`eval_runner` 모듈은 구성된 모듈 및 레지스트리 접근 권한으로 Lua를 실행합니다.

```lua
local runner = require("eval_runner")

local result, err = runner.run({
    source = [[
        local function double(x)
            return x * 2
        end
        return { double = double }
    ]],
    method = "double",
    args = {21}
})
if err then
    return nil, err
end
-- result = 42
```

### 설정

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `source` | string | Lua 소스 코드(필수) |
| `method` | string | 반환된 테이블에서 호출할 함수 |
| `args` | any[] | 함수에 전달할 인수 |
| `modules` | string[] | 허용된 내장 모듈 |
| `imports` | table | 가져올 레지스트리 엔트리 |
| `context` | table | `ctx`로 사용할 수 있는 값 |
| `allow_classes` | string[] | 추가 모듈 클래스 |
| `custom_modules` | table | 모듈로 제공할 사용자 정의 테이블 |
| `limits` | table | 평가 실행 제한 |

`modules`가 생략되거나 비어 있으면 호스트는 클래스가 기본 필터를 통과하는 사용 가능한 모든 모듈을 제공합니다. 이 암시적 모드에서 `allow_classes`는 필터를 확장하므로 지정한 클래스의 모듈을 추가할 수 있습니다. 명시적 `modules` 목록이 있으면, 원래 클래스 때문에 제외될 모듈 중 목록에 있는 것만 허용합니다. 평가 프로그램의 기능이 호출부에 드러나도록 명시적이고 최소한인 목록을 사용하는 것이 좋습니다.

런타임 v0.3.32a에서 `eval.module` 정책 검사는 기본 필터가 암시적으로 선택한 모듈이 아니라 `modules`에 명시적으로 제공한 이름만 다룹니다. 암시적 기본 모듈을 제거하기 위해 `eval.module` 정책에 의존하지 말고 명시적 목록을 전달하세요.

### 단계 제한

`limits.max_steps`로 평가 중 스케줄러 재개 횟수를 제한합니다:

```lua
local result, err = runner.run({
    source = user_code,
    modules = {"json"},
    limits = {max_steps = 1000}
})
if err then
    return nil, err
end
```

`max_steps`는 음수가 아닌 정수여야 합니다. 생략하면 평가는 `lua.eval.max_steps`(기본값 `10000`)를 상속하며, 명시적 `0`은 제한을 제거합니다. 스케줄러가 재개될 때마다 한 단계가 소모되므로 모듈 호출의 yield도 예산을 소모합니다. 일반 Lua 루프 반복은 세지 않으므로 이 설정은 양보하지 않는 코드의 CPU 또는 명령 예산이 아닙니다.

알 수 없는 `limits` 필드, 테이블이 아닌 `limits` 값, 잘못된 `max_steps` 값은 재시도할 수 없는 `errors.INVALID`를 반환합니다.

### 모듈 접근

모듈 허용 목록을 제공합니다:

```lua
local encoded, err = runner.run({
    source = [[
        local json = require("json")
        return json.encode({hello = "world"})
    ]],
    modules = {"json"}
})
if err then
    return nil, err
end
```

명시적 목록이 있으면 목록 밖의 모듈은 require할 수 없습니다. 목록에 든 각 모듈에는 `eval.module` 권한도 필요합니다.

### 레지스트리 가져오기

레지스트리에서 엔트리를 가져옵니다:

```lua
local result, err = runner.run({
    source = [[
        local data = ...
        return utils.format(data)
    ]],
    imports = {
        utils = "app.lib:utilities"
    },
    args = {{key = "value"}}
})
if err then
    return nil, err
end
```

가져온 라이브러리는 값을 반환하는 소스 기반 레지스트리 라이브러리여야 합니다. 별칭(여기서는 `utils`)은 평가된 프로그램의 전역으로 바인딩됩니다. Wippy 모듈이 아니므로 `require()`가 필요하지 않습니다.

### 권한이 확장된 가져오기

가져온 라이브러리는 평가된 소스가 사용할 수 없는 모듈을 사용할 수 있습니다. `id`와 `modules`가 있는 테이블 형식을 사용하세요:

```lua
local quote, err = runner.run({
    source = [[
        return pricing.quote(...)
    ]],
    modules = {"json"},
    imports = {
        pricing = { id = "app.lib:pricing", modules = {"funcs"} }
    },
})
if err then
    return nil, err
end
```

`pricing` 라이브러리는 `funcs`를 사용할 수 있는 제한된 환경에서 실행되고, 평가된 소스는 `funcs`를 직접 require하거나 접근할 수 없습니다. 가져오기에 모듈을 부여하려면 호출자가 그 모듈에 대한 `eval.module` 권한을 가져야 하므로 호출자가 사용할 수 없는 모듈을 가져오기에 제공할 수 없습니다.

### 사용자 정의 모듈

사용자 정의 테이블을 모듈로 노출합니다:

```lua
local version, err = runner.run({
    source = [[
        return sdk.version
    ]],
    custom_modules = {
        sdk = {version = "1.0.0"}
    }
})
if err then
    return nil, err
end
```

사용자 정의 모듈 값은 평가된 코드에서 직접 접근할 수 있습니다. 해당 코드에 의도적으로 공개할 때가 아니면 이 테이블에 비밀이나 권한이 있는 핸들을 넣지 마세요.

### 컨텍스트 값

`ctx`를 통해 값을 전달합니다:

```lua
local greeting, err = runner.run({
    source = [[
        local user, ctx_err = ctx.get("user")
        if ctx_err then error(ctx_err) end
        return "Hello, " .. user
    ]],
    modules = {"ctx"},
    context = {user = "Alice"}
})
if err then
    return nil, err
end
```

### 프로그램 컴파일

`runner.compile`은 소스를 실행하지 않고 검증하며 진입점과 모듈을 보고합니다:

```lua
local program, err = runner.compile([[
    local function process(x)
        return x * 2
    end
    return { process = process }
]], "process", {modules = {"json"}})
if err then
    return nil, err
end

program:method()   -- "process"  (string)
program:modules()  -- {"json"}    (string[])
```

컴파일된 프로그램은 소스를 설명하지만 실행하지 않습니다. 프로그램을 실행하려면 소스와 메서드로 `runner.run`을 호출하세요.

## 기능 제어

### 모듈 클래스

모듈은 기능에 따라 분류됩니다:

| 클래스 | 설명 | 기본값 |
|--------|------|--------|
| `deterministic` | 순수 함수 | 허용 |
| `encoding` | 데이터 인코딩 | 허용 |
| `time` | 시간 연산 | 허용 |
| `nondeterministic` | 난수 등 | 허용 |
| `io` | 별도로 차단된 클래스가 없는 입출력 작업 | 허용 |
| `security` | 보안 도우미 | 허용 |
| `workflow` | 워크플로에 안전한 작업 | 허용 |
| `process` | 스폰, 레지스트리 | 차단 |
| `storage` | 파일, 데이터베이스 | 차단 |
| `network` | HTTP, 소켓 | 차단 |

"차단"은 호출자가 차단된 클래스를 `allow_classes`에 제공하고 해당 `eval.class` 리소스에 대한 권한을 받지 않는 한 차단된다는 뜻입니다. 한 모듈이 여러 클래스에 속할 수 있으므로 그 모듈이 가진 차단 클래스를 모두 나열하세요.

### 추가 클래스 허용

```lua
local status, err = runner.run({
    source = [[
        local http = require("http_client")
        local response, err = http.get("https://api.example.com")
        if err then error(err) end
        return response.status_code
    ]],
    modules = {"http_client"},
    allow_classes = {"network"}
})
if err then
    return nil, err
end
```

클래스 권한은 모듈을 eval 환경에 들이는 것만 허용합니다. 모듈 자체의 보안 검사와 외부 접근 제어도 계속 적용됩니다.

### 권한 검사

시스템은 다음 권한을 검사합니다:

- `eval.compile` - 컴파일 전
- `eval.run` - 실행 전
- `eval.module` - 허용 목록의 각 모듈과 권한이 확장된 가져오기에 부여된 각 모듈
- `eval.import` - 각 레지스트리 가져오기
- `eval.class` - 허용된 각 클래스

보안 정책에서 이 작업을 구성하세요.

## 컴파일된 프로그램 캐시

컴파일된 프로그램은 소스, 메서드, 모듈, 허용 클래스를 키로 하는 LRU에 캐시됩니다. 같은 코드를 반복 실행하면 컴파일을 건너뜁니다. 가져오기, 사용자 정의 모듈, 인수, 컨텍스트는 실행 시점에 바인딩되며 캐시 키에 영향을 주지 않습니다.

```yaml
# .wippy.yaml
lua:
  eval:
    cache_size: 256   # entries; 0 or less disables caching (default: 256)
    cache_ttl: 0      # expiry; 0 = no expiry (default: 0)
    max_steps: 10000  # inherited run limit; 0 = unlimited (default: 10000)
```

## 평가 오류 처리

```lua
local result, err = runner.run(run_config)
if err then
    if err:kind() == errors.PERMISSION_DENIED then
        -- Access denied by security policy
    elseif err:kind() == errors.INVALID then
        -- Missing source or invalid limits configuration
    elseif err:kind() == errors.INTERNAL then
        -- Syntax, compilation, import, or execution failure
    end
end
```

여기서 `run_config`는 주변 애플리케이션이 구성한 설정 테이블입니다.

## 사용 사례별 선택

### 플러그인

```lua
local plugins, find_err = registry.find({["meta.type"] = "plugin"})
if find_err then
    return nil, find_err
end

for _, plugin in ipairs(plugins) do
    local _, run_err = runner.run({
        source = plugin.data.source,
        method = "init",
        modules = {"json", "time"},
        context = {config = app_config}
    })
    if run_err then
        return nil, run_err
    end
end
```

이 부분 패턴은 호출자가 `registry`와 `eval_runner`를 로드했고, `app_config`가 정의되어 있으며, 일치하는 레지스트리 엔트리가 Lua 소스를 `data.source`에 저장한다고 가정합니다. `registry.find`는 엔트리 테이블을 반환하므로 엔트리 메서드가 아니라 `plugin.data`로 필드를 읽습니다.

### 반복 규칙

```lua
local compiled, compile_err = expr.compile("score >= minimum")
if compile_err then
    return nil, compile_err
end

for _, candidate in ipairs(candidates) do
    local accepted, run_err = compiled:run({
        score = candidate.score,
        minimum = 80
    })
    if run_err then
        return nil, run_err
    end
    candidate.accepted = accepted
end
```

이 부분 패턴은 애플리케이션이 `candidates`를 제공한다고 가정합니다. 출력이 렌더링된 텍스트라면 `expr`가 아니라 템플릿 모듈을 사용하세요.

### 사용자 스크립트

```lua
local result, err = runner.run({
    source = user_code, -- Supplied by the surrounding application
    modules = {"json", "text"},
    context = {data = input_data}
})
if err then
    return nil, err
end
```

이것은 적대적 코드 샌드박스가 아니라 부분 통합 패턴입니다. 누가 `user_code`를 제공할 수 있는지 검증하고 필요한 모듈과 정책만 부여하세요. 신뢰할 수 없는 코드가 yield하지 않을 수 있다면 외부 타임아웃이나 격리 경계를 적용하세요.

## 함께 보기

- [표현식](./expression.md) - 표현식 언어 레퍼런스
- [실행](./exec.md) - 시스템 명령 실행
- [보안](../security/security.md) - 보안 정책
