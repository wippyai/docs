---
title: "TTY"
description: "터미널 입력 이벤트를 처리하고 스타일이 적용된 터미널 레이아웃을 렌더링합니다."
---

# TTY
<secondary-label ref="process"/>
<secondary-label ref="io"/>

`tty` 모듈은 원시 터미널 입력 이벤트를 처리하고 스타일이 적용된 출력 및 레이아웃 유틸리티를 제공합니다.

이 페이지는 API 레퍼런스입니다. 입력 루프는 터미널 프로세스의 부분 예시이며 스타일과 레이아웃 조각은 독립된 예시입니다.

<note>
이 모듈은 일반 함수가 아니라 <a href="../../system/terminal.md">Terminal Host</a>에서 실행되는 프로세스에서만 사용할 수 있습니다.
</note>

## 로딩

```lua
local tty = require("tty")
```

## 입력 루프

원시 입력 리더를 시작하고, 이벤트를 구독하고, 루프에서 처리합니다:

```lua
local tty = require("tty")
local io = require("io")

local function handler()
    local events, events_err = tty.events()
    if events_err then return nil, events_err end

    -- Subscribe before starting so the initial start event cannot be missed.
    local started, start_err = tty.start()
    if start_err then return nil, start_err end

    local loop_err

    while true do
        local ev, open = events:receive()
        if not open then break end

        if ev.type == "key" then
            if ev.key == "q" or (ev.ctrl and ev.key == "c") then
                break
            end
            local _, print_err = io.print("Key: " .. ev.key)
            if print_err then loop_err = print_err; break end

        elseif ev.type == "resize" then
            local _, print_err = io.print("Size: " .. ev.width .. "x" .. ev.height)
            if print_err then loop_err = print_err; break end
        end
    end

    local _, stop_err = tty.stop()
    if loop_err then return nil, loop_err end
    if stop_err then return nil, stop_err end
    return started
end
```

## 입력 제어

### `tty.start()`

원시 터미널 입력 모드를 활성화합니다. 터미널이 원시 모드로 전환되고 이벤트 발행을 시작합니다.

```lua
local ok, err = tty.start()
```

**반환:** `boolean, error`

### `tty.stop()`

원시 입력을 비활성화하고 터미널을 일반 모드로 복원합니다.

```lua
local ok, err = tty.stop()
```

**반환:** `boolean, error`

### `tty.events()`

터미널 이벤트를 구독하고 채널을 반환합니다. 이벤트는 `type` 필드가 있는 테이블로 전달됩니다.

```lua
local events = tty.events()
```

**반환:** `EventChannel, error`

### `tty.screen_size()`

현재 터미널 크기를 조회합니다.

```lua
local width, height, err = tty.screen_size()
```

**반환:** `number, number, error`

### `tty.mouse(enable)`

마우스 이벤트 추적을 활성화하거나 비활성화합니다.

```lua
local ok, err = tty.mouse(true)
```

| 파라미터 | 타입 | 설명 |
|-----------|------|-------------|
| `enable` | boolean | 활성화는 `true`, 비활성화는 `false` |

**반환:** `boolean, error`

## 이벤트 타입

이벤트는 어떤 다른 필드가 있는지 결정하는 `type` 필드가 있는 테이블입니다.

### 키 이벤트

```lua
{
    type = "key",
    key = "a",           -- printable character or key name
    key_type = "runes",  -- "runes" for printable, or special key name
    action = "press",    -- "press" or "release"
    alt = false,
    ctrl = false,
    shift = false
}
```

### 마우스 이벤트

`tty.mouse(true)`가 필요합니다.

```lua
{
    type = "mouse",
    action = "press",    -- "press", "release", "motion", "wheel"
    button = "left",     -- button name
    x = 10,
    y = 5,
    alt = false,
    ctrl = false,
    shift = false
}
```

### 리사이즈 이벤트

```lua
{type = "resize", width = 120, height = 40}
```

### 시작 이벤트

`tty.start()` 후 초기 크기와 함께 한 번 발행됩니다.

```lua
{type = "start", width = 120, height = 40}
```

### 포커스 이벤트

```lua
{type = "focus", focused = true}
```

### 붙여넣기 이벤트

```lua
{type = "paste", text = "pasted content"}
```

## 키 바인딩

키 이벤트와 매칭되는 재사용 가능한 키 바인딩을 생성합니다:

```lua
local quit = tty.bind({
    keys = {"q", "ctrl+c"},
    help = {key = "q/ctrl+c", desc = "quit"}
})

-- In event loop
if quit:matches(ev) then
    break
end
```

### `tty.bind(config)`

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `keys` | string[] | 필수. 매칭할 키 패턴 (예: `"a"`, `"ctrl+c"`, `"enter"`) |
| `help` | table | 선택. 도움말 텍스트용 `{key = "...", desc = "..."}` |

**반환:** `KeyBinding`

타입 스키마에서는 `keys`가 필수입니다. 런타임에서 생략되거나 빈 `keys` 테이블은 어떤 이벤트와도 일치하지 않는 바인딩을 만듭니다.

### KeyBinding 메서드

| 메서드 | 반환 | 설명 |
|--------|---------|-------------|
| `matches(event)` | boolean | 키 이벤트가 이 바인딩과 일치하는지 테스트 |
| `set_enabled(bool)` | self | 바인딩 활성화 또는 비활성화 |
| `is_enabled()` | boolean | 바인딩이 활성화되었는지 확인 |
| `help()` | table | `{key, desc}` 도움말 정보 반환 |

