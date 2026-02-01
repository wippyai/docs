# HTTP-Endpunkte

Endpunkte (`http.endpoint`) definieren HTTP-Routen-Handler, die Lua-Funktionen ausführen.

## Definition

```yaml
- name: get_user
  kind: http.endpoint
  router: api_router
  method: GET
  path: /users/{id}
  func: app.users:get_user
```

## Konfiguration

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `router` | registry.ID | Übergeordneter Router (optional wenn nur ein Router) |
| `method` | string | HTTP-Methode |
| `path` | string | URL-Pfadmuster |
| `func` | registry.ID | Auszuführende Funktion |

## HTTP-Methoden

Unterstützte Methoden:

| Methode | Anwendungsfall |
|---------|----------------|
| `GET` | Ressourcen abrufen |
| `POST` | Ressourcen erstellen |
| `PUT` | Ressourcen ersetzen |
| `PATCH` | Teilweise aktualisieren |
| `DELETE` | Ressourcen entfernen |
| `HEAD` | Nur Header |
| `OPTIONS` | CORS-Preflight (automatisch behandelt) |

## Pfadparameter

Verwenden Sie `{param}`-Syntax für URL-Parameter:

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

Zugriff im Handler:

```lua
function(req, res)
    local user_id = req:param("id")
    local post_id = req:param("post_id")
end
```

## Wildcard-Pfade

Verbleibenden Pfad mit `{path...}` erfassen:

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

## Handler-Funktion

Endpunkt-Funktionen erhalten Request- und Response-Objekte:

```lua
function(req, res)
    -- Request lesen
    local body = req:body()
    local user_id = req:param("id")
    local page = req:query("page")
    local auth = req:header("Authorization")

    -- Verarbeiten
    local user = get_user(user_id)

    -- Response schreiben
    res:set_header("Content-Type", "application/json")
    res:set_status(200)
    res:write(json.encode(user))
end
```

### Request-Objekt

| Methode | Rückgabe | Beschreibung |
|---------|----------|--------------|
| `req:method()` | string | HTTP-Methode |
| `req:path()` | string | Request-Pfad |
| `req:param(name)` | string | URL-Parameter |
| `req:query(name)` | string | Query-Parameter |
| `req:header(name)` | string | Request-Header |
| `req:headers()` | table | Alle Header |
| `req:body()` | string | Request-Body |
| `req:cookie(name)` | string | Cookie-Wert |
| `req:remote_addr()` | string | Client-IP-Adresse |

### Response-Objekt

| Methode | Beschreibung |
|---------|--------------|
| `res:set_status(code)` | HTTP-Status setzen |
| `res:set_header(name, value)` | Header setzen |
| `res:set_cookie(name, value, opts)` | Cookie setzen |
| `res:write(data)` | Body schreiben |
| `res:redirect(url, code?)` | Weiterleiten (Standard 302) |

## JSON-API-Muster

Gängiges Muster für JSON-APIs:

```lua
local json = require("json")

function(req, res)
    -- JSON-Body parsen
    local data, err = json.decode(req:body())
    if err then
        res:set_status(400)
        res:set_header("Content-Type", "application/json")
        res:write(json.encode({error = "Ungültiges JSON"}))
        return
    end

    -- Request verarbeiten
    local result = process(data)

    -- JSON-Response zurückgeben
    res:set_status(200)
    res:set_header("Content-Type", "application/json")
    res:write(json.encode(result))
end
```

## Fehler-Responses

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
            return api_error(res, 404, "USER_NOT_FOUND", "Benutzer nicht gefunden")
        end
        return api_error(res, 500, "INTERNAL_ERROR", "Serverfehler")
    end

    res:set_status(200)
    res:set_header("Content-Type", "application/json")
    res:write(json.encode(user))
end
```

## Beispiele

### CRUD-Endpunkte

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

### Geschützter Endpunkt

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

## Siehe auch

- [Router](http-router.md) - Routen-Gruppierung
- [HTTP-Modul](lua-http.md) - Request/Response-API
- [Middleware](http-middleware.md) - Request-Verarbeitung
