---
title: "TTY"
description: "<secondary-label ref='process'/ <secondary-label ref='io'/"
---

# TTY
<secondary-label ref="process"/>
<secondary-label ref="io"/>

터미널 입력 이벤트, 스타일이 적용된 출력, 표시 서피스, 로컬 가상 뷰포트입니다.

<note>
모든 함수는 호출하는 프로세스 프레임에 연결된 터미널 포트를 해석합니다. <a href="system/terminal.md">Terminal Host</a>의 프로세스는 물리 터미널을 소유하고; 일반 <code>process.host</code>의 <code>process.lua</code>는 뷰포트 grant와 함께 스폰되면 가상 터미널을 소유합니다. 둘 중 어느 연결도 없으면 모듈은 "no terminal context"를 반환합니다.
</note>

## 로딩

```lua
local tty = require("tty")
```

## 모델

**Surface**는 한 프로세스가 자신의 터미널 포트에 대해 갖는 배타적 표시 리스입니다. 완성된 행 스냅샷을 발행하며; 백엔드가 diff와 터미널 복구를 담당합니다. 한 포트에는 한 번에 하나의 서피스만 열 수 있습니다.

**Canvas**는 프로세스 내부의 스타일 셀 합성 버퍼입니다. 셀 경계에서 클리핑하며 자체적으로 터미널 제어 명령을 내보내지 않습니다.

**Viewport**는 한 프로세스가 바이트 스트림을 공유하지 않고 다른 프로세스의 서피스를 호스팅할 수 있게 하는 로컬 구조화 터미널 경계입니다. 셸이 뷰포트 콘텐츠가 어디에 나타날지 결정하고 입력을 자식의 좌표로 변환하며; 자식은 일반 터미널 포트를 보고 자신이 전체 화면인지, 타일링인지, 탭인지, 숨겨져 있는지 알지 못합니다.

뷰포트는 하나의 런타임 노드에 로컬입니다. grant와 핸들은 불투명한 로컬 케이퍼빌리티이며, 직렬화 가능한 네트워크 참조가 아닙니다.

## 입력 루프

입력 전달을 시작하고, 이벤트를 구독하고, 루프에서 처리합니다:

```lua
local tty = require("tty")
local io = require("io")

local function handler()
    local events = tty.events()
    tty.start()

    while true do
        local ev = events:receive()
        if not ev then break end

        if ev.type == "key" then
            if ev.key == "q" or (ev.ctrl and ev.key == "c") then
                break
            end
            io.print("Key: " .. ev.key)

        elseif ev.type == "resize" then
            io.print("Size: " .. ev.width .. "x" .. ev.height)
        end
    end

    tty.stop()
end
```

첫 이벤트가 도착할 때 소비자가 준비되어 있도록 `start()`보다 먼저 `events()`를 호출하세요. 가상 포트에서는 `start()`가 뷰어에서 생산자로의 이벤트 전달을 열고 `stop()`이 이를 닫습니다: 그 구간 밖의 `Viewport:send()`는 입력을 조용히 버리는 대신 실패합니다. 리사이즈 전달은 입력 상태와 무관합니다.

## 입력 제어

### tty.start()

현재 포트의 입력 전달을 시작합니다. 물리 터미널은 원시 모드로 전환됩니다.

```lua
local ok, err = tty.start()
```

**반환:** `boolean, error`

### tty.stop()

입력 전달을 중지하고 터미널을 일반 모드로 복원합니다.

```lua
local ok, err = tty.stop()
```

**반환:** `boolean, error`

### tty.events()

포트의 터미널 이벤트를 구독하고 채널을 반환합니다. 이벤트는 `type` 필드가 있는 테이블로 전달됩니다. 한 번 구독하고 채널을 재사용하세요.

```lua
local events, err = tty.events()
```

**반환:** `EventChannel, error`

`EventChannel`에는 `receive()`와 `case_receive()`가 있어 `channel.select`와 조합됩니다.

### tty.screen_size()

현재 터미널 크기를 조회합니다.

```lua
local width, height, err = tty.screen_size()
```

**반환:** `number, number, error`

### tty.mouse(enable)

마우스 이벤트 추적을 활성화하거나 비활성화합니다.

```lua
local ok, err = tty.mouse(true)
```

| 파라미터 | 타입 | 설명 |
|-----------|------|-------------|
| `enable` | boolean | 활성화는 `true`, 비활성화는 `false` |

**반환:** `boolean, error`

## Surface

