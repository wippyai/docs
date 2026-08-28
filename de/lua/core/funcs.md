---
title: "Funktionsaufruf"
description: "Registrierte Funktionen synchron oder asynchron aufrufen und Anfragekontext, Sicherheitsidentität sowie Aufrufoptionen weitergeben."
---

# Funktionsaufruf
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Das Modul `funcs` ruft registrierte Funktionen synchron oder asynchron auf. Ein Executor kann Anfragekontext, Sicherheitsidentität und implementierungsspezifische Aufrufoptionen weitergeben. Diese Seite ist eine API-Referenz; Ziel-IDs, Argumente und Anwendungsdaten stehen für umgebenden Code.

## Laden

```lua
local funcs = require("funcs")
```

## `call`

Ruft eine registrierte Funktion synchron auf und wartet auf ihr Ergebnis.

```lua
local result, err = funcs.call("app.api:get_user", user_id)
if err then
    return nil, err
end
print(result.name)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `target` | string | Funktions-ID im Format "namespace:name" |
| `...args` | any | Argumente, die an die Funktion übergeben werden |

**Gibt zurück:** `result, error`

Das Ziel verwendet das Format `namespace:name`.

## `async`

Startet einen Funktionsaufruf und gibt sofort ein `Future` zurück. Futures ermöglichen andere Arbeit während des Aufrufs und unterstützen mehrere gleichzeitige Aufrufe.

```lua
-- Start heavy computation without blocking
local future, err = funcs.async("app.process:analyze_data", large_dataset)
if err then
    return nil, err
end

-- Do other work while computation runs...

-- Wait for result when ready
local ch = future:response()
local _, open = ch:receive()
if not open then
    return nil, errors.new("future response channel closed")
end

local payload, result_err = future:result()
if result_err then
    return nil, result_err
end
local result, data_err = payload:data()
if data_err then return nil, data_err end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `target` | string | Funktions-ID im Format "namespace:name" |
| `...args` | any | Argumente, die an die Funktion übergeben werden |

**Gibt zurück:** `Future, error`

## `new`

Erstellt einen `Executor` für Aufrufe mit benutzerdefiniertem Kontext, Sicherheitsidentität oder Aufrufoptionen.

```lua
local exec = funcs.new()
```

**Gibt zurück:** `Executor`

## Executor

Ein Executor speichert Aufrufkontext und Optionen. Seine Konfigurationsmethoden geben neue Executor-Instanzen zurück, sodass eine Basiskonfiguration wiederverwendet werden kann.

### `with_context`

Fügt anfragebezogene Werte hinzu, die der aufgerufenen Funktion zur Verfügung stehen, etwa Trace-IDs, Sitzungsdaten oder Feature-Flags.

```lua
local ctx = require("ctx")

-- Propagate request context to downstream services
local request_id, ctx_err = ctx.get("request_id")
if ctx_err then return nil, ctx_err end

local exec, err = funcs.new():with_context({
    request_id = request_id,
    feature_flags = {dark_mode = true}
})
if err then return nil, err end

local user, err = exec:call("app.api:get_user", user_id)
if err then return nil, err end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `values` | table | Schlüssel-Wert-Paare zum Hinzufügen zum Kontext |

**Gibt zurück:** `Executor, error`

### `with_actor`

Setzt den Sicherheits-Actor für Autorisierungsprüfungen in der aufgerufenen Funktion.

```lua
local security = require("security")
local actor = security.actor()  -- Get current user's actor

-- Call admin function with user's credentials
local exec, err = funcs.new():with_actor(actor)
if err then return nil, err end
local result, err = exec:call("app.admin:delete_record", record_id)
if err and err:kind() == errors.PERMISSION_DENIED then
    return nil, errors.new({
        message = "User cannot delete records",
        kind = errors.PERMISSION_DENIED
    })
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `actor` | Actor | Sicherheits-Actor (vom Security-Modul) |

**Gibt zurück:** `Executor, error`

### `with_scope`

Setzt den Sicherheits-Scope für aufgerufene Funktionen. Scopes definieren die verfügbaren Berechtigungen für den Aufruf.

```lua
local security = require("security")
local scope = security.new_scope()

local exec, err = funcs.new():with_scope(scope)
if err then return nil, err end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `scope` | Scope | Sicherheits-Scope (vom Security-Modul) |

**Gibt zurück:** `Executor, error`

### `with_options`

Setzt Aufrufoptionen. Implementierungen können eigene Optionen definieren; die Runtime erkennt außerdem `network` zur Auswahl eines ausgehenden Netzwerks.

```lua
-- Set a 5 second timeout for external API call
local exec, err = funcs.new():with_options({timeout = 5000})
if err then return nil, err end
local result, err = exec:call("app.external:fetch_data", query)
if err then
    -- Handle timeout or other error
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `options` | table | Implementierungsspezifische Optionen |

Die von der Runtime definierte Option ist:

| Erkannte Option | Typ | Beschreibung |
|------------------|-----|--------------|
| `network` | string | Registry-ID des ausgehenden `network.*`-Entrys |

**Gibt zurück:** `Executor, error`

Die Auswahl eines Netzwerks erfordert die Berechtigung `network.select` für diese Netzwerk-ID.

### `call` und `async`

Executor-Versionen von call und async, die den konfigurierten Kontext verwenden.

```lua
-- Build reusable executor with context
local exec, err = funcs.new():with_context({trace_id = "abc-123"})
if err then return nil, err end
exec, err = exec:with_options({timeout = 10000})
if err then return nil, err end

-- Make multiple calls with same context
local users, users_err = exec:call("app.api:list_users")
if users_err then return nil, users_err end
local posts, posts_err = exec:call("app.api:list_posts")
if posts_err then return nil, posts_err end
```

