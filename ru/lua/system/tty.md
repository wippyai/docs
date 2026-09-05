---
title: "TTY"
description: "<secondary-label ref='process'/ <secondary-label ref='io'/"
---

# TTY
<secondary-label ref="process"/>
<secondary-label ref="io"/>

События терминального ввода, стилизованный вывод, surface представления и локальные виртуальные viewport.

<note>
Каждая функция разрешает терминальный порт, присоединённый к фрейму вызывающего процесса. Процесс на <a href="system/terminal.md">Terminal Host</a> владеет физическим терминалом; <code>process.lua</code> на обычном <code>process.host</code> владеет виртуальным терминалом, если порождён с грантом viewport. Без такого присоединения модуль возвращает "no terminal context".
</note>

## Загрузка

```lua
local tty = require("tty")
```

## Модель

**Surface** — это исключительная аренда представления, которую один процесс держит на своём терминальном порту. Он публикует целые снимки строк; вычислением различий и восстановлением терминала владеет бэкенд. На порту одновременно может быть открыт только один surface.

**Canvas** — внутрипроцессный буфер композиции стилизованных ячеек. Он обрезает содержимое по границам ячеек и никогда не выдаёт собственных управляющих команд терминала.

**Viewport** — локальная структурированная граница терминала, позволяющая одному процессу размещать surface другого процесса без совместного использования байтовых потоков. Оболочка решает, где появится содержимое viewport, и транслирует ввод в координаты дочернего процесса; дочерний процесс видит обычный терминальный порт и не знает, полноэкранный он, размещён в мозаике, во вкладке или скрыт.

Viewport локальны для одной ноды среды исполнения. Гранты и хэндлы — это непрозрачные локальные возможности, а не сериализуемые сетевые ссылки.

## Цикл ввода

Запустите доставку ввода, подпишитесь на события и обработайте их в цикле:

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

Вызывайте `events()` до `start()`, чтобы потребитель был готов к моменту прихода первых событий. На виртуальном порту `start()` открывает доставку событий от зрителя к производителю, а `stop()` её закрывает: `Viewport:send()` вне этого интервала завершается ошибкой, а не молча теряет ввод. Доставка событий изменения размера не зависит от состояния ввода.

## Управление вводом

### tty.start()

Запустить доставку ввода для текущего порта. Физический терминал переключается в raw-режим.

```lua
local ok, err = tty.start()
```

**Возвращает:** `boolean, error`

### tty.stop()

Остановить доставку ввода и вернуть терминал в нормальный режим.

```lua
local ok, err = tty.stop()
```

**Возвращает:** `boolean, error`

### tty.events()

Подписаться на события терминала этого порта и вернуть канал. События доставляются в виде таблиц с полем `type`. Подпишитесь один раз и переиспользуйте канал.

```lua
local events, err = tty.events()
```

**Возвращает:** `EventChannel, error`

У `EventChannel` есть `receive()` и `case_receive()`, поэтому он сочетается с `channel.select`.

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

## Surface

Surface — это аренда представления на порту. Получите её, публикуйте целые кадры и закройте, когда закончите.

### tty.surface(options?)

```lua
local surface, err = tty.surface({
    alternate_screen = true,
    hide_cursor = true,
    synchronized_output = true,
})
```

| Опция | Тип | По умолчанию | Описание |
|-------|-----|--------------|----------|
| `alternate_screen` | boolean | false | Выводить на альтернативный экранный буфер терминала |
| `hide_cursor` | boolean | false | Скрывать курсор терминала, пока surface открыт |
| `synchronized_output` | boolean | false | Оборачивать каждый кадр маркерами синхронизированного вывода |

**Возвращает:** `Surface, error`

Открытие второго surface на порту, где он уже есть, завершается ошибкой. Виртуальный порт хранит опции как метаданные surface; физический порт транслирует их в режимы терминала и восстанавливает при закрытии.

### surface:present(rows, options?)

Публикует полный массив строк кадра. Строка `1` — верхняя.

