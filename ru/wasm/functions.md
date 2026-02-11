# Функции WASM

Функции WASM -- это записи реестра, которые выполняют WebAssembly-код. Доступны два вида записей: `function.wat` для встроенного WAT-исходника и `function.wasm` для предкомпилированных бинарников.

## Встроенные WAT-функции

Определяйте небольшие WASM-функции прямо в `_index.yaml`, используя формат WebAssembly Text:

```yaml
entries:
  - name: answer
    kind: function.wat
    source: |
      (module
        (func (export "answer") (result i32)
          i32.const 42
        )
      )
    wit: |
      answer: func() -> s32;
    method: answer
    pool:
      type: inline
```

Для более крупных WAT-исходников используйте ссылку на файл:

```yaml
  - name: answer
    kind: function.wat
    source: file://answer.wat
    wit: |
      answer: func() -> s32;
    method: answer
    pool:
      type: inline
```

### Поля конфигурации WAT

| Field | Required | Описание |
|-------|----------|----------|
| `source` | Yes | Встроенный WAT-исходник или ссылка `file://` |
| `method` | Yes | Имя экспортируемой функции для вызова |
| `wit` | No | WIT-сигнатура для raw/core модулей |
| `pool` | No | Конфигурация пула воркеров |
| `transport` | No | Маппинг ввода/вывода (по умолчанию: `payload`) |
| `imports` | No | Хост-импорты для подключения (напр., `wasi:cli`, `wasi:io`) |
| `wasi` | No | Конфигурация WASI (args, env, mounts) |
| `limits` | No | Ограничения выполнения |

## Предкомпилированные WASM-функции

Загружайте скомпилированные `.wasm`-бинарники из записи файловой системы:

```yaml
entries:
  - name: assets
    kind: fs.directory
    directory: ./wasm

  - name: compute
    kind: function.wasm
    fs: myns:assets
    path: /compute.wasm
    hash: sha256:292b796376f8b4cc360acf2ea6b82d1084871c3607a079f30b446da8e5c984a4
    method: compute
    pool:
      type: lazy
      max_size: 4
```

### Поля конфигурации WASM

| Field | Required | Описание |
|-------|----------|----------|
| `fs` | Yes | ID записи файловой системы, содержащей бинарник |
| `path` | Yes | Путь к `.wasm`-файлу внутри файловой системы |
| `hash` | Yes | SHA-256 хеш для проверки целостности (`sha256:...`) |
| `method` | Yes | Имя экспортируемой функции для вызова |
| `wit` | No | WIT-сигнатура для raw/core модулей |
| `pool` | No | Конфигурация пула воркеров |
| `transport` | No | Маппинг ввода/вывода (по умолчанию: `payload`) |
| `imports` | No | Хост-импорты для подключения |
| `wasi` | No | Конфигурация WASI |
| `limits` | No | Ограничения выполнения |

## Пулы воркеров

Каждая WASM-функция использует пул предкомпилированных экземпляров. Тип пула управляет параллелизмом и потреблением ресурсов.

| Type | Описание |
|------|----------|
| `inline` | Синхронный, однопоточный. Новый экземпляр на каждый вызов. |
| `lazy` | Нет простаивающих воркеров. Масштабируется по запросу до `max_size`. |
| `static` | Фиксированное количество воркеров с очередью запросов. |
| `adaptive` | Автомасштабируемый эластичный пул. |

### Конфигурация пула

```yaml
pool:
  type: static
  size: 4            # Total pool size
  workers: 2         # Worker threads
  buffer: 16         # Request queue buffer (default: workers * 64)
```

```yaml
pool:
  type: lazy
  max_size: 8        # Maximum concurrent instances
```

```yaml
pool:
  type: adaptive
  max_size: 16       # Upper scaling bound
  warm_start: true   # Pre-instantiate initial workers
```

Максимум эластичного пула по умолчанию -- 100 воркеров, если `max_size` не указан.

## Транспорты

Транспорты управляют тем, как входные и выходные данные преобразуются между средой выполнения и WASM-модулем.

| Transport | Описание |
|-----------|----------|
| `payload` | Преобразует данные среды выполнения напрямую в аргументы вызова WASM (по умолчанию) |
| `wasi-http` | Преобразует контекст HTTP-запроса/ответа в аргументы и результаты WASM |

