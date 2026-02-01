# Структура проекта

Организация каталогов, YAML-файлы и соглашения об именовании.

## Структура каталогов

```
myapp/
├── .wippy.yaml          # Конфигурация среды исполнения
├── wippy.lock           # Пути к исходникам
├── .wippy/              # Установленные модули
└── src/                 # Исходный код
    ├── _index.yaml      # Определения записей
    ├── api/
    │   ├── _index.yaml
    │   └── *.lua
    └── workers/
        ├── _index.yaml
        └── *.lua
```

## YAML-файлы определений

<note>
YAML-определения загружаются в реестр при старте. Реестр — источник истины, а YAML — лишь один из способов его наполнить. Записи могут поступать из других источников или создаваться программно.
</note>

### Структура файла

Любой YAML с полями `version` и `namespace` считается валидным:

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    meta:
      comment: Получает пользователя по ID
    source: file://get_user.lua
    method: handler
    modules:
      - sql
      - json

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      comment: API-эндпоинт пользователя
    method: GET
    path: /users/{id}
    func: get_user
```

| Поле | Обязательно | Описание |
|------|-------------|----------|
| `version` | да | Версия схемы (сейчас `"1.0"`) |
| `namespace` | да | Пространство имён для записей |
| `entries` | да | Массив определений записей |

### Соглашения об именовании

Точки (`.`) разделяют смысловые части, подчёркивания (`_`) — слова внутри части:

```yaml
# Функция и её эндпоинт
- name: get_user              # Функция
- name: get_user.endpoint     # Её HTTP-эндпоинт

# Несколько эндпоинтов для одной функции
- name: list_orders
- name: list_orders.endpoint.get
- name: list_orders.endpoint.post

# Роутеры
- name: api.public            # Публичный API
- name: api.admin             # Админский API
```

<tip>
Паттерн: <code>base_name.variant</code> — точки разделяют смысловые части, подчёркивания — слова внутри части.
</tip>

### Пространства имён

Пространства имён — идентификаторы через точку:

```
app
app.api
app.api.v2
app.workers
```

Полный ID записи — пространство имён плюс имя: `app.api:get_user`

### Каталоги исходников

Файл `wippy.lock` указывает, откуда Wippy загружает определения:

```yaml
directories:
  modules: .wippy
  src: ./src
```

Wippy рекурсивно сканирует эти каталоги в поисках YAML-файлов.

## Определения записей

Каждая запись в массиве `entries`. Свойства на корневом уровне (без обёртки `data:`):

```yaml
entries:
  - name: hello
    kind: function.lua
    meta:
      comment: Возвращает hello world
    source: file://hello.lua
    method: handler
    modules:
      - http
      - json

  - name: hello.endpoint
    kind: http.endpoint
    meta:
      comment: Hello-эндпоинт
    method: GET
    path: /hello
    func: hello
```

### Метаданные

Используйте `meta` для информации, отображаемой в UI:

```yaml
- name: payment_handler
  kind: function.lua
  meta:
    title: Обработчик платежей
    comment: Работает со Stripe
  source: file://payment.lua
```

Соглашение: `meta.title` и `meta.comment` красиво отображаются в интерфейсах управления.

### Записи приложения

Используйте `registry.entry` для конфигурации уровня приложения:

```yaml
- name: config
  kind: registry.entry
  meta:
    title: Настройки приложения
    type: application
  environment: production
  features:
    dark_mode: true
    beta_access: false
```

## Типы записей

| Тип | Назначение |
|-----|------------|
| `registry.entry` | Произвольные данные |
| `function.lua` | Вызываемая Lua-функция |
| `process.lua` | Долгоживущий процесс |
| `http.service` | HTTP-сервер |
| `http.router` | Группа маршрутов |
| `http.endpoint` | HTTP-обработчик |
| `process.host` | Супервизор процессов |

Подробнее в [справочнике типов записей](guide-entry-kinds.md).

## Файлы конфигурации

### .wippy.yaml

Конфигурация среды исполнения в корне проекта:

```yaml
logger:
  level: info
  mode: production

host:
  worker_count: 16

http:
  address: :8080
```

Подробнее в [руководстве по конфигурации](guide-configuration.md).

### wippy.lock

Определяет каталоги исходников:

```yaml
directories:
  modules: .wippy
  src: ./src
```

## Ссылки на записи

Ссылайтесь по полному ID или относительному имени:

```yaml
# Полный ID (между пространствами имён)
- name: main.router
  kind: http.router
  endpoints:
    - app.api:get_user.endpoint
    - app.api:list_orders.endpoint

# В том же пространстве — просто имя
- name: get_user.endpoint
  kind: http.endpoint
  func: get_user
```

## Пример проекта

```
myapp/
├── .wippy.yaml
├── wippy.lock
└── src/
    ├── _index.yaml           # namespace: app
    ├── api/
    │   ├── _index.yaml       # namespace: app.api
    │   ├── users.lua
    │   └── orders.lua
    ├── lib/
    │   ├── _index.yaml       # namespace: app.lib
    │   └── database.lua
    └── workers/
        ├── _index.yaml       # namespace: app.workers
        └── email_sender.lua
```

## См. также

- [Типы записей](guide-entry-kinds.md) — доступные типы
- [Конфигурация](guide-configuration.md) — параметры среды исполнения
- [Собственные типы записей](internal-kinds.md) — реализация обработчиков (продвинутый уровень)
