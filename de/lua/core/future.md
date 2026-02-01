# Futures
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Asynchrone Operationsergebnisse. Futures werden von `funcs.async()` und asynchronen Contract-Aufrufen zuruckgegeben.

## Laden

Kein ladbares Modul. Futures werden von asynchronen Operationen erstellt:

```lua
local funcs = require("funcs")
local future, err = funcs.async("app.compute:task", data)
```

## Response-Channel

Channel zum Empfangen des Ergebnisses holen:

```lua
local ch = future:response()
local payload, ok = ch:receive()
if ok then
    local result = payload:data()
end
```

`channel()` ist ein Alias fur `response()`.

## Abschlussprufung

Nicht-blockierende Prufung, ob Future abgeschlossen ist:

```lua
if future:is_complete() then
    local result, err = future:result()
end
```

## Abbruchprufung

Prufen, ob `cancel()` aufgerufen wurde:

```lua
if future:is_canceled() then
    print("Operation was canceled")
end
```

## Ergebnis holen

Zwischengespeichertes Ergebnis holen (nicht-blockierend):

```lua
local val, err = future:result()
```

**Gibt zuruck:**
- Nicht abgeschlossen: `nil, nil`
- Abgebrochen: `nil, error` (Art `CANCELED`)
- Fehler: `nil, error`
- Erfolg: `Payload, nil` oder `table, nil` (mehrere Payloads)

## Fehler holen

Fehler holen, wenn Future fehlgeschlagen ist:

```lua
local err, has_error = future:error()
if has_error then
    print("Failed:", err:message())
end
```

**Gibt zuruck:** `error, boolean`

## Abbrechen

Asynchrone Operation abbrechen (Best-Effort):

```lua
future:cancel()
```

Operation kann trotzdem abgeschlossen werden, wenn bereits in Bearbeitung.

## Timeout-Muster

```lua
local future = funcs.async("app.compute:slow", data)
local timeout = time.after("5s")

local r = channel.select {
    future:channel():case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    future:cancel()
    return nil, errors.new("TIMEOUT", "Operation timed out")
end

return r.value:data()
```

## First-to-Complete

```lua
local f1 = funcs.async("app.cache:get", key)
local f2 = funcs.async("app.db:get", key)

local r = channel.select {
    f1:channel():case_receive(),
    f2:channel():case_receive()
}

-- Die langsamere abbrechen
if r.channel == f1:channel() then
    f2:cancel()
else
    f1:cancel()
end

return r.value:data()
```

## Fehler

| Bedingung | Art |
|-----------|------|
| Operation abgebrochen | `CANCELED` |
| Asynchrone Operation fehlgeschlagen | variiert |
