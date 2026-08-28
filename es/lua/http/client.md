---
title: "Cliente HTTP"
description: "Envía solicitudes HTTP con headers, autenticación, formularios, cargas, TLS, streaming y lotes."
---

# Cliente HTTP
<secondary-label ref="network"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

El módulo `http_client` envía solicitudes HTTP con headers, query parameters,
formularios, cargas de archivos, autenticación, opciones TLS, respuestas en streaming
y lotes concurrentes.

Esta es una referencia de API con recetas parciales. Las URLs, tokens, credenciales,
datos y certificados proceden de la aplicación. Los ejemplos comprueban
`Response, error` antes de consumir una respuesta y cierran los cuerpos en streaming.

## Carga

```lua
local http_client = require("http_client")
```

Añade `http_client` a `modules:` antes de requerirlo. Las recetas de JSON y sistema
de archivos también requieren `json` y `fs`.

## Metodos HTTP

Todos los metodos comparten la misma firma: `method(url, options?)` devolviendo `Response, error`.

### GET

Envía una solicitud `GET`.

```lua
local resp, err = http_client.get("https://api.example.com/users")
if err then
    return nil, err
end

print(resp.status_code)  -- 200
print(resp.body)         -- response body
```

### POST

Envía una solicitud `POST`.

```lua
local json = require("json")

local body, body_err = json.encode({name = "Alice", email = "alice@example.com"})
if body_err then return nil, body_err end
local resp, err = http_client.post("https://api.example.com/users", {
    headers = {["Content-Type"] = "application/json"},
    body = body
})
if err then return nil, err end
```

### PUT

Envía una solicitud `PUT`.

```lua
local body, body_err = json.encode({name = "Alice Smith"})
if body_err then return nil, body_err end
local resp, err = http_client.put("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = body
})
if err then return nil, err end
```

### PATCH

Envía una solicitud `PATCH`.

```lua
local body, body_err = json.encode({status = "active"})
if body_err then return nil, body_err end
local resp, err = http_client.patch("https://api.example.com/users/123", {
    headers = {["Content-Type"] = "application/json"},
    body = body
})
if err then return nil, err end
```

### DELETE

Envía una solicitud `DELETE`.

```lua
local resp, err = http_client.delete("https://api.example.com/users/123", {
    headers = {["Authorization"] = "Bearer " .. token}
})
if err then return nil, err end
```

### HEAD

Una solicitud `HEAD` devuelve solo cabeceras, sin cuerpo.

```lua
local resp, err = http_client.head("https://cdn.example.com/file.zip")
if err then return nil, err end
local size = resp.headers["Content-Length"]
```

### Métodos personalizados

```lua
local resp, err = http_client.request("PROPFIND", "https://dav.example.com/folder", {
    headers = {["Depth"] = "1"}
})
if err then return nil, err end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `method` | string | Método HTTP |
| `url` | string | URL de solicitud |
| `options` | table | Opciones de solicitud (opcional) |

## Opciones de Solicitud

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `headers` | table | Cabeceras de solicitud `{["Name"] = "value"}` |
| `body` | string | Cuerpo de solicitud |
| `query` | table | Parametros de consulta `{key = "value"}` |
| `form` | table | Datos de formulario (establece Content-Type automaticamente) |
| `files` | table | Carga de archivos (array de definiciones de archivo) |
| `cookies` | table | Cookies de solicitud `{name = "value"}` |
| `auth` | table | Autenticación basica `{user = "name", pass = "secret"}` |
| `timeout` | number/string | Timeout: número en segundos, o string como `"30s"`, `"1m"` |
| `stream` | boolean | Transmitir cuerpo de respuesta en lugar de almacenar en buffer |
| `max_response_body` | number | Tamano maximo de respuesta en bytes (0 = predeterminado) |
| `unix_socket` | string | Conectar via ruta de socket Unix |
| `tls` | table | Configuracion TLS por solicitud (ver [Opciones TLS](#opciones-tls)) |
| `overlay_network` | string | Enruta por una [red superpuesta](../../system/network.md): ID de `network.socks5`, `network.tailscale` o `network.i2p` |

Seleccionar `overlay_network` requiere `network.select` sobre ese ID de red.

### Parametros de Consulta

```lua
local resp, err = http_client.get("https://api.example.com/search", {
    query = {
        q = "lua programming",
        page = "1",
        limit = "20"
    }
})
if err then return nil, err end
```

### Cabeceras y Autenticación

```lua
local resp, err = http_client.get("https://api.example.com/data", {
    headers = {
        ["Authorization"] = "Bearer " .. token,
        ["Accept"] = "application/json"
    }
})
if err then return nil, err end

