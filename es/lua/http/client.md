# Cliente HTTP
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Realizar solicitudes HTTP a servicios externos. Soporta todos los metodos HTTP, cabeceras, parametros de consulta, datos de formulario, carga de archivos, respuestas en streaming y solicitudes por lotes concurrentes.

## Carga

```lua
local http_client = require("http_client")
```

## Metodos HTTP

Todos los metodos comparten la misma firma: `method(url, options?)` devolviendo `Response, error`.

### Solicitud GET

```lua
local resp, err = http_client.get("https://api.example.com/users")
if err then
    return nil, err
end

print(resp.status_code)  -- 200
print(resp.body)         -- cuerpo de respuesta
```

### Solicitud POST

```lua
local resp, err = http_client.post("https://api.example.com/users", {
    headers = {["Content-Type"] = "application/json"},
    body = json.encode({name = "Alice", email = "alice@example.com"})
})
```

### Solicitud PUT

```lua
local resp, err = http_client.put("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = json.encode({name = "Alice Smith"})
})
```

### Solicitud PATCH

```lua
local resp, err = http_client.patch("https://api.example.com/users/123", {
    body = json.encode({status = "active"})
})
```

### Solicitud DELETE

```lua
local resp, err = http_client.delete("https://api.example.com/users/123", {
    headers = {["Authorization"] = "Bearer " .. token}
})
```

### Solicitud HEAD

Devuelve solo cabeceras, sin cuerpo.

```lua
local resp, err = http_client.head("https://cdn.example.com/file.zip")
local size = resp.headers["Content-Length"]
```

### Metodo Personalizado

```lua
local resp, err = http_client.request("PROPFIND", "https://dav.example.com/folder", {
    headers = {["Depth"] = "1"}
})
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `method` | string | Metodo HTTP |
| `url` | string | URL de solicitud |
| `options` | table | Opciones de solicitud (opcional) |

## Opciones de Solicitud

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `headers` | table | Cabeceras de solicitud `{["Name"] = "value"}` |
| `body` | string | Cuerpo de solicitud |
| `query` | table | Parametros de consulta `{key = "value"}` |
| `form` | table | Datos de formulario (establece Content-Type automaticamente) |
| `files` | table | Carga de archivos (array de definiciones de archivo) |
| `cookies` | table | Cookies de solicitud `{name = "value"}` |
| `auth` | table | Autenticacion basica `{user = "name", pass = "secret"}` |
| `timeout` | number/string | Timeout: numero en segundos, o string como `"30s"`, `"1m"` |
| `stream` | boolean | Transmitir cuerpo de respuesta en lugar de almacenar en buffer |
| `max_response_body` | number | Tamano maximo de respuesta en bytes (0 = predeterminado) |
| `unix_socket` | string | Conectar via ruta de socket Unix |

### Parametros de Consulta

```lua
local resp, err = http_client.get("https://api.example.com/search", {
    query = {
        q = "lua programming",
        page = "1",
        limit = "20"
    }
})
```

### Cabeceras y Autenticacion

```lua
local resp, err = http_client.get("https://api.example.com/data", {
    headers = {
        ["Authorization"] = "Bearer " .. token,
        ["Accept"] = "application/json"
    }
})

-- O usar autenticacion basica
local resp, err = http_client.get("https://api.example.com/data", {
    auth = {user = "admin", pass = "secret"}
})
```

### Datos de Formulario

```lua
local resp, err = http_client.post("https://api.example.com/login", {
    form = {
        username = "alice",
        password = "secret123"
    }
})
```

### Carga de Archivos

```lua
local resp, err = http_client.post("https://api.example.com/upload", {
    form = {title = "My Document"},
    files = {
        {
            name = "attachment",      -- nombre de campo de formulario
            filename = "report.pdf",  -- nombre de archivo original
            content = pdf_data,       -- contenido del archivo
            content_type = "application/pdf"
        }
    }
})
```

| Campo de Archivo | Tipo | Requerido | Descripcion |
|------------------|------|-----------|-------------|
| `name` | string | si | Nombre de campo de formulario |
| `filename` | string | no | Nombre de archivo original |
| `content` | string | si* | Contenido del archivo |
| `reader` | userdata | si* | Alternativa: io.Reader para contenido |
| `content_type` | string | no | Tipo MIME (predeterminado: `application/octet-stream`) |

*Se requiere `content` o `reader`.

### Timeout

```lua
-- Numero: segundos
local resp, err = http_client.get(url, {timeout = 30})

