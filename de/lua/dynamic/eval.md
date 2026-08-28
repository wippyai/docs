---
title: "Dynamische Auswertung"
description: "Ausdrücke auswerten oder Lua-Code mit eingeschränkten Fähigkeiten und konfiguriertem Modul- und Registry-Zugriff ausführen."
---

# Dynamische Auswertung

Wippy wertet Ausdrücke aus und führt zur Laufzeit bereitgestellten Lua-Code mit eingeschränkten Fähigkeiten aus. Diese Seite ist ein API-Leitfaden. Die Beispiele laufen in einem vorhandenen Wippy-Lua-Prozess und setzen voraus, dass dessen Eintrag die vom Aufrufer verwendeten Module deklariert. Registry-IDs, Richtlinien und Anwendungsdaten sind Platzhalter, die die umgebende Anwendung bereitstellt.

`eval_runner` begrenzt, welche Wippy-Module der ausgewertete Code erreichen kann, ist aber keine vollständige Eindämmung feindlichen Codes. Insbesondere zählt `limits.max_steps` Scheduler-Fortsetzungen statt Lua-Anweisungen. Eine Endlosschleife ohne Yield wird durch dieses Limit nicht unterbrochen.

## Auswertungssystem auswählen

Wippy bietet zwei Auswertungssysteme:

| System | Zweck | Anwendungsfall |
|--------|---------|----------|
| `expr` | Ausdrucksauswertung | Konfiguration, Templates, einfache Berechnungen |
| `eval_runner` | Lua-Ausführung mit eingeschränkten Fähigkeiten | Vertrauenswürdige Plugins und kontrollierter dynamischer Code |

## Ausdrucksauswertung mit `expr`

Das Modul `expr` wertet Ausdrücke in der Syntax von expr-lang aus. Verwenden Sie es für Ausdrücke, nicht für vollständige Lua-Programme. [Ausdruckssprache](lua/dynamic/expression.md) ist die vollständige Referenz für Lua-API und Syntax.

```lua
local expr = require("expr")

local result, err = expr.eval("x + y * 2", {x = 10, y = 5})
if err then
    return nil, err
end
-- result = 20
```

### Kompilierte Ausdrücke wiederverwenden

Einmal kompilieren, mehrfach ausführen:

```lua
local program, err = expr.compile("price * quantity")
if err then
    return nil, err
end

local total1, first_err = program:run({price = 10, quantity = 5})
if first_err then
    return nil, first_err
end

local total2, second_err = program:run({price = 20, quantity = 3})
if second_err then
    return nil, second_err
end
```

### Syntax im Überblick

| Merkmal | Ausdruck | Ergebnis |
|---------|----------|----------|
| Arithmetik | `1 + 2 * 3` | `7` |
| Rest | `10 % 3` | `1` |
| Vergleich | `x > 5` mit `{x = 10}` | `true` |
| Boolesch | `a && b` mit `{a = true, b = false}` | `false` |
| Ternär | `x > 0 ? 'positive' : 'negative'` mit `{x = 5}` | `"positive"` |
| Funktion | `max(1, 5, 3)` | `5` |
| Array-Index | `[1, 2, 3][0]` | `1` |
| Verkettung | `'hello' + ' ' + 'world'` | `"hello world"` |

## Lua mit eingeschränkten Fähigkeiten über `eval_runner`

Das Modul `eval_runner` führt Lua mit konfiguriertem Modul- und Registry-Zugriff aus.

```lua
local runner = require("eval_runner")

local result, err = runner.run({
    source = [[
        local function double(x)
            return x * 2
        end
        return { double = double }
    ]],
    method = "double",
    args = {21}
})
if err then
    return nil, err
end
-- result = 42
```

### Konfiguration

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `source` | string | Lua-Quellcode (erforderlich) |
| `method` | string | Aufzurufende Funktion in zurückgegebener Tabelle |
| `args` | any[] | An Funktion übergebene Argumente |
| `modules` | string[] | Erlaubte eingebaute Module |
| `imports` | table | Registry-Einträge zum Importieren |
| `context` | table | Als `ctx` verfügbare Werte |
| `allow_classes` | string[] | Zusätzliche Modulklassen |
| `custom_modules` | table | Benutzerdefinierte Tabellen als Module |
| `limits` | table | Ausführungslimits für die Auswertung |

Wird `modules` ausgelassen oder ist die Liste leer, stellt der Host alle verfügbaren Module bereit, deren Klassen den Standardfilter passieren. In diesem impliziten Modus erweitert `allow_classes` den Filter und kann Module der genannten Klassen hinzufügen. Bei einer expliziten `modules`-Liste erlaubt es nur aufgeführte Module, deren Klassen andernfalls ausgeschlossen wären. Verwenden Sie vorzugsweise eine explizite, minimale Liste, damit die Fähigkeiten des Programms im Aufruf sichtbar sind.