## 스타일

lipgloss 기반 스타일링을 사용하여 스타일이 적용된 텍스트 출력을 생성합니다. 모든 스타일 메서드는 새 스타일을 반환합니다(불변).

```lua
local tty = require("tty")
local io = require("io")

local title = tty.style()
    :bold()
    :foreground("#FF0000")
    :padding(0, 1)

local box = tty.style()
    :border(tty.borders.ROUNDED)
    :border_foreground("#00FF00")
    :width(40)
    :padding(1, 2)

local _, print_err = io.print(box:render(title:render("Hello"), "World"))
if print_err then return nil, print_err end
```

### `tty.style()`

새 빈 스타일을 생성합니다.

**반환:** `Style`

### Style 메서드

모든 메서드는 새 `Style`을 반환하며 체이닝할 수 있습니다.

#### 텍스트 장식

| 메서드 | 파라미터 | 설명 |
|--------|-----------|-------------|
| `foreground(color)` | string | 텍스트 색상 (16진수 `"#FF0000"`, ANSI `"9"`, 또는 이름) |
| `background(color)` | string | 배경 색상 |
| `bold(enable?)` | boolean | 굵은 텍스트 (기본값: true) |
| `italic(enable?)` | boolean | 기울임꼴 텍스트 |
| `underline(enable?)` | boolean | 밑줄 텍스트 |
| `strikethrough(enable?)` | boolean | 취소선 텍스트 |
| `faint(enable?)` | boolean | 흐림 텍스트 |
| `blink(enable?)` | boolean | 깜빡이는 텍스트 |
| `reverse(enable?)` | boolean | 전경/배경 교체 |

#### 레이아웃

| 메서드 | 파라미터 | 설명 |
|--------|-----------|-------------|
| `width(n)` | number | 고정 너비 |
| `height(n)` | number | 고정 높이 |
| `max_width(n)` | number | 최대 너비 |
| `max_height(n)` | number | 최대 높이 |
| `padding(...)` | numbers | 패딩 (CSS 스타일: top, right, bottom, left) |
| `margin(...)` | numbers | 마진 (CSS 스타일) |
| `align(pos)` | number | 수평 정렬 |
| `align_vertical(pos)` | number | 수직 정렬 |
| `inline(enable?)` | boolean | 인라인 렌더링 모드 |

#### 테두리

| 메서드 | 파라미터 | 설명 |
|--------|-----------|-------------|
| `border(name, ...)` | string, booleans | 테두리 스타일, 선택적 측면별 토글 |
| `border_foreground(...)` | strings | 테두리 색상 |
| `border_background(...)` | strings | 테두리 배경 색상 |

#### 기타

| 메서드 | 설명 |
|--------|-------------|
| `render(...)` | 이 스타일이 적용된 문자열 렌더링 |
| `copy()` | 이 스타일의 복사본 생성 |

### 테두리 상수

```lua
tty.borders.NORMAL
tty.borders.ROUNDED
tty.borders.THICK
tty.borders.DOUBLE
tty.borders.HIDDEN
```

### 정렬 상수

```lua
tty.align.LEFT    -- 0
tty.align.CENTER  -- 0.5
tty.align.RIGHT   -- 1
```

## 텍스트 유틸리티

스타일이 적용된 텍스트의 레이아웃 및 측정 함수입니다. `tty.text`에서 사용할 수 있습니다.

### 측정

```lua
local w = tty.text.width("hello")         -- printable width (ANSI-aware)
local h = tty.text.height("a\nb\nc")      -- line count
local w, h = tty.text.size("hello\nworld") -- both
```

### 결합

```lua
-- Join side by side, aligned at top
local row = tty.text.join_horizontal(tty.text.position.TOP, left, right)

-- Stack vertically, centered
local col = tty.text.join_vertical(tty.text.position.CENTER, top, bottom)
```

### 최대 크기

```lua
local w = tty.text.max_width({"short", "a longer string"})   -- widest
local h = tty.text.max_height({"one\ntwo", "single"})         -- tallest
```

### 배치

주어진 크기의 박스 내에 문자열을 배치합니다:

```lua
-- Center in a 80x24 box
local out = tty.text.place(80, 24, tty.text.position.CENTER, tty.text.position.CENTER, content)

-- Horizontal only
local out = tty.text.place_horizontal(80, tty.text.position.RIGHT, content)

-- Vertical only
local out = tty.text.place_vertical(24, tty.text.position.BOTTOM, content)
```

### 위치 상수

```lua
tty.text.position.TOP      -- 0
tty.text.position.LEFT     -- 0
tty.text.position.CENTER   -- 0.5
tty.text.position.BOTTOM   -- 1
tty.text.position.RIGHT    -- 1
```

## 오류

입력 제어 함수는 구조화 오류를 반환합니다:

| 조건 | 종류 | 재시도 가능 |
|------|------|-------------|
| 터미널 컨텍스트 또는 입력 컨트롤러 없음 | `errors.UNAVAILABLE` | 아니오 |
| 이벤트 구독에 런타임 또는 프로세스 컨텍스트 없음 | `errors.INTERNAL` | 아니오 |
| 터미널 yield 응답이 잘못됨 | `errors.INTERNAL` | 아니오 |

## 참고

- [터미널 I/O](./io.md) — stdin/stdout/stderr 작업
- [Terminal Host](../../system/terminal.md) — Terminal Host 설정
