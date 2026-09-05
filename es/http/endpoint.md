---
title: "Endpoints HTTP"
description: "Los endpoints (http.endpoint) definen manejadores de rutas HTTP que ejecutan funciones Lua."
---

# Endpoints HTTP

Los endpoints (`http.endpoint`) definen manejadores de rutas HTTP que ejecutan funciones Lua.

## Definición

```yaml
- name: get_user
  kind: http.endpoint
  meta:
    router: app:api_router
  method: GET
  path: /users/{id}
  func: app.users:get_user
```

## Configuración

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `meta.router` | registry.ID | No | Router padre (por defecto, el único router si exactamente uno está registrado) |
| `method` | string | Sí | Método HTTP, o `"*"` para cualquier método |
| `path` | string | Sí | Patrón de ruta URL |
| `func` | registry.ID | Sí | Función a ejecutar |

## Métodos HTTP

Métodos soportados:

| Método | Caso de Uso |
|--------|----------|
| `GET` | Recuperar recursos |
| `POST` | Crear recursos |
| `PUT` | Reemplazar recursos |
| `PATCH` | Actualización parcial |
| `DELETE` | Eliminar recursos |
| `HEAD` | Solo headers |
| `OPTIONS` | Preflight CORS (auto-manejado) |
| `TRACE` | Loopback de diagnóstico |
| `*` | Cualquier método |

Los nombres de método van en mayúsculas; `method` es obligatorio, y cualquier valor fuera de este conjunto se rechaza como error de configuración.

### Endpoints Agnósticos al Método

`method: "*"` registra la ruta para todos los métodos HTTP, y el handler lee el método real con `req:method()`:

```yaml
- name: proxy
  kind: http.endpoint
  method: "*"
  path: /proxy/{path...}
  func: proxy_handler
```

Para un endpoint normal el router también registra un handler `OPTIONS` en la misma ruta, de modo que el middleware CORS puede responder un preflight sin que el endpoint se ejecute. Un endpoint `*` no obtiene ese handler: ya coincide con `OPTIONS`, así que las solicitudes de preflight llegan a la propia función del endpoint, que debe responderlas.

## Parámetros de Ruta

Use sintaxis `{param}` para parámetros de URL:

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

Acceso en handler:

```lua
local http = require("http")

local function handler()
    local req = http.request()
    local user_id = req:param("id")
    local post_id = req:param("post_id")
end
```

## Rutas Comodín

Capture la ruta restante con `{path...}`:

```yaml
- name: file_handler
  kind: http.endpoint
  method: GET
  path: /files/{path...}
  func: serve_file
```

Este segmento catch-all hace que la ruta coincida con solicitudes como `/files/docs/readme.md`. La cola capturada se lee como cualquier otro parámetro, bajo el nombre sin los puntos finales:

```lua
local req = http.request()
local tail = req:param("path")  -- "docs/readme.md"
```

## Función Handler

Las funciones de endpoint obtienen objetos de solicitud y respuesta del módulo `http`:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    -- Leer solicitud
    local body = req:body()
    local user_id = req:param("id")
    local page = req:query("page")
    local auth = req:header("Authorization")

    -- Procesar
    local user = get_user(user_id)

    -- Escribir respuesta
    res:set_content_type(http.CONTENT.JSON)
    res:set_status(http.STATUS.OK)
    res:write_json(user)
end

return { handler = handler }
```

### Objeto Request

| Método | Retorna | Descripción |
|--------|---------|-------------|
| `req:method()` | string | Método HTTP |
| `req:path()` | string | Ruta de solicitud |
| `req:param(name)` | string | Parámetro de URL |
| `req:params()` | table | Todos los parámetros de ruta |
| `req:query(name)` | string | Parámetro de query |
| `req:query_params()` | table | Todos los parámetros de query |
| `req:header(name)` | string | Header de solicitud |
| `req:body()` | string | Cuerpo de solicitud |
| `req:body_json()` | table, error | Parsear cuerpo JSON |
| `req:has_body()` | boolean | Verifica si existe cuerpo |
| `req:content_type()` | string | Tipo de contenido |
| `req:content_length()` | number | Tamaño del cuerpo en bytes |
| `req:host()` | string | Nombre del host |
| `req:remote_addr()` | string | Dirección IP del cliente |
| `req:accepts(type)` | boolean | Negociación de contenido |
| `req:is_content_type(type)` | boolean | Verifica tipo de contenido |
| `req:stream()` | Stream | Cuerpo como stream para archivos grandes |
| `req:parse_multipart(max?)` | table, error | Parsear formulario multipart |

### Objeto Response

| Método | Descripción |
|--------|-------------|
| `res:set_status(code)` | Establecer código de status HTTP |
| `res:set_header(name, value)` | Establecer header de respuesta |
| `res:set_content_type(type)` | Establecer tipo de contenido |
| `res:write(data)` | Escribir cuerpo crudo |
| `res:write_json(data)` | Escribir respuesta JSON |
| `res:write_event(data)` | Enviar evento SSE |
| `res:set_transfer(encoding)` | Establecer modo de transferencia (SSE, chunked) |
| `res:flush()` | Descargar respuesta al cliente |

## Patrón de API JSON

Patrón común para APIs JSON:

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

## Respuestas de Error

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

## Ejemplos

### Endpoints CRUD

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

### Endpoint Protegido

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

## Ver También

- [Router](http/router.md) - Agrupación de rutas
- [Módulo HTTP](lua/http/http.md) - API de request/response
- [Middleware](http/middleware.md) - Procesamiento de solicitudes