In Runtime v0.3.32a prüfen `eval.module`-Richtlinien nur ausdrücklich in `modules` genannte Namen, nicht implizit über den Standardfilter ausgewählte Module. Verlassen Sie sich daher nicht auf `eval.module`, um ein solches Standardmodul zu entfernen; übergeben Sie stattdessen eine explizite Liste.

### Schrittlimit

Mit `limits.max_steps` begrenzen Sie die Anzahl der Scheduler-Fortsetzungen während einer Auswertung:

```lua
local result, err = runner.run({
    source = user_code,
    modules = {"json"},
    limits = {max_steps = 1000}
})
if err then
    return nil, err
end
```

`max_steps` muss eine nicht negative Ganzzahl sein. Fehlt der Wert, wird `lua.eval.max_steps` übernommen, standardmäßig `10000`; ein ausdrücklicher Wert `0` entfernt das Limit. Jede Scheduler-Fortsetzung verbraucht einen Schritt, somit auch Yields aus Modulaufrufen. Gewöhnliche Lua-Schleifeniterationen zählen nicht, daher ist dies kein CPU- oder Anweisungsbudget für Code ohne Yield.

Unbekannte Felder in `limits`, ein nicht tabellarischer `limits`-Wert und ungültige `max_steps`-Werte liefern einen nicht wiederholbaren Fehler `errors.INVALID`.

### Modulzugriff

Erlaubte Module auf Whitelist setzen:

```lua
local encoded, err = runner.run({
    source = [[
        local json = require("json")
        return json.encode({hello = "world"})
    ]],
    modules = {"json"}
})
if err then
    return nil, err
end
```

Bei einer expliziten Liste können Module außerhalb dieser Liste nicht per `require()` geladen werden. Jedes aufgeführte Modul erfordert außerdem die Berechtigung `eval.module`.

### Registry-Imports

Einträge aus der Registry importieren:

```lua
local result, err = runner.run({
    source = [[
        local data = ...
        return utils.format(data)
    ]],
    imports = {
        utils = "app.lib:utilities"
    },
    args = {{key = "value"}}
})
if err then
    return nil, err
end
```

### Privilegierte Imports

Einem Import können Module gewährt werden, die der evaluierte Code selbst nicht sehen kann. Verwenden Sie die Tabellenform mit `id` und `modules`:

```lua
local quote, err = runner.run({
    source = [[
        return pricing.quote(...)
    ]],
    modules = {"json"},
    imports = {
        pricing = { id = "app.lib:pricing", modules = {"funcs"} }
    },
})
if err then
    return nil, err
end
```

Die Bibliothek `pricing` läuft in einer abgegrenzten Umgebung, in der `funcs` verfügbar ist. Der ausgewertete Quellcode kann `funcs` weder per `require()` laden noch direkt erreichen. Das Gewähren eines Moduls an einen Import erfordert die Berechtigung `eval.module` für dieses Modul; der Import kann daher kein Modul erhalten, das dem Aufrufer nicht zur Verfügung steht.

### Benutzerdefinierte Module

Stellen Sie benutzerdefinierte Tabellen als Module bereit:

```lua
local version, err = runner.run({
    source = [[
        return sdk.version
    ]],
    custom_modules = {
        sdk = {version = "1.0.0"}
    }
})
if err then
    return nil, err
end
```

Werte benutzerdefinierter Module sind für den ausgewerteten Code direkt erreichbar. Legen Sie dort keine Secrets oder privilegierten Handles ab, sofern deren Offenlegung nicht beabsichtigt ist.

### Kontextwerte

Daten übergeben, die als `ctx` zugänglich sind:

```lua
local greeting, err = runner.run({
    source = [[
        local user, ctx_err = ctx.get("user")
        if ctx_err then error(ctx_err) end
        return "Hello, " .. user
    ]],
    modules = {"ctx"},
    context = {user = "Alice"}
})
if err then
    return nil, err
end
```

### Programme kompilieren

`runner.compile` validiert den Quellcode und meldet seinen Entrypoint und seine Module, ohne ihn auszuführen:

```lua
local program, err = runner.compile([[
    local function process(x)
        return x * 2
    end
    return { process = process }
]], "process", {modules = {"json"}})
if err then
    return nil, err
end

program:method()   -- "process"  (string)
program:modules()  -- {"json"}    (string[])
```

Das kompilierte Programm ist informativ; ausgeführt wird durch Aufruf von `runner.run` mit Quellcode und Methode.

## Steuerung der Fähigkeiten

### Modulklassen

Module werden nach Fähigkeiten kategorisiert:

| Klasse | Beschreibung | Standard |
|-------|-------------|---------|
| `deterministic` | Reine Funktionen | Erlaubt |
| `encoding` | Datenkodierung | Erlaubt |
| `time` | Zeitoperationen | Erlaubt |
| `nondeterministic` | Zufall, etc. | Erlaubt |
| `io` | Ein-/Ausgabe ohne eigene blockierte Klasse | Erlaubt |
| `security` | Sicherheits-Hilfsfunktionen | Erlaubt |
| `workflow` | Workflow-sichere Operationen | Erlaubt |
| `process` | Spawn, Registry | Blockiert |
| `storage` | Datei, Datenbank | Blockiert |
| `network` | HTTP, Sockets | Blockiert |

