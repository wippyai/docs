# Публикация модулей

Делитесь переиспользуемым кодом в Wippy Hub.

## Предварительные требования

1. Создайте аккаунт на [hub.wippy.ai](https://hub.wippy.ai)
2. Создайте организацию или присоединитесь к существующей
3. Зарегистрируйте имя модуля под вашей организацией

## Структура модуля

```
mymodule/
├── wippy.yaml      # Манифест модуля
├── src/
│   ├── _index.yaml # Определения записей
│   └── *.lua       # Исходные файлы
└── README.md       # Документация (опционально)
```

## wippy.yaml

Манифест модуля:

```yaml
organization: acme
module: http-utils
description: HTTP utilities and helpers
license: MIT
repository: https://github.com/acme/http-utils
homepage: https://acme.dev
keywords:
  - http
  - utilities
```

| Поле | Обязательное | Описание |
|-------|----------|-------------|
| `organization` | Да | Имя вашей организации в hub |
| `module` | Да | Имя модуля |
| `description` | Нет | Краткое описание |
| `license` | Нет | Идентификатор SPDX (MIT, Apache-2.0) |
| `repository` | Нет | URL репозитория исходников |
| `homepage` | Нет | Главная страница проекта |
| `keywords` | Нет | Поисковые ключевые слова |

## Определения записей

Записи определяются в `_index.yaml`:

```yaml
version: "1.0"
namespace: acme.http

entries:
  - name: definition
    kind: ns.definition
    meta:
      title: HTTP Utilities
      description: Helpers for HTTP operations

  - name: client
    kind: library.lua
    source: file://client.lua
    modules:
      - http_client
      - json
```

## Зависимости

Объявление зависимостей от других модулей:

```yaml
entries:
  - name: __dependency.wippy.test
    kind: ns.dependency
    meta:
      description: Testing framework
    component: wippy/test
    version: ">=0.3.0"
```

Ограничения версий:

| Ограничение | Значение |
|------------|---------|
| `*` | Любая версия |
| `1.0.0` | Точная версия |
| `>=1.0.0` | Минимальная версия |
| `^1.0.0` | Совместимая (тот же major) |

## Требования

Определите конфигурацию, которую должны предоставлять потребители:

```yaml
entries:
  - name: api_endpoint
    kind: ns.requirement
    meta:
      description: API endpoint URL
    targets:
      - entry: acme.http:client
        path: ".meta.endpoint"
    default: "https://api.example.com"
```

Targets указывают, куда внедряется значение:
- `entry` — полный ID записи для конфигурирования
- `path` — JSONPath для внедрения значения

Потребители настраивают через override. Флаг `-o` принимает тройку `namespace:entry:field=value`:

```bash
wippy run -o acme.http:client:meta.endpoint=https://custom.api.com
```

## Импорты

Ссылки на другие записи:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  modules:
    - json
  imports:
    client: acme.http:client           # То же пространство имён
    utils: acme.utils:helpers          # Другое пространство имён
    base_registry: :registry           # Встроенное
```

В Lua:

```lua
local client = require("client")
local utils = require("utils")
```

## Контракты

Определение публичных интерфейсов:

```yaml
- name: http_contract
  kind: contract.definition
  meta:
    name: HTTP Client Contract
  methods:
    - name: get
      description: Perform GET request
    - name: post
      description: Perform POST request

- name: http_contract_binding
  kind: contract.binding
  contracts:
    - contract: acme.http:http_contract
      methods:
        get: acme.http:get_handler
        post: acme.http:post_handler
```

## Процесс публикации

### 1. Аутентификация

```bash
wippy auth login
```

### 2. Подготовка

```bash
wippy init
wippy update
wippy lint
```

### 3. Валидация

```bash
wippy publish --dry-run
```

### 4. Публикация

```bash
wippy publish --version 1.0.0
```

С release notes:

```bash
wippy publish --version 1.0.0 --release-notes "Initial release"
```

### Дополнительные флаги

| Флаг | Описание |
|------|-------------|
| `--label <name>` | Опубликовать как изменяемый label (например, `latest`, `beta`) вместо неизменяемой версии |
| `--protected` | Пометить опубликованную версию как защищённую (нельзя удалить или перезаписать) |
| `--registry <url>` | Переопределить URL реестра для этой публикации |
| `--config <dir>` | Каталог, содержащий `wippy.yaml` (по умолчанию: текущий) |
| `--create` | Зарегистрировать модуль на хабе, если он ещё не существует, затем опубликовать |
| `--module-visibility <v>` | Видимость для `--create`: `private` (по умолчанию) или `public` |
| `--module-type <t>` | Тип для `--create`: `application` (по умолчанию), `library`, `agent` или `plugin` |
| `--module-display-name <n>` | Отображаемое имя для `--create` |

### Встраивание статических файлов

Модули с записями `fs.directory` (статические ассеты, шаблоны, публичные файлы) должны использовать `--embed`, чтобы включить их в опубликованный пакет. Без него записи `fs.directory` исключаются.

```bash
wippy publish --version 1.0.0 --embed app:public_files
wippy publish --version 1.0.0 --embed app:assets,app:templates
```

Флаг `--embed` принимает ID или имена записей, соответствующие `fs.directory`. Тот же флаг доступен в `wippy pack`.

### Первая публикация

При первой публикации модуля он автоматически регистрируется на хабе (по умолчанию приватным), и публикация повторяется один раз. Передайте `--create`, чтобы зарегистрировать его заранее и задать его свойства:

```bash
wippy publish --create --version 0.1.0 \
  --module-visibility public \
  --module-type library \
  --module-display-name "HTTP Utils"
```

`--create` идемпотентен — для уже зарегистрированного модуля шаг создания ничего не делает. Если ваша учётная запись не может создавать модули в организации, хаб возвращает ошибку прав доступа вместо публикации.

### Публикация в локальный хаб

Укажите `--registry` на локально запущенный хаб, чтобы публиковать и устанавливать без публичного реестра. Обычный HTTP разрешён только для локальных хостов — `localhost`, `127.0.0.1` и контейнерных алиасов `host.docker.internal` (Docker Desktop / OrbStack) и `host.containers.internal` (Podman); любой другой хост должен использовать HTTPS.

```bash
wippy auth login --registry http://localhost:8080 --token wpy_xxx
wippy publish --registry http://localhost:8080 --create --version 0.1.0
```

Реестр и токен также могут поступать из переменных окружения `WIPPY_REGISTRY` и `WIPPY_TOKEN`. Когда они не заданы, реестр по умолчанию — `https://hub.wippy.ai`.

### Квоты

Если квота организации на приватные модули исчерпана, публикация завершается с сообщением вроде `cannot publish: Private-module quota exhausted (5 of 5)...`. Сделайте модуль публичным или попросите администратора организации увеличить квоту. Загрузки и скачивания автоматически повторяются при временных сетевых ошибках.

## Использование опубликованных модулей

### Добавление зависимости

```bash
wippy add acme/http-utils
wippy add acme/http-utils@1.0.0
wippy install
```

### Конфигурация требований

Переопределение значений во время выполнения:

```bash
wippy run -o acme.http:client:meta.endpoint=https://my.api.com
```

Или в `.wippy.yaml`:

```yaml
override:
  acme.http:client:meta.endpoint: "https://my.api.com"
```

### Импорт в вашем коде

```yaml
# ваш src/_index.yaml
entries:
  - name: __dependency.acme.http
    kind: ns.dependency
    component: acme/http-utils
    version: ">=1.0.0"

  - name: my_handler
    kind: function.lua
    source: file://handler.lua
    imports:
      http: acme.http:client
```

## Полный пример

**wippy.yaml:**
```yaml
organization: acme
module: cache
description: In-memory caching with TTL
license: MIT
keywords:
  - cache
  - memory
```

**src/_index.yaml:**
```yaml
version: "1.0"
namespace: acme.cache

entries:
  - name: definition
    kind: ns.definition
    meta:
      title: Cache Module

  - name: max_size
    kind: ns.requirement
    meta:
      description: Maximum cache entries
    targets:
      - entry: acme.cache:cache
        path: ".meta.max_size"
    default: "1000"

  - name: cache
    kind: library.lua
    meta:
      max_size: 1000
    source: file://cache.lua
    modules:
      - time
```

**src/cache.lua:**
```lua
local time = require("time")

local cache = {}
local store = {}
local max_size = 1000

function cache.set(key, value, ttl)
    if #store >= max_size then
        cache.evict_oldest()
    end
    store[key] = {
        value = value,
        expires = ttl and (time.now():unix() + ttl) or nil
    }
end

function cache.get(key)
    local entry = store[key]
    if not entry then return nil end
    if entry.expires and time.now():unix() > entry.expires then
        store[key] = nil
        return nil
    end
    return entry.value
end

return cache
```

Публикация:

```bash
wippy init && wippy update && wippy lint
wippy publish --version 1.0.0
```

## См. также

- [CLI Reference](guides/cli.md)
- [Виды записей](guides/entry-kinds.md)
- [Конфигурация](guides/configuration.md)
