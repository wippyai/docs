# HTTP
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Обработка HTTP-запросов и формирование ответов. Доступ к данным запроса, параметрам маршрута, заголовкам и телу. Формирование ответов с кодами статуса, заголовками и поддержкой потоковой передачи.

Настройку сервера см. в [HTTP-сервер](http-server.md).

## Загрузка

```lua
local http = require("http")
```

## Доступ к запросу

Получить контекст текущего HTTP-запроса:

```lua
local req = http.request()

-- С опциями
local req = http.request({
    timeout = 5000,        -- таймаут чтения тела 5 секунд
    max_body = 10485760    -- макс. размер тела 10MB
})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `options.timeout` | integer | Таймаут чтения тела в мс (по умолчанию: 300000 / 5 мин) |
| `options.max_body` | integer | Макс. размер тела в байтах (по умолчанию: 120MB) |

**Возвращает:** `Request, error`

## Доступ к ответу

Получить контекст текущего HTTP-ответа:

```lua
local res = http.response()
```

**Возвращает:** `Response, error`

## Методы запроса

### method

```lua
local method = req:method()

if method == http.METHOD.GET then
    return get_resource(id)
elseif method == http.METHOD.POST then
    return create_resource(req:body_json())
elseif method == http.METHOD.PUT then
    return update_resource(id, req:body_json())
elseif method == http.METHOD.DELETE then
    return delete_resource(id)
end
```

### path

```lua
local path = req:path()
print(path)  -- "/api/users/123"

-- Маршрутизация по пути
if path:match("^/api/") then
    return handle_api(req)
end
```

### query

Получает один query-параметр.

```lua
-- GET /search?q=hello&page=2&limit=10
local query = req:query("q")        -- "hello"
local page = req:query("page")      -- "2"
local missing = req:query("foo")    -- nil

-- Со значениями по умолчанию
local page = tonumber(req:query("page")) or 1
local limit = tonumber(req:query("limit")) or 20
local sort = req:query("sort") or "created_at"
```

### query_params

Получает все query-параметры. Несколько значений для одного ключа объединяются через запятую.

```lua
-- GET /search?tags=lua&tags=go&active=true
local params = req:query_params()
-- {tags = "lua,go", active = "true"}

for key, value in pairs(params) do
    print(key .. ": " .. value)
end
```

### header

```lua
local auth = req:header("Authorization")
if not auth then
    res:set_status(401)
    return res:write_json({error = "Missing authorization"})
end

local user_agent = req:header("User-Agent")
local correlation_id = req:header("X-Correlation-ID") or uuid.v4()
```

### content_type

Получает заголовок Content-Type.

```lua
local ct = req:content_type()  -- "application/json; charset=utf-8" или nil
```

### content_length

Получает значение заголовка Content-Length.

```lua
local length = req:content_length()  -- количество байт
```

### host

Получает заголовок Host.

```lua
local host = req:host()  -- "example.com:8080"
```

### param

Получает параметры URL-маршрута (из паттернов типа `/users/:id`).

```lua
-- Маршрут: /users/:id/posts/:post_id
local user_id = req:param("id")
local post_id = req:param("post_id")

-- Валидация параметра
local id = req:param("id")
if not id or not uuid.validate(id) then
    res:set_status(400)
    return res:write_json({error = "Invalid ID format"})
end
```

### params

Получает все параметры маршрута.

```lua
-- Маршрут: /orgs/:org/repos/:repo/issues/:issue
local p = req:params()
-- {org = "acme", repo = "widget", issue = "123"}

local issue = get_issue(p.org, p.repo, p.issue)
```

### body

Читает всё тело запроса как строку.

```lua
local body = req:body()

-- Ручной разбор XML
if req:is_content_type("application/xml") then
    local data = parse_xml(body)
end

