# HTTP-Endpunkte

Endpunkte (`http.endpoint`) definieren HTTP-Routen-Handler, die Lua-Funktionen ausführen.

## Definition

```yaml
- name: get_user
  kind: http.endpoint
  meta:
    router: app:api_router
  method: GET
  path: /users/{id}
  func: app.users:get_user
```

## Konfiguration

| Feld | Typ | Erforderlich | Beschreibung |
|------|-----|--------------|--------------|
| `meta.router` | registry.ID | Nein | Übergeordneter Router (Standard: der einzige Router, falls genau einer registriert ist) |
| `method` | string | Ja | HTTP-Methode |
| `path` | string | Ja | URL-Pfadmuster |
| `func` | registry.ID | Ja | Auszuführende Funktion |

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
| `TRACE` | Diagnostischer Loopback |

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
local http = require("http")

local function handler()
    local req = http.request()
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
local function handler()
    local req = http.request()
    local file_path = req:param("path")
    -- /files/docs/readme.md -> path = "docs/readme.md"
end
```

## Handler-Funktion

Endpunkt-Funktionen erhalten Request- und Response-Objekte aus dem `http`-Modul:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local res = http.response()

    -- Request lesen
    local body = req:body()
    local user_id = req:param("id")
    local page = req:query("page")
    local auth = req:header("Authorization")

    -- Verarbeiten
    local user = get_user(user_id)

    -- Response schreiben
    res:set_content_type(http.CONTENT.JSON)
    res:set_status(http.STATUS.OK)
    res:write_json(user)
end

return { handler = handler }
```

### Request-Objekt

| Methode | Rückgabe | Beschreibung |
|---------|----------|--------------|
| `req:method()` | string | HTTP-Methode |
| `req:path()` | string | Request-Pfad |
| `req:param(name)` | string | URL-Parameter |
| `req:params()` | table | Alle Pfadparameter |
| `req:query(name)` | string | Query-Parameter |
| `req:query_params()` | table | Alle Query-Parameter |
| `req:header(name)` | string | Request-Header |
| `req:body()` | string | Request-Body |
| `req:body_json()` | table, error | JSON-Body parsen |
| `req:has_body()` | boolean | Prüfen, ob Body vorhanden |
| `req:content_type()` | string | Content-Type |
| `req:content_length()` | number | Body-Größe in Bytes |
| `req:host()` | string | Hostname |
| `req:remote_addr()` | string | Client-IP-Adresse |
| `req:accepts(type)` | boolean | Content Negotiation |
| `req:is_content_type(type)` | boolean | Content-Type prüfen |
| `req:stream()` | Stream | Body als Stream für große Dateien |
| `req:parse_multipart(max?)` | table, error | Multipart-Formular parsen |

### Response-Objekt

| Methode | Beschreibung |
|---------|--------------|
| `res:set_status(code)` | HTTP-Statuscode setzen |
| `res:set_header(name, value)` | Response-Header setzen |
| `res:set_content_type(type)` | Content-Type setzen |
| `res:write(data)` | Raw-Body schreiben |
| `res:write_json(data)` | JSON-Response schreiben |
| `res:write_event(data)` | SSE-Event senden |
| `res:set_transfer(encoding)` | Transfer-Modus setzen (SSE, chunked) |
| `res:flush()` | Response an Client übertragen |

## JSON-API-Muster

Gängiges Muster für JSON-APIs:

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

## Fehler-Responses

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

### Geschützter Endpunkt

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

## Siehe auch

- [Router](http/router.md) - Routen-Gruppierung
- [HTTP-Modul](lua/http/http.md) - Request/Response-API
- [Middleware](http/middleware.md) - Request-Verarbeitung
