---
title: "Contracts"
description: "Typisierte Service-Bindings öffnen, Contracts prüfen, Implementierungen aufrufen und Aufruf- oder Sicherheitskontext weitergeben."
---

# Contracts
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

Das Modul `contract` öffnet typisierte Service-Bindings für Remote-APIs, Workflows und Funktionen. Contracts unterstützen Schemavalidierung, asynchrone Aufrufe und die Weitergabe von Aufrufkontext. Diese Seite ist eine API-Referenz; IDs und Werte wie `current_user` stehen für anwendungseigene Entrys und den umgebenden Handler-Zustand.

## Laden

```lua
local contract = require("contract")
```

## Ein Binding öffnen

Öffnen Sie ein Binding direkt per ID:

```lua
local greeter, err = contract.open("app.services:greeter")
if err then
    return nil, err
end

local result, err = greeter:say_hello("Alice")
if err then
    return nil, err
end
```

Mit Scope-Kontext oder Query-Parametern:

```lua
-- With scope table
local svc, err = contract.open("app.services:user", {
    tenant_id = "acme",
    region = "us-east"
})

-- With query parameters (auto-converted: "true"→bool, numbers→int/float)
local api, err = contract.open("app.services:api?debug=true&timeout=5000")

-- With call options (third argument)
local inst, err = contract.open("app.services:flaky", nil, {
    retry = { max_attempts = 5, initial_delay = 100 }
})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `binding_id` | string | Binding-ID, unterstützt Query-Parameter |
| `scope` | table | Kontextwerte (optional, überschreibt Query-Parameter) |
| `options` | table | Aufrufoptionen (optional) — z.B. `retry.max_attempts`, `retry.initial_delay` |

**Gibt zurück:** `Instance, error`

## Einen Contract abrufen

Rufen Sie die Contract-Definition zur Introspektion ab:

```lua
local c, err = contract.get("app.services:greeter")
if err then
    return nil, err
end

print(c:id())  -- "app.services:greeter"

local methods = c:methods()
for _, m in ipairs(methods) do
    print(m.name, m.description)
end

local method, err = c:method("say_hello")
if err then
    return nil, err
end
```

### Methodendefinition

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `name` | string | Methodenname |
| `description` | string | Methodenbeschreibung |
| `input_schemas` | table[] oder nil | Eingabe-Schemadefinitionen; bei leerer Liste nicht vorhanden |
| `output_schemas` | table[] oder nil | Ausgabe-Schemadefinitionen; bei leerer Liste nicht vorhanden |

Jedes Schemaelement enthält einen String `format` und kann einen Wert `definition` enthalten.

## Implementierungen finden

Listen Sie alle Bindings auf, die einen Contract implementieren:

```lua
local bindings, err = contract.find_implementations("app.services:greeter")
if err then
    return nil, err
end

for _, binding_id in ipairs(bindings) do
    print(binding_id)
end
```

Oder über das Contract-Objekt:

```lua
local c, err = contract.get("app.services:greeter")
if err then
    return nil, err
end
local bindings, err = c:implementations()
if err then
    return nil, err
end
```

## Implementierung prüfen

Prüfen Sie, ob eine Instanz einen Contract implementiert:

```lua
if contract.is(instance, "app.services:greeter") then
    instance:say_hello("World")
end
```

## Methoden aufrufen

Synchroner Aufruf - blockiert bis zum Abschluss:

```lua
local calc, err = contract.open("app.services:calculator")
if err then
    return nil, err
end

local sum, err = calc:add(10, 20)
if err then
    return nil, err
end
local product, err = calc:multiply(5, 6)
if err then
    return nil, err
end
```

## Asynchrone Aufrufe

Fügen Sie das Suffix `_async` für asynchrone Ausführung hinzu:

```lua
local processor, err = contract.open("app.services:processor")
if err then
    return nil, err
end

local future, err = processor:process_async(large_dataset)
if err then
    return nil, err
end

-- Do other work...

-- Wait for result
local ch = future:response()
local _, open = ch:receive()
if not open then
    return nil, errors.new("future response channel closed")
end