## Zusammenfassung von Future-Aufrufen

`async()` gibt ein Future zurück, das einen laufenden Aufruf darstellt. Die folgenden Methoden decken die Schritte zum Empfangen, Prüfen oder Abbrechen dieses Aufrufs ab. Siehe [Future](./future.md) für die Referenz des Future-Objekts.

### `response` und `channel`

Gibt den zugrunde liegenden Channel zum Empfangen des Ergebnisses zurück.

```lua
local time = require("time")

local future, err = funcs.async("app.api:slow_operation", data)
if err then
    return nil, err
end
local ch = future:response()  -- or future:channel()

local timeout, err = time.after("5s")
if err then
    return nil, err
end

local result = channel.select {
    ch:case_receive(),
    timeout:case_receive()
}
```

**Gibt zurück:** `Channel`

Der Response-Channel signalisiert den Abschluss. Sobald er bereit ist, liefert `future:result()` den zwischengespeicherten Wert oder den Fehler der aufgerufenen Funktion.

### `is_complete`

Nicht-blockierende Prüfung, ob das Future abgeschlossen ist.

```lua
while not future:is_complete() do
    -- do other work
    local _, sleep_err = time.sleep("100ms")
    if sleep_err then return nil, sleep_err end
end
local result, err = future:result()
```

**Gibt zurück:** `boolean`

### `is_canceled`

Gibt `true` zurück, wenn der Provider das Future als abgebrochen markiert hat. Beachten Sie die nachfolgende Einschränkung zur Abbruchbehandlung.

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

**Gibt zurück:** `boolean`

### `result`

Gibt das zwischengespeicherte Ergebnis zurück, wenn abgeschlossen, oder nil wenn noch ausstehend.

```lua
local value, err = future:result()
if err then
    print("Failed:", err:message())
elseif value then
    local data, data_err = value:data()
    if data_err then return nil, data_err end
    print("Got:", data)
end
```

**Gibt zurück:** `Payload|table|nil, error|nil`

### `error`

Gibt den Fehler zurück, wenn das Future fehlgeschlagen ist.

```lua
local err, has_error = future:error()
if has_error then
    print("Error kind:", err:kind())
end
```

**Gibt zurück:** `error|nil, boolean`

Diese Methode gibt bei einem fehlgeschlagenen Vorgang einen nicht wiederholbaren `INTERNAL`-Wrapper zurück. Verwenden Sie `result()`, um die ursprünglichen Fehlermetadaten der aufgerufenen Funktion zu erhalten.

### `cancel`

Fordert den Abbruch der asynchronen Operation an.

```lua
local canceled, err = future:cancel()
if err then return nil, err end
```

**Gibt zurück:** `boolean, error`

<warning>
In Runtime v0.3.32a verwenden Function- und Contract-Futures denselben prozessglobalen Cancellation-Callback. Wenn beide Provider geladen sind, bilden <code>cancel()</code> und <code>is_canceled()</code> keinen stabilen providerübergreifenden Vertrag. Verwenden Sie Cancellation nicht für die Korrektheit der Anwendung; lassen Sie stattdessen lokal ein Timeout ablaufen und ignorieren Sie ein verspätetes Ergebnis, bis die Runtime die Provider-Cancellation trennt.
</warning>

## Parallele Operationen

Kombinieren Sie `async` mit `channel.select`, um mehrere Aufrufe gleichzeitig auszuführen und ihre Ergebnisse einzusammeln.

```lua
-- Start multiple operations in parallel
local f1, err = funcs.async("app.api:get_user", user_id)
if err then return nil, err end
local f2, err = funcs.async("app.api:get_orders", user_id)
if err then return nil, err end
local f3, err = funcs.async("app.api:get_preferences", user_id)
if err then return nil, err end

-- Wait for all to complete using channels
local user_ch = f1:channel()
local orders_ch = f2:channel()
local prefs_ch = f3:channel()

local pending = {
    [user_ch] = {name = "user", future = f1},
    [orders_ch] = {name = "orders", future = f2},
    [prefs_ch] = {name = "preferences", future = f3}
}
local results = {}
while next(pending) do
    local cases = {}
    for ch in pairs(pending) do
        cases[#cases + 1] = ch:case_receive()
    end

    local r = channel.select(cases)
    local completed = pending[r.channel]
    pending[r.channel] = nil

    local payload, result_err = completed.future:result()
    if result_err then
        return nil, result_err
    end
    local data, data_err = payload:data()
    if data_err then
        return nil, data_err
    end
    results[completed.name] = data
end
```

## Berechtigungen

Funktionsoperationen unterliegen der Sicherheitsrichtlinienauswertung.

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `funcs.call` | Funktions-ID | Eine bestimmte Funktion aufrufen |
| `funcs.context` | `context` | `with_context()` verwenden, um benutzerdefinierten Kontext zu setzen |
| `funcs.security` | `security` | `with_actor()` oder `with_scope()` verwenden |
| `network.select` | Netzwerk-ID | Mit `with_options()` ein ausgehendes Netzwerk auswählen |

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Target leer | `errors.INVALID` | nein |
| Namespace fehlt | `errors.INVALID` | nein |
| Name fehlt | `errors.INVALID` | nein |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` | nein |
| Abonnement fehlgeschlagen | `errors.INTERNAL` | nein |
| Dispatch zum Start des asynchronen Aufrufs fehlgeschlagen | `errors.INTERNAL` | nein |
| Funktionsfehler | variiert | variiert |

Siehe [Fehlerbehandlung](lua/core/errors.md) für den Umgang mit Fehlern.
