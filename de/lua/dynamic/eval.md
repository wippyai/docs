# Dynamische Auswertung

Fuhren Sie Code dynamisch zur Laufzeit mit Sandbox-Umgebungen und kontrolliertem Modulzugriff aus.

## Zwei Systeme

Wippy bietet zwei Auswertungssysteme:

| System | Zweck | Anwendungsfall |
|--------|---------|----------|
| `expr` | Ausdrucksauswertung | Konfiguration, Templates, einfache Berechnungen |
| `eval_runner` | Vollstandige Lua-Ausfuhrung | Plugins, Benutzerskripte, dynamischer Code |

## expr-Modul

Leichtgewichtige Ausdrucksauswertung mit expr-lang-Syntax.

```lua
local expr = require("expr")

local result, err = expr.eval("x + y * 2", {x = 10, y = 5})
-- result = 20
```

### Ausdrucke kompilieren

Einmal kompilieren, mehrfach ausfuhren:

```lua
local program, err = expr.compile("price * quantity")

local total1 = program:run({price = 10, quantity = 5})
local total2 = program:run({price = 20, quantity = 3})
```

### Unterstutzte Syntax

```lua
-- Arithmetik
expr.eval("1 + 2 * 3")           -- 7
expr.eval("10 / 2 - 1")          -- 4
expr.eval("10 % 3")              -- 1

-- Vergleich
expr.eval("x > 5", {x = 10})     -- true
expr.eval("x == y", {x = 1, y = 1}) -- true

-- Boolean
expr.eval("a && b", {a = true, b = false})  -- false
expr.eval("a || b", {a = true, b = false})  -- true
expr.eval("!a", {a = false})     -- true

-- Ternar
expr.eval("x > 0 ? 'positive' : 'negative'", {x = 5})

-- Funktionen
expr.eval("max(1, 5, 3)")        -- 5
expr.eval("min(1, 5, 3)")        -- 1
expr.eval("len([1, 2, 3])")      -- 3

-- Arrays
expr.eval("[1, 2, 3][0]")        -- 1

-- String-Verkettung
expr.eval("'hello' + ' ' + 'world'")
```

## eval_runner-Modul

Vollstandige Lua-Ausfuhrung mit Sicherheitskontrollen.

```lua
local runner = require("eval_runner")

local result, err = runner.run({
    source = [[
        local function double(x)
            return x * 2
        end
        return double(input)
    ]],
    args = {21}
})
-- result = 42
```

### Konfiguration

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `source` | string | Lua-Quellcode (erforderlich) |
| `method` | string | Aufzurufende Funktion in zuruckgegebener Tabelle |
| `args` | any[] | An Funktion ubergebene Argumente |
| `modules` | string[] | Erlaubte eingebaute Module |
| `imports` | table | Registry-Eintrage zum Importieren |
| `context` | table | Als `ctx` verfugbare Werte |
| `allow_classes` | string[] | Zusatzliche Modulklassen |
| `custom_modules` | table | Benutzerdefinierte Tabellen als Module |

### Modulzugriff

Erlaubte Module auf Whitelist setzen:

```lua
runner.run({
    source = [[
        local json = require("json")
        return json.encode({hello = "world"})
    ]],
    modules = {"json"}
})
```

Module, die nicht in der Liste sind, konnen nicht mit require geladen werden.

### Registry-Imports

Eintrage aus der Registry importieren:

```lua
runner.run({
    source = [[
        local utils = require("utils")
        return utils.format(data)
    ]],
    imports = {
        utils = "app.lib:utilities"
    },
    args = {{key = "value"}}
})
```

### Benutzerdefinierte Module

Benutzerdefinierte Tabellen injizieren:

```lua
runner.run({
    source = [[
        return sdk.version
    ]],
    custom_modules = {
        sdk = {version = "1.0.0", api_key = "xxx"}
    }
})
```

### Kontextwerte

Daten ubergeben, die als `ctx` zuganglich sind:

```lua
runner.run({
    source = [[
        return "Hello, " .. ctx.user
    ]],
    context = {user = "Alice"}
})
```

### Programme kompilieren

Einmal kompilieren fur wiederholte Ausfuhrung:

```lua
local program, err = runner.compile([[
    local function process(x)
        return x * 2
    end
    return { process = process }
]], "process", {modules = {"json"}})

local result = program:run({10})  -- 20
```

## Sicherheitsmodell

### Modulklassen

Module werden nach Fahigkeiten kategorisiert:

| Klasse | Beschreibung | Standard |
|-------|-------------|---------|
| `deterministic` | Reine Funktionen | Erlaubt |
| `encoding` | Datenkodierung | Erlaubt |
| `time` | Zeitoperationen | Erlaubt |
| `nondeterministic` | Zufall, etc. | Erlaubt |
| `process` | Spawn, Registry | Blockiert |
| `storage` | Datei, Datenbank | Blockiert |
| `network` | HTTP, Sockets | Blockiert |

### Blockierte Klassen aktivieren

```lua
runner.run({
    source = [[
        local http = require("http_client")
        return http.get("https://api.example.com")
    ]],
    modules = {"http_client"},
    allow_classes = {"network"}
})
```

### Berechtigungsprufungen

Das System pruft Berechtigungen fur:

- `eval.compile` - Vor Kompilierung
- `eval.run` - Vor Ausfuhrung
- `eval.module` - Fur jedes Modul in Whitelist
- `eval.import` - Fur jeden Registry-Import
- `eval.class` - Fur jede erlaubte Klasse

In Sicherheitsrichtlinien konfigurieren.

## Fehlerbehandlung

```lua
local result, err = runner.run({...})
if err then
    if err:kind() == errors.PERMISSION_DENIED then
        -- Zugriff durch Sicherheitsrichtlinie verweigert
    elseif err:kind() == errors.INVALID then
        -- Ungultige Quelle oder Konfiguration
    elseif err:kind() == errors.INTERNAL then
        -- Ausfuhrungs- oder Kompilierungsfehler
    end
end
```

## Anwendungsfalle

### Plugin-System

```lua
local plugins = registry.find({meta = {type = "plugin"}})

for _, plugin in ipairs(plugins) do
    local source = plugin:data().source
    runner.run({
        source = source,
        method = "init",
        modules = {"json", "time"},
        context = {config = app_config}
    })
end
```

### Template-Auswertung

```lua
local template = "Hello, {{name}}! You have {{count}} messages."
local compiled = expr.compile("name")

-- Schnelle wiederholte Auswertung
for _, user in ipairs(users) do
    local greeting = compiled:run({name = user.name})
end
```

### Benutzerskripte

```lua
local user_code = request:body()

local result, err = runner.run({
    source = user_code,
    modules = {"json", "text"},  -- Nur sichere Module
    context = {data = input_data}
})
```

## Siehe auch

- [Expression](lua/dynamic/expression.md) - Ausdruckssprachen-Referenz
- [Exec](lua/dynamic/exec.md) - Systembefehlsausfuhrung
- [Security](lua/security/security.md) - Sicherheitsrichtlinien
