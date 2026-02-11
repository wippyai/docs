# HTTP-клиент
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Выполнение HTTP-запросов к внешним сервисам. Поддержка всех HTTP-методов, заголовков, query-параметров, данных форм, загрузки файлов, потоковых ответов и конкурентных пакетных запросов.

## Загрузка

```lua
local http_client = require("http_client")
```

## HTTP-методы

Все методы имеют одинаковую сигнатуру: `method(url, options?)`, возвращают `Response, error`.

### GET-запрос

```lua
local resp, err = http_client.get("https://api.example.com/users")
if err then
    return nil, err
end

print(resp.status_code)  -- 200
print(resp.body)         -- тело ответа
```

### POST-запрос

```lua
local resp, err = http_client.post("https://api.example.com/users", {
    headers = {["Content-Type"] = "application/json"},
    body = json.encode({name = "Alice", email = "alice@example.com"})
})
```

### PUT-запрос

```lua
local resp, err = http_client.put("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = json.encode({name = "Alice Smith"})
})
```

### PATCH-запрос

```lua
local resp, err = http_client.patch("https://api.example.com/users/123", {
    body = json.encode({status = "active"})
})
```

### DELETE-запрос

```lua
local resp, err = http_client.delete("https://api.example.com/users/123", {
    headers = {["Authorization"] = "Bearer " .. token}
})
```

### HEAD-запрос

Возвращает только заголовки, без тела.

```lua
local resp, err = http_client.head("https://cdn.example.com/file.zip")
local size = resp.headers["Content-Length"]
```

### Произвольный метод

```lua
local resp, err = http_client.request("PROPFIND", "https://dav.example.com/folder", {
    headers = {["Depth"] = "1"}
})
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `method` | string | HTTP-метод |
| `url` | string | URL запроса |
| `options` | table | Опции запроса (опционально) |

## Опции запроса

| Поле | Тип | Описание |
|------|-----|----------|
| `headers` | table | Заголовки запроса `{["Name"] = "value"}` |
| `body` | string | Тело запроса |
| `query` | table | Query-параметры `{key = "value"}` |
| `form` | table | Данные формы (Content-Type устанавливается автоматически) |
| `files` | table | Загрузка файлов (массив определений файлов) |
| `cookies` | table | Cookies запроса `{name = "value"}` |
| `auth` | table | Basic-авторизация `{user = "name", pass = "secret"}` |
| `timeout` | number/string | Таймаут: число в секундах или строка типа `"30s"`, `"1m"` |
| `stream` | boolean | Потоковое получение тела вместо буферизации |
| `max_response_body` | number | Макс. размер ответа в байтах (0 = по умолчанию) |
| `unix_socket` | string | Подключение через Unix-сокет |
| `tls` | table | Настройки TLS для запроса (см. [Параметры TLS](#параметры-tls)) |

### Query-параметры

```lua
local resp, err = http_client.get("https://api.example.com/search", {
    query = {
        q = "lua programming",
        page = "1",
        limit = "20"
    }
})
```

### Заголовки и авторизация

```lua
local resp, err = http_client.get("https://api.example.com/data", {
    headers = {
        ["Authorization"] = "Bearer " .. token,
        ["Accept"] = "application/json"
    }
})

-- Или через basic auth
local resp, err = http_client.get("https://api.example.com/data", {
    auth = {user = "admin", pass = "secret"}
})
```

### Данные формы

```lua
local resp, err = http_client.post("https://api.example.com/login", {
    form = {
        username = "alice",
        password = "secret123"
    }
})
```

### Загрузка файлов

```lua
local resp, err = http_client.post("https://api.example.com/upload", {
    form = {title = "My Document"},
    files = {
        {
            name = "attachment",      -- имя поля формы
            filename = "report.pdf",  -- исходное имя файла
            content = pdf_data,       -- содержимое файла
            content_type = "application/pdf"
        }
    }
})
```

| Поле файла | Тип | Обязательно | Описание |
|------------|-----|-------------|----------|
| `name` | string | да | Имя поля формы |
| `filename` | string | нет | Исходное имя файла |
| `content` | string | да* | Содержимое файла |
| `reader` | userdata | да* | Альтернатива: io.Reader для содержимого |
| `content_type` | string | нет | MIME-тип (по умолчанию: `application/octet-stream`) |

*Требуется либо `content`, либо `reader`.

### Таймаут

```lua
-- Число: секунды
local resp, err = http_client.get(url, {timeout = 30})

-- Строка: формат Go duration
local resp, err = http_client.get(url, {timeout = "30s"})
local resp, err = http_client.get(url, {timeout = "1m30s"})
local resp, err = http_client.get(url, {timeout = "1h"})
```

### Параметры TLS

Настройка TLS для отдельных запросов: mTLS (взаимный TLS) и пользовательские CA-сертификаты.

| Поле | Тип | Описание |
|------|-----|----------|
| `cert` | string | Клиентский сертификат в формате PEM |
| `key` | string | Закрытый ключ клиента в формате PEM |
| `ca` | string | Пользовательский CA-сертификат в формате PEM |
| `server_name` | string | Имя сервера для SNI-верификации |
| `insecure_skip_verify` | boolean | Пропустить проверку TLS-сертификата |

Для mTLS необходимо указать оба поля `cert` и `key`. Поле `ca` заменяет системный пул сертификатов пользовательским CA.

#### Аутентификация mTLS

```lua
local cert_pem = fs.read("/certs/client.crt")
local key_pem = fs.read("/certs/client.key")

