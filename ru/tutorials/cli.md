# CLI-приложения

Создание инструментов командной строки, которые читают ввод, пишут вывод и взаимодействуют с пользователями.

## Что создаём

Простой CLI, который приветствует пользователя:

```
$ wippy run -x app:cli
Hello from CLI!
```

## Структура проекта

```
cli-app/
├── wippy.lock
└── src/
    ├── _index.yaml
    └── cli.lua
```

## Шаг 1: Создание проекта

```bash
mkdir cli-app && cd cli-app
mkdir src
```

## Шаг 2: Определения записей

Создайте `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  # Terminal host связывает процессы с stdin/stdout
  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # CLI-процесс
  - name: cli
    kind: process.lua
    source: file://cli.lua
    method: main
    modules:
      - io
```

<tip>
<code>terminal.host</code> соединяет ваш Lua-процесс с терминалом. Без него <code>io.print()</code> некуда писать.
</tip>

## Шаг 3: Код CLI

Создайте `src/cli.lua`:

```lua
local io = require("io")

local function main()
    io.print("Hello from CLI!")
    return 0
end

return { main = main }
```

## Шаг 4: Запуск

```bash
wippy init
wippy run -x app:cli
```

Вывод:
```
Hello from CLI!
```

<note>
Флаг <code>-x</code> автоматически определяет ваш <code>terminal.host</code> и запускается в тихом режиме для чистого вывода.
</note>

## Чтение пользовательского ввода

```lua
local io = require("io")

local function main()
    io.write("Enter your name: ")
    local name = io.readline()

    if name and #name > 0 then
        io.print("Hello, " .. name .. "!")
    else
        io.print("Hello, stranger!")
    end

    return 0
end

return { main = main }
```

## Цветной вывод

Используйте ANSI escape-коды для цветов:

```lua
local io = require("io")

local reset = "\027[0m"
local function red(s) return "\027[31m" .. s .. reset end
local function green(s) return "\027[32m" .. s .. reset end
local function yellow(s) return "\027[33m" .. s .. reset end
local function cyan(s) return "\027[36m" .. s .. reset end
local function bold(s) return "\027[1m" .. s .. reset end

local function main()
    io.print(bold(cyan("Welcome!")))
    io.write(yellow("Enter a number: "))

    local input = io.readline()
    local n = tonumber(input)

    if n then
        io.print("Squared: " .. green(tostring(n * n)))
        return 0
    else
        io.print(red("Error: ") .. "not a number")
        return 1
    end
end

return { main = main }
```

## Системная информация

Доступ к статистике рантайма через модуль `system`:

```yaml
# Добавьте к определению записи
modules:
  - io
  - system
```

```lua
local io = require("io")
local system = require("system")

local function main()
    io.print("Host: " .. system.process.hostname())
    io.print("CPUs: " .. system.runtime.cpu_count())
    io.print("Goroutines: " .. system.runtime.goroutines())

    local mem = system.memory.stats()
    io.print("Memory: " .. string.format("%.1f MB", mem.heap_alloc / 1024 / 1024))

    return 0
end

return { main = main }
```

## Коды завершения

Возвращайте значение из `main()` для установки кода завершения:

```lua
local function main()
    if error_occurred then
        return 1  -- Ошибка
    end
    return 0      -- Успех
end
```

## Справочник I/O

| Функция | Описание |
|---------|----------|
| `io.print(...)` | Вывод в stdout с переводом строки |
| `io.write(...)` | Вывод в stdout без перевода строки |
| `io.eprint(...)` | Вывод в stderr с переводом строки |
| `io.readline()` | Чтение строки из stdin |
| `io.flush()` | Сброс буфера вывода |

## Флаги CLI

| Флаг | Описание |
|------|----------|
| `wippy run -x app:cli` | Запуск CLI-процесса (автоопределение terminal.host) |
| `wippy run -x app:cli --host app:term` | Явное указание terminal host |
| `wippy run -x app:cli -v` | С подробным логированием |

## Следующие шаги

- [Модуль I/O](lua-io.md) — полный справочник по I/O
- [Модуль System](lua-system.md) — информация о рантайме и системе
- [Echo Service](echo-service.md) — многопроцессные приложения
