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
| `cmd` | string | Команда для выполнения |
| `options.work_dir` | string | Рабочая директория |
| `options.env` | table | Переменные окружения |

**Возвращает:** `Process, error`

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
-- Передача данных команде
local proc = executor:exec("sort")
local stdout = proc:stdout_stream()

proc:start()

-- Запись входных данных
proc:write_stdin("banana\napple\ncherry\n")
proc:write_stdin("")  -- Сигнал EOF

-- Чтение отсортированного вывода
local sorted = stdout:read()
print(sorted)  -- "apple\nbanana\ncherry\n"

proc:wait()
stdout:close()
```

## signal / close

Отправка сигналов или закрытие процесса:

```lua
local proc = executor:exec("./long-running-server.sh")
proc:start()

-- ... позже, нужно остановить ...

-- Мягкое завершение (SIGTERM)
proc:close()

-- Или принудительное завершение (SIGKILL)
proc:close(true)

-- Или отправка конкретного сигнала
local SIGINT = 2
proc:signal(SIGINT)
```

## Разрешения

Операции exec подчиняются политикам безопасности.

| Действие | Ресурс | Описание |
|----------|--------|----------|
| `exec.get` | ID исполнителя | Получение ресурса исполнителя |
| `exec.run` | Команда | Выполнение конкретной команды |

## Ошибки

| Ситуация | Тип | Повтор |
|----------|-----|--------|
| Неверный ID | `errors.INVALID` | нет |
| Доступ запрещён | `errors.PERMISSION_DENIED` | нет |
| Процесс закрыт | `errors.INVALID` | нет |
| Процесс не запущен | `errors.INVALID` | нет |
| Процесс уже запущен | `errors.INVALID` | нет |

Подробнее см. [Обработка ошибок](lua/core/errors.md).
