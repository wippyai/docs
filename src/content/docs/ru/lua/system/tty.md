---
title: "TTY"
---

# TTY
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Модуль терминального UI для событий сырого ввода, стилизованного вывода и утилит компоновки.

<note>
Этот модуль работает только в контексте терминала. Его нельзя использовать из обычных функций — только из процессов, запущенных на <a href="system/terminal.md">Terminal Host</a>.
</note>

## Загрузка

```lua
local tty = require("tty")
```

## Цикл ввода

Запустите читалку сырого ввода, подпишитесь на события и обработайте их в цикле:

```lua
local tty = require("tty")
local io = require("io")

local function handler()
    tty.start()
    local events = tty.events()

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

## Управление вводом

### tty.start()

Включить режим сырого ввода терминала. Терминал переключается в raw-режим и начинает выдавать события.

```lua
local ok, err = tty.start()
```

**Возвращает:** `boolean, error`

### tty.stop()

Отключить сырой ввод и вернуть терминал в нормальный режим.

```lua
local ok, err = tty.stop()
```

**Возвращает:** `boolean, error`

### tty.events()

Подписаться на события терминала и вернуть канал. События доставляются в виде таблиц с полем `type`.

```lua
local events = tty.events()
```

**Возвращает:** `EventChannel, error`

### tty.screen_size()

Запросить текущие размеры терминала.

```lua
local width, height, err = tty.screen_size()
```

**Возвращает:** `number, number, error`

### tty.mouse(enable)

Включить или отключить отслеживание событий мыши.

```lua
local ok, err = tty.mouse(true)
```

| Параметр | Тип | Описание |
|-----------|------|-------------|
| `enable` | boolean | `true` для включения, `false` для отключения |

**Возвращает:** `boolean, error`

## Типы событий

События — это таблицы с полем `type`, которое определяет, какие другие поля присутствуют.

### Событие клавиши

```lua
{
    type = "key",
    key = "a",           -- печатный символ или имя клавиши
    key_type = "runes",  -- "runes" для печатных, или имя специальной клавиши
    action = "press",    -- "press" или "release"
    alt = false,
    ctrl = false,
    shift = false
}
```

### Событие мыши

Требует `tty.mouse(true)`.

```lua
{
    type = "mouse",
    action = "press",    -- "press", "release", "motion", "wheel"
    button = "left",     -- имя кнопки
    x = 10,
    y = 5,
    alt = false,
    ctrl = false,
    shift = false
}
```

### Событие изменения размера

```lua
{type = "resize", width = 120, height = 40}
```

### Событие старта

Выдаётся один раз после `tty.start()` с начальными размерами.

```lua
{type = "start", width = 120, height = 40}
```

### Событие фокуса

```lua
{type = "focus", focused = true}
```

### Событие вставки

```lua
{type = "paste", text = "pasted content"}
```

## Привязки клавиш

Создавайте переиспользуемые привязки клавиш, которые сопоставляются с событиями клавиш:

```lua
local quit = tty.bind({
    keys = {"q", "ctrl+c"},
    help = {key = "q/ctrl+c", desc = "quit"}
})

-- В цикле событий
if quit:matches(ev) then
    break
