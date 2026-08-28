---
title: "Activities"
description: "Registrieren Sie function.lua- oder process.lua-Einträge als Temporal-Activities für nichtdeterministische Operationen."
---

# Activities

Temporal-Activities führen nichtdeterministische Operationen aus. Registrieren Sie einen `function.lua`- oder `process.lua`-Eintrag über seine Metadaten als Activity.

Die Ausschnitte sind API-Rezepte. Das Zahlungsbeispiel ist illustrativ und erfordert einen anwendungseigenen Umgebungseintrag, die Berechtigung `env.get` für die Zugangsdaten, die Berechtigung `http_client.request` für die Provider-URL sowie einen Vertrag mit einem Zahlungsanbieter.

## Activities registrieren

`meta.temporal.activity` hinzufügen, um eine Funktion als Activity zu registrieren:

```yaml
- name: charge_payment
  kind: function.lua
  source: file://payment.lua
  method: charge
  modules:
    - env
    - errors
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

Activities sind reguläre Lua-Funktionen. Übergeben Sie keine Zugangsdaten in Workflow-Eingaben, da Temporal diese Eingaben im Workflow-Verlauf speichert. Dieses Beispiel liest den Zahlungsschlüssel innerhalb der Activity aus der Umgebungs-Registry. Der Platzhalter-Provider akzeptiert eine JSON-Zahlungsanfrage und gibt eine JSON-Antwort zurück. Die Zuordnung der Statuscodes ist eine anwendungseigene Richtlinie: Ersetzen Sie URL, Anfragefelder, Antwortfelder und Fehlerzuordnung durch den Vertrag Ihres Providers.

```lua
-- payment.lua
local http = require("http_client")
local json = require("json")
local env = require("env")
local errors = require("errors")

local function payment_error(status)
    if status == 408 then
        return errors.new({kind = errors.TIMEOUT, message = "payment provider timed out", retryable = true})
    elseif status == 429 then
        return errors.new({kind = errors.RATE_LIMITED, message = "payment provider rate limited the request", retryable = true})
    elseif status >= 500 then
        return errors.new({kind = errors.UNAVAILABLE, message = "payment provider is unavailable", retryable = true})
    end
    return errors.new({kind = errors.INVALID, message = "payment request was rejected", retryable = false})
end

local function charge(input)
    local api_key, env_err = env.get("PAYMENTS_API_KEY")
    if env_err then return nil, env_err end

    local body, encode_err = json.encode({
        amount = input.amount,
        currency = input.currency,
        payment_token = input.payment_token
    })
    if encode_err then
        return nil, encode_err
    end

    local response, err = http.post("https://payments.example.com/v1/charges", {
        headers = {
            ["Authorization"] = "Bearer " .. api_key,
            ["Content-Type"] = "application/json"
        },
        body = body
    })

    if err then
        return nil, err
    end

    if response.status_code >= 400 then
        return nil, payment_error(response.status_code)
    end

    return json.decode(response.body)
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
    payment_token = "payment-token-123"
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
if err then
    return nil, err
end
local b, err = reliable:call("app:step_two", a)
if err then
    return nil, err
end
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
| `activity.versioning_intent` | string oder number | - | Worker-Versionierungsabsicht für die Activity |
| `activity.summary` | string | - | In den Temporal-Activity-Metadaten angezeigte Zusammenfassung |
| `activity.priority` | table | - | Prioritätsschlüssel und optionale Fairness-Einstellungen |
| `activity.name` | string | - | Überschreibung des Activity-Typs |

Duration-Werte akzeptieren Strings (`"5s"`, `"10m"`, `"1h"`) oder Millisekunden als Zahlen.

Verwenden Sie für neuen Code die kanonischen Namen `activity.*`. Die veralteten Aliasse `temporal.activity.*` werden aus Kompatibilitätsgründen weiterhin akzeptiert.

