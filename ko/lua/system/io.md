# 터미널 I/O
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

CLI 애플리케이션을 위해 stdin에서 읽고 stdout/stderr에 씁니다.

<note>
이 모듈은 터미널 컨텍스트 내에서만 작동합니다. 일반 함수에서는 사용할 수 없습니다. <a href="system/terminal.md">터미널 호스트</a>에서 실행되는 프로세스에서만 사용할 수 있습니다.
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
| `...` | string | 쓸 문자열들 (가변 인수) |

**반환:** `boolean, error`

## 개행과 함께 출력

탭으로 구분하고 끝에 개행을 추가하여 stdout에 값을 씁니다:

```lua
io.print("value1", "value2", 123)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `...` | any | 출력할 값들 (가변 인수) |

**반환:** `boolean, error`

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

stdin에서 최대 n 바이트를 읽습니다:

```lua
local data, err = io.read(1024)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `n` | integer | 읽을 바이트 수 (기본값: 1024, 0 이하의 값은 1024가 됨) |

**반환:** `string, error`

## 줄 읽기

stdin에서 개행까지 한 줄을 읽습니다:

```lua
local line, err = io.readline()
```

**반환:** `string, error`

## 출력 플러시

stdout 버퍼를 플러시합니다:

```lua
local ok, err = io.flush()
```

**반환:** `boolean, error`

## 명령줄 인수

명령줄 인수를 가져옵니다:

```lua
local args = io.args()
```

**반환:** `string[]`

## 에러

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 터미널 컨텍스트 없음 | `errors.UNAVAILABLE` | 아니오 |
| 쓰기 작업 실패 | `errors.INTERNAL` | 아니오 |
| 읽기 작업 실패 | `errors.INTERNAL` | 아니오 |
| 플러시 작업 실패 | `errors.INTERNAL` | 아니오 |

에러 처리는 [에러 처리](lua/core/errors.md)를 참조하세요.
