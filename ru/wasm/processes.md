# Процессы WASM

WASM-модули могут запускаться как процессы через вид записи `process.wasm`. Процессы выполняются внутри хоста процессов Wippy и поддерживают полный жизненный цикл: порождение, мониторинг и контролируемое завершение.

## Конфигурация записи

```yaml
entries:
  - name: wasm_binaries
    kind: fs.directory
    directory: ./wasm

  - name: compute_worker
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /worker.wasm
    hash: sha256:292b796376f8b4cc360acf2ea6b82d1084871c3607a079f30b446da8e5c984a4
    method: compute
```

### Поля конфигурации

| Field | Required | Описание |
|-------|----------|----------|
| `fs` | Yes | ID записи файловой системы, содержащей бинарник |
| `path` | Yes | Путь к `.wasm`-файлу внутри файловой системы |
| `hash` | Yes | SHA-256 хеш для проверки целостности |
| `method` | Yes | Имя экспортируемой функции для выполнения |
| `imports` | No | Хост-импорты для подключения |
| `wasi` | No | Конфигурация WASI (args, env, mounts) |
| `limits` | No | Ограничения выполнения |

## CLI-команды

Зарегистрируйте WASM-процесс как именованную команду с помощью `meta.command`:

```yaml
  - name: greet
    kind: process.wasm
    meta:
      command:
        name: greet
        short: Greet someone via WASM
    fs: myns:wasm_binaries
    path: /component.wasm
    hash: sha256:...
    method: greet
```

Запуск:

```bash
wippy run greet
```

Список доступных команд:

```bash
wippy run list
```

| Field | Required | Описание |
|-------|----------|----------|
| `name` | Yes | Имя команды для использования с `wippy run <name>` |
| `short` | No | Краткое описание, отображаемое в `wippy run list` |

Для работы CLI-команд необходимы `terminal.host` и `process.host`.

## Жизненный цикл процесса

WASM-процессы следуют модели жизненного цикла Init/Step/Close:

1. **Init** - Модуль инстанцируется, входные аргументы захватываются
2. **Step** - Выполнение продвигается. Для асинхронных модулей планировщик управляет циклами yield/resume. Для синхронных модулей выполнение завершается за один шаг.
3. **Close** - Ресурсы экземпляра освобождаются

## Порождение из Lua

Порождение WASM-процесса с мониторингом завершения:

```lua
local process = require("process")
local time = require("time")

-- Spawn with monitoring
local pid, err = process.spawn_monitored(
    "myns:compute_worker",   -- entry ID
    "myns:processes",        -- process group
    6, 7                     -- arguments passed to the WASM function
)

if err then
    error("spawn failed: " .. tostring(err))
end

-- Wait for the process to complete
local event = process.receive(time.seconds(10))
if event and event.type == "EXIT" then
    local result = event.value  -- return value from the WASM function
end
```

## Асинхронное выполнение

WASM-процессы, импортирующие WASI-интерфейсы, могут выполнять асинхронные операции. Планировщик приостанавливает процесс во время I/O и возобновляет его после завершения операции:

```yaml
  - name: http_worker
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /http_worker.wasm
    hash: sha256:...
    method: run
    imports:
      - wasi:io
      - wasi:cli
      - wasi:http
      - funcs
    wasi:
      env:
        - id: myns:api_url
          name: API_URL
          required: true
```

Механизм yield/resume прозрачен для WASM-кода. Стандартные блокирующие вызовы в госте (sleep, read, write, HTTP-запросы) автоматически передают управление диспетчеру.

## Конфигурация WASI

Процессы поддерживают ту же конфигурацию WASI, что и функции:

```yaml
  - name: file_processor
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /processor.wasm
    hash: sha256:...
    method: process
    imports:
      - wasi:cli
      - wasi:io
      - wasi:clocks
      - wasi:filesystem
    wasi:
      args: ["--input", "/data/input.csv"]
      cwd: "/app"
      env:
        - id: myns:output_format
          name: OUTPUT_FORMAT
      mounts:
        - fs: myns:input_data
          guest: /data
          read_only: true
        - fs: myns:output_dir
          guest: /output
```

## См. также

- [Обзор](wasm/overview.md) - Обзор среды выполнения WebAssembly
- [Функции](wasm/functions.md) - Конфигурация функций WASM
- [Хост-функции](wasm/hosts.md) - Доступные хост-интерфейсы
- [Модель процессов](concepts/process-model.md) - Жизненный цикл процессов
- [Супервизия](guides/supervision.md) - Деревья супервизии процессов
