# WebAssembly 런타임

> WASM 런타임은 실험적 확장 기능입니다. 설정은 안정적이나, 런타임 내부 구현은 릴리스 간에 변경될 수 있습니다.

Wippy는 WebAssembly 모듈을 Lua 코드와 함께 일급 레지스트리 엔트리로 실행합니다. WASM 함수와 프로세스는 동일한 스케줄러 내에서 실행되고, 동일한 보안 모델을 공유하며, 함수 레지스트리를 통해 Lua와 상호 운용됩니다.

## 엔트리 종류

| Kind | Description |
|------|-------------|
| `function.wat` | YAML에서 정의된 인라인 WebAssembly Text 형식 함수 |
| `function.wasm` | 파일시스템 엔트리에서 로드된 사전 컴파일된 WASM 바이너리 |
| `process.wasm` | 프로세스로 실행되는 WASM 바이너리 (CLI 명령 또는 장기 실행) |

## 동작 방식

1. WASM 모듈은 `_index.yaml`에서 레지스트리 엔트리로 선언됩니다
2. 부팅 시 모듈이 컴파일되어 워커 풀에 배치됩니다
3. Lua (또는 다른 WASM) 코드가 `funcs.call()`을 통해 호출합니다
4. 인자와 반환값은 Lua 테이블과 WIT 타입 간에 자동으로 매핑됩니다
5. 비동기 작업 (I/O, sleep, HTTP)은 Lua와 동일하게 디스패처를 통해 양보(yield)합니다

## 컴포넌트 모델

Wippy는 WIT (WebAssembly Interface Types)를 사용하는 WebAssembly 컴포넌트 모델을 지원합니다. 컴포넌트 모듈은 호스트와 게스트 간에 완전한 타입 매핑을 제공합니다:

- Record는 이름이 있는 필드를 가진 Lua 테이블로 매핑됩니다
- List는 Lua 배열로 매핑됩니다
- Result는 `(value, error)` 반환 튜플로 매핑됩니다
- 프리미티브 (`s32`, `f64`, `string` 등)는 직접 매핑됩니다

명시적 WIT 시그니처를 사용하는 Raw/Core WASM 모듈도 지원됩니다.

## Lua에서 WASM 호출하기

WASM 함수는 레지스트리의 다른 함수와 동일한 방식으로 호출됩니다:

```lua
local funcs = require("funcs")

-- No arguments
local result, err = funcs.call("myns:answer_wat")

-- With arguments
local result, err = funcs.call("myns:compute", 6, 7)

-- With complex data
local users = {
    {id = 1, name = "Alice", tags = {"admin"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
}
local transformed, err = funcs.call("myns:transform_users", users)
```

## WASM 모듈 간 호출

WASM 컴포넌트는 `wippy:runtime/funcs` 호스트 인터페이스를 통해 다른 Wippy 함수 (Lua 또는 WASM)를 호출할 수 있습니다:

```wit
call-string: func(target: string, input: string) -> result<string, string>;
call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
```

엔트리 설정에서 `funcs` 호스트를 임포트합니다:

```yaml
imports:
  - funcs
```

## 보안

WASM 실행은 기본적으로 호출자의 보안 컨텍스트를 상속합니다:

- 액터 아이덴티티가 상속됩니다
- 스코프가 상속됩니다
- 요청 컨텍스트가 상속됩니다

호스트 기능은 명시적 임포트를 통해 옵트인됩니다. 각 엔트리는 필요한 WASI 인터페이스 (`wasi:cli`, `wasi:filesystem` 등)를 정확히 선언하여 모듈의 접근 범위를 제한합니다.

## 참고

- [함수](wasm/functions.md) - WASM 함수 엔트리 설정
- [호스트 함수](wasm/hosts.md) - 사용 가능한 WASI 및 Wippy 호스트 인터페이스
- [프로세스](wasm/processes.md) - WASM을 장기 실행 프로세스로 실행하기
