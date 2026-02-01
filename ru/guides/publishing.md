# Публикация модулей

Делитесь переиспользуемым кодом на Wippy Hub.

## Предварительные требования

1. Создайте аккаунт на [hub.wippy.ai](https://hub.wippy.ai)
2. Создайте организацию или вступите в существующую
3. Зарегистрируйте имя модуля под своей организацией

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
description: HTTP-утилиты и хелперы
license: MIT
repository: https://github.com/acme/http-utils
homepage: https://acme.dev
keywords:
  - http
  - utilities
```

| Поле | Обязательно | Описание |
|------|-------------|----------|
| `organization` | Да | Имя организации в hub |
| `module` | Да | Имя модуля |
| `description` | Да | Краткое описание |
| `license` | Нет | SPDX-идентификатор (MIT, Apache-2.0) |
| `repository` | Нет | URL репозитория |
| `homepage` | Нет | Домашняя страница проекта |
| `keywords` | Нет | Ключевые слова для поиска |

## Определения записей

Записи определяются в `_index.yaml`:

```yaml
version: "1.0"
namespace: acme.http

entries:
  - name: definition
    kind: ns.definition
    meta:
      title: HTTP-утилиты
      description: Хелперы для HTTP-операций

  - name: client
    kind: library.lua
    source: file://client.lua
    modules:
      - http_client
      - json
```

## Зависимости

Объявляйте зависимости от других модулей:

```yaml
entries:
  - name: __dependency.wippy.test
    kind: ns.dependency
    meta:
      description: Фреймворк тестирования
    component: wippy/test
    version: ">=0.3.0"
```

Ограничения версий:

| Ограничение | Значение |
|-------------|----------|
| `*` | Любая версия |
| `1.0.0` | Точная версия |
| `>=1.0.0` | Минимальная версия |
| `^1.0.0` | Совместимая (тот же major) |

## Требования

Определяйте конфигурацию, которую должны предоставить потребители:

```yaml
entries:
  - name: api_endpoint
    kind: ns.requirement
    meta:
      description: URL API-эндпоинта
    targets:
      - entry: acme.http:client
        path: ".meta.endpoint"
    default: "https://api.example.com"
```

Targets указывают, куда внедряется значение:
- `entry` — полный ID записи для настройки
- `path` — JSONPath для внедрения значения

Потребители настраивают через override:

```bash
wippy run -o acme.http:api_endpoint=https://custom.api.com
```

## Импорты

Ссылайтесь на другие записи:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  modules:
    - json
  imports:
    client: acme.http:client           # То же пространство имён
    utils: acme.utils:helpers          # Другое пространство имён
    base_registry: :registry           # Встроенный
```

В Lua:

```lua
local client = require("client")
local utils = require("utils")
```

## Контракты

Определяйте публичные интерфейсы:

```yaml
- name: http_contract
  kind: contract.definition
  meta:
    name: HTTP Client Contract
  methods:
    - name: get
      description: Выполнить GET-запрос
    - name: post
      description: Выполнить POST-запрос

- name: http_contract_binding
  kind: contract.binding
  contracts:
    - contract: acme.http:http_contract
      methods:
        get: acme.http:get_handler
        post: acme.http:post_handler
```

## Процесс публикации

### 1. Авторизация

```bash
wippy auth login
```

### 2. Подготовка

```bash
wippy init
wippy update
wippy lint
```

### 3. Проверка

```bash
wippy publish --dry-run
```

### 4. Публикация

```bash
wippy publish --version 1.0.0
```

С заметками о релизе:

```bash
wippy publish --version 1.0.0 --release-notes "Первый релиз"
```

### Защищённые версии

Пометьте продакшен-релизы как защищённые (нельзя отозвать):

```bash
wippy publish --version 1.0.0 --protected
```

## Использование опубликованных модулей

### Добавление зависимости

```bash
wippy add acme/http-utils
wippy add acme/http-utils@1.0.0
wippy install
```

### Настройка требований

Переопределяйте значения при запуске:

```bash
wippy run -o acme.http:api_endpoint=https://my.api.com
```

Или в `.wippy.yaml`:

```yaml
override:
  acme.http:api_endpoint: "https://my.api.com"
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
description: In-memory кэширование с TTL
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
      title: Модуль кэширования

  - name: max_size
    kind: ns.requirement
    meta:
      description: Максимум записей в кэше
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

- [Справочник CLI](guides/cli.md)
- [Типы записей](guides/entry-kinds.md)
- [Конфигурация](guides/configuration.md)
