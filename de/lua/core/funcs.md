# Funktionsaufruf
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Die primäre Methode zum Aufrufen anderer Funktionen in Wippy. Führen Sie registrierte Funktionen synchron oder asynchron uber Prozesse hinweg aus, mit voller Unterstützung für Kontextpropagierung, Sicherheitsanmeldedaten und Timeouts. Dieses Modul ist zentral für den Aufbau verteilter Anwendungen, bei denen Komponenten kommunizieren müssen.

## Laden

```lua
local funcs = require("funcs")
```

## call

Ruft eine registrierte Funktion synchron auf. Verwenden Sie dies, wenn Sie ein sofortiges Ergebnis benötigen und darauf warten können.

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

Der Target-String folgt dem Muster `namespace:name`, wobei namespace das Modul und name die spezifische Funktion identifiziert.

## async

Startet einen asynchronen Funktionsaufruf und gibt sofort ein Future zurück. Verwenden Sie dies für lang laufende Operationen, bei denen Sie nicht blockieren möchten, oder wenn Sie mehrere Operationen parallel ausführen möchten.

```lua
-- Schwere Berechnung starten ohne zu blockieren
local future, err = funcs.async("app.process:analyze_data", large_dataset)
if err then
    return nil, err
end

-- Andere Arbeit erledigen während die Berechnung läuft...

-- Auf Ergebnis warten wenn bereit
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `target` | string | Funktions-ID im Format "namespace:name" |
| `...args` | any | Argumente, die an die Funktion übergeben werden |

**Gibt zurück:** `Future, error`

## new

Erstellt einen neuen Executor zum Aufbauen von Funktionsaufrufen mit benutzerdefiniertem Kontext. Verwenden Sie dies, wenn Sie Request-Kontext propagieren, Sicherheitsanmeldedaten setzen oder Timeouts konfigurieren müssen.

```lua
local exec = funcs.new()
```

**Gibt zurück:** `Executor, error`

## Executor

Builder für Funktionsaufrufe mit benutzerdefinierten Kontextoptionen. Methoden geben neue Executor-Instanzen zurück (unveränderliche Verkettung), sodass Sie eine Basiskonfiguration wiederverwenden können.

### with_context

Fügt Kontextwerte hinzu, die der aufgerufenen Funktion zur Verfügung stehen. Verwenden Sie dies, um request-spezifische Daten wie Trace-IDs, Benutzersitzungen oder Feature-Flags zu propagieren.

```lua
-- Request-Kontext an nachgelagerte Services propagieren
local exec = funcs.new():with_context({
    request_id = ctx.get("request_id"),
    feature_flags = {dark_mode = true}
})

local user, err = exec:call("app.api:get_user", user_id)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `values` | table | Schlüssel-Wert-Paare zum Hinzufügen zum Kontext |

**Gibt zurück:** `Executor, error`

### with_actor

Setzt den Sicherheits-Actor für Autorisierungsprüfungen in der aufgerufenen Funktion. Verwenden Sie dies beim Aufrufen einer Funktion im Namen eines bestimmten Benutzers.

```lua
local security = require("security")
local actor = security.actor()  -- Actor des aktuellen Benutzers holen

-- Admin-Funktion mit Benutzeranmeldedaten aufrufen
local exec = funcs.new():with_actor(actor)
local result, err = exec:call("app.admin:delete_record", record_id)
if err and err:kind() == "PERMISSION_DENIED" then
    return nil, errors.new("PERMISSION_DENIED", "User cannot delete records")
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `actor` | Actor | Sicherheits-Actor (vom Security-Modul) |

**Gibt zurück:** `Executor, error`

### with_scope

Setzt den Sicherheits-Scope für aufgerufene Funktionen. Scopes definieren die verfügbaren Berechtigungen für den Aufruf.

```lua
local security = require("security")
local scope = security.new_scope()

local exec = funcs.new():with_scope(scope)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `scope` | Scope | Sicherheits-Scope (vom Security-Modul) |

**Gibt zurück:** `Executor, error`

### with_options

Setzt Aufrufoptionen wie Timeout und Priorität. Verwenden Sie dies für Operationen, die Zeitlimits benötigen.