-- Логирование сырого тела для отладки
logger.debug("Request body", {body = body, length = #body})
```

### body_json

Читает и разбирает тело как JSON.

```lua
local data, err = req:body_json()
if err then
    res:set_status(400)
    return res:write_json({error = "Invalid JSON: " .. err:message()})
end

-- Валидация обязательных полей
if not data.name or not data.email then
    res:set_status(400)
    return res:write_json({error = "Missing required fields"})
end

local user = create_user(data)
```

### has_body

```lua
if req:has_body() then
    local data = req:body_json()
    process(data)
else
    res:set_status(400)
    return res:write_json({error = "Request body required"})
end
```

### is_content_type

```lua
if not req:is_content_type("application/json") then
    res:set_status(415)
    return res:write_json({error = "Content-Type must be application/json"})
end
```

### accepts

```lua
if req:accepts("application/json") then
    res:write_json(data)
elseif req:accepts("text/html") then
    res:set_content_type("text/html")
    res:write(render_html(data))
else
    res:set_status(406)
    res:write_json({error = "Cannot produce acceptable response"})
end
```

### remote_addr

```lua
local addr = req:remote_addr()  -- "192.168.1.100:54321"

-- Извлечение только IP
local ip = addr:match("^([^:]+)")

-- Rate limiting по IP
if rate_limiter:is_limited(ip) then
    res:set_status(429)
    return res:write_json({error = "Too many requests"})
end
```

### parse_multipart

Разбирает multipart-данные формы (загрузка файлов).

```lua
local form, err = req:parse_multipart()
if err then
    res:set_status(400)
    return res:write_json({error = "Invalid form data"})
end

-- Доступ к значениям формы
local title = form.values.title
local description = form.values.description

-- Доступ к загруженным файлам
if form.files.avatar then
    local file = form.files.avatar[1]
    local filename = file:name()        -- "photo.jpg"
    local size = file:size()            -- 102400
    local content_type = file:header("Content-Type")  -- "image/jpeg"

    -- Чтение содержимого файла
    local stream = file:stream()
    local content = stream:read_all()
    stream:close()

    -- Сохранение в хранилище
    storage.write("avatars/" .. filename, content)
end

-- Обработка нескольких файлов
if form.files.documents then
    for _, file in ipairs(form.files.documents) do
        process_document(file)
    end
end
```

### stream

Получает тело запроса как поток для больших файлов.

```lua
local stream = req:stream()

-- Обработка порциями
while true do
    local chunk, err = stream:read(65536)  -- порции по 64KB
    if err or not chunk then break end
    process_chunk(chunk)
end
stream:close()
```

## Методы ответа

### set_status

```lua
res:set_status(200)
res:set_status(http.STATUS.CREATED)

-- Типичные паттерны
res:set_status(201)  -- Created
res:set_status(204)  -- No Content (для DELETE)
res:set_status(400)  -- Bad Request
res:set_status(401)  -- Unauthorized
res:set_status(403)  -- Forbidden
res:set_status(404)  -- Not Found
res:set_status(500)  -- Internal Server Error
```

### set_header

```lua
res:set_header("X-Request-ID", correlation_id)
res:set_header("Cache-Control", "max-age=3600")
res:set_header("X-RateLimit-Remaining", tostring(remaining))

-- CORS-заголовки
res:set_header("Access-Control-Allow-Origin", "*")
res:set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE")
res:set_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
```

### set_content_type

```lua
res:set_content_type("application/json")
res:set_content_type(http.CONTENT.JSON)
res:set_content_type("text/html; charset=utf-8")
res:set_content_type("application/pdf")
```

### write

Записывает в тело ответа.

```lua
res:write("Hello, World!")

-- Формирование ответа порциями
res:write("<html><body>")
res:write("<h1>Title</h1>")
res:write("<p>Content</p>")
res:write("</body></html>")
```

### write_json

Кодирует значение в JSON и записывает.

```lua
-- Успешный ответ
res:set_status(200)
res:write_json({
    data = users,
    total = count,
    page = page
})

-- Ответ с ошибкой
res:set_status(400)
res:write_json({
    error = "Validation failed",
    details = {
        {field = "email", message = "Invalid format"},
        {field = "age", message = "Must be positive"}
    }
})
```

### flush

Сбрасывает буферизованные данные клиенту.

<code-block lang="lua">
-- Потоковая отправка прогресса
for i = 1, 100 do
    res:write(string.format("Progress: %d%%\n", i))
    res:flush()
    time.sleep("100ms")
end
</code-block>

### set_transfer

Устанавливает кодировку передачи для потоковой отправки.

```lua
-- Chunked-передача
res:set_transfer(http.TRANSFER.CHUNKED)
for chunk in get_chunks() do
    res:write(chunk)
    res:flush()
end

-- Server-Sent Events
res:set_transfer(http.TRANSFER.SSE)
```

### write_event

Записывает Server-Sent Event.

```lua
-- Обновления в реальном времени
res:set_transfer(http.TRANSFER.SSE)

res:write_event({name = "connected", data = {client_id = client_id}})

for progress in task:progress() do
    res:write_event({name = "progress", data = {percent = progress}})
end

res:write_event({name = "complete", data = {result = result}})

-- Сообщения чата
res:write_event({name = "message", data = {
    from = "alice",
    text = "Hello!",
    timestamp = time.now():unix()
}})
```

## Константы

### HTTP-методы

```lua
http.METHOD.GET
http.METHOD.POST
http.METHOD.PUT
http.METHOD.DELETE
http.METHOD.PATCH
http.METHOD.HEAD
http.METHOD.OPTIONS
```

### Коды статуса

```lua
-- Успех (2xx)
http.STATUS.OK                   -- 200
http.STATUS.CREATED              -- 201
http.STATUS.ACCEPTED             -- 202
http.STATUS.NO_CONTENT           -- 204
http.STATUS.PARTIAL_CONTENT      -- 206

-- Перенаправление (3xx)
http.STATUS.MOVED_PERMANENTLY    -- 301
http.STATUS.FOUND                -- 302
http.STATUS.SEE_OTHER            -- 303
http.STATUS.NOT_MODIFIED         -- 304
http.STATUS.TEMPORARY_REDIRECT   -- 307
http.STATUS.PERMANENT_REDIRECT   -- 308

-- Ошибки клиента (4xx)
http.STATUS.BAD_REQUEST          -- 400
http.STATUS.UNAUTHORIZED         -- 401
http.STATUS.PAYMENT_REQUIRED     -- 402
http.STATUS.FORBIDDEN            -- 403
http.STATUS.NOT_FOUND            -- 404
http.STATUS.METHOD_NOT_ALLOWED   -- 405
http.STATUS.NOT_ACCEPTABLE       -- 406
http.STATUS.CONFLICT             -- 409
http.STATUS.GONE                 -- 410
http.STATUS.UNPROCESSABLE        -- 422
http.STATUS.TOO_MANY_REQUESTS    -- 429

-- Ошибки сервера (5xx)
http.STATUS.INTERNAL_ERROR       -- 500
http.STATUS.NOT_IMPLEMENTED      -- 501
http.STATUS.BAD_GATEWAY          -- 502
http.STATUS.SERVICE_UNAVAILABLE  -- 503
http.STATUS.GATEWAY_TIMEOUT      -- 504
http.STATUS.VERSION_NOT_SUPPORTED -- 505
```

### Типы содержимого

```lua
http.CONTENT.JSON       -- "application/json"
http.CONTENT.FORM       -- "application/x-www-form-urlencoded"
http.CONTENT.MULTIPART  -- "multipart/form-data"
http.CONTENT.TEXT       -- "text/plain"
http.CONTENT.STREAM     -- "application/octet-stream"
```

### Режимы передачи

```lua
http.TRANSFER.CHUNKED   -- "chunked"
http.TRANSFER.SSE       -- "sse"
```

### Типы ошибок

Константы типов ошибок модуля для точной обработки.

```lua
http.ERROR.PARSE_FAILED   -- Ошибка разбора формы/multipart
http.ERROR.INVALID_STATE  -- Некорректное состояние ответа
http.ERROR.WRITE_FAILED   -- Ошибка записи ответа
http.ERROR.STREAM_ERROR   -- Ошибка потока тела
```

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Нет HTTP-контекста | `errors.INTERNAL` | нет |
| Тело слишком большое | `errors.INVALID` | нет |
| Таймаут чтения | `errors.INTERNAL` | нет |
| Некорректный JSON | `errors.INVALID` | нет |
| Не multipart | `errors.INVALID` | нет |
| Заголовки уже отправлены | `errors.INVALID` | нет |
| Ошибка записи | `errors.INTERNAL` | нет |

См. [Обработка ошибок](lua-errors.md) для работы с ошибками.
