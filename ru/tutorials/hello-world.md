# Hello World

Ваше первое приложение на Wippy — простой HTTP API, возвращающий JSON.

## Что создаём

Минимальный веб-API с одним эндпоинтом:

```
GET /hello → {"message": "hello world"}
```

## Структура проекта

```
hello-world/
├── wippy.lock           # Генерируемый lock-файл
└── src/
    ├── _index.yaml      # Определения записей
    └── hello.lua        # Код обработчика
```

## Шаг 1: Создание директории проекта

```bash
mkdir hello-world && cd hello-world
mkdir src
```

## Шаг 2: Определения записей

Создайте `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  # HTTP-сервер
  - name: gateway
    kind: http.service
    addr: :8080
    lifecycle:
      auto_start: true

  # Роутер
  - name: api
    kind: http.router
    meta:
      server: gateway
    prefix: /

  # Функция-обработчик
  - name: hello
    kind: function.lua
    source: file://hello.lua
    method: handler
    modules:
      - http

  # Эндпоинт
  - name: hello.endpoint
    kind: http.endpoint
    meta:
      router: app:api
    method: GET
    func: hello
    path: /hello
```

**Четыре записи работают вместе:**

1. `gateway` — HTTP-сервер, слушающий порт 8080
2. `api` — роутер, привязанный к gateway через `meta.server`
3. `hello` — Lua-функция, обрабатывающая запросы
4. `hello.endpoint` — маршрутизирует `GET /hello` на функцию

## Шаг 3: Код обработчика

Создайте `src/hello.lua`:

```lua
local http = require("http")

local function handler()
    local res = http.response()

    res:set_content_type(http.CONTENT.JSON)
    res:set_status(http.STATUS.OK)
    res:write_json({message = "hello world"})
end

return {
    handler = handler
}
```

Модуль `http` предоставляет доступ к объектам запроса/ответа. Функция возвращает таблицу с экспортируемым методом `handler`.

## Шаг 4: Инициализация и запуск

```bash
# Генерация lock-файла из исходников
wippy init

# Запуск рантайма (-c для цветного вывода в консоль)
wippy run -c
```

Вы увидите вывод:

```
╦ ╦╦╔═╗╔═╗╦ ╦  Adaptive Application Runtime
║║║║╠═╝╠═╝╚╦╝  v0.1.20
╚╩╝╩╩  ╩   ╩   by Spiral Scout

0.00s  INFO  run          runtime ready
0.11s  INFO  core         service app:gateway is running  {"details": "service listening on :8080"}
```

## Шаг 5: Тестирование

```bash
curl http://localhost:8080/hello
```

Ответ:

```json
{"message":"hello world"}
```

## Как это работает

1. `gateway` принимает TCP-соединение на порту 8080
2. Роутер `api` сопоставляет префикс пути `/`
3. `hello.endpoint` сопоставляет `GET /hello`
4. Функция `hello` выполняется и записывает JSON-ответ

## Справочник CLI

| Команда | Описание |
|---------|----------|
| `wippy init` | Генерация lock-файла из `src/` |
| `wippy run` | Запуск рантайма из lock-файла |
| `wippy run -c` | Запуск с цветным выводом в консоль |
| `wippy run -v` | Запуск с подробным debug-логированием |
| `wippy run -s` | Запуск в тихом режиме (без логов в консоль) |

## Следующие шаги

- [Echo Service](tutorials/echo-service.md) — обработка параметров запроса
- [Task Queue](tutorials/task-queue.md) — REST API с фоновой обработкой
- [HTTP-роутер](http/router.md) — паттерны маршрутизации
