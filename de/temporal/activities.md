# Activities

Activities sind Funktionen, die nicht-deterministische Operationen ausführen. Jeder `function.lua`- oder `process.lua`-Eintrag kann als Temporal-Activity registriert werden, indem Metadaten hinzugefügt werden.

## Activities registrieren

Fügen Sie `meta.temporal.activity` hinzu um eine Funktion als Activity zu registrieren:

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

Aus Workflows verwenden Sie das `funcs`-Modul:

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

### Activity-Optionen

Konfigurieren Sie Timeouts und Retry-Verhalten:

```lua
local funcs = require("funcs")

local executor = funcs.new()
executor = executor:with_options({
    start_to_close_timeout = "30s",
    schedule_to_close_timeout = "5m",
    heartbeat_timeout = "10s",
    retry_policy = {
        max_attempts = 3,
        initial_interval = "1s",
        backoff_coefficient = 2.0,
        max_interval = "1m"
    }
})

local result, err = executor:call("app:charge_payment", input)
```

## Lokale Activities

Lokale Activities werden im Workflow-Worker-Prozess ohne separates Task-Queue-Polling ausgeführt. Verwenden Sie sie für schnelle, kurze Operationen:

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
- Geringere Latenz
- Kein separater Task-Queue-Overhead
- Beschränkt auf kurze Ausführungszeiten
- Kein Heartbeating

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

## Fehlerbehandlung

Geben Sie Fehler über das Standard-Lua-Muster zurück:

```lua
local function charge(input)
    if not input.amount or input.amount <= 0 then
        return nil, errors.new("INVALID", "Betrag muss positiv sein")
    end

    local response, err = http.post(url, options)
    if err then
        return nil, errors.wrap(err, "Zahlungs-API fehlgeschlagen")
    end

    if response:status() >= 400 then
        return nil, errors.new("FAILED", "Zahlung abgelehnt")
    end

    return json.decode(response:body())
end
```

## Prozess-Activities

`process.lua`-Einträge können ebenfalls als Activities registriert werden:

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
