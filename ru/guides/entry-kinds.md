# Типы записей

Полный справочник всех типов записей Wippy.

> Записи ссылаются друг на друга в формате `namespace:name`. Реестр автоматически связывает зависимости, обеспечивая правильный порядок инициализации ресурсов.

## См. также

- [Реестр](concepts/registry.md) — хранение и разрешение записей
- [Конфигурация](guides/configuration.md) — формат YAML

## Lua Runtime

| Тип | Описание |
|-----|----------|
| `function.lua` | Точка входа Lua-функции |
| `process.lua` | Долгоживущий Lua-процесс |
| `workflow.lua` | Temporal workflow (детерминированный) |
| `library.lua` | Разделяемая Lua-библиотека |

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
  imports:
    utils: app.lib:helpers  # Импорт другой записи как модуля
```

<tip>
Используйте <code>imports</code> для ссылок на другие Lua-записи. Они становятся доступны через <code>require("alias_name")</code> в коде.
</tip>

## HTTP-сервисы

| Тип | Описание |
|-----|----------|
| `http.service` | HTTP-сервер (слушает порт) |
| `http.router` | Префикс маршрутов и middleware |
| `http.endpoint` | HTTP-эндпоинт (метод + путь) |
| `http.static` | Раздача статических файлов |

```yaml
# HTTP-сервер
- name: gateway
  kind: http.service
  addr: ":8080"
  lifecycle:
    auto_start: true

# Роутер с middleware
- name: api
  kind: http.router
  meta:
    server: gateway
  prefix: /api
  middleware:
    - cors
    - rate_limit

# Эндпоинт
- name: users_list
  kind: http.endpoint
  meta:
    router: app:api
  method: GET
  path: /users
  func: list_handler
```

**Lua API:** См. [Модуль HTTP](lua/http/http.md)

```lua
local http = require("http")
local req = http.request()
local resp = http.response()

resp:status(200):json({users = get_users()})
```

## Базы данных

| Тип | Описание |
|-----|----------|
| `db.sql.sqlite` | SQLite |
| `db.sql.postgres` | PostgreSQL |
| `db.sql.mysql` | MySQL |
| `db.sql.mssql` | Microsoft SQL Server |
| `db.sql.oracle` | Oracle |

### SQLite

```yaml
- name: database
  kind: db.sql.sqlite
  file: "./data/app.db"
  lifecycle:
    auto_start: true

# In-memory для тестов
- name: testdb
  kind: db.sql.sqlite
  file: ":memory:"
```

### PostgreSQL

```yaml
- name: database
  kind: db.sql.postgres
  dsn: "postgres://user:pass@localhost:5432/dbname?sslmode=disable"
  pool:
    max_open: 25
    max_idle: 5
    max_lifetime: "30m"
  lifecycle:
    auto_start: true
```

### MySQL

```yaml
- name: database
  kind: db.sql.mysql
  dsn: "user:pass@tcp(localhost:3306)/dbname?parseTime=true"
  lifecycle:
    auto_start: true
```

### MSSQL

```yaml
- name: database
  kind: db.sql.mssql
  dsn: "sqlserver://user:pass@localhost:1433?database=dbname"
  lifecycle:
    auto_start: true
```

**Lua API:** См. [Модуль SQL](lua/storage/sql.md)

```lua
local sql = require("sql")
local db, err = sql.get("app:database")

local rows, err = db:query("SELECT * FROM users WHERE id = ?", user_id)
db:execute("INSERT INTO logs (msg) VALUES (?)", message)
```


## Key-Value хранилища

| Тип | Описание |
|-----|----------|
| `store.memory` | In-memory хранилище |
| `store.sql` | Хранилище на базе SQL |

```yaml
# Memory store
- name: cache
  kind: store.memory
  lifecycle:
    auto_start: true

# SQL-backed store
- name: persistent_store
  kind: store.sql
  database: app:database
  table: kv_store
  lifecycle:
    auto_start: true
```

**Lua API:** См. [Модуль Store](lua/storage/store.md)

```lua
local store = require("store")
local s, err = store.get("app:cache")

s:set("user:123", user_data, 3600)  -- TTL в секундах
local data = s:get("user:123")
```

## Очереди

| Тип | Описание |
|-----|----------|
| `queue.driver.memory` | In-memory драйвер очередей |
| `queue.queue` | Объявление очереди |
| `queue.consumer` | Потребитель очереди |

```yaml
# Драйвер
- name: queue_driver
  kind: queue.driver.memory
  lifecycle:
    auto_start: true

# Очередь
- name: jobs
  kind: queue.queue
  driver: queue_driver

# Потребитель
- name: job_consumer
  kind: queue.consumer
  queue: app:jobs
  func: job_handler
  concurrency: 4
  prefetch: 10
  lifecycle:
    auto_start: true
```

**Lua API:** См. [Модуль Queue](lua/storage/queue.md)

```lua
local queue = require("queue")