„Blockiert“ bedeutet: blockiert, sofern der Aufrufer die Klasse nicht in `allow_classes` nennt und für die Ressource `eval.class` autorisiert ist. Ein Modul kann mehreren Klassen angehören; führen Sie jede blockierte Klasse des Moduls auf.

### Zusätzliche Klassen erlauben

```lua
local status, err = runner.run({
    source = [[
        local http = require("http_client")
        local response, err = http.get("https://api.example.com")
        if err then error(err) end
        return response.status_code
    ]],
    modules = {"http_client"},
    allow_classes = {"network"}
})
if err then
    return nil, err
end
```

Die Klassenautorisierung nimmt das Modul nur in die Eval-Umgebung auf. Die eigenen Sicherheitsprüfungen des Moduls und externe Zugriffskontrollen gelten weiterhin.

### Berechtigungsprüfungen

Das System prüft Berechtigungen für:

- `eval.compile` - Vor Kompilierung
- `eval.run` - Vor Ausführung
- `eval.module` - Für jedes Modul in Whitelist und für jedes einem privilegierten Import gewährte Modul
- `eval.import` - Für jeden Registry-Import
- `eval.class` - Für jede erlaubte Klasse

In Sicherheitsrichtlinien konfigurieren.

## Cache kompilierter Programme

Kompilierte Programme werden in einem LRU-Cache nach Quelle, Methode, Modulen und erlaubten Klassen gespeichert. Wiederholte Ausführungen identischen Codes überspringen die Kompilierung. Imports, benutzerdefinierte Module, Argumente und Kontext werden zur Laufzeit gebunden und beeinflussen den Cache-Schlüssel nicht.

```yaml
# .wippy.yaml
lua:
  eval:
    cache_size: 256   # entries; 0 or less disables caching (default: 256)
    cache_ttl: 0      # expiry; 0 = no expiry (default: 0)
    max_steps: 10000  # inherited run limit; 0 = unlimited (default: 10000)
```

## Auswertungsfehler behandeln

```lua
local result, err = runner.run(run_config)
if err then
    if err:kind() == errors.PERMISSION_DENIED then
        -- Access denied by security policy
    elseif err:kind() == errors.INVALID then
        -- Missing source or invalid limits configuration
    elseif err:kind() == errors.INTERNAL then
        -- Syntax, compilation, import, or execution failure
    end
end
```

`run_config` ist hier die von der umgebenden Anwendung zusammengestellte Konfigurationstabelle.

## Auswahl nach Anwendungsfall

### Plugins

```lua
local plugins, find_err = registry.find({["meta.type"] = "plugin"})
if find_err then
    return nil, find_err
end

for _, plugin in ipairs(plugins) do
    local _, run_err = runner.run({
        source = plugin.data.source,
        method = "init",
        modules = {"json", "time"},
        context = {config = app_config}
    })
    if run_err then
        return nil, run_err
    end
end
```

Dieses Teilmuster setzt voraus, dass der Aufrufer `registry` und `eval_runner` geladen hat, `app_config` definiert ist und passende Registry-Einträge Lua-Quellcode unter `data.source` speichern. `registry.find` liefert Entry-Tabellen; Felder werden daher als `plugin.data` gelesen, nicht über eine Entry-Methode.

### Wiederholte Regeln

```lua
local compiled, compile_err = expr.compile("score >= minimum")
if compile_err then
    return nil, compile_err
end

for _, candidate in ipairs(candidates) do
    local accepted, run_err = compiled:run({
        score = candidate.score,
        minimum = 80
    })
    if run_err then
        return nil, run_err
    end
    candidate.accepted = accepted
end
```

Dieses Teilmuster setzt voraus, dass `candidates` von der Anwendung bereitgestellt wird. Für gerenderten Text verwenden Sie das Template-Modul statt `expr`.

### Benutzerskripte

```lua
local result, err = runner.run({
    source = user_code, -- Supplied by the surrounding application
    modules = {"json", "text"},
    context = {data = input_data}
})
if err then
    return nil, err
end
```

Dies ist ein Teilmuster für eine Integration, keine Sandbox für feindlichen Code. Prüfen Sie, wer `user_code` liefern darf, gewähren Sie nur benötigte Module und Richtlinien und erzwingen Sie einen externen Timeout oder eine Isolationsgrenze, wenn nicht vertrauenswürdiger Code möglicherweise keinen Yield ausführt.

## Siehe auch

- [Expression](./expression.md) – Referenz der Ausdruckssprache
- [Exec](lua/dynamic/exec.md) – Ausführung von Systembefehlen
- [Security](lua/security/security.md) – Sicherheitsrichtlinien
