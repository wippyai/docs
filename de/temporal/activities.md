# Activities

Activities sind Funktionen, die nicht-deterministische Operationen ausführen. Jeder `function.lua`- oder `process.lua`-Eintrag kann als Temporal-Activity registriert werden, indem Metadaten hinzugefügt werden.

## Activities registrieren

`meta.temporal.activity` hinzufügen, um eine Funktion als Activity zu registrieren:

```yaml
- name: charge_payment
  kind: function.lua
  source: file://payment.lua
  method: charge
  modules:
    - http_client
    - json
  meta:
    temporal:
      activity:
        worker: app:worker
```

### Metadaten-Felder

| Feld | Erforderlich | Beschreibung |
|------|--------------|--------------|
| `worker` | Ja | Referenz auf `temporal.worker`-Eintrag |
| `local` | Nein | Als lokale Activity ausführen (Standard: false) |

## Implementierung

Activities sind reguläre Lua-Funktionen:

```lua
-- payment.lua
local http = require("http_client")
local json = require("json")

local function charge(input)
    local response, err = http.post("https://api.stripe.com/v1/charges", {
        headers = {
            ["Authorization"] = "Bearer " .. input.api_key,
            ["Content-Type"] = "application/json"
        },
        body = json.encode({
            amount = input.amount,
            currency = input.currency,
            source = input.token
        })
    })

    if err then
        return nil, err
    end

    return json.decode(response:body())
end

return { charge = charge }
```

## Activities aufrufen

Aus Workflows das `funcs`-Modul verwenden:

```lua
local funcs = require("funcs")

local result, err = funcs.call("app:charge_payment", {
    amount = 5000,
    currency = "usd",
    token = "tok_visa",
    api_key = ctx.stripe_key
})

if err then
    return nil, err
end
```

## Activity-Optionen

Timeouts, Retry-Verhalten und andere Ausführungsparameter mit dem Executor-Builder konfigurieren:

```lua
local funcs = require("funcs")

local executor = funcs.new():with_options({
    ["activity.start_to_close_timeout"] = "30s",
    ["activity.schedule_to_close_timeout"] = "5m",
    ["activity.heartbeat_timeout"] = "10s",
    ["activity.retry_policy"] = {
        maximum_attempts = 3,
        initial_interval = 1000,
        backoff_coefficient = 2.0,
        maximum_interval = 60000,
    }
})

local result, err = executor:call("app:charge_payment", input)
```

Der Executor ist unveränderlich und wiederverwendbar. Einmal erstellen und für mehrere Aufrufe verwenden:

```lua
local reliable = funcs.new():with_options({
    ["activity.start_to_close_timeout"] = "60s",
    ["activity.retry_policy"] = {
        maximum_attempts = 5,
        initial_interval = 2000,
        backoff_coefficient = 2.0,
        maximum_interval = 120000,
    }
})

local a, err = reliable:call("app:step_one", input)
local b, err = reliable:call("app:step_two", a)
```

### Optionsreferenz

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|--------------|
| `activity.start_to_close_timeout` | duration | 10m | Maximale Zeit für Activity-Ausführung |
| `activity.schedule_to_close_timeout` | duration | - | Maximale Zeit von Planung bis Abschluss |
| `activity.schedule_to_start_timeout` | duration | - | Maximale Zeit bis Activity startet |
| `activity.heartbeat_timeout` | duration | - | Maximale Zeit zwischen Heartbeats |
| `activity.id` | string | - | Benutzerdefinierte Activity-Ausführungs-ID |
| `activity.task_queue` | string | - | Task-Queue für diesen Aufruf überschreiben |
| `activity.wait_for_cancellation` | boolean | false | Auf Activity-Stornierung warten |
| `activity.disable_eager_execution` | boolean | false | Sofortige Ausführung deaktivieren |
| `activity.retry_policy` | table | - | Retry-Konfiguration (siehe unten) |

Duration-Werte akzeptieren Strings (`"5s"`, `"10m"`, `"1h"`) oder Millisekunden als Zahlen.

### Retry-Richtlinie

Automatisches Retry-Verhalten für fehlgeschlagene Activities konfigurieren:

```lua
["activity.retry_policy"] = {
    initial_interval = 1000,         -- ms before first retry
    backoff_coefficient = 2.0,       -- multiplier for each retry
    maximum_interval = 300000,       -- max interval between retries (ms)
    maximum_attempts = 10,           -- max retry attempts (0 = unlimited)
    non_retryable_error_types = {    -- errors that skip retries
        "INVALID",
        "PERMISSION_DENIED"
    }
}
```

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `initial_interval` | number | 1000 | Millisekunden vor dem ersten Retry |
| `backoff_coefficient` | number | 2.0 | Multiplikator, der bei jedem Retry auf das Intervall angewendet wird |
| `maximum_interval` | number | - | Obergrenze für Retry-Intervall (ms) |
| `maximum_attempts` | number | 0 | Maximale Versuche (0 = unbegrenzt) |
| `non_retryable_error_types` | array | - | Fehlerarten, die Retries umgehen |