local resp, err = http_client.get("https://secure.example.com/api", {
    tls = {
        cert = cert_pem,
        key = key_pem,
    }
})
```

#### Пользовательский CA

```lua
local ca_pem = fs.read("/certs/internal-ca.crt")

local resp, err = http_client.get("https://internal.example.com/api", {
    tls = {
        ca = ca_pem,
        server_name = "internal.example.com",
    }
})
```

#### Пропуск проверки TLS

Пропуск TLS-верификации для сред разработки. Требует разрешение безопасности `http_client.insecure_tls`.

```lua
local resp, err = http_client.get("https://localhost:8443/api", {
    tls = {
        insecure_skip_verify = true,
    }
})
```

## Объект ответа

| Поле | Тип | Описание |
|------|-----|----------|
| `status_code` | number | HTTP-код статуса |
| `body` | string | Тело ответа (если не потоковый) |
| `body_size` | number | Размер тела в байтах (-1 если потоковый) |
| `headers` | table | Заголовки ответа |
| `cookies` | table | Cookies ответа |
| `url` | string | Финальный URL (после редиректов) |
| `stream` | Stream | Объект потока (если `stream = true`) |

```lua
local resp, err = http_client.get("https://api.example.com/data")
if err then
    return nil, err
end

if resp.status_code == 200 then
    local data = json.decode(resp.body)
    print("Content-Type:", resp.headers["Content-Type"])
end
```

## Потоковые ответы

Для больших ответов используйте потоковый режим, чтобы не загружать всё тело в память.

```lua
local resp, err = http_client.get("https://cdn.example.com/large-file.zip", {
    stream = true
})
if err then
    return nil, err
end

-- Обработка порциями
while true do
    local chunk, err = resp.stream:read(65536)
    if err or not chunk then break end
    -- обработка chunk
end
resp.stream:close()
```

| Метод потока | Возвращает | Описание |
|--------------|------------|----------|
| `read(size)` | string, error | Читает до `size` байт |
| `close()` | - | Закрывает поток |

## Пакетные запросы

Выполнение нескольких запросов конкурентно.

```lua
local responses, errors = http_client.request_batch({
    {"GET", "https://api.example.com/users"},
    {"GET", "https://api.example.com/products"},
    {"POST", "https://api.example.com/log", {body = "event"}}
})

if errors then
    for i, err in ipairs(errors) do
        if err then
            print("Request " .. i .. " failed:", err)
        end
    end
else
    -- Все успешны
    for i, resp in ipairs(responses) do
        print("Response " .. i .. ":", resp.status_code)
    end
end
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `requests` | table | Массив `{method, url, options?}` |

**Возвращает:** `responses, errors` — массивы, индексированные по позиции запроса

**Замечания:**
- Запросы выполняются конкурентно
- Потоковый режим (`stream = true`) не поддерживается в пакетном режиме
- Массивы результатов соответствуют порядку запросов (индексация с 1)

## URL-кодирование

### Кодирование

```lua
local encoded = http_client.encode_uri("hello world")
-- "hello+world"

local url = "https://api.example.com/search?q=" .. http_client.encode_uri(query)
```

### Декодирование

```lua
local decoded, err = http_client.decode_uri("hello+world")
-- "hello world"
```

## Разрешения

HTTP-запросы подчиняются вычислению политики безопасности.

### Действия безопасности

| Действие | Ресурс | Описание |
|----------|--------|----------|
| `http_client.request` | URL | Разрешить/запретить запросы к конкретным URL |
| `http_client.unix_socket` | Путь сокета | Разрешить/запретить подключения через Unix-сокет |
| `http_client.private_ip` | IP-адрес | Разрешить/запретить доступ к приватным IP-диапазонам |
| `http_client.insecure_tls` | URL | Разрешить/запретить небезопасный TLS (пропуск верификации) |

### Проверка доступа

```lua
local security = require("security")

if security.can("http_client.request", "https://api.example.com/users") then
    local resp = http_client.get("https://api.example.com/users")
end
```

### Защита от SSRF

Приватные IP-диапазоны (10.x, 192.168.x, 172.16-31.x, localhost) заблокированы по умолчанию. Доступ требует разрешения `http_client.private_ip`.

```lua
local resp, err = http_client.get("http://192.168.1.1/admin")
-- Error: not allowed: private IP 192.168.1.1
```

См. [Модель безопасности](system/security.md) для настройки политик.

## Ошибки

| Условие | Kind | Повторяемо |
|---------|------|------------|
| Запрещено политикой безопасности | `errors.PERMISSION_DENIED` | нет |
| Приватный IP заблокирован | `errors.PERMISSION_DENIED` | нет |
| Unix-сокет запрещён | `errors.PERMISSION_DENIED` | нет |
| Небезопасный TLS запрещён | `errors.PERMISSION_DENIED` | нет |
| Некорректный URL или опции | `errors.INVALID` | нет |
| Нет контекста | `errors.INTERNAL` | нет |
| Сетевая ошибка | `errors.INTERNAL` | да |
| Таймаут | `errors.INTERNAL` | да |

```lua
local resp, err = http_client.get(url)
if err then
    if errors.is(err, errors.PERMISSION_DENIED) then
        print("Access denied:", err:message())
    elseif err:retryable() then
        print("Temporary error:", err:message())
    end
    return nil, err
end
```

См. [Обработка ошибок](lua/core/errors.md) для работы с ошибками.