-- Публикация сообщения
queue.publish("app:jobs", {task = "process", id = 123})

-- В обработчике — доступ к текущему сообщению
local msg = queue.message()
local data = msg:body_json()
```

<note>
Функция <code>func</code> потребителя вызывается для каждого сообщения. Используйте <code>queue.message()</code> внутри обработчика для доступа к текущему сообщению.
</note>

## Управление процессами

| Тип | Описание |
|-----|----------|
| `process.host` | Хост выполнения процессов |
| `process.service` | Супервизируемый процесс (обёртка над process.lua) |
| `terminal.host` | Хост терминала/CLI |

```yaml
# Хост процессов (где выполняются процессы)
- name: processes
  kind: process.host
  host:
    workers: 32             # Горутины-воркеры (по умолчанию: NumCPU)
    queue_size: 1024        # Размер глобальной очереди
    local_queue_size: 256   # Очередь на воркер
  lifecycle:
    auto_start: true

# Определение процесса
- name: worker_process
  kind: process.lua
  source: file://worker.lua
  method: main

# Супервизируемый сервис
- name: worker
  kind: process.service
  process: app:worker_process
  host: app:processes
  input: ["arg1", "arg2"]
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10

- name: terminal
  kind: terminal.host
  lifecycle:
    auto_start: true
```

<tip>
Используйте <code>process.service</code>, когда нужен процесс как супервизируемый сервис с автоматическим перезапуском. Поле <code>process</code> ссылается на запись <code>process.lua</code>.
</tip>

## Temporal (Workflows)

| Тип | Описание |
|-----|----------|
| `temporal.client` | Подключение к Temporal |
| `temporal.worker` | Воркер Temporal |

```yaml
- name: temporal_client
  kind: temporal.client
  address: "localhost:7233"
  namespace: "default"
  auth:
    type: none  # none, api_key, mtls
  lifecycle:
    auto_start: true

- name: temporal_worker
  kind: temporal.worker
  client: temporal_client
  task_queue: "main-queue"
  lifecycle:
    auto_start: true
```

## Облачное хранилище

| Тип | Описание |
|-----|----------|
| `config.aws` | Конфигурация AWS |
| `cloudstorage.s3` | Доступ к S3-бакету |

```yaml
- name: aws
  kind: config.aws
  region: "us-east-1"
  access_key_id_env: "AWS_ACCESS_KEY_ID"
  secret_access_key_env: "AWS_SECRET_ACCESS_KEY"

- name: uploads
  kind: cloudstorage.s3
  config: app:aws
  bucket: "my-uploads"
  endpoint: ""  # Опционально, для S3-совместимых сервисов
```

**Lua API:** См. [Модуль Cloud Storage](lua/storage/cloud.md)

```lua
local cloudstorage = require("cloudstorage")
local storage, err = cloudstorage.get("app:uploads")

storage:upload_object("files/doc.pdf", file_content)
local url = storage:presigned_get_url("files/doc.pdf", {expires = "1h"})
```

<tip>
Используйте <code>endpoint</code> для подключения к S3-совместимым сервисам типа MinIO или DigitalOcean Spaces.
</tip>

## Файловые системы

| Тип | Описание |
|-----|----------|
| `fs.directory` | Доступ к каталогу |

```yaml
- name: data_dir
  kind: fs.directory
  directory: "./data"
  auto_init: true   # Создать, если не существует
  mode: "0755"      # Права доступа
```

**Lua API:** См. [Модуль Filesystem](lua/storage/filesystem.md)

```lua
local fs = require("fs")
local filesystem, err = fs.get("app:data_dir")

local file = filesystem:open("output.txt", "w")
file:write("Hello, World!")
file:close()
```

## Окружение

| Тип | Описание |
|-----|----------|
| `env.storage.memory` | In-memory хранилище переменных |
| `env.storage.file` | Файловое хранилище переменных |
| `env.storage.os` | Переменные окружения ОС |
| `env.storage.router` | Роутер окружения (несколько хранилищ) |
| `env.variable` | Переменная окружения |

```yaml
- name: os_env
  kind: env.storage.os

- name: file_env
  kind: env.storage.file
  file_path: ".env"
  auto_create: true

- name: app_env
  kind: env.storage.router
  storages:
    - app:os_env
    - app:file_env
```

**Lua API:** См. [Модуль Env](lua/system/env.md)

```lua
local env = require("env")

local api_key = env.get("API_KEY")
env.set("CACHE_TTL", "3600")
```

<note>
Роутер перебирает хранилища по порядку. При чтении возвращается первое найденное значение; запись идёт в первое записываемое хранилище.
</note>

## Шаблоны

| Тип | Описание |
|-----|----------|
| `template.jet` | Отдельный Jet-шаблон |
| `template.set` | Набор шаблонов |

```yaml
# Набор шаблонов с настройками движка
- name: templates
  kind: template.set
  engine:
    development_mode: false
    extensions:
      - ".jet"
      - ".html.jet"