서피스는 포트의 표시 리스입니다. 하나를 획득하고, 완성된 프레임을 발행하고, 끝나면 닫습니다.

### tty.surface(options?)

```lua
local surface, err = tty.surface({
    alternate_screen = true,
    hide_cursor = true,
    synchronized_output = true,
})
```

| 옵션 | 타입 | 기본값 | 설명 |
|--------|------|---------|-------------|
| `alternate_screen` | boolean | false | 터미널의 대체 화면 버퍼에 표시 |
| `hide_cursor` | boolean | false | 서피스가 열려 있는 동안 터미널 커서 숨김 |
| `synchronized_output` | boolean | false | 각 프레임을 동기화 출력 마커로 감쌈 |

**반환:** `Surface, error`

이미 서피스가 있는 포트에 두 번째 서피스를 열면 실패합니다. 가상 포트는 옵션을 서피스 메타데이터로 유지하고; 물리 포트는 이를 터미널 모드로 변환하며 닫을 때 복원합니다.

### surface:present(rows, options?)

행 문자열의 완전한 배열을 발행합니다. 행 `1`이 최상단 줄입니다.

```lua
local stats, err = surface:present(rows, {
    cursor = {x = 12, y = 3, visible = true},
})
```

| 파라미터 | 타입 | 설명 |
|-----------|------|-------------|
| `rows` | string[] | 완성된 프레임, 최대 16384행 |
| `options.cursor` | table | 1부터 시작하는 서피스 좌표의 `{x, y, visible}` |

`cursor`를 생략하면 마지막으로 명시된 커서 상태가 유지됩니다. `cursor`가 있으면 세 필드 모두 필수입니다.

**반환:** `stats, error` — `rows`, `changed_rows`, `bytes_written`을 담은 불변 레코드. 이전과 동일한 물리 프레임은 아무것도 쓰지 않습니다.

### surface:invalidate()

논리 프레임을 지우지 않고 백엔드 표시 상태를 잊습니다. 다음 `present`는 행이 변경되지 않았더라도 커밋됩니다. 바깥 터미널 리사이즈 후나 다른 소유자가 물리 상태를 흐트러뜨렸을 수 있을 때 사용하세요.

**반환:** `boolean`

### surface:close()

리스를 해제합니다. 멱등입니다: 이후 호출은 첫 번째 close 결과를 반환합니다. 물리 백엔드는 터미널 모드를 복원합니다.

**반환:** `boolean, error`

## Canvas

캔버스는 프레임을 표시하기 전에 합성하는 데 사용하는 경계가 있는 스타일 셀 버퍼입니다.

### tty.canvas(width, height)

```lua
local canvas = tty.canvas(width, height)
```

너비는 16384열, 높이는 16384행, 면적은 262,144셀로 제한됩니다. 범위를 벗어난 인자는 인자 에러를 발생시킵니다.

**반환:** `Canvas`

그리기는 터미널 명령이 아니라 스타일이 적용된 텍스트를 받습니다. SGR 색상과 OSC 8 링크는 보존되며; 지우기, 커서 이동 등 제어 전용 출력은 내보내지 않습니다. 각 배치는 그래핌 폭을 인식하며 셀 경계에서 개별적으로 클리핑되므로, 잘린 이스케이프 시퀀스가 인접 콘텐츠로 새어 나갈 수 없습니다.

### canvas:clear(fill?)

모든 셀을 지웁니다. 선택적인 스타일 `fill` 문자열이 각 행에 반복됩니다.

```lua
canvas:clear()
canvas:clear(tty.style():background("#1a1a1a"):render(" "))
```

**반환:** `boolean`

### canvas:put(x, y, text, width?)

1부터 시작하는 `x`, `y`에 스타일이 적용된 행 하나를 배치하고 `width` 셀로 클리핑합니다(기본값: 캔버스 너비). 좌표는 음수이거나 가장자리를 넘어도 되며; 배치는 거부되지 않고 클리핑됩니다. 개행은 행을 끝내므로 여러 행 콘텐츠에는 `put_rows`를 사용하세요.

```lua
canvas:put(3, 1, tty.style():bold():render("Title"), 40)
```

**반환:** `boolean`

### canvas:put_rows(x, y, rows, width?)

`x`, `y`에서 시작해 아래 방향으로 한 줄에 한 행씩 스타일이 적용된 행 배열을 배치합니다. 무엇이든 그려지기 전에 모든 항목이 검증됩니다.

