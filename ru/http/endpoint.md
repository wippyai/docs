# HTTP-эндпоинты

Эндпоинты (`http.endpoint`) определяют обработчики HTTP-маршрутов, которые выполняют Lua-функции.

## Определение

```yaml
- name: get_user
  kind: http.endpoint
  router: api_router
  method: GET
  path: /users/{id}
  func: app.users:get_user
```

## Конфигурация

| Поле | Тип | Описание |
|------|-----|----------|
| `router` | registry.ID | Родительский роутер (необязательно, если роутер один) |
| `method` | string | HTTP-метод |
| `path` | string | Шаблон URL-пути |
| `func` | registry.ID | Выполняемая функция |

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
function(req, res)
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
function(req, res)
    local file_path = req:param("path")
    -- /files/docs/readme.md -> path = "docs/readme.md"
end
```

## Функция-обработчик

Функции эндпоинтов получают объекты запроса и ответа:

```lua
function(req, res)
    -- Чтение запроса
    local body = req:body()
    local user_id = req:param("id")
    local page = req:query("page")
    local auth = req:header("Authorization")

    -- Обработка
    local user = get_user(user_id)

    -- Запись ответа
    res:set_header("Content-Type", "application/json")
    res:set_status(200)
    res:write(json.encode(user))
end
```

### Объект Request

| Метод | Возвращает | Описание |
|-------|------------|----------|
| `req:method()` | string | HTTP-метод |
| `req:path()` | string | Путь запроса |
| `req:param(name)` | string | URL-параметр |
| `req:query(name)` | string | Query-параметр |
| `req:header(name)` | string | Заголовок запроса |
| `req:headers()` | table | Все заголовки |
| `req:body()` | string | Тело запроса |
| `req:cookie(name)` | string | Значение cookie |
| `req:remote_addr()` | string | IP-адрес клиента |

### Объект Response

| Метод | Описание |
|-------|----------|
| `res:set_status(code)` | Установить HTTP-статус |
| `res:set_header(name, value)` | Установить заголовок |
| `res:set_cookie(name, value, opts)` | Установить cookie |
| `res:write(data)` | Записать тело |
| `res:redirect(url, code?)` | Редирект (по умолчанию 302) |

## Паттерн JSON API

Типовой паттерн для JSON API:

```lua
local json = require("json")

function(req, res)
    -- Парсинг JSON-тела
    local data, err = json.decode(req:body())
    if err then
        res:set_status(400)
        res:set_header("Content-Type", "application/json")
        res:write(json.encode({error = "Invalid JSON"}))
        return
    end

    -- Обработка запроса
    local result = process(data)

    -- Возврат JSON-ответа
    res:set_status(200)
    res:set_header("Content-Type", "application/json")
    res:write(json.encode(result))
end
```

## Ответы об ошибках

```lua
local function api_error(res, status, code, message)
    res:set_status(status)
    res:set_header("Content-Type", "application/json")
    res:write(json.encode({
        error = {
            code = code,
            message = message
        }
    }))
end

function(req, res)
    local user_id = req:param("id")
    local user, err = db.get_user(user_id)

    if err then
        if errors.is(err, errors.NOT_FOUND) then
            return api_error(res, 404, "USER_NOT_FOUND", "User not found")
        end
        return api_error(res, 500, "INTERNAL_ERROR", "Server error")
    end

    res:set_status(200)
    res:set_header("Content-Type", "application/json")
    res:write(json.encode(user))
end
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
    router: users_router
    method: GET
    path: /
    func: app.users:list

  - name: get_user
    kind: http.endpoint
    router: users_router
    method: GET
    path: /{id}
    func: app.users:get

  - name: create_user
    kind: http.endpoint
    router: users_router
    method: POST
    path: /
    func: app.users:create

  - name: update_user
    kind: http.endpoint
    router: users_router
    method: PUT
    path: /{id}
    func: app.users:update

  - name: delete_user
    kind: http.endpoint
    router: users_router
    method: DELETE
    path: /{id}
    func: app.users:delete
```

### Защищённый эндпоинт

```yaml
- name: admin_endpoint
  kind: http.endpoint
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
