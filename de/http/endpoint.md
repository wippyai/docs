---
title: "HTTP-Endpunkte"
description: "Endpunkte (http.endpoint) definieren HTTP-Routen-Handler, die Lua-Funktionen ausführen."
---

# HTTP-Endpunkte

Ein `http.endpoint` ordnet eine HTTP-Methode und einen Pfad einer Lua-Handler-Funktion zu.

**Klassifikation: Konfigurations- und API-Referenz.** YAML-Blöcke sind Registry-Fragmente und setzen voraus, dass die referenzierten Server-, Router-, Middleware-, Funktions- und Sicherheitsrichtlinieneinträge bereits vorhanden sind. Lua-Blöcke konzentrieren sich auf Handler-Verträge und kennzeichnen Anwendungsaufrufe ausdrücklich.

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
| `method` | string | Ja | HTTP-Methode, oder `"*"` für jede Methode |
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
| `*` | Jede Methode |

Methodennamen werden großgeschrieben; `method` ist erforderlich, und jeder Wert außerhalb dieser Menge wird als Konfigurationsfehler abgelehnt.

### Methodenunabhängige Endpunkte

`method: "*"` registriert den Pfad für jede HTTP-Methode, und der Handler liest die tatsächliche Methode mit `req:method()`:

```yaml
- name: proxy
  kind: http.endpoint
  method: "*"
  path: /proxy/{path...}
  func: proxy_handler
```

Für einen normalen Endpunkt registriert der Router zusätzlich einen `OPTIONS`-Handler auf demselben Pfad, sodass CORS-Middleware einen Preflight beantworten kann, ohne dass der Endpunkt läuft. Ein `*`-Endpunkt erhält keinen solchen Handler: Er trifft `OPTIONS` bereits selbst. Router-Middleware umhüllt ihn dennoch, sodass konfigurierte CORS-Middleware einen erlaubten Preflight mit `204` beantwortet, bevor der Endpunkt läuft; jede andere `OPTIONS`-Anfrage erreicht die Endpunkt-Funktion selbst, die sie beantworten muss.

## Pfadparameter

Verwenden Sie `{param}`-Syntax für URL-Parameter:

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

Zugriff im Handler:

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

## Wildcard-Pfade

Verbleibenden Pfad mit `{path...}` erfassen:

```yaml
- name: file_handler
  kind: http.endpoint
  method: GET
  path: /files/{path...}
  func: serve_file
```

Dieses Catch-all-Segment lässt die Route auf Anfragen wie `/files/docs/readme.md` passen. Der erfasste Rest wird wie jeder andere Parameter gelesen, unter dem Namen ohne die abschließenden Punkte:

```lua
local req = http.request()
local tail = req:param("path")  -- "docs/readme.md"
```

## Handler-Funktion

Endpunkt-Funktionen erhalten Request- und Response-Objekte aus dem `http`-Modul:

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
| `req:headers()` | table | Alle Request-Header |
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
| `res:set_status(code)` | HTTP-Statuscode setzen; gibt einen Fehler zurück, wenn die Header bereits gesendet wurden |
| `res:set_header(name, value)` | Response-Header setzen; gibt einen Fehler zurück, wenn die Header bereits gesendet wurden |
| `res:set_content_type(type)` | Content-Type setzen; gibt einen Fehler zurück, wenn die Header bereits gesendet wurden |
| `res:write(data)` | Rohdaten in den Body schreiben; gibt bei einem Fehlschlag einen Fehler zurück |
| `res:write_json(data)` | JSON-Response schreiben; gibt bei einem Fehlschlag einen Fehler zurück |
| `res:write_event(data)` | SSE-Ereignis senden und flushen; gibt bei einem Fehlschlag einen Fehler zurück |
| `res:set_transfer(encoding)` | Transfermodus `chunked` oder `sse` setzen; gibt einen Fehler zurück, wenn die Header bereits gesendet wurden |
| `res:flush()` | Response flushen; gibt einen Fehlerwert zurück |

## JSON-API-Muster

Ein JSON-API-Handler kann den Request-Body parsen, ungültige Eingaben zurückweisen und ein JSON-Ergebnis schreiben:

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

## Fehler-Responses

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

## Beispiele

### CRUD-Endpunkte

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

### Geschützter Endpunkt

Autorisierungs-Middleware wird auf dem übergeordneten Router konfiguriert, nicht auf dem Endpunkt. Post-Match-Middleware (wie `endpoint_firewall`) läuft nach dem Routen-Matching und gilt für jeden Endpunkt unter dem Router:

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

## Siehe auch

- [Router](http/router.md) – Routengruppierung
- [HTTP-Modul](lua/http/http.md) – Request-/Response-API
- [Middleware](http/middleware.md) – Request-Verarbeitung