```lua
canvas:put_rows(2, 2, child_rows, inner_width)
```

**반환:** `boolean`

### canvas:rows()

`surface:present`에 바로 쓸 수 있는 완전한 행 배열을 렌더링합니다.

**반환:** `string[]`

## Viewport

뷰포트는 가상 터미널 포트입니다. 생성한 프로세스가 첫 번째 뷰어이고; 그 grant로 승인된 프로세스가 생산자입니다.

### tty.viewport(options?)

```lua
local view, err = tty.viewport({width = 80, height = 24})
```

| 옵션 | 타입 | 기본값 | 설명 |
|--------|------|---------|-------------|
| `width` | number | 80 | 열 수, 1에서 65535 |
| `height` | number | 24 | 행 수, 1에서 65535 |

면적은 262,144셀로 제한됩니다.

**반환:** `Viewport, error`

### tty.attach(handle)

기존 뷰포트에 다른 로컬 뷰어를 추가합니다. 핸들은 보기 권한만 부여하며 표시 소유권은 절대 부여하지 않고, 다른 노드에서는 유효하지 않습니다.

```lua
local view, err = tty.attach(handle)
```

**반환:** `Viewport, error`

### viewport:grant()

일회성 생산자 케이퍼빌리티를 반환합니다. `terminal` 스폰 옵션으로 전달하세요:

```lua
local grant = assert(view:grant())
local child = assert(process.with_options({terminal = grant})
    :spawn_monitored("app:child", "app:workers"))
```

