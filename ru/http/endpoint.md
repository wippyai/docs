---
title: "HTTP-эндпоинты"
description: "Эндпоинты (http.endpoint) определяют обработчики HTTP-маршрутов, которые выполняют Lua-функции."
---

# HTTP-эндпоинты

Эндпоинты (`http.endpoint`) определяют обработчики HTTP-маршрутов, которые выполняют Lua-функции.

## Определение

```yaml
- name: get_user
  kind: http.endpoint
  meta:
    router: app:api_router
  method: GET
  path: /users/{id}
  func: app.users:get_user
```

## Конфигурация

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `meta.router` | registry.ID | Нет | Родительский роутер (по умолчанию используется единственный зарегистрированный роутер, если он один) |
| `method` | string | Да | HTTP-метод |
| `path` | string | Да | Шаблон URL-пути |
| `func` | registry.ID | Да | Выполняемая функция |

## HTTP-методы

Поддерживаемые методы:

| Метод | Назначение |
|-------|------------|
| `GET` | Получение ресурсов |
| `POST` | Создание ресурсов |
| `PUT` | Замена ресурсов |
| `PATCH` | Частичное обновление |
| `DELETE` | Удаление ресурсов |
| `HEAD` | Только заголовки |
| `OPTIONS` | CORS preflight (автоматически) |
| `TRACE` | Диагностический loopback |

## Параметры пути

Используйте синтаксис `{param}` для URL-параметров:

```yaml
- name: get_user
  kind: http.endpoint
  method: GET
  path: /users/{id}
  func: get_user

- name: get_user_post
  kind: http.endpoint
  method: GET
  path: /users/{user_id}/posts/{post_id}
  func: get_user_post
```

Доступ в обработчике:

```lua
local http = require("http")

local function handler()
    local req = http.request()
    local user_id = req:param("id")
    local post_id = req:param("post_id")
end
```

## Wildcard-пути

Захват оставшегося пути через `{path...}`:

```yaml
- name: file_handler
  kind: http.endpoint
  method: GET
  path: /files/{path...}
  func: serve_file
```

```lua
local function handler()
    local req = http.request()
    local file_path = req:param("path")
    -- /files/docs/readme.md -> path = "docs/readme.md"
end
```

## Функция-обработчик

Функции эндпоинтов получают объекты запроса и ответа из модуля `http`:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    -- Чтение запроса
    local body = req:body()
    local user_id = req:param("id")
    local page = req:query("page")
    local auth = req:header("Authorization")

    -- Обработка
    local user = get_user(user_id)

    -- Запись ответа
    res:set_content_type(http.CONTENT.JSON)
    res:set_status(http.STATUS.OK)
    res:write_json(user)
end

return { handler = handler }
```

### Объект Request

| Метод | Возвращает | Описание |
|-------|------------|----------|
| `req:method()` | string | HTTP-метод |
| `req:path()` | string | Путь запроса |
| `req:param(name)` | string | URL-параметр |
| `req:params()` | table | Все параметры пути |
| `req:query(name)` | string | Query-параметр |
| `req:query_params()` | table | Все query-параметры |
| `req:header(name)` | string | Заголовок запроса |
| `req:body()` | string | Тело запроса |
| `req:body_json()` | table, error | Разбор JSON-тела |
| `req:has_body()` | boolean | Проверка наличия тела |
| `req:content_type()` | string | Content-Type |
| `req:content_length()` | number | Размер тела в байтах |
| `req:host()` | string | Имя хоста |
| `req:remote_addr()` | string | IP-адрес клиента |
| `req:accepts(type)` | boolean | Content negotiation |
| `req:is_content_type(type)` | boolean | Проверка content-type |
| `req:stream()` | Stream | Тело как поток для больших файлов |
| `req:parse_multipart(max?)` | table, error | Разбор multipart-формы |

### Объект Response

| Метод | Описание |
|-------|----------|
| `res:set_status(code)` | Установить HTTP-статус |
| `res:set_header(name, value)` | Установить заголовок ответа |
| `res:set_content_type(type)` | Установить content-type |
| `res:write(data)` | Записать raw-тело |
| `res:write_json(data)` | Записать JSON-ответ |
| `res:write_event(data)` | Отправить SSE-событие |
| `res:set_transfer(encoding)` | Установить режим передачи (SSE, chunked) |
| `res:flush()` | Сбросить ответ клиенту |

## Паттерн JSON API

Типовой паттерн для JSON API:

```lua
local http = require("http")

local function handler()
    local req = http.request()
    local res = http.response()

    local data, err = req:body_json()
    if err then
        res:set_status(http.STATUS.BAD_REQUEST)
        res:write_json({error = "Invalid JSON"})
        return
    end

    local result = process(data)

    res:set_status(http.STATUS.OK)
    res:write_json(result)
end

return { handler = handler }
```

## Ответы об ошибках

```lua
local http = require("http")

local function api_error(res, status, code, message)
    res:set_status(status)
    res:write_json({
        error = {
            code = code,
            message = message
        }
    })
end

local function handler()
    local req = http.request()
    local res = http.response()

    local user_id = req:param("id")
    local user, err = db.get_user(user_id)

    if err then
        if errors.is(err, errors.NOT_FOUND) then
            return api_error(res, http.STATUS.NOT_FOUND, "USER_NOT_FOUND", "User not found")
        end
        return api_error(res, http.STATUS.INTERNAL_ERROR, "INTERNAL_ERROR", "Server error")
    end

    res:set_status(http.STATUS.OK)
    res:write_json(user)
end

return { handler = handler }
```

## Примеры

### CRUD-эндпоинты

```yaml
entries:
  - name: users_router
    kind: http.router
    prefix: /api/users
    middleware:
      - cors
      - compress

  - name: list_users
    kind: http.endpoint
    meta:
      router: users_router
    method: GET
    path: /
    func: app.users:list

  - name: get_user
    kind: http.endpoint
    meta:
      router: users_router
    method: GET
    path: /{id}
    func: app.users:get

  - name: create_user
    kind: http.endpoint
    meta:
      router: users_router
    method: POST
    path: /
    func: app.users:create

  - name: update_user
    kind: http.endpoint
    meta:
      router: users_router
    method: PUT
    path: /{id}
    func: app.users:update

  - name: delete_user
    kind: http.endpoint
    meta:
      router: users_router
    method: DELETE
    path: /{id}
    func: app.users:delete
```

### Защищённый эндпоинт

```yaml
- name: admin_endpoint
  kind: http.endpoint
  meta:
    router: admin_router
  method: POST
  path: /settings
  func: app.admin:update_settings
  post_middleware:
    - endpoint_firewall
  post_options:
    endpoint_firewall.action: "admin"
```

## См. также

- [Роутер](http/router.md) — группировка маршрутов
- [Модуль HTTP](lua/http/http.md) — API запроса/ответа
- [Middleware](http/middleware.md) — обработка запросов