# Отдельный шаблон
- name: email_template
  kind: template.jet
  source: file://templates/email.jet
  set: app:templates
```

**Lua API:** См. [Модуль Template](lua/text/template.md)

```lua
local templates = require("templates")
local set, err = templates.get("app:templates")

local html = set:render("email", {
    user = "Alice",
    message = "Welcome!"
})
```

## Безопасность

| Тип | Описание |
|-----|----------|
| `security.policy` | Политика безопасности с условиями |
| `security.policy.expr` | Политика на основе выражений |
| `security.token_store` | Хранилище токенов |

```yaml
# Политика с условиями
- name: admin_policy
  kind: security.policy
  policy:
    actions: "*"
    resources: "*"
    effect: allow
    conditions:
      - field: "actor.meta.role"
        operator: eq
        value: "admin"

# Политика на основе выражений
- name: owner_policy
  kind: security.policy.expr
  policy:
    actions: "*"
    resources: "*"
    effect: allow
    expression: 'actor.id == meta.owner_id || actor.meta.role == "admin"'
```

**Lua API:** См. [Модуль Security](lua/security/security.md)

```lua
local security = require("security")

-- Проверка разрешения перед действием
if security.can("delete", "users", {user_id = id}) then
    delete_user(id)
end

-- Получить текущего актора
local actor = security.actor()
```

<warning>
Политики вычисляются по порядку. Первая подходящая определяет доступ. Размещайте более специфичные политики перед общими.
</warning>

## Контракты (Dependency Injection)

| Тип | Описание |
|-----|----------|
| `contract.definition` | Интерфейс со спецификациями методов |
| `contract.binding` | Связывает методы контракта с реализациями |

```yaml
# Определение интерфейса
- name: greeter
  kind: contract.definition
  methods:
    - name: greet
      description: Возвращает приветствие
    - name: greet_with_name
      description: Возвращает персональное приветствие
      input_schemas:
        - format: "application/schema+json"
          definition: {"type": "string"}
      output_schemas:
        - format: "application/schema+json"
          definition: {"type": "string"}

# Функции-реализации
- name: greeter_greet
  kind: function.lua
  source: file://greeter_greet.lua
  method: main

- name: greeter_greet_name
  kind: function.lua
  source: file://greeter_greet_name.lua
  method: main

# Связывание методов контракта с реализациями
- name: greeter_impl
  kind: contract.binding
  contracts:
    - contract: app:greeter
      default: true
      methods:
        greet: app:greeter_greet
        greet_with_name: app:greeter_greet_name
```

Использование в Lua:

```lua
local contract = require("contract")

-- Открыть binding по ID
local greeter, err = contract.open("app:greeter_impl")

-- Вызов методов
local result = greeter:greet()
local personalized = greeter:greet_with_name("Alice")

-- Проверка, реализует ли экземпляр контракт
local is_greeter = contract.is(greeter, "app:greeter")
```

**Lua API:** См. [Модуль Contract](lua/core/contract.md)

<tip>
Пометьте один binding как <code>default: true</code>, чтобы использовать его при открытии контракта без указания binding ID (работает только если не заданы поля <code>context_required</code>).
</tip>

## Выполнение команд

| Тип | Описание |
|-----|----------|
| `exec.native` | Выполнение нативных команд |
| `exec.docker` | Выполнение в Docker-контейнере |

```yaml
- name: native_exec
  kind: exec.native
  default_work_dir: "/app"
  command_whitelist:
    - "ls"
    - "cat"

- name: docker_exec
  kind: exec.docker
  image: "python:3.11-slim"
  default_work_dir: "/workspace"
  auto_remove: true
  memory_limit: 536870912  # 512MB
  command_whitelist:
    - "python"
```

## Настройка жизненного цикла

Большинство записей поддерживают настройку жизненного цикла:

```yaml
- name: service
  kind: some.kind
  lifecycle:
    auto_start: true          # Запускать автоматически
    start_timeout: 10s        # Максимальное время запуска
    stop_timeout: 10s         # Максимальное время остановки
    stable_threshold: 5s      # Время до признания стабильным
    depends_on:
      - app:database
    restart:                  # Политика перезапуска
      initial_delay: 1s
      max_delay: 90s
      backoff_factor: 2.0
      max_attempts: 0         # 0 = бесконечно
```

<note>
Используйте <code>depends_on</code> для правильного порядка запуска. Супервизор ждёт, пока зависимости станут стабильными, прежде чем запускать зависимые записи.
</note>

## Формат ссылок на записи

Записи указываются в формате `namespace:name`:

```yaml
# Определение
namespace: app.users
entries:
  - name: handler
    kind: function.lua

# Ссылка из другой записи
func: app.users:handler
```