```lua
local executor = funcs.new():with_options({
    ["activity.summary"] = "Charge the order payment",
    ["activity.priority"] = {
        priority_key = 10,
        fairness_key = "customer-123",
        fairness_weight = 1.0,
    },
    ["activity.name"] = "charge-payment",
    ["activity.versioning_intent"] = "use_assignment_rules",
})
```

### Retry-Richtlinie

Automatisches Retry-Verhalten für fehlgeschlagene Activities konfigurieren:

```lua
["activity.retry_policy"] = {
    initial_interval = 1000,         -- ms before first retry
    backoff_coefficient = 2.0,       -- multiplier for each retry
    maximum_interval = 300000,       -- max interval between retries (ms)
    maximum_attempts = 10,           -- max retry attempts (0 = unlimited)
    non_retryable_error_types = {    -- errors that skip retries
        "Invalid",
        "PermissionDenied"
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

Das Feld `local` wird für eine Activity akzeptiert:

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

Derzeit wird `local: true` zwar geparst, verhält sich aber genauso wie eine reguläre Activity: Die Activity wird über den standardmäßigen Activity-Pfad registriert und ausgeführt. Eine eigenständige lokale Activity-Ausführung gibt es noch nicht; die Einstellung ändert daher weder Latenz noch Task-Queue-Verhalten oder Heartbeating.

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
-- Spawner sets context
local spawner = process.with_context({
    user_id = "user-1",
    tenant = "tenant-1",
})
local pid, err = spawner:spawn("app:order_workflow", "app:worker", order)
if err then
    return nil, err
end
```

```lua
-- Activity reads context
local ctx = require("ctx")

local function process_order(input)
    local user_id, user_err = ctx.get("user_id")   -- "user-1"
    if user_err then return nil, user_err end
    local tenant, tenant_err = ctx.get("tenant")   -- "tenant-1"
    if tenant_err then return nil, tenant_err end
    -- use context for authorization, logging, etc.
end
```

Activities, die aus einem Workflow mit `funcs.new():with_context()` aufgerufen werden, propagieren ebenfalls den Kontext:

```lua
-- Inside workflow
local executor = funcs.new():with_context({trace_id = "abc-123"})
local result, err = executor:call("app:charge_payment", input)
```

## Fehlerbehandlung

Fehler über das Standard-Lua-Muster zurückgeben:

```lua
local errors = require("errors")

-- Replace this mapping with the payment provider's documented error contract.
local function payment_error(status)
    if status == 408 then
        return errors.new({kind = errors.TIMEOUT, message = "payment provider timed out", retryable = true})
    elseif status == 429 then
        return errors.new({kind = errors.RATE_LIMITED, message = "payment provider rate limited the request", retryable = true})
    elseif status >= 500 then
        return errors.new({kind = errors.UNAVAILABLE, message = "payment provider is unavailable", retryable = true})
    end
    return errors.new({kind = errors.INVALID, message = "payment request was rejected", retryable = false})
end

local function charge(input)
    if not input.amount or input.amount <= 0 then
        return nil, errors.new({ kind = errors.INVALID, message = "amount must be positive" })
    end

    local response, err = http.post(url, options)
    if err then
        return nil, errors.wrap(err, "payment API failed")
    end

    if response.status_code >= 400 then
        return nil, payment_error(response.status_code)
    end

    return json.decode(response.body)
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
| Anwendungsfehler | Was die Activity zurückgegeben hat | Wird vom zurückgegebenen Fehler übernommen | Von Activity-Code via `return nil, err` zurückgegebener Fehler |
| Laufzeitabsturz | `Internal` | false | Unbehandelter Lua-Fehler in Activity |
| Fehlende Activity | `NotFound` | false | Activity nicht beim Worker registriert |
| Timeout | `Timeout` | false | Activity hat konfiguriertes Timeout überschritten |

```lua
local executor = funcs.new():with_options({
    ["activity.retry_policy"] = {maximum_attempts = 1}
})

local result, err = executor:call("app:missing_activity", input)
if err then
    print(err:kind())      -- "NotFound"
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
