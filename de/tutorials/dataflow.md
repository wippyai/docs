---
title: "Dataflow: Einen dauerhaften DAG ausführen"
description: "Einen kleinen wippy/dataflow-Workflow mit persistentem Zustand, automatischen Migrationen und zwei Funktionsknoten bauen und ausführen."
---

# Dataflow: Einen dauerhaften DAG ausführen

**Klassifizierung: ausführbares Tutorial.** Diese Seite erstellt ein vollständiges,
Provider-unabhängiges Projekt mit `wippy/dataflow`. Es verwendet weder Embeddings
noch ein LLM; für diesen Anwendungsfall siehe
[Retrieval-Augmented Generation](./rag.md).

Der Workflow leitet eine Eingabe durch zwei Funktionsknoten:

```text
{ values = { 2, 4, 6 } } -> double -> summarize -> { count = 3, total = 24 }
```

Dataflow persistiert Workflow, Knoten, Befehle, Wake-Vorgänge und Aktivierungen in SQL.
Der Befehl wartet, bis der Migrations-Bootloader diese Tabellen erstellt hat, bevor
er den Flow startet.

## Voraussetzungen

- Ein Wippy-Projekt mit dem Quellverzeichnis `./src`.
- Wippy-Runtime `v0.3.32a` oder neuer.
- Zugriff auf die Modul-Registry für die erste Installation der Abhängigkeiten.

Ein Modell-Provider oder API-Key ist nicht erforderlich.

## Projektstruktur

```text
dataflow-demo/
├── wippy.lock                 # generated
└── src/
    ├── _index.yaml
    ├── double.lua
    ├── summarize.lua
    └── run.lua
```

## Runtime konfigurieren

Erstellen Sie `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./.wippy/dataflow.db
    lifecycle:
      auto_start: true

  - name: env_storage
    kind: env.storage.file
    file_path: ./.wippy/dataflow.env
    auto_create: true

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  # Dataflow includes session views, so its standalone configuration supplies
  # the router those transitive entries target. The HTTP service need not start.
  - name: gateway
    kind: http.service
    addr: ":18080"
    lifecycle:
      auto_start: false

  - name: api.public
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api/public

  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api

  - name: dep.dataflow
    kind: ns.dependency
    component: wippy/dataflow
    version: "0.7.6"
    parameters:
      - name: userspace.dataflow:target_db
        value: app:db
      - name: userspace.dataflow:process_host
        value: app:processes
      - name: wippy.migration:app_db
        value: app:db

  - name: dep.security
    kind: ns.dependency
    component: wippy/security
    version: "*"

  - name: dep.bootloader
    kind: ns.dependency
    component: wippy/bootloader
    version: "*"
    parameters:
      - name: wippy.bootloader:application_host
        value: app:processes
      - name: wippy.bootloader:env_storage
        value: app:env_storage

  - name: dep.llm
    kind: ns.dependency
    component: wippy/llm
    version: "*"
    parameters:
      - name: wippy.llm:process_host
        value: app:processes
      - name: wippy.llm:env_storage
        value: app:env_storage

  - name: dep.session
    kind: ns.dependency
    component: wippy/session
    version: "*"
    parameters:
      - name: wippy.session:database_resource
        value: app:db
      - name: wippy.session:api_router
        value: app:api.public
      - name: wippy.session:env_storage
        value: app:env_storage
      - name: wippy.session:delegation_func_id
        value: userspace.dataflow.session:delegate

  - name: dep.views
    kind: ns.dependency
    component: wippy/views
    version: "*"
    parameters:
      - name: wippy.views:api_router
        value: app:api.public
      - name: wippy.views:env_storage
        value: app:env_storage

  - name: demo_policy
    kind: security.policy
    policy:
      actions: "*"
      resources: "*"
      effect: allow

  - name: double
    kind: function.lua
    source: file://double.lua
    method: handler

  - name: summarize
    kind: function.lua
    source: file://summarize.lua
    method: handler

  - name: run
    kind: process.lua
    meta:
      command:
        name: dataflow-demo
        short: Run the Dataflow tutorial DAG
        security:
          actor:
            id: app:dataflow-demo
          policies:
            - app:demo_policy
    source: file://run.lua
    method: main
    modules:
      - io
      - sql
      - time
    imports:
      flow: userspace.dataflow.flow:flow
```

