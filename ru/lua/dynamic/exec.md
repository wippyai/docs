---
title: "Выполнение команд"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='io'/ <secondary-label ref='permissions'/"
---

# Выполнение команд
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Запуск внешних команд и shell-скриптов с полным контролем над потоками ввода-вывода.

Настройка исполнителей описана в разделе [Исполнитель команд](system/exec.md).

## Подключение

```lua
local exec = require("exec")
```

## Получение исполнителя

Получите ресурс исполнителя по его идентификатору:

```lua
local executor, err = exec.get("app:exec")
if err then
    return nil, err
end

-- Работа с исполнителем
local proc = executor:exec("ls -la")
-- ...

-- Освобождение ресурса
executor:release()
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | string | Идентификатор ресурса |

**Возвращает:** `Executor, error`

## Создание процесса

Создайте процесс с заданной командой:

```lua
-- Простая команда
local proc, err = executor:exec("echo 'Hello, World!'")

-- С рабочей директорией
local proc = executor:exec("npm install", {
    work_dir = "/app/project"
})

-- С переменными окружения
local proc = executor:exec("python script.py", {
    work_dir = "/scripts",
    env = {
        PYTHONPATH = "/app/lib",
        DEBUG = "true",
        API_KEY = api_key
    }
})

-- Запуск shell-скрипта
local proc = executor:exec("./deploy.sh production", {
    work_dir = "/app/scripts",
    env = {
        DEPLOY_ENV = "production"
    }
})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `cmd` | string | Исполняемый файл и литеральные аргументы |
| `options.work_dir` | string | Рабочая директория |
| `options.env` | table | Переменные окружения |
| `options.pty` | table | Выделить псевдотерминал для дочернего процесса |

**Возвращает:** `Process, error`

Процесс создан, но не запущен.

### Разбор команды

`cmd` разбивается на исполняемый файл и литеральные аргументы по shell-подобным правилам кавычек: одинарные и двойные кавычки группируют слово, а обратный слэш экранирует следующий символ. Оболочки нет, поэтому не происходит ни подстановки переменных, ни globbing, ни каналов, ни перенаправлений. Незакрытая кавычка возвращает `errors.INVALID`.

```lua
-- Один аргумент с пробелом, передаётся буквально
local proc = executor:exec("grep 'hello world' notes.txt")

-- $HOME передаётся как пять символов $HOME, без подстановки
local proc = executor:exec("echo $HOME")
```

Чтобы воспользоваться возможностями оболочки, вызовите её явно:

```lua
local proc = executor:exec("/bin/sh -c 'ls *.log | wc -l'")
```

### Опции PTY

Выделение PTY даёт дочернему процессу настоящий терминал: редактирование строки, управление задачами и полноэкранные программы работают так же, как в оболочке.

```lua
local proc = executor:exec("/bin/bash --noprofile --norc", {
    pty = {width = 100, height = 30, term = "xterm-256color"},
})
```

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `width` | number | 80 | Начальное число колонок PTY, от 1 до 65535 |
| `height` | number | 24 | Начальное число строк PTY, от 1 до 65535 |
| `term` | string | нет | Значение `TERM` дочернего процесса |