### Транспорт payload

Транспорт по умолчанию передает аргументы напрямую. Lua-значения транскодируются в Go-типы, затем приводятся к WIT-типам:

```yaml
  - name: compute
    kind: function.wasm
    fs: myns:assets
    path: /compute.wasm
    hash: sha256:...
    method: compute
    pool:
      type: inline
```

```lua
-- Arguments passed directly as WASM function parameters
local result, err = funcs.call("myns:compute", 6, 7)
-- result: 42
```

### Транспорт WASI HTTP

Транспорт `wasi-http` преобразует HTTP-запросы в WASM и записывает результаты обратно в HTTP-ответ. Используйте его для предоставления WASM-функций как HTTP-эндпоинтов:

```yaml
  - name: greet_wasm
    kind: function.wasm
    fs: myns:assets
    path: /greet.wasm
    hash: sha256:...
    method: greet
    transport: wasi-http
    pool:
      type: inline

  - name: greet_endpoint
    kind: http.endpoint
    method: POST
    path: /api/greet
    func: greet_wasm
```

## Ограничения выполнения

Установите максимальное время выполнения функции:

```yaml
limits:
  max_execution_ms: 5000   # 5 second timeout
```

При превышении лимита выполнение отменяется и возвращается ошибка.

## Конфигурация WASI

Настройте WASI-возможности для гостевого модуля:

```yaml
wasi:
  args: ["--verbose"]
  cwd: "/app"
  env:
    - id: myns:api_key
      name: API_KEY
      required: true
    - id: myns:debug_mode
      name: DEBUG
  mounts:
    - fs: myns:data_files
      guest: /data
      read_only: true
    - fs: myns:output
      guest: /output
```

| Field | Описание |
|-------|----------|
| `args` | Аргументы командной строки, передаваемые гостю |
| `cwd` | Рабочая директория внутри гостя (должна быть абсолютной) |
| `env` | Переменные окружения, привязанные к записям окружения реестра |
| `mounts` | Монтирование файловых систем из записей файловой системы реестра |

Переменные окружения разрешаются из реестра окружения в момент вызова. Обязательные переменные вызывают ошибку, если не найдены.

Пути монтирования должны быть абсолютными и уникальными. Каждая точка монтирования связывает запись файловой системы среды выполнения с путем директории в госте.

## Примеры

### Конвейер преобразования данных

```yaml
entries:
  - name: wasm_binaries
    kind: fs.directory
    directory: ./wasm

  - name: transform_users
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /mapper.wasm
    hash: sha256:7304fc7d19778605458ae5804dae9a7343dcd3f5fc22bcc9415e98b5047192dd
    method: transform-users
    pool:
      type: lazy
      max_size: 4

  - name: filter_active
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /mapper.wasm
    hash: sha256:7304fc7d19778605458ae5804dae9a7343dcd3f5fc22bcc9415e98b5047192dd
    method: filter-active
    pool:
      type: lazy
      max_size: 4
```

```lua
local funcs = require("funcs")

local users = {
    {id = 1, name = "Alice", tags = {"admin", "dev"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
    {id = 3, name = "Carol", tags = {"dev"}, active = true},
}

-- Transform: adds display field and tag count
local transformed, err = funcs.call("myns:transform_users", users)

-- Filter: returns only active users
local active, err = funcs.call("myns:filter_active", users)
```

### Асинхронный sleep с WASI Clocks

WASM-компоненты, импортирующие `wasi:clocks` и `wasi:io`, могут использовать часы и опрос (polling). Механизм асинхронной передачи управления интегрируется с диспетчером Wippy:

```yaml
  - name: sleep_ms
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /sleep_test.wasm
    hash: sha256:...
    method: "test-sleep#sleep-ms"
    imports:
      - wasi:io
      - wasi:clocks
    pool:
      type: inline
```

Разделитель `#` в поле method указывает на метод интерфейса: `test-sleep#sleep-ms` вызывает функцию `sleep-ms` из интерфейса `test-sleep`.

## См. также

- [Обзор](wasm/overview.md) - Обзор среды выполнения WebAssembly
- [Хост-функции](wasm/hosts.md) - Доступные хост-интерфейсы
- [Процессы](wasm/processes.md) - Запуск WASM как процессов
- [Типы записей](guides/entry-kinds.md) - Все виды записей реестра