`wippy/dataflow` besitzt die Migrationseinträge. Die Abhängigkeit `wippy/migration`
ist transitiv, während `wippy/bootloader` beim Start der Runtime den Migrations-Bootloader
ausführt. Die expliziten Parameter oben binden beide Systeme an `app:db`.

Die breite Policy hält dieses isolierte Tutorial auf das Workflow-Verhalten fokussiert.
Produktionsbefehle sollten sie durch die exakten Funktions-, Datenbank- und
Prozessaktionen ersetzen, die der Workflow benötigt.

## Knoten implementieren

Erstellen Sie `src/double.lua`:

```lua
local function handler(input)
    local result = { values = {} }
    for _, value in ipairs(input.values or {}) do
        table.insert(result.values, value * 2)
    end
    return result
end

return { handler = handler }
```

Erstellen Sie `src/summarize.lua`:

```lua
local function handler(input)
    local total = 0
    for _, value in ipairs(input.values or {}) do
        total = total + value
    end
    return { count = #(input.values or {}), total = total }
end

return { handler = handler }
```

## Flow erstellen und ausführen

Erstellen Sie `src/run.lua`:

```lua
local io = require("io")
local sql = require("sql")
local time = require("time")
local flow = require("flow")

local function wait_for_schema()
    for _ = 1, 100 do
        local db, err = sql.get("app:db")
        if not err then
            local rows, query_err = db:query(
                "SELECT name FROM sqlite_master " ..
                "WHERE type='table' AND name='dataflows'"
            )
            db:release()
            if not query_err and rows and #rows > 0 then
                return true
            end
        end
        time.sleep("100ms")
    end
    return nil, "Dataflow migrations did not finish within 10 seconds"
end

local function main()
    local ready, ready_err = wait_for_schema()
    if not ready then
        io.print("dataflow failed: " .. ready_err)
        return 1
    end

    local result, err = flow.create()
        :with_title("Double and summarize")
        :with_input({ values = { 2, 4, 6 } })
        :func("app:double")
        :as("double")
        :to("summarize", "default")
        :func("app:summarize")
        :as("summarize")
        :run()

    if err then
        io.print("dataflow failed: " .. tostring(err))
        return 1
    end

    io.print(string.format("count=%d total=%d", result.count, result.total))
    return 0
end

return { main = main }
```

Initialisieren Sie die Lock-Datei, lösen Sie den Abhängigkeitsgraphen auf, installieren
Sie ihn und führen Sie den benannten Befehl mit aktivierten Konsolen-Logs aus:

```bash
wippy init
wippy update
wippy install
wippy run -c dataflow-demo
```

Beim ersten Lauf wendet der Bootloader die Dataflow-Migrationen an. Anschließend gibt
der Befehl Folgendes aus:

```text
count=3 total=24
```

Spätere Läufe melden die Migrationen als bereits angewendet und führen einen neuen
persistierten Workflow aus.

## Persistenz prüfen

Die SQLite-Datei ist `./.wippy/dataflow.db`. Nach einem erfolgreichen Lauf enthält
sie die Dataflow-eigenen Tabellen für Workflows, Knoten, Daten, Commits, Wake-Vorgänge
und Aktivierungen. Anwendungen sollten diese über den Dataflow-Client oder Keeper
untersuchen, statt direkt in die Tabellen zu schreiben.

Verwenden Sie `:start()` statt `:run()`, wenn der Aufrufer sofort eine Workflow-ID
erhalten soll. Mit dem Dataflow-Client können Sie Status und Ausgabe lesen oder einen
asynchronen Workflow abbrechen, beenden, wiederbeleben oder signalisieren.

## Nächste Schritte

- [Dataflow-Framework](../framework/dataflow.md) — Routing, parallele Knoten,
  Zyklen, Agenten, Signale und die Client-API
- [Retrieval-Augmented Generation](./rag.md) — Abruf auf Basis von Embeddings
- [Keeper über MCP](./keeper-mcp.md) — Laufende Workflows aus einem MCP-Client untersuchen
