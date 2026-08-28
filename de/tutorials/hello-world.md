---
title: "Hello World"
description: "Eine minimale Wippy-HTTP-API bauen und ausführen, die JSON zurückgibt."
---

# Hello World

Bauen Sie eine minimale Wippy-Anwendung mit einem HTTP-Endpunkt, der JSON zurückgibt.

**Klassifizierung:** Ausführbares Tutorial. Es enthält die vollständige Registry und
den vollständigen Lua-Quellcode für eine lokale HTTP-Anwendung sowie Befehle zum
Starten und Überprüfen.

## Was wir bauen

Eine minimale Web-API mit einem Endpunkt:

```
GET /hello → {"message": "hello world"}
```

## Voraussetzungen

- Die Wippy-Runtime `v0.3.32a` ist als `wippy` verfügbar. Prüfen Sie dies mit
  `wippy version --short`.
- `curl` oder ein anderer HTTP-Client.
- Port 8080 ist auf dem lokalen Rechner verfügbar.

## Projektstruktur

```
hello-world/
├── wippy.lock           # Generated lock file
└── src/
    ├── _index.yaml      # Entry definitions
    └── hello.lua        # Handler code
```

## Schritt 1: Projektverzeichnis erstellen

```bash
mkdir hello-world && cd hello-world
mkdir src
```

## Schritt 2: Eintragsdefinitionen

Erstellen Sie `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  # HTTP server
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

  # Handler function
  - name: hello
    kind: function.lua
    source: file://hello.lua
    method: handler
    modules:
      - http

  # Endpoint
  - name: hello.endpoint
    kind: http.endpoint
    meta:
      router: app:api
    method: GET
    func: app:hello
    path: /hello
```

Die Anwendung verwendet vier Einträge:

1. `gateway` — HTTP-Server, der an Port 8080 lauscht
2. `api` — Router, der über `meta.server` mit dem Gateway verbunden ist
3. `hello` — Lua-Funktion, die Anfragen verarbeitet
4. `hello.endpoint` — Route von `GET /hello` zur Funktion

## Schritt 3: Handler-Code

Erstellen Sie `src/hello.lua`:

```lua
local http = require("http")

local function handler()
    local res, response_err = http.response()
    if response_err then
        error("cannot create response: " .. tostring(response_err))
    end

    local content_type_err = res:set_content_type(http.CONTENT.JSON)
    if content_type_err then
        error("cannot set content type: " .. tostring(content_type_err))
    end

    local status_err = res:set_status(http.STATUS.OK)
    if status_err then
        error("cannot set status: " .. tostring(status_err))
    end

    local write_err = res:write_json({message = "hello world"})
    if write_err then
        error("cannot write response: " .. tostring(write_err))
    end
end

return {
    handler = handler
}
```

Das Modul `http` stellt Request- und Response-Objekte bereit. Die Funktion gibt eine Tabelle mit der exportierten Methode `handler` zurück.

## Schritt 4: Initialisieren und ausführen

```bash
# Generate lock file from source
wippy init

# Start the runtime (-c for colorful console output)
wippy run -c
```

`wippy init` schreibt `wippy.lock`. Lassen Sie `wippy run -c` laufen, während Sie
den Endpunkt testen. Die Formatierung der Logs unterscheidet sich je nach Build;
verwenden Sie deshalb die folgende HTTP-Antwort als Bereitschaftsprüfung.

## Schritt 5: Testen

```bash
curl http://localhost:8080/hello
```

Erwartete Antwort:

```json
{"message":"hello world"}
```

Die Anfrage sollte den HTTP-Status 200 mit `Content-Type: application/json` zurückgeben.

## Funktionsweise

1. `gateway` akzeptiert die TCP-Verbindung an Port 8080.
2. Der Router `api` gleicht das Pfadpräfix `/` ab.
3. `hello.endpoint` gleicht `GET /hello` ab.
4. Die Funktion `hello` schreibt die JSON-Antwort.

## CLI-Referenz

| Befehl | Beschreibung |
|--------|--------------|
| `wippy init` | `wippy.lock` mit `./src` als Quellverzeichnis erstellen |
| `wippy run` | Die Runtime aus der Lock-Datei starten |
| `wippy run -c` | Mit farbiger Konsolenausgabe starten |
| `wippy run -v` | Mit ausführlichem Debug-Logging starten |
| `wippy run -s` | Im stillen Modus starten (keine Konsolen-Logs) |

## Fehlerbehebung und Bereinigung

- Wenn `wippy init` die Einträge nicht findet, führen Sie den Befehl aus
  `hello-world/` aus und prüfen Sie, ob `src/_index.yaml` vorhanden ist.
- Wenn beim Start gemeldet wird, dass die Adresse bereits verwendet wird, beenden
  Sie den Prozess an Port 8080 oder ändern Sie `addr` und die Test-URL auf denselben freien Port.
- Eine 404-Antwort bedeutet meist, dass der Router- oder Endpunkteintrag von den
  Definitionen oben abweicht. Prüfen Sie `meta.server`, `meta.router` und `/hello` exakt.
- Drücken Sie Strg+C im Runtime-Terminal, um die Anwendung zu beenden. Wenn das
  Verzeichnis nur für diese Übung angelegt wurde, können Sie `hello-world/` anschließend löschen.

## Nächste Schritte

- [Echo-Service](tutorials/echo-service.md) — Einen CLI-Dienst mit mehreren Prozessen bauen
- [Task-Queue](tutorials/task-queue.md) — Eine REST-API mit Hintergrundverarbeitung kombinieren
- [HTTP-Router](http/router.md) — Routing-Muster nachschlagen