```lua
local stats, err = surface:present(rows, {
    cursor = {x = 12, y = 3, visible = true},
})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `rows` | string[] | Полный кадр, не более 16384 строк |
| `options.cursor` | table | `{x, y, visible}` в координатах surface с отсчётом от единицы |

Опущенный `cursor` сохраняет последнее явно заданное состояние курсора. При наличии `cursor` все три его поля обязательны.

**Возвращает:** `stats, error` — неизменяемая запись с полями `rows`, `changed_rows` и `bytes_written`. Физический кадр, идентичный предыдущему, ничего не пишет.

### surface:invalidate()

Забыть состояние представления бэкенда, не стирая логический кадр. Следующий `present` будет зафиксирован, даже если строки не изменились. Используйте после изменения размера внешнего терминала или когда физическое состояние мог нарушить другой владелец.

**Возвращает:** `boolean`

### surface:close()

Освободить аренду. Идемпотентно: последующие вызовы возвращают результат первого закрытия. Физический бэкенд восстанавливает режимы терминала.

**Возвращает:** `boolean, error`

## Canvas

Canvas — ограниченный буфер стилизованных ячеек, используемый для композиции кадра перед выводом.

### tty.canvas(width, height)

```lua
local canvas = tty.canvas(width, height)
```

Ширина ограничена 16384 колонками, высота — 16384 строками, а площадь — 262 144 ячейками. Аргументы вне диапазона вызывают ошибку аргумента.

**Возвращает:** `Canvas`

Рисование принимает стилизованный текст, а не команды терминала. Цвета SGR и ссылки OSC 8 сохраняются; стирание, перемещение курсора и другой чисто управляющий вывод не выдаётся. Каждое размещение обрезается независимо по границам ячеек с учётом ширины графем, поэтому обрезанная escape-последовательность не может просочиться в соседнее содержимое.

### canvas:clear(fill?)

Очищает все ячейки. Необязательная стилизованная строка `fill` повторяется по каждой строке.

```lua
canvas:clear()
canvas:clear(tty.style():background("#1a1a1a"):render(" "))
```

**Возвращает:** `boolean`

### canvas:put(x, y, text, width?)

Размещает одну стилизованную строку в позиции `x`, `y` с отсчётом от единицы и обрезает её до `width` ячеек (по умолчанию — ширина canvas). Координаты могут быть отрицательными или выходить за край; размещение обрезается, а не отклоняется. Перевод строки завершает строку, поэтому для многострочного содержимого используйте `put_rows`.

```lua
canvas:put(3, 1, tty.style():bold():render("Title"), 40)
```

**Возвращает:** `boolean`

### canvas:put_rows(x, y, rows, width?)

Размещает массив стилизованных строк начиная с `x`, `y`, по одной строке вниз. Каждый элемент проверяется до того, как что-либо будет нарисовано.

```lua
canvas:put_rows(2, 2, child_rows, inner_width)
```

**Возвращает:** `boolean`

### canvas:rows()

Рендерит полный массив строк, готовый для `surface:present`.

**Возвращает:** `string[]`

## Viewport

Viewport — виртуальный терминальный порт. Создающий процесс становится его первым зрителем; процесс, допущенный по его гранту, — его производителем.

### tty.viewport(options?)

```lua
local view, err = tty.viewport({width = 80, height = 24})
```

| Опция | Тип | По умолчанию | Описание |
|-------|-----|--------------|----------|
| `width` | number | 80 | Колонки, от 1 до 65535 |
| `height` | number | 24 | Строки, от 1 до 65535 |

Площадь ограничена 262 144 ячейками.

**Возвращает:** `Viewport, error`

### tty.attach(handle)

Добавляет ещё одного локального зрителя к существующему viewport. Хэндл даёт право просмотра, но не владение представлением, и недействителен на другой ноде.

```lua
local view, err = tty.attach(handle)
```

**Возвращает:** `Viewport, error`

### viewport:grant()

Возвращает одноразовую возможность производителя. Передайте её как опцию spawn `terminal`:

```lua
local grant = assert(view:grant())
local child = assert(process.with_options({terminal = grant})
    :spawn_monitored("app:child", "app:workers"))