-- Or use basic auth
local resp, err = http_client.get("https://api.example.com/data", {
    auth = {user = service_user, pass = service_password}
})
if err then return nil, err end
```

Carga los valores de autenticación desde almacenamiento secreto de la aplicación y
envíalos únicamente mediante TLS.

### Datos de Formulario

```lua
local resp, err = http_client.post("https://api.example.com/login", {
    form = {
        username = username,
        password = password
    }
})
if err then return nil, err end
```

### Carga de Archivos

```lua
local resp, err = http_client.post("https://api.example.com/upload", {
    form = {title = "My Document"},
    files = {
        {
            name = "attachment",      -- form field name
            filename = "report.pdf",  -- original filename
            content = pdf_data,       -- file content
            content_type = "application/pdf"
        }
    }
})
if err then return nil, err end
```

| Campo de Archivo | Tipo | Requerido | Descripción |
|------------------|------|-----------|-------------|
| `name` | string | si | Nombre de campo de formulario |
| `filename` | string | no | Nombre de archivo original |
| `content` | string | si* | Contenido del archivo |
| `reader` | userdata | si* | Alternativa: io.Reader para contenido |
| `content_type` | string | no | Se ignora actualmente: cada parte usa `Content-Type: application/octet-stream` |

*Se requiere `content` o `reader`.

El runtime fijado lee por completo un `reader` en memoria antes del dispatch, no lo
cierra y no informa por separado de fallos distintos de EOF; puede enviar los bytes
acumulados antes del fallo. Prefiere `content` para datos ya limitados y cierra los
readers propiedad del caller. En `v0.3.32a`, `content_type` se analiza pero no se reenvía.

Los archivos respaldados por reader solo se admiten en llamadas individuales.
`request_batch` reenvía `content` pero descarta un `reader`; las cargas en lote deben
usar `content`.

### Timeout

```lua
-- Number: seconds
local resp, err = http_client.get(url, {timeout = 30})
if err then return nil, err end

-- String alternatives use Go duration format: "30s", "1m30s", or "1h".
```

### Opciones TLS

Configurar ajustes TLS por solicitud para mTLS (TLS mutuo) y certificados CA personalizados.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `cert` | string | Certificado de cliente en formato PEM |
| `key` | string | Clave privada del cliente en formato PEM |
| `ca` | string | Certificado CA personalizado en formato PEM |
| `server_name` | string | Nombre del servidor para verificacion SNI |
| `insecure_skip_verify` | boolean | Omitir verificacion de certificado TLS |

Tanto `cert` como `key` deben proporcionarse juntos para mTLS. El campo `ca` reemplaza el pool de certificados del sistema con un CA personalizado.

#### Autenticacion mTLS

```lua
local fs = require("fs")
local certs, volume_err = fs.get("app:certs")
if volume_err then return nil, volume_err end
local cert_pem, cert_err = certs:readfile("client.crt")
if cert_err then return nil, cert_err end
local key_pem, key_err = certs:readfile("client.key")
if key_err then return nil, key_err end

local resp, err = http_client.get("https://secure.example.com/api", {
    tls = {
        cert = cert_pem,
        key = key_pem,
    }
})
if err then return nil, err end
```

#### CA Personalizado

```lua
local fs = require("fs")
local certs, volume_err = fs.get("app:certs")
if volume_err then return nil, volume_err end
local ca_pem, ca_err = certs:readfile("internal-ca.crt")
if ca_err then return nil, ca_err end

local resp, err = http_client.get("https://internal.example.com/api", {
    tls = {
        ca = ca_pem,
        server_name = "internal.example.com",
    }
})
if err then return nil, err end
```

#### Omitir Verificacion Insegura

Omitir verificacion TLS para entornos de desarrollo. `insecure_skip_verify` desactiva la verificación TLS y requiere el permiso de seguridad `http_client.insecure_tls`.

```lua
local resp, err = http_client.get("https://localhost:8443/api", {
    tls = {
        insecure_skip_verify = true,
    }
})
if err then return nil, err end
```

Usa `insecure_skip_verify` solo para un endpoint de diagnóstico controlado. Desactiva
la verificación tanto de la cadena del certificado como del hostname.

## Objeto Response

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `status_code` | number | Código de estado HTTP |
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
    local data, decode_err = json.decode(resp.body)
    if decode_err then return nil, decode_err end
    print("Content-Type:", resp.headers["Content-Type"])
end
```

## Respuestas en Streaming

Para respuestas grandes, establezca `stream = true` para procesar la respuesta de forma incremental en lugar de cargar todo el cuerpo en memoria.