end
```

### tty.bind(config)

| Поле | Тип | Описание |
|-------|------|-------------|
| `keys` | string[] | Шаблоны клавиш для сопоставления (например, `"a"`, `"ctrl+c"`, `"enter"`) |
| `help` | table | Опционально. `{key = "...", desc = "..."}` для текста справки |

**Возвращает:** `KeyBinding`

### Методы KeyBinding

| Метод | Возвращает | Описание |
|--------|---------|-------------|
| `matches(event)` | boolean | Проверить, соответствует ли событие клавиши этой привязке |
| `set_enabled(bool)` | self | Включить или отключить привязку |
| `is_enabled()` | boolean | Проверить, включена ли привязка |
| `help()` | table | Возвращает справочную информацию `{key, desc}` |

## Стили

Создавайте стилизованный текстовый вывод с помощью стилизации на базе lipgloss. Все методы стиля возвращают новый стиль (immutable).

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

Создать новый пустой стиль.

**Возвращает:** `Style`

### Методы Style

Все методы возвращают новый `Style` и могут быть зацеплены.

#### Декорация текста

| Метод | Параметр | Описание |
|--------|-----------|-------------|
| `foreground(color)` | string | Цвет текста (hex `"#FF0000"`, ANSI `"9"` или имя) |
| `background(color)` | string | Цвет фона |
| `bold(enable?)` | boolean | Жирный текст (по умолчанию: true) |
| `italic(enable?)` | boolean | Курсивный текст |
| `underline(enable?)` | boolean | Подчёркнутый текст |
| `strikethrough(enable?)` | boolean | Перечёркнутый текст |
| `faint(enable?)` | boolean | Приглушённый текст |
| `blink(enable?)` | boolean | Мигающий текст |
| `reverse(enable?)` | boolean | Поменять местами цвет текста и фона |

#### Компоновка

| Метод | Параметр | Описание |
|--------|-----------|-------------|
| `width(n)` | number | Фиксированная ширина |
| `height(n)` | number | Фиксированная высота |
| `max_width(n)` | number | Максимальная ширина |
| `max_height(n)` | number | Максимальная высота |
| `padding(...)` | numbers | Внутренний отступ (CSS-стиль: top, right, bottom, left) |
| `margin(...)` | numbers | Внешний отступ (CSS-стиль) |
| `align(pos)` | number | Горизонтальное выравнивание |
| `align_vertical(pos)` | number | Вертикальное выравнивание |
| `inline(enable?)` | boolean | Inline-режим рендеринга |

#### Границы

| Метод | Параметр | Описание |
|--------|-----------|-------------|
| `border(name, ...)` | string, booleans | Стиль границы, опциональные переключатели по сторонам |
| `border_foreground(...)` | strings | Цвет(а) границы |
| `border_background(...)` | strings | Цвет(а) фона границы |

#### Прочее

| Метод | Описание |
|--------|-------------|
| `render(...)` | Отрендерить строки с применённым стилем |
| `copy()` | Создать копию этого стиля |

### Константы границ

```lua
tty.borders.NORMAL
tty.borders.ROUNDED
tty.borders.THICK
tty.borders.DOUBLE
tty.borders.HIDDEN
```

### Константы выравнивания

```lua
tty.align.LEFT    -- 0
tty.align.CENTER  -- 0.5
tty.align.RIGHT   -- 1
```

## Утилиты текста

Функции компоновки и измерения для стилизованного текста. Доступны под `tty.text`.

### Измерение

```lua
local w = tty.text.width("hello")         -- печатная ширина (с учётом ANSI)
local h = tty.text.height("a\nb\nc")      -- количество строк
local w, h = tty.text.size("hello\nworld") -- оба значения
```

### Соединение

```lua
-- Соединить бок о бок, выровняв по верху
local row = tty.text.join_horizontal(tty.text.position.TOP, left, right)

-- Сложить вертикально, центрировано
local col = tty.text.join_vertical(tty.text.position.CENTER, top, bottom)
```

### Максимальные размеры

```lua
local w = tty.text.max_width({"short", "a longer string"})   -- самое широкое
local h = tty.text.max_height({"one\ntwo", "single"})         -- самое высокое
```

### Размещение

Поместить строку внутри области заданных размеров:

```lua
-- Центрировать в области 80x24
local out = tty.text.place(80, 24, tty.text.position.CENTER, tty.text.position.CENTER, content)

-- Только горизонтально
local out = tty.text.place_horizontal(80, tty.text.position.RIGHT, content)

-- Только вертикально
local out = tty.text.place_vertical(24, tty.text.position.BOTTOM, content)
```

### Константы позиции

```lua
tty.text.position.TOP      -- 0
tty.text.position.LEFT     -- 0
tty.text.position.CENTER   -- 0.5
tty.text.position.BOTTOM   -- 1
tty.text.position.RIGHT    -- 1
```

## См. также

- [Терминальный I/O](lua/system/io.md) — операции stdin/stdout/stderr
- [Terminal Host](system/terminal.md) — Конфигурация хоста терминала
