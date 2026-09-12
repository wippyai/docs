---
title: "Процессы WASM"
description: "Запускайте постоянных WASM-акторов в хосте процессов Wippy с помощью process.wasm."
---

# Процессы WASM

Запись `process.wasm` создаёт постоянный изолированный WASM-актор в хосте
процессов Wippy. Один экземпляр модуля живёт всё время существования PID,
сохраняет состояние гостя между сообщениями и участвует в порождении,
мониторинге, обмене сообщениями и контролируемом завершении.

**Классификация: справочник конфигурации и жизненного цикла процесса.** Блоки с
бинарниками предполагают внешнюю сборку компонента и принадлежащие приложению
записи файловой системы, хоста процессов, окружения и политик. Хеши-заполнители
нужно заменить точным дайджестом бинарника.

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
    method: run
    imports:
      - wippy:actor
      - wasi:io
      - wasi:poll
    options:
      limits:
        memory_bytes: 67108864
      mailbox:
        capacity: 128
        bytes: 8388608
        message_bytes: 1048576
```

### Поля конфигурации

| Field | Required | Описание |
|-------|----------|----------|
| `fs` | Yes | ID записи файловой системы, содержащей бинарник |
| `path` | Yes | Путь к `.wasm`-файлу внутри файловой системы |
| `hash` | Yes | SHA-256 хеш для проверки целостности |
| `method` | Yes | Имя экспортируемой функции для выполнения |
| `transport` | No | Транспорт вызова: `payload` (по умолчанию) или `wasi-http` |
| `wit` | No | WIT-сигнатура для raw/core-модулей |
| `imports` | No | Хост-импорты для подключения |
| `wasi` | No | Конфигурация WASI (`args`, `cwd`, `env` и `mounts`) |
| `options` | No | Параметры актора: `worker_class`, `limits` и `mailbox` |

<note>
Актор `process.wasm` владеет одним экземпляром модуля в течение всей жизни PID и сохраняет состояние гостя между сообщениями. Поэтому пул функций не используется, а блок `pool` отклоняется. Ограничения актора задаются в `options.limits`; прежние варианты `limits` и `meta.options` временно принимаются с предупреждением об устаревании.
</note>

### Акторы WASM с состоянием

Для component guest импорт `wippy:actor` предоставляет текущий PID и его
ограниченный mailbox. Интерфейс `wippy:actor/process@0.1.0` включает:

| Функция | Поведение |
|---------|-----------|
| `self()` | Возвращает текущий PID актора как строку |
| `send(target, topic, payloads)` | Отправляет проверенное политикой сообщение другому PID |
| `try-receive()` | Немедленно возвращает следующее сообщение или `none` |
| `receive()` | Приостанавливается до появления сообщения |
| `subscribe()` | Возвращает pollable `wasi:io/poll` для готовности mailbox |

Сообщение содержит PID отправителя, topic и до 16 payload. Форматы payload —
`bytes`, UTF-8 `text` и UTF-8 `json`. Отправка авторизуется как `process.send`
для целевого PID. Некорректные, слишком большие сообщения и сообщения сверх
ёмкости mailbox отклоняются до передачи гостю.

Обычно guest экспортирует долгоживущую функцию `run`:

```wit
package example:worker;

world worker {
  import wippy:actor/process@0.1.0;
  import wasi:io/poll@0.2.8;
  export run: func() -> result<_, string>;
}
```

В `run` вызывайте `receive()` в цикле, обновляйте состояние guest и отвечайте
через `send()` на `message.from`. Возврат из `run` завершает процесс.

## Управление актором

Постоянные лимиты ресурсов и mailbox задаются внутри `options`:

```yaml
options:
  worker_class: wasm
  limits:
    memory_bytes: 67108864
    host_buffer_bytes: 8388608
    asyncify_stack_bytes: 65536
    max_execution_ms: 0
    max_open_sockets: 16
    socket_timeout_ms: 30000
  mailbox:
    capacity: 128
    bytes: 8388608
    message_bytes: 1048576
```

| Поле | По умолчанию | Описание |
|------|--------------|----------|
| `worker_class` | `wasm` | Выделенный класс worker планировщика; сейчас поддерживается только `wasm` |
| `limits.memory_bytes` | 64 МиБ | Ограничение линейной памяти guest; положительное кратное 64 КиБ, максимум 4 ГиБ |
| `limits.host_buffer_bytes` | без ограничений | Учитываемый лимит резидентных буферов хоста; `0` отключает этот лимит |
| `limits.asyncify_stack_bytes` | по умолчанию среды (64 КиБ) | Собственное хранилище приостановки для core-модуля |
| `limits.max_execution_ms` | без ограничений | Время жизни актора по часам; `0` означает отсутствие срока |
| `limits.max_open_sockets` | 16 | Одновременно открытые сокеты актора |
| `limits.socket_timeout_ms` | 30000 | Тайм-аут операций с сокетами в миллисекундах |
| `mailbox.capacity` | 128 | Максимум сообщений в очереди |
| `mailbox.bytes` | 8 МиБ | Совокупный лимит сообщений в очереди |
| `mailbox.message_bytes` | 1 МиБ | Лимит одного сообщения с учётом framing overhead |

`mailbox.message_bytes` не может превышать `mailbox.bytes`. Ёмкость также
должна укладываться в минимальный учёт 256 байт на сообщение. Неизвестные поля
и недопустимые значения приводят к отклонению записи.

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
| `main` | No | Назначить запись командой по умолчанию для pack или hub-модуля |
| `use_case` | No | Категория точки входа; по умолчанию `run` |
| `security` | No | Контекст безопасности, применяемый только при запуске этой команды доверенным терминальным launcher |

Для работы CLI-команд необходим `terminal.host` — именно он является хостом процессов, выполняющим команду.

## Жизненный цикл процесса

WASM-процессы следуют модели жизненного цикла Init/Step/Close:

1. **Init** - Модуль инстанцируется, входные аргументы захватываются
2. **Step** - На первом шаге модуль инстанцируется и запускается. Последующие шаги продвигают операции, связанные с диспетчером; синхронное выполнение может завершиться на первом шаге.
3. **Close** - Ресурсы экземпляра освобождаются

## Порождение из Lua

Порождение WASM-процесса с мониторингом завершения:

```lua
local errors = require("errors")

-- Spawn with monitoring
local pid, err = process.spawn_monitored(
    "myns:compute_worker",   -- entry ID
    "myns:processes",        -- process host
    6, 7                     -- arguments passed to the WASM function
)

if err then
    return nil, err
end

-- Wait for the process to complete
local events = process.events()
    local event, open = events:receive()
    if not open then return nil, errors.new("process event channel closed") end
    if event.kind == process.event.EXIT and event.from == pid then
        local result = event.result.value  -- return value from the WASM function
        return result, event.result.error
    end
```

## Асинхронное выполнение

WASM-акторы могут уступать управление на операциях хоста, которые среда
выполнения передаёт через диспетчер: приём и отправка сообщений mailbox,
polling, часы, сокеты, DNS, потоки файловой системы и исходящий HTTP.
Планировщик приостанавливает процесс до завершения операции, а затем
возобновляет тот же экземпляр гостя:

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
    wasi:
      env:
        - id: myns:api_url
          name: API_URL
          required: true
```

Механизм yield/resume прозрачен для asyncify-модуля core или компонента,
использующего поддерживаемые pollable-интерфейсы.

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