```

Допуск потребляет грант транзакционно: отклонённый запуск восстанавливает грант неразрешённым, а процесс, разрешивший порт, потребляет его окончательно. Хост без поддержки присоединения терминалов отклоняет spawn, а не игнорирует опцию. См. [Процессы](lua/core/process.md#spawner-with-options).

**Возвращает:** `string, error`

### viewport:handle()

Возвращает локальный хэндл зрителя для `tty.attach`.

**Возвращает:** `string`

### viewport:snapshot(after_revision?)

Читает текущие размеры, строки, курсор и ревизию. С `after_revision` возвращает `nil`, если ревизия не изменилась.

```lua
local frame = view:snapshot(revision)
if frame then
    revision = frame.revision
    canvas:put_rows(2, 2, frame.rows, inner_width)
end
```

**Возвращает:** `snapshot` или `nil`

| Поле | Тип | Описание |
|------|-----|----------|
| `revision` | number | Монотонная ревизия этого кадра |
| `width` | number | Колонки viewport |
| `height` | number | Строки viewport |
| `rows` | string[] | Строки, последний раз опубликованные производителем |
| `cursor` | table | `{x, y, visible}` в координатах с отсчётом от единицы; отсутствует, пока производитель не опубликует явное состояние курсора |

### viewport:updates()

Возвращает канал объединённых водяных знаков ревизий. `receive()` выдаёт номер ревизии; `case_receive()` сочетается с `channel.select`.

```lua
local updates = assert(view:updates())
```

Обновления — это ограниченные подсказки, а не журнал событий. Медленный зритель получает только самый свежий водяной знак и должен вызывать `snapshot()` за состоянием. Представление и изменение размера никогда не блокируются из-за медленного зрителя.

**Возвращает:** `ViewportUpdateChannel, error`

### viewport:send(event)

Пересылает проверенную запись события производителю. Производитель должен был вызвать `tty.start()`; иначе вызов завершается ошибкой, а не теряет событие.

```lua
assert(view:send(event))
assert(view:send({type = "close"}))
```

**Возвращает:** `boolean, error`

### viewport:resize(width, height)

Обновляет геометрию viewport. При изменении размера зрители получают новую ревизию, а производитель — событие `resize`.

**Возвращает:** `boolean, error`

### viewport:close()

Отсоединяет только этого зрителя. Закрытие последнего зрителя не убивает живого производителя, а закрытие порта производителя не уничтожает состояние, пока остаются зрители.

**Возвращает:** `boolean, error`

## Типы событий

События — это таблицы с полем `type`, которое определяет, какие другие поля присутствуют. Координаты отсчитываются от единицы. Те же записи принимает `viewport:send()`.

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

Сообщает о владении клавиатурой.

```lua
{type = "focus", focused = true}
```

### Событие видимости

Сообщает, полезна ли перерисовка. Оно не предписывает жизненный цикл приложения или фоновые вычисления.

```lua
{type = "visibility", visible = true}
```

### Событие вставки

```lua
{type = "paste", text = "pasted content"}
```

### Событие закрытия

Просит производителя завершить работу. Оболочка отправляет его через `viewport:send`, чтобы запросить корректный выход дочернего процесса.

```lua
{type = "close"}
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

### Обрезка

```lua
-- Обрезать до печатной ширины, с необязательным хвостом
local head = tty.text.truncate(line, 40)
local head = tty.text.truncate(line, 40, "…")

-- Взять диапазон печатных ячеек [left, right)
local middle = tty.text.cut(line, 10, 30)
```

Обе функции сохраняют состояние ANSI и границы графем, поэтому стилизованный текст можно обрезать и склеивать, не ломая escape-последовательности. `truncate` возвращает пустую строку при ширине ноль или меньше; `cut` возвращает пустую строку, если `right` не больше `left`.

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

## Разрешения

Модуль не применяет собственных действий политики. Доступ к терминалу приходит из фрейма: терминальный хост присоединяет физический порт, а `process.with_options({terminal = grant})` присоединяет viewport, что требует `process.context` на порождающей стороне.

## См. также

- [Terminal UI](tutorials/tty.md) — сборка оболочки, размещающей дочерний процесс в viewport
- [Терминальный I/O](lua/system/io.md) — операции stdin/stdout/stderr
- [Terminal Host](system/terminal.md) — Конфигурация хоста терминала
- [Выполнение команд](lua/dynamic/exec.md) — PTY-процессы и терминальные сессии
- [Процессы](lua/core/process.md) — опции spawn, мониторинг, события жизненного цикла
