---
title: "터미널 I/O"
description: "terminal input을 읽고 standard output과 standard error에 씁니다."
---

# 터미널 I/O
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

`io` 모듈은 terminal application에서 standard input을 읽고 standard output과 standard error에 씁니다.

이 페이지는 API reference입니다. snippet은 독립된 call이며 terminal process는 결과가 control flow에 영향을 주는 경우 반환된 structured Lua error를 propagate해야 합니다.

<note>
이 모듈은 일반 function이 아니라 <a href="../../system/terminal.md">Terminal Host</a>에서 실행되는 process에서만 사용할 수 있습니다.
</note>

## 로딩

```lua
local io = require("io")
```

## Stdout에 쓰기

개행 없이 문자열을 stdout에 씁니다:

```lua
local ok, err = io.write("text", "more")
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `...` | any | 쓸 값들 (가변 인수, 문자열로 변환됨) |

**반환:** `boolean, error`

terminal context lookup이 성공한 뒤에는 output write error가 무시되고 function이 `true`를 반환합니다. terminal context가 없으면 `nil, "no terminal context"`를 반환합니다.

## 개행과 함께 출력

탭으로 구분하고 끝에 개행을 추가하여 stdout에 값을 씁니다:

```lua
io.print("value1", "value2", 123)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `...` | any | 출력할 값들 (가변 인수) |

**반환:** `boolean, error`

terminal context lookup이 성공한 뒤에는 output write error가 무시되고 function이 `true`를 반환합니다. terminal context가 없으면 `nil, "no terminal context"`를 반환합니다.

## Stderr에 쓰기

탭으로 구분하고 끝에 개행을 추가하여 stderr에 값을 씁니다:

```lua
io.eprint("Error:", message)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `...` | any | 출력할 값들 (가변 인수) |

**반환:** `boolean, error`

## 바이트 읽기

stdin에서 최대 `n` 바이트를 읽습니다:

```lua
local data, err = io.read(1024)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `n` | integer | 읽을 바이트 수 (기본값: 1024, 0 이하의 값은 1024가 됨) |

**반환:** `string, error`. 성공한 read는 `n`보다 적은 byte 또는 빈 문자열을 반환할 수 있습니다.

## 줄 읽기

stdin에서 개행까지 한 줄을 읽습니다:

```lua
local line, err = io.readline()
```

**반환:** `string, error`. 끝의 `\n`과 `\r`은 제거됩니다. 일부 input 뒤의 EOF는 해당 partial line을 반환하고, input 없는 EOF는 `nil`과 structured error를 반환합니다.

## Raw 모드

Raw 터미널 모드를 활성화 또는 비활성화합니다 (라인 버퍼링과 에코를 비활성화):

```lua
local ok, err = io.raw(true)   -- enable
local ok, err = io.raw(false)  -- disable
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `enable` | boolean | 활성화하려면 `true`, 비활성화하려면 `false` (기본값: `true`) |

**반환:** `boolean, error`

Raw 모드는 참조 카운팅 방식입니다 — 각 `io.raw(true)`는 `io.raw(false)`와 짝을 이뤄야 합니다. 프로세스 종료 시 터미널은 자동으로 일반 모드로 재설정됩니다.

## 출력 플러시

stdout 버퍼를 플러시합니다:

```lua
local ok, err = io.flush()
```

**반환:** `boolean, error`. standard output이 `Sync()`를 구현하지 않으면 성공하는 no-op입니다.

## 명령줄 인수

명령줄 인수를 가져옵니다:

```lua
local args = io.args()
```

**반환:** `string[]`

`io.args()`는 실패하지 않습니다. terminal context가 없으면 빈 table을 반환합니다.

## 에러

이 모듈은 structured Lua error를 반환합니다. terminal context가 없으면 `errors.UNAVAILABLE`을 사용합니다. direct write/flush 및 invalid yield-response failure는 `errors.INTERNAL`을 사용합니다. dispatcher-backed read, readline, raw-mode failure는 가능한 경우 underlying error metadata를 보존합니다. `io.args()`에는 error return이 없습니다.