-- String: formato de duracion Go
local resp, err = http_client.get(url, {timeout = "30s"})
local resp, err = http_client.get(url, {timeout = "1m30s"})
local resp, err = http_client.get(url, {timeout = "1h"})
```

## Objeto Response

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `status_code` | number | Codigo de estado HTTP |
| `body` | string | Cuerpo de respuesta (si no es streaming) |
| `body_size` | number | Tamano del cuerpo en bytes (-1 si es streaming) |
| `headers` | table | Cabeceras de respuesta |
| `cookies` | table | Cookies de respuesta |
| `url` | string | URL final (despues de redirecciones) |
| `stream` | Stream | Objeto Stream (si `stream = true`) |

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

## Respuestas en Streaming

Para respuestas grandes, use streaming para evitar cargar todo el cuerpo en memoria.

```lua
local resp, err = http_client.get("https://cdn.example.com/large-file.zip", {
    stream = true
})
if err then
    return nil, err
end

-- Procesar en fragmentos
while true do
    local chunk, err = resp.stream:read(65536)
    if err or not chunk then break end
    -- procesar fragmento
end
resp.stream:close()
```

| Metodo de Stream | Devuelve | Descripcion |
|------------------|----------|-------------|
| `read(size)` | string, error | Leer hasta `size` bytes |
| `close()` | - | Cerrar el stream |

## Solicitudes por Lotes

Ejecutar multiples solicitudes concurrentemente.

```lua
local responses, errors = http_client.request_batch({
    {"GET", "https://api.example.com/users"},
    {"GET", "https://api.example.com/products"},
    {"POST", "https://api.example.com/log", {body = "event"}}
})

if errors then
    for i, err in ipairs(errors) do
        if err then
            print("Solicitud " .. i .. " fallo:", err)
        end
    end
else
    -- Todas exitosas
    for i, resp in ipairs(responses) do
        print("Respuesta " .. i .. ":", resp.status_code)
    end
end
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `requests` | table | Array de `{method, url, options?}` |

**Devuelve:** `responses, errors` - arrays indexados por posicion de solicitud

**Notas:**
- Las solicitudes se ejecutan concurrentemente
- Streaming (`stream = true`) no es soportado en lotes
- Los arrays de resultado coinciden con el orden de solicitud (indexado desde 1)

## Codificacion de URL

### Codificar

```lua
local encoded = http_client.encode_uri("hello world")
-- "hello+world"

local url = "https://api.example.com/search?q=" .. http_client.encode_uri(query)
```

### Decodificar

```lua
local decoded, err = http_client.decode_uri("hello+world")
-- "hello world"
```

## Permisos

Las solicitudes HTTP estan sujetas a evaluacion de politica de seguridad.

### Acciones de Seguridad

| Accion | Recurso | Descripcion |
|--------|---------|-------------|
| `http_client.request` | URL | Permitir/denegar solicitudes a URLs especificas |
| `http_client.unix_socket` | Ruta de socket | Permitir/denegar conexiones de socket Unix |
| `http_client.private_ip` | Direccion IP | Permitir/denegar acceso a rangos de IP privados |

### Verificar Acceso

```lua
local security = require("security")

if security.can("http_client.request", "https://api.example.com/users") then
    local resp = http_client.get("https://api.example.com/users")
end
```

### Proteccion SSRF

Los rangos de IP privados (10.x, 192.168.x, 172.16-31.x, localhost) estan bloqueados por defecto. El acceso requiere el permiso `http_client.private_ip`.

```lua
local resp, err = http_client.get("http://192.168.1.1/admin")
-- Error: no permitido: IP privada 192.168.1.1
```

Consulte [Modelo de Seguridad](system-security.md) para configuracion de politicas.

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| Politica de seguridad denegada | `errors.PERMISSION_DENIED` | no |
| IP privada bloqueada | `errors.PERMISSION_DENIED` | no |
| Socket Unix denegado | `errors.PERMISSION_DENIED` | no |
| URL u opciones invalidas | `errors.INVALID` | no |
| Sin contexto | `errors.INTERNAL` | no |
| Fallo de red | `errors.INTERNAL` | si |
| Timeout | `errors.INTERNAL` | si |

```lua
local resp, err = http_client.get(url)
if err then
    if errors.is(err, errors.PERMISSION_DENIED) then
        print("Acceso denegado:", err:message())
    elseif err:retryable() then
        print("Error temporal:", err:message())
    end
    return nil, err
end
```

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