### Timeout-Beziehungen

```
|--- schedule_to_close_timeout --------------------------------|
|--- schedule_to_start_timeout ---|--- start_to_close_timeout -|
     (waiting in queue)                (executing)
```

- `start_to_close_timeout`: Wie lange die Activity selbst laufen darf. Dies ist das am häufigsten verwendete Timeout.
- `schedule_to_close_timeout`: Gesamtzeit von der Planung der Activity bis zum Abschluss, einschließlich Wartezeit in der Queue und Retries.
- `schedule_to_start_timeout`: Maximale Zeit, die die Activity in der Task-Queue auf einen Worker warten kann.
- `heartbeat_timeout`: Für langlebige Activities die maximale Zeit zwischen Heartbeat-Meldungen.

## Lokale Activities

Lokale Activities werden im Workflow-Worker-Prozess ohne separates Task-Queue-Polling ausgeführt:

```yaml
- name: validate_input
  kind: function.lua
  source: file://validate.lua
  method: validate
  modules:
    - json
  meta:
    temporal:
      activity:
        worker: app:worker
        local: true
```

Eigenschaften:
- Werden im Workflow-Worker-Prozess ausgeführt
- Geringere Latenz (kein Task-Queue-Roundtrip)
- Kein separater Task-Queue-Overhead
- Beschränkt auf kurze Ausführungszeiten
- Kein Heartbeating

Lokale Activities eignen sich für schnelle, kurze Operationen wie Eingabevalidierung, Datentransformation oder Cache-Abfragen.

## Activity-Benennung

Activities werden mit ihrer vollständigen Entry-ID als Namen registriert:

```yaml
namespace: app
entries:
  - name: charge_payment
    kind: function.lua
    # ...
```

Activity-Name: `app:charge_payment`

## Kontextpropagierung

Kontextwerte, die beim Starten des Workflows gesetzt werden, sind innerhalb von Activities verfügbar:

```lua
-- spawner sets context
local spawner = process.with_context({
    user_id = "user-1",
    tenant = "tenant-1",
})
local pid = spawner:spawn("app:order_workflow", "app:worker", order)
```

```lua
-- activity reads context
local ctx = require("ctx")

local function process_order(input)
    local user_id = ctx.get("user_id")   -- "user-1"
    local tenant = ctx.get("tenant")     -- "tenant-1"
    -- use context for authorization, logging, etc.
end
```

Activities, die aus einem Workflow mit `funcs.new():with_context()` aufgerufen werden, propagieren ebenfalls den Kontext:

```lua
-- inside workflow
local executor = funcs.new():with_context({trace_id = "abc-123"})
local result, err = executor:call("app:charge_payment", input)
```

## Fehlerbehandlung

Fehler über das Standard-Lua-Muster zurückgeben:

```lua
local errors = require("errors")

local function charge(input)
    if not input.amount or input.amount <= 0 then
        return nil, errors.new("INVALID", "amount must be positive")
    end

    local response, err = http.post(url, options)
    if err then
        return nil, errors.wrap(err, "payment API failed")
    end

    if response:status() >= 400 then
        return nil, errors.new("FAILED", "payment declined")
    end

    return json.decode(response:body())
end
```

### Fehlerobjekte

An Workflows weitergegebene Activity-Fehler enthalten strukturierte Metadaten:

```lua
local result, err = funcs.call("app:charge_payment", input)
if err then
    err:kind()       -- error classification string
    err:retryable()  -- boolean, whether retry makes sense
    err:message()    -- human-readable error message
end
```

### Fehlermodi

| Fehler | Fehlerart | Wiederholbar | Beschreibung |
|--------|-----------|--------------|--------------|
| Anwendungsfehler | variiert | variiert | Von Activity-Code zurückgegebener Fehler |
| Laufzeitabsturz | `INTERNAL` | ja | Unbehandelter Lua-Fehler in Activity |
| Fehlende Activity | `NOT_FOUND` | nein | Activity nicht beim Worker registriert |
| Timeout | `TIMEOUT` | ja | Activity hat konfiguriertes Timeout überschritten |

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {maximum_attempts = 1}
})

local result, err = executor:call("app:missing_activity", input)
if err then
    print(err:kind())      -- "NOT_FOUND"
    print(err:retryable())  -- false
end
```

## Prozess-Activities

`process.lua`-Einträge können ebenfalls als Activities für langlebige Operationen registriert werden:

```yaml
- name: long_task
  kind: process.lua
  source: file://long_task.lua
  method: main
  modules:
    - http_client
  meta:
    temporal:
      activity:
        worker: app:worker
```

## Siehe auch

- [Übersicht](temporal/overview.md) - Konfiguration
- [Workflows](temporal/workflows.md) - Workflow-Implementierung
- [Funktionen](lua/core/funcs.md) - Funktionsmodul
- [Fehlerbehandlung](lua/core/errors.md) - Fehlertypen und -muster
