---
title: "Endpoints HTTP"
description: "Los endpoints (http.endpoint) definen manejadores de rutas HTTP que ejecutan funciones Lua."
---

# Endpoints HTTP

Un `http.endpoint` asigna un método y una ruta HTTP a una función handler de Lua.

**Clasificación: referencia de configuración y API.** Los bloques YAML son fragmentos de registro que presuponen que ya existen el servidor, router, middleware, entradas de función y políticas de seguridad referenciados. Los bloques Lua se centran en los contratos del handler e identifican explícitamente las llamadas de la aplicación.

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
| `meta.router` | registry.ID | Sí | Router padre (referenciado por ID de registro) |
| `method` | string | Sí | Método HTTP |
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
| `*` | Coincidir con todos los métodos HTTP |

## Parámetros de Ruta

Use sintaxis `{param}` para parámetros de URL:

```yaml
- name: get_user
  kind: http.endpoint
  meta:
    router: api
  method: GET
  path: /users/{id}
  func: get_user

- name: get_user_post
  kind: http.endpoint
  meta:
    router: api
  method: GET
  path: /users/{user_id}/posts/{post_id}
  func: get_user_post
```

Acceso en handler:

```lua
local http = require("http")

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local user_id, user_err = req:param("user_id")
    if user_err then return nil, user_err end
    local post_id, post_err = req:param("post_id")
    if post_err then return nil, post_err end
    return {user_id = user_id, post_id = post_id}
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

Este segmento comodín hace que la ruta coincida con solicitudes como `/files/docs/readme.md`. En esa solicitud, `req:param("path")` devuelve `docs/readme.md`.

## Función Handler

Las funciones de endpoint obtienen objetos de solicitud y respuesta del módulo `http`:

```lua
local http = require("http")
local funcs = require("funcs")

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local user_id, param_err = req:param("id")
    if param_err then return nil, param_err end

    local user, call_err = funcs.call("app.users:get_user", user_id)
    if call_err then return nil, call_err end

    local type_err = res:set_content_type(http.CONTENT.JSON)
    if type_err then return nil, type_err end
    local status_err = res:set_status(http.STATUS.OK)
    if status_err then return nil, status_err end
    local write_err = res:write_json(user)
    if write_err then return nil, write_err end
    return true
end

return { handler = handler }
```

### Objeto Request

| Método | Retorna | Descripción |
|--------|---------|-------------|
| `req:method()` | string, error | Método HTTP |
| `req:path()` | string, error | Ruta de la solicitud |
| `req:param(name)` | string o nil, error | Parámetro de URL |
| `req:params()` | table, error | Todos los parámetros de ruta |
| `req:query(name)` | string o nil, error | Parámetro de consulta |
| `req:query_params()` | table, error | Todos los parámetros de consulta |
| `req:header(name)` | string o nil, error | Cabecera de la solicitud |
| `req:body()` | string, error | Cuerpo de la solicitud |
| `req:body_json()` | value, error | Analizar el cuerpo JSON |
| `req:has_body()` | boolean, error | Comprobar si existe un cuerpo |
| `req:content_type()` | string o nil, error | Tipo de contenido |
| `req:content_length()` | number, error | Tamaño del cuerpo en bytes |
| `req:host()` | string, error | Cabecera Host |
| `req:remote_addr()` | string, error | Dirección del cliente con formato `IP:port`, salvo que un middleware la reescriba |
| `req:accepts(type)` | boolean, error | Negociación de contenido |
| `req:is_content_type(type)` | boolean, error | Comprobar el tipo de contenido |
| `req:stream()` | Stream, error | Cuerpo como stream para archivos grandes |
| `req:parse_multipart(max?)` | table, error | Parsear formulario multipart |

### Objeto Response

| Método | Descripción |
|--------|-------------|
| `res:set_status(code)` | Establecer el código de estado HTTP; devuelve un error si ya se enviaron las cabeceras |
| `res:set_header(name, value)` | Establecer una cabecera de respuesta; devuelve un error si ya se enviaron las cabeceras |
| `res:set_content_type(type)` | Establecer el tipo de contenido; devuelve un error si ya se enviaron las cabeceras |
| `res:write(data)` | Escribir el cuerpo sin procesar; devuelve un error si falla |
| `res:write_json(data)` | Escribir una respuesta JSON; devuelve un error si falla |
| `res:write_event(data)` | Enviar y vaciar un evento SSE; devuelve un error si falla |
| `res:set_transfer(encoding)` | Establecer el modo de transferencia `chunked` o `sse`; devuelve un error si ya se enviaron las cabeceras |
| `res:flush()` | Vaciar la respuesta; devuelve un valor de error |

## Patrón de API JSON

Un handler de API JSON puede analizar el cuerpo de la solicitud, rechazar entradas no válidas y escribir un resultado JSON:

```lua
local http = require("http")
local funcs = require("funcs")

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local data, err = req:body_json()
    if err then
        local status_err = res:set_status(http.STATUS.BAD_REQUEST)
        if status_err then return nil, status_err end
        local write_err = res:write_json({error = "Invalid JSON"})
        if write_err then return nil, write_err end
        return true
    end

    local result, process_err = funcs.call("app.api:process_request", data)
    if process_err then return nil, process_err end

    local status_err = res:set_status(http.STATUS.OK)
    if status_err then return nil, status_err end
    local write_err = res:write_json(result)
    if write_err then return nil, write_err end
    return true
end

return { handler = handler }
```

## Respuestas de Error

```lua
local http = require("http")
local funcs = require("funcs")

local function api_error(res, status, code, message)
    local status_err = res:set_status(status)
    if status_err then return nil, status_err end
    local write_err = res:write_json({
        error = {
            code = code,
            message = message
        }
    })
    if write_err then return nil, write_err end
    return true
end

local function handler()
    local req, req_err = http.request()
    if req_err then return nil, req_err end
    local res, res_err = http.response()
    if res_err then return nil, res_err end

    local user_id, param_err = req:param("id")
    if param_err then return nil, param_err end
    local user, err = funcs.call("app.users:get_user", user_id)

    if err then
        if errors.is(err, errors.NOT_FOUND) then
            return api_error(res, http.STATUS.NOT_FOUND, "USER_NOT_FOUND", "User not found")
        end
        return api_error(res, http.STATUS.INTERNAL_ERROR, "INTERNAL_ERROR", "Server error")
    end

    local status_err = res:set_status(http.STATUS.OK)
    if status_err then return nil, status_err end
    local write_err = res:write_json(user)
    if write_err then return nil, write_err end
    return true
end

return { handler = handler }
```

## Ejemplos

### Endpoints CRUD

```yaml
entries:
  - name: users_router
    kind: http.router
    meta:
      server: gateway
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

El middleware de autorización se configura en el router padre, no en el endpoint. El middleware post-match —como `endpoint_firewall`— se ejecuta después de hacer coincidir la ruta y se aplica a todos los endpoints del router:

```yaml
- name: admin_router
  kind: http.router
  meta:
    server: gateway
  prefix: /admin
  middleware:
    - cors
    - token_auth
  post_middleware:
    - endpoint_firewall
  post_options:
    endpoint_firewall.action: "admin"

- name: admin_endpoint
  kind: http.endpoint
  meta:
    router: admin_router
  method: POST
  path: /settings
  func: app.admin:update_settings
```

## Véase también

- [Router](./router.md) - Agrupación de rutas
- [Módulo HTTP](../lua/http/http.md) - API de solicitud y respuesta
- [Middleware](./middleware.md) - Procesamiento de solicitudes