```lua
local resp, err = http_client.get("https://cdn.example.com/large-file.zip", {
    stream = true
})
if err then
    return nil, err
end

-- Process in chunks
local read_err
while true do
    local chunk
    chunk, read_err = resp.stream:read(65536)
    if read_err or not chunk then break end
    -- process chunk
end
local _, close_err = resp.stream:close()
if read_err then return nil, read_err end
if close_err then return nil, close_err end
```

| Método de Stream | Devuelve | Descripción |
|------------------|----------|-------------|
| `read(n?)` | string, error | Leer hasta `n` bytes (predeterminado: buffer de implementación) |
| `close()` | boolean, error | Cerrar el stream |

`resp.stream` es un objeto [stream](lua/core/stream.md) completo: también dispone de
`seek`, `stat` y `scanner`. El caller es propietario del cuerpo y debe cerrarlo en
todas las salidas; la limpieza de la tarea es solo un fallback.

## Solicitudes por Lotes

`request_batch` ejecuta varias solicitudes concurrentemente.

```lua
local requests = {
    {"GET", "https://api.example.com/users"},
    {"GET", "https://api.example.com/products"},
    {"POST", "https://api.example.com/log", {body = "event"}}
}
local responses, batch_errors = http_client.request_batch(requests)

if not responses then
    return nil, batch_errors  -- whole-batch dispatch or validation failure
end

if batch_errors then
    for i = 1, #requests do
        local err = batch_errors[i]
        if err then
            print("Request " .. i .. " failed:", err)
        end
    end
else
    -- All succeeded
    for i, resp in ipairs(responses) do
        print("Response " .. i .. ":", resp.status_code)
    end
end
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `requests` | table | Array de `{method, url, options?}` |

**Devuelve:** `responses, errors` - arrays indexados por posicion de solicitud

**Notas:**
- Las solicitudes se ejecutan concurrentemente
- Streaming (`stream = true`) no es soportado en lotes
- Las cargas respaldadas por reader no se admiten en lote; usa `files[].content`
- Los arrays de resultado coinciden con el orden de solicitud (indexado desde 1)

## Codificacion de URL

### Codificar

Codifique valores con `http_client.encode_uri` antes de incorporarlos a una URL:

```lua
local encoded = http_client.encode_uri("hello world")
-- "hello+world"

local url = "https://api.example.com/search?q=" .. http_client.encode_uri(query)
```

### Decodificar

```lua
local decoded, err = http_client.decode_uri("hello+world")
if err then return nil, err end
-- "hello world"
```

## Permisos

Las solicitudes HTTP estan sujetas a evaluacion de politica de seguridad.

### Acciones de Seguridad

| Accion | Recurso | Descripción |
|--------|---------|-------------|
| `http_client.request` | URL | Permitir/denegar solicitudes a URLs especificas |
| `http_client.unix_socket` | Ruta de socket | Permitir/denegar conexiones de socket Unix |
| `http_client.private_ip` | Direccion IP | Permitir/denegar acceso a rangos de IP privados |
| `http_client.insecure_tls` | URL | Permitir/denegar TLS inseguro (omitir verificacion) |
| `network.select` | ID de red | Permitir/denegar la selección explícita de `overlay_network` |

### Verificar Acceso

```lua
local security = require("security")

if security.can("http_client.request", "https://api.example.com/users") then
    local resp, request_err = http_client.get("https://api.example.com/users")
    if request_err then return nil, request_err end
end
```

### Proteccion SSRF

Los rangos de IP privados (10.x, 192.168.x, 172.16-31.x, localhost) estan bloqueados por defecto. El acceso requiere el permiso `http_client.private_ip`.

```lua
local resp, err = http_client.get("http://192.168.1.1/admin")
-- Error: not allowed: private IP 192.168.1.1
```

Consulta [Modelo de seguridad](system/security.md) para configurar políticas.

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Politica de seguridad denegada | `errors.PERMISSION_DENIED` | no |
| IP privada bloqueada | `errors.PERMISSION_DENIED` | no |
| Socket Unix denegado | `errors.PERMISSION_DENIED` | no |
| TLS inseguro denegado | `errors.PERMISSION_DENIED` | no |
| Elemento de lote, streaming en lote o escape URI no válido | `errors.INVALID` | no |
| Sin contexto | `errors.INTERNAL` | no |
| URL de transporte malformada o fallo de red | `errors.INTERNAL` | sí |
| Timeout | `errors.INTERNAL` | si |

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

Muchos valores de opciones no compatibles se ignoran en lugar de producir errores
estructurados. Los tipos de argumentos Lua no válidos y un lote vacío lanzan errores
de argumento. Valida las tablas suministradas por la aplicación antes de llamar.

Consulta [Manejo de errores](lua/core/errors.md) para trabajar con errores.