승인은 grant를 트랜잭션적으로 소비합니다: 시작이 거부되면 해석되지 않은 grant가 복원되고, 포트를 해석한 프로세스는 이를 영구적으로 소비합니다. 터미널 연결을 지원하지 않는 호스트는 옵션을 무시하는 대신 스폰을 거부합니다. [프로세스](lua/core/process.md#spawner-with-options)를 참조하세요.

**반환:** `string, error`

### viewport:handle()

`tty.attach`용 로컬 뷰어 핸들을 반환합니다.

**반환:** `string`

### viewport:snapshot(after_revision?)

현재 크기, 행, 커서, 리비전을 읽습니다. `after_revision`을 주면 리비전이 변경되지 않은 경우 `nil`을 반환합니다.

```lua
local frame = view:snapshot(revision)
if frame then
    revision = frame.revision
    canvas:put_rows(2, 2, frame.rows, inner_width)
end
```

**반환:** `snapshot` 또는 `nil`

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `revision` | number | 이 프레임의 단조 증가 리비전 |
| `width` | number | 뷰포트 열 수 |
| `height` | number | 뷰포트 행 수 |
| `rows` | string[] | 생산자가 마지막으로 발행한 행 |
| `cursor` | table | 1부터 시작하는 좌표의 `{x, y, visible}`, 생산자가 명시적 커서 상태를 발행하기 전에는 없음 |

### viewport:updates()

병합된 리비전 워터마크의 채널을 반환합니다. `receive()`는 리비전 번호를 내주고; `case_receive()`는 `channel.select`와 조합됩니다.

```lua
local updates = assert(view:updates())
```

업데이트는 이벤트 로그가 아니라 경계가 있는 힌트입니다. 느린 뷰어는 최신 워터마크만 받으며 상태는 `snapshot()`으로 가져와야 합니다. 표시와 리사이즈는 느린 뷰어 때문에 블로킹되지 않습니다.

**반환:** `ViewportUpdateChannel, error`

### viewport:send(event)

검증된 이벤트 레코드를 생산자에게 전달합니다. 생산자가 `tty.start()`를 호출한 상태여야 하며; 그렇지 않으면 이벤트를 버리는 대신 호출이 실패합니다.

```lua
assert(view:send(event))
assert(view:send({type = "close"}))
```

**반환:** `boolean, error`

### viewport:resize(width, height)

뷰포트 지오메트리를 갱신합니다. 크기가 변경되면 뷰어는 새 리비전을 받고 생산자는 `resize` 이벤트를 받습니다.

**반환:** `boolean, error`

### viewport:close()

이 뷰어만 분리합니다. 마지막 뷰어를 닫아도 살아 있는 생산자가 종료되지 않으며, 생산자의 포트를 닫아도 뷰어가 남아 있는 한 상태가 파괴되지 않습니다.

**반환:** `boolean, error`

## 이벤트 타입

이벤트는 어떤 다른 필드가 있는지 결정하는 `type` 필드가 있는 테이블입니다. 좌표는 1부터 시작합니다. `viewport:send()`도 동일한 레코드를 받습니다.

### 키 이벤트

```lua
{
    type = "key",
    key = "a",           -- 인쇄 가능한 문자 또는 키 이름
    key_type = "runes",  -- 인쇄 가능한 경우 "runes", 또는 특수 키 이름
    action = "press",    -- "press" 또는 "release"
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
    button = "left",     -- 버튼 이름
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

키보드 소유권을 보고합니다.

```lua
{type = "focus", focused = true}
```

### 가시성 이벤트

다시 그리는 것이 유용한지 보고합니다. 애플리케이션 수명 주기나 백그라운드 연산을 규정하지는 않습니다.

```lua
{type = "visibility", visible = true}
```

### 붙여넣기 이벤트

```lua
{type = "paste", text = "pasted content"}
```

### 종료 이벤트

생산자에게 종료를 요청합니다. 셸은 자식의 정상 종료를 요청하기 위해 `viewport:send`로 이를 보냅니다.

```lua
{type = "close"}
```

## 키 바인딩

키 이벤트와 매칭되는 재사용 가능한 키 바인딩을 생성합니다:

```lua
local quit = tty.bind({
    keys = {"q", "ctrl+c"},
    help = {key = "q/ctrl+c", desc = "quit"}
})

-- 이벤트 루프에서
if quit:matches(ev) then
    break
end
```

### tty.bind(config)

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `keys` | string[] | 매칭할 키 패턴 (예: `"a"`, `"ctrl+c"`, `"enter"`) |
| `help` | table | 선택. 도움말 텍스트용 `{key = "...", desc = "..."}` |

**반환:** `KeyBinding`

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

io.print(box:render(title:render("Hello"), "World"))
```

### tty.style()

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
local w = tty.text.width("hello")         -- 인쇄 가능한 너비 (ANSI 인식)
local h = tty.text.height("a\nb\nc")      -- 줄 수
local w, h = tty.text.size("hello\nworld") -- 둘 다
```

### 클리핑

```lua
-- 인쇄 가능한 너비로 자르기, 선택적 꼬리 문자 포함
local head = tty.text.truncate(line, 40)
local head = tty.text.truncate(line, 40, "…")

-- 인쇄 가능한 셀 범위 [left, right) 가져오기
local middle = tty.text.cut(line, 10, 30)
```

둘 다 ANSI 상태와 그래핌 경계를 보존하므로, 스타일이 적용된 텍스트를 이스케이프 시퀀스를 깨뜨리지 않고 클리핑하고 이어 붙일 수 있습니다. `truncate`는 너비가 0 이하이면 빈 문자열을 반환하고; `cut`은 `right`가 `left`보다 크지 않으면 빈 문자열을 반환합니다.

### 결합

```lua
-- 위쪽으로 정렬하여 나란히 결합
local row = tty.text.join_horizontal(tty.text.position.TOP, left, right)

-- 가운데 정렬로 수직 스택
local col = tty.text.join_vertical(tty.text.position.CENTER, top, bottom)
```

### 최대 크기

```lua
local w = tty.text.max_width({"short", "a longer string"})   -- 가장 넓은
local h = tty.text.max_height({"one\ntwo", "single"})         -- 가장 높은
```

### 배치

주어진 크기의 박스 내에 문자열을 배치합니다:

```lua
-- 80x24 박스의 가운데
local out = tty.text.place(80, 24, tty.text.position.CENTER, tty.text.position.CENTER, content)

-- 수평만
local out = tty.text.place_horizontal(80, tty.text.position.RIGHT, content)

-- 수직만
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

## 권한

이 모듈은 자체 정책 액션을 강제하지 않습니다. 터미널 접근은 프레임에서 옵니다: 터미널 호스트가 물리 포트를 연결하고, `process.with_options({terminal = grant})`가 뷰포트를 연결하며, 후자는 스폰하는 쪽에 `process.context`를 요구합니다.

## 참고

- [터미널 UI](tutorials/tty.md) — 뷰포트에서 자식을 호스팅하는 셸 만들기
- [터미널 I/O](lua/system/io.md) — stdin/stdout/stderr 작업
- [Terminal Host](system/terminal.md) — Terminal Host 설정
- [명령 실행](lua/dynamic/exec.md) — PTY 프로세스와 터미널 세션
- [프로세스](lua/core/process.md) — 스폰 옵션, 모니터링, 수명 주기 이벤트
