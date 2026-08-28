---
title: "WebAssembly 런타임"
description: "레지스트리 엔트리를 통해 WAT 및 WASM 함수나 WASM 프로세스를 Lua와 함께 실행합니다."
---

# WebAssembly 런타임

> WASM 런타임은 실험적 확장 기능입니다. 설정은 안정적이나, 런타임 내부 구현은 릴리스 간에 변경될 수 있습니다.

Wippy는 WebAssembly 모듈을 Lua 코드와 함께 등록합니다. 함수 엔트리는 함수 레지스트리에 들어가 함수 풀에서 실행되고, 프로세스 엔트리는 프로세스 팩토리를 등록해 프로세스 호스트 아래에서 실행됩니다. 둘 다 런타임 스케줄러와 보안 모델을 사용합니다.

**분류: 개념 개요.** Lua 블록은 서로 독립적인 호출 패턴이며, 이름이 지정된 WASM 엔트리와 WIT 계약이 이미 등록되어 있다고 가정합니다. 컴파일된 컴포넌트를 포함한 프로젝트는 Rust/WASM 튜토리얼을 참조하십시오.

## 엔트리 종류

| 종류 | 설명 |
|------|-------------|
| `function.wat` | YAML에서 정의된 인라인 WebAssembly Text 형식 함수 |
| `function.wasm` | 파일시스템 엔트리에서 로드된 사전 컴파일된 WASM 바이너리 |
| `process.wasm` | 프로세스로 실행되는 WASM 바이너리 (CLI 명령 또는 장기 실행) |

## 동작 방식

1. WASM 모듈은 `_index.yaml`에서 레지스트리 엔트리로 선언됩니다
2. 부팅 시 `function.wat` 및 `function.wasm` 엔트리가 컴파일되고 함수로 등록되어 설정된 함수 풀에 배치됩니다
3. Lua는 `funcs.call()`을 통해 해당 함수 엔트리를 호출합니다
4. 반면 `process.wasm` 엔트리는 프로세스 팩토리를 등록하고 프로세스 호스트 아래에서 spawn됩니다
5. 함수 인자와 반환값은 Lua 테이블과 WIT 타입 간에 매핑됩니다
6. clock polling 및 outgoing HTTP를 포함한 지원되는 dispatcher-bridge 작업은 스케줄러가 다른 작업을 실행할 수 있도록 yield합니다

## 컴포넌트 모델

Wippy는 WIT(WebAssembly Interface Types)를 사용하는 WebAssembly Component Model을 지원합니다. 컴포넌트 모듈은 호스트와 게스트 사이에서 다음 타입을 매핑합니다.

- Record는 이름이 있는 필드를 가진 Lua 테이블로 매핑됩니다
- List는 Lua 배열로 매핑됩니다
- Result는 `(value, error)` 반환 튜플로 매핑됩니다
- 프리미티브 (`s32`, `f64`, `string` 등)는 직접 매핑됩니다

명시적 WIT 시그니처를 사용하는 Raw/Core WASM 모듈도 지원됩니다.

## Lua에서 WASM 호출하기

`funcs.call()`을 통해 레지스트리 ID로 WASM 함수를 호출합니다.

```lua
local funcs = require("funcs")

-- No arguments
local result, err = funcs.call("myns:answer_wat")
if err then return nil, err end

-- With arguments
local computed, compute_err = funcs.call("myns:compute", 6, 7)
if compute_err then return nil, compute_err end

-- With complex data
local users = {
    {id = 1, name = "Alice", tags = {"admin"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
}
local transformed, err = funcs.call("myns:transform_users", users)
if err then return nil, err end
```

## 보안

WASM 실행은 기본적으로 호출자의 보안 컨텍스트를 상속합니다:

- 액터 아이덴티티가 상속됩니다
- 스코프가 상속됩니다
- 요청 컨텍스트가 상속됩니다

호스트 기능은 명시적 import를 통해 opt-in합니다. 각 엔트리는 `funcs`, `wasi1`, `wasi:cli`, `wasi:filesystem` 등 필요한 호스트 프로필을 선언해 모듈의 접근 범위를 제한합니다. 프로필을 활성화해도 함수 호출, 소켓, outgoing HTTP 같은 작업의 런타임 보안 검사를 우회하지 않습니다.

## 참고

- [함수](wasm/functions.md) - WASM 함수 엔트리 설정
- [호스트 함수](wasm/hosts.md) - 사용 가능한 WASI 및 Wippy 호스트 인터페이스
- [프로세스](wasm/processes.md) - WASM을 장기 실행 프로세스로 실행하기
- [Rust/WASM 튜토리얼](../tutorials/rust-wasm.md) - 컴포넌트 빌드 및 등록