```lua
-- 5 Sekunden Timeout für externen API-Aufruf setzen
local exec = funcs.new():with_options({timeout = 5000})
local result, err = exec:call("app.external:fetch_data", query)
if err then
    -- Timeout oder anderen Fehler behandeln
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `options` | table | Implementierungsspezifische Optionen |

**Gibt zurück:** `Executor, error`

### call / async

Executor-Versionen von call und async, die den konfigurierten Kontext verwenden.

```lua
-- Wiederverwendbaren Executor mit Kontext aufbauen
local exec = funcs.new()
    :with_context({trace_id = "abc-123"})
    :with_options({timeout = 10000})

-- Mehrere Aufrufe mit gleichem Kontext machen
local users, _ = exec:call("app.api:list_users")
local posts, _ = exec:call("app.api:list_posts")
```

## Future

Wird von `async()`-Aufrufen zurückgegeben. Repräsentiert eine laufende asynchrone Operation.

### response / channel

Gibt den zugrunde liegenden Channel zum Empfangen des Ergebnisses zurück.

```lua
local future, _ = funcs.async("app.api:slow_operation", data)
local ch = future:response()  -- oder future:channel()

local result = channel.select {
    ch:case_receive(),
    timeout:case_receive()
}
```

**Gibt zurück:** `Channel`

### is_complete

Nicht-blockierende Prüfung, ob das Future abgeschlossen ist.

```lua
while not future:is_complete() do
    -- andere Arbeit erledigen
    time.sleep("100ms")
end
local result, err = future:result()
```

**Gibt zurück:** `boolean`

### is_canceled

Gibt true zurück, wenn `cancel()` auf diesem Future aufgerufen wurde.

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

**Gibt zurück:** `boolean`

### result

Gibt das zwischengespeicherte Ergebnis zurück, wenn abgeschlossen, oder nil wenn noch ausstehend.

```lua
local value, err = future:result()
if err then
    print("Failed:", err:message())
elseif value then
    print("Got:", value:data())
end
```

**Gibt zurück:** `Payload|nil, error|nil`

### error

Gibt den Fehler zurück, wenn das Future fehlgeschlagen ist.

```lua
local err, has_error = future:error()
if has_error then
    print("Error kind:", err:kind())
end
```

**Gibt zurück:** `error|nil, boolean`

### cancel

Bricht die asynchrone Operation ab.

```lua
future:cancel()
```

## Parallele Operationen

Führen Sie mehrere Operationen gleichzeitig aus mit async und channel.select.

```lua
-- Mehrere Operationen parallel starten
local f1, _ = funcs.async("app.api:get_user", user_id)
local f2, _ = funcs.async("app.api:get_orders", user_id)
local f3, _ = funcs.async("app.api:get_preferences", user_id)

-- Auf alle warten mit Channels
local user_ch = f1:channel()
local orders_ch = f2:channel()
local prefs_ch = f3:channel()

local results = {}
for i = 1, 3 do
    local r = channel.select {
        user_ch:case_receive(),
        orders_ch:case_receive(),
        prefs_ch:case_receive()
    }
    if r.channel == user_ch then
        results.user = r.value:data()
    elseif r.channel == orders_ch then
        results.orders = r.value:data()
    else
        results.prefs = r.value:data()
    end
end
```

## Berechtigungen

Funktionsoperationen unterliegen der Sicherheitsrichtlinienauswertung.

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `funcs.call` | Funktions-ID | Eine bestimmte Funktion aufrufen |
| `funcs.context` | `context` | `with_context()` verwenden, um benutzerdefinierten Kontext zu setzen |
| `funcs.security` | `security` | `with_actor()` oder `with_scope()` verwenden |

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Target leer | `errors.INVALID` | nein |
| Namespace fehlt | `errors.INVALID` | nein |
| Name fehlt | `errors.INVALID` | nein |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` | nein |
| Abonnement fehlgeschlagen | `errors.INTERNAL` | nein |
| Funktionsfehler | variiert | variiert |

Siehe [Fehlerbehandlung](lua-errors.md) für die Arbeit mit Fehlern.
