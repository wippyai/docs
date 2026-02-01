# Endpoints HTTP

Los endpoints (`http.endpoint`) definen manejadores de rutas HTTP que ejecutan funciones Lua.

## Definición

```yaml
- name: get_user
  kind: http.endpoint
  router: api_router
  method: GET
  path: /users/{id}
  func: app.users:get_user
```

## Configuración

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `router` | registry.ID | Router padre (opcional si solo hay un router) |
| `method` | string | Método HTTP |
| `path` | string | Patrón de ruta URL |
| `func` | registry.ID | Función a ejecutar |

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
function(req, res)
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

```lua
function(req, res)
    local file_path = req:param("path")
    -- /files/docs/readme.md -> path = "docs/readme.md"
end
```

## Función Handler

Las funciones de endpoint reciben objetos de solicitud y respuesta:

```lua
function(req, res)
    -- Leer solicitud
    local body = req:body()
    local user_id = req:param("id")
    local page = req:query("page")
    local auth = req:header("Authorization")

    -- Procesar
    local user = get_user(user_id)

    -- Escribir respuesta
    res:set_header("Content-Type", "application/json")
    res:set_status(200)
    res:write(json.encode(user))
end
```

### Objeto Request

| Método | Retorna | Descripción |
|--------|---------|-------------|
| `req:method()` | string | Método HTTP |
| `req:path()` | string | Ruta de solicitud |
| `req:param(name)` | string | Parámetro de URL |
| `req:query(name)` | string | Parámetro de query |
| `req:header(name)` | string | Header de solicitud |
| `req:headers()` | table | Todos los headers |
| `req:body()` | string | Cuerpo de solicitud |
| `req:cookie(name)` | string | Valor de cookie |
| `req:remote_addr()` | string | Dirección IP del cliente |

### Objeto Response

| Método | Descripción |
|--------|-------------|
| `res:set_status(code)` | Establecer status HTTP |
| `res:set_header(name, value)` | Establecer header |
| `res:set_cookie(name, value, opts)` | Establecer cookie |
| `res:write(data)` | Escribir cuerpo |
| `res:redirect(url, code?)` | Redirigir (por defecto 302) |

## Patrón de API JSON

Patrón común para APIs JSON:

```lua
local json = require("json")

function(req, res)
    -- Parsear cuerpo JSON
    local data, err = json.decode(req:body())
    if err then
        res:set_status(400)
        res:set_header("Content-Type", "application/json")
        res:write(json.encode({error = "JSON inválido"}))
        return
    end

    -- Procesar solicitud
    local result = process(data)

    -- Retornar respuesta JSON
    res:set_status(200)
    res:set_header("Content-Type", "application/json")
    res:write(json.encode(result))
end
```

## Respuestas de Error

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
            return api_error(res, 404, "USER_NOT_FOUND", "Usuario no encontrado")
        end
        return api_error(res, 500, "INTERNAL_ERROR", "Error de servidor")
    end

    res:set_status(200)
    res:set_header("Content-Type", "application/json")
    res:write(json.encode(user))
end
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

### Endpoint Protegido

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

## Ver También

- [Router](http-router.md) - Agrupación de rutas
- [Módulo HTTP](lua-http.md) - API de request/response
- [Middleware](http-middleware.md) - Procesamiento de solicitudes