Произведение ширины на высоту не может превышать 262 144 ячеек. Процесс с PTY сливает вывод дочернего процесса в единый терминальный поток; управляйте им через [resize](#resize) и [attach_terminal](#attach_terminal), а не через методы каналов stdin/stdout.

## start / wait

Запуск процесса и ожидание завершения:

```lua
local proc = executor:exec("./build.sh")

local ok, err = proc:start()
if err then
    return nil, err
end

local exit_code, err = proc:wait()
if err then
    return nil, err
end

if exit_code ~= 0 then
    return nil, errors.new("INTERNAL", "Сборка завершилась с кодом: " .. exit_code)
end
```

## stdout_stream / stderr_stream

Получение потоков для чтения вывода процесса:

```lua
local proc = executor:exec("./process-data.sh")

local stdout = proc:stdout_stream()
local stderr = proc:stderr_stream()

proc:start()

-- Чтение всего stdout
local output = {}
while true do
    local chunk = stdout:read(4096)
    if not chunk then break end
    table.insert(output, chunk)
end
local result = table.concat(output)

-- Проверка ошибок
local err_output = {}
while true do
    local chunk = stderr:read(4096)
    if not chunk then break end
    table.insert(err_output, chunk)
end

local exit_code = proc:wait()

stdout:close()
stderr:close()

if exit_code ~= 0 then
    return nil, errors.new("INTERNAL", table.concat(err_output))
end

return result
```

## write_stdin

Запись данных в stdin процесса:

```lua
local proc = executor:exec("sort")
local stdout = proc:stdout_stream()

proc:start()

proc:write_stdin("banana\napple\ncherry\n")

local sorted = stdout:read()

proc:wait()
stdout:close()
```

Каждый вызов записывает переданные байты и возвращает управление. Stdin остаётся открытым на всё время жизни процесса; команда, читающая до конца ввода, завершается, когда процессу отправлен сигнал или он закрыт.

## signal / close

Отправка сигналов или освобождение процесса:

```lua
local proc = executor:exec("./long-running-server.sh")
proc:start()

-- ... позже, нужно остановить ...

-- Отправить SIGTERM и освободить хэндл
proc:close()

-- Отправить SIGKILL и освободить хэндл
proc:close(true)

-- Или отправить конкретный сигнал и сохранить хэндл
local SIGINT = 2
proc:signal(SIGINT)
```

`close(force?)` отправляет запущенному дочернему процессу `SIGTERM` или `SIGKILL`, если `force` истинно, а затем пожинает его в фоне, так что вызов не блокирует. Дочерний процесс, всё ещё работающий по истечении отсрочки, убивается, чтобы пожинание всегда завершалось. Незапущенный хэндл просто инвалидируется, а повторное закрытие ошибкой не является.

Пожинание закрывает каналы stdout и stderr дочернего процесса, поэтому прочитайте нужный вывод до вызова `close()`. После него каждый метод процесса, включая `wait()`, сообщает `process closed` — если важен код выхода, используйте вместо этого `signal()` и `wait()`.

## resize

Изменяет размер PTY у процесса с PTY. Процесс на каналах возвращает ошибку.

```lua
local ok, err = proc:resize(120, 40)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `width` | number | Колонки, от 1 до 65535 |
| `height` | number | Строки, от 1 до 65535 |

**Возвращает:** `boolean, error`

Используйте это, чтобы задать начальную геометрию до передачи процесса терминальной сессии. Как только сессия владеет процессом, отправляйте ей вместо этого событие `resize`.

## attach_terminal

Присоединяет незапущенный процесс с PTY к терминалу вызывающего процесса и возвращает `TerminalSession`.

```lua
local exec = require("exec")
local tty = require("tty")

local executor = assert(exec.get("app:exec"))
local proc = assert(executor:exec("/bin/bash --noprofile --norc", {
    pty = {term = "xterm-256color"},
}))
local session = assert(proc:attach_terminal())
```

**Возвращает:** `TerminalSession, error`

Вызов потребляет процесс: сессия становится единственным владельцем его жизненного цикла, а исходный хэндл больше использовать нельзя. Сессия открывает surface на текущем терминальном порту и владеет эмуляцией PTY, кодированием ввода, изменением размера, мягким и принудительным завершением и пожинанием. Ей нужен терминальный порт — процесс на [терминальном хосте](system/terminal.md) или процесс, порождённый с [грантом viewport](lua/system/tty.md#viewport), — и она завершается неудачей, если у порта нет контроллера ввода или уже открыт surface.

### TerminalSession

| Метод | Возвращает | Описание |
|-------|------------|----------|
| `send(event)` | `boolean, error` | Переслать одно каноническое TTY-событие дочернему процессу |
| `done()` | channel | Канал, срабатывающий один раз по завершении дочернего процесса |
| `status()` | `string, error` | `"running"` или `"done"`, с ошибкой сбоя, если он произошёл |
| `close()` | `boolean, error` | Запросить завершение работающего дочернего процесса |

`send` принимает записи key, mouse, resize, focus и paste, описанные в [TTY](lua/system/tty.md#event-types). Отправка после завершения дочернего процесса возвращает ошибку.

```lua
local channel = require("channel")

local events = assert(tty.events())
assert(tty.start())
local done = session:done()

while true do
    local selected = channel.select({
        events:case_receive(),
        done:case_receive(),
    })
    if not selected.ok or selected.channel == done then break end
    if selected.value.type == "close" then break end
    assert(session:send(selected.value))
end

assert(session:close())
```

## Разрешения

Операции exec подчиняются политикам безопасности.

| Действие | Ресурс | Описание |
|----------|--------|----------|
| `exec.get` | ID исполнителя | Получение ресурса исполнителя |
| `exec.run` | Команда | Выполнение конкретной команды |

`exec.run` вычисляется по сырой строке команды, а запрошенные опции передаются как метаданные:

| Ключ | Тип | Описание |
|------|-----|----------|
| `work_dir` | string | Запрошенная рабочая директория, пустая строка если не задана |
| `env_names` | string[] | Имена переданных переменных окружения, отсортированные; значения не раскрываются |
| `pty.requested` | boolean | Запрашивался ли PTY |
| `pty.width` | number | Итоговое число колонок PTY, присутствует при запросе |
| `pty.height` | number | Итоговое число строк PTY, присутствует при запросе |
| `pty.term` | string | Запрошенное значение `TERM`, присутствует при запросе |

Поэтому политика может разрешать обычные команды, ограничивая те, что запрашивают терминал или конкретную рабочую директорию.

## Ошибки

| Ситуация | Тип | Повтор |
|----------|-----|--------|
| Неверный ID | `errors.INVALID` | нет |
| Доступ запрещён | `errors.INVALID` | нет |
| Процесс закрыт | `errors.INVALID` | нет |
| Процесс не запущен | `errors.INVALID` | нет |
| Процесс уже запущен | `errors.INVALID` | нет |
| Незакрытая кавычка в команде | `errors.INVALID` | нет |
| У процесса нет PTY | `errors.INVALID` | нет |
| Терминальный порт недоступен | `errors.UNAVAILABLE` | нет |

Подробнее см. [Обработка ошибок](lua/core/errors.md).

## См. также

- [Executor](system/exec.md) — конфигурация исполнителя
- [TTY](lua/system/tty.md) — терминальные события, surface и viewport
- [Terminal UI](tutorials/tty.md) — оболочка, размещающая дочерний PTY-процесс в viewport
