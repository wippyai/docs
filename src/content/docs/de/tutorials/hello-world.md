---
title: "Hello World"
---

# Hello World

Ihre erste Wippy-Anwendung - eine einfache HTTP-API, die JSON zurückgibt.

## Was wir bauen

Eine minimale Web-API mit einem Endpunkt:

```
GET /hello → {"message": "hello world"}
```

## Projektstruktur

```
hello-world/
├── wippy.lock           # Generierte Lock-Datei
└── src/
    ├── _index.yaml      # Entry-Definitionen
    └── hello.lua        # Handler-Code
```

## Schritt 1: Projektverzeichnis erstellen

```bash
mkdir hello-world && cd hello-world
mkdir src
```

## Schritt 2: Entry-Definitionen

Erstellen Sie `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  # HTTP-Server
  - name: gateway
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # Router
  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /

  # Handler-Funktion
  - name: hello
    kind: function.lua
    source: file://hello.lua
    method: handler
    modules:
      - http

  # Endpunkt
  - name: hello.endpoint
    kind: http.endpoint
    meta:
      router: app:api
    method: GET
    func: app:hello
    path: /hello
```

**Vier Einträge arbeiten zusammen:**

1. `gateway` - HTTP-Server lauscht auf Port 8080
2. `api` - Router an Gateway via `meta.server` angebunden
3. `hello` - Lua-Funktion die Anfragen behandelt
4. `hello.endpoint` - Routet `GET /hello` zur Funktion

## Schritt 3: Handler-Code

Erstellen Sie `src/hello.lua`:

```lua
local http = require("http")

local function handler()
    local res = http.response()

    res:set_content_type(http.CONTENT.JSON)
    res:set_status(http.STATUS.OK)
    res:write_json({message = "hello world"})
end

return {
    handler = handler
}
```

Das `http`-Modul bietet Zugang zu Request/Response-Objekten. Die Funktion gibt eine Tabelle mit der exportierten `handler`-Methode zurück.

## Schritt 4: Initialisieren und Ausführen

```bash
# Lock-Datei aus Quellen generieren
wippy init

# Runtime starten (-c für farbige Konsolenausgabe)
wippy run -c
```

Sie sehen Ausgabe wie:

```
╦ ╦╦╔═╗╔═╗╦ ╦  Adaptive Application Runtime
║║║║╠═╝╠═╝╚╦╝  v0.1.20
╚╩╝╩╩  ╩   ╩   by Spiral Scout

0.00s  INFO  run          runtime ready
0.11s  INFO  core         service app:gateway is running  {"details": "service listening on :8080"}
```

## Schritt 5: Testen

```bash
curl http://localhost:8080/hello
```

Antwort:

```json
{"message":"hello world"}
```

## Wie es funktioniert

1. `gateway` akzeptiert die TCP-Verbindung auf Port 8080
2. `api` Router matched den Pfad-Präfix `/`
3. `hello.endpoint` matched `GET /hello`
4. `hello` Funktion wird ausgeführt und schreibt JSON-Antwort

## CLI-Referenz

| Befehl | Beschreibung |
|--------|--------------|
| `wippy init` | Lock-Datei aus `src/` generieren |
| `wippy run` | Runtime aus Lock-Datei starten |
| `wippy run -c` | Mit farbiger Konsolenausgabe starten |
| `wippy run -v` | Mit ausführlichem Debug-Logging starten |
| `wippy run -s` | Im stillen Modus starten (keine Konsolenlogs) |

## Nächste Schritte

- [Echo-Service](tutorials/echo-service.md) - Anfrageparameter behandeln
- [Task-Queue](tutorials/task-queue.md) - REST-API mit Hintergrundverarbeitung
- [HTTP-Router](http/router.md) - Routing-Muster