local payload, result_err = future:result()
if result_err then return nil, result_err end
local result, data_err = payload:data()
if data_err then return nil, data_err end
```

Siehe [Futures](lua/core/future.md) für Future-Methoden.

## Via Contract öffnen

Öffnen Sie ein Binding über ein Contract-Objekt. Die folgenden Aufrufe sind Alternativen; prüfen Sie den Fehler von `contract.get()` und vom gewählten `open()`-Aufruf, bevor Sie die Instanz verwenden.

```lua
local c, err = contract.get("app.services:user")
if err then
    return nil, err
end

-- Default binding
local instance, err = c:open()

-- Specific binding
local instance, err = c:open("app.services:user_impl")

-- With scope
local instance, err = c:open(nil, {user_id = 123})
local instance, err = c:open("app.services:user_impl", {user_id = 123})
```

## Kontext hinzufügen

Erstellen Sie einen Wrapper mit vorkonfiguriertem Kontext:

```lua
local ctx = require("ctx")
local c, err = contract.get("app.services:user")
if err then return nil, err end

local request_id, ctx_err = ctx.get("request_id")
if ctx_err then return nil, ctx_err end

local wrapped, err = c:with_context({
    request_id = request_id,
    user_id = current_user.id
})
if err then return nil, err end

local instance, err = wrapped:open()
```

## Aufrufoptionen

Konfigurieren Sie Wiederholungen und anderes Aufrufverhalten mit `with_options`:

```lua
local c, err = contract.get("app.services:flaky")
if err then return nil, err end

local configured = c:with_options({
    retry = { max_attempts = 5, initial_delay = 100 }
})
local inst, err = configured:open("app.services:flaky_impl")
if err then return nil, err end

local result, err = inst:call()
```

Optionen gelten für jeden Methodenaufruf auf der zurückgegebenen Instanz. Nur wiederholbare Fehler lösen Wiederholungen aus; nicht wiederholbare Fehler werden sofort zurückgegeben. `with_options` kann mit `with_context`, `with_actor` und `with_scope` verkettet werden.

| Option | Typ | Beschreibung |
|--------|------|-------------|
| `retry.max_attempts` | int | Maximale Versuche inkl. dem ersten (1 deaktiviert Retry) |
| `retry.initial_delay` | int/duration | Verzögerung vor dem ersten Wiederholungsversuch (ms oder Dauer-String) |

## Sicherheitskontext

Setzen Sie Actor und Scope für die Autorisierung:

```lua
local security = require("security")
local c, err = contract.get("app.services:admin")
if err then return nil, err end

local secured, err = c:with_actor(security.actor())
if err then return nil, err end

secured, err = secured:with_scope(security.scope())
if err then return nil, err end

local admin, err = secured:open()
if err then return nil, err end
```

Ohne explizites `with_actor`/`with_scope` erbt ein geöffneter Contract den ambienten Actor und Scope des Aufrufers. Sind sie gesetzt, propagieren sie zu den gebundenen Implementierungsfunktionen — jeder Methodenaufruf auf der Instanz läuft unter dieser Identität.

## Berechtigungen

| Berechtigung | Ressource | Funktionen |
|------------|----------|-----------|
| `contract.get` | Contract-ID | `get()` |
| `contract.open` | Binding-ID | `open()`, `Contract:open()` |
| `contract.implementations` | Contract-ID | `find_implementations()`, `Contract:implementations()` |
| `contract.call` | Methodenname | synchrone und asynchrone Methodenaufrufe |
| `contract.context` | "context" | `Contract:with_context()` |
| `contract.security` | "security" | `Contract:with_actor()`, `Contract:with_scope()` |

## Fehler

| Bedingung | Art |
|-----------|------|
| Ungültiges Binding-ID-Format | `errors.INVALID` |
| Contract nicht gefunden | `errors.NOT_FOUND` |
| Binding nicht gefunden | `errors.NOT_FOUND` |
| Methode nicht gefunden | `errors.NOT_FOUND` |
| Kein Standard-Binding | `errors.NOT_FOUND` |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` |
| Contract-Dispatcher oder Konvertierung der Antwort fehlgeschlagen | `errors.INTERNAL` |
| Implementierung gab einen Fehler zurück | Fehlerart der Implementierung bleibt erhalten |
