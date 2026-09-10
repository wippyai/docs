---
title: "Futures"
description: "Asynchrone Operationsergebnisse. Futures werden von funcs.async() und asynchronen Contract-Aufrufen zurückgegeben."
---

# Futures
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Futures stellen Ergebnisse asynchroner Operationen dar. Sie werden von `funcs.async()` und asynchronen Contract-Aufrufen zurückgegeben. Diese Seite ist eine API-Referenz; Ziel-IDs und Argumente in den Mustern werden von der Anwendung definiert.

## Laden

Futures werden nicht als Modul geladen; asynchrone Operationen erstellen sie:

```lua
local funcs = require("funcs")
local future, err = funcs.async("app.compute:task", data)
if err then
    return nil, err
end
```

## Response-Channel

Verwenden Sie den Response-Channel, um auf den Abschluss zu warten, und lesen Sie danach das zwischengespeicherte Ergebnis aus dem Future:

```lua
local ch = future:response()
local _, open = ch:receive()
if not open then
    return nil, errors.new("future response channel closed")
end

local payload, err = future:result()
if err then
    return nil, err
end
local result, data_err = payload:data()
if data_err then return nil, data_err end
```

`channel()` ist ein Alias für `response()`.

Der Channel-Wert ist das Payload, eine Payload-Tabelle oder ein Fehler der Operation. Ein Aufruf von `result()`, nachdem der Channel bereit ist, bietet eine einheitliche Erfolgs-/Fehlerschnittstelle und liefert den zwischengespeicherten Wert auch dann, wenn der Channel bereits geleert wurde.

## Abschlussprüfung

Nicht-blockierende Prüfung, ob Future abgeschlossen ist:

```lua
if future:is_complete() then
    local result, err = future:result()
end
```

## Abbruchprüfung

Prüft, ob der Provider das Future als abgebrochen markiert hat:

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

**Gibt zurück:**
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

**Gibt zurück:** `error, boolean`

Wenn eine Operation fehlschlägt, gibt `error()` einen nicht wiederholbaren `INTERNAL`-Wrapper zurück. Verwenden Sie `result()`, wenn ursprüngliche Fehlerart und Wiederholbarkeit der aufgerufenen Funktion erhalten bleiben müssen.

## Abbrechen

Fordert den Abbruch der asynchronen Operation nach dem Best-Effort-Prinzip an:

```lua
local canceled, err = future:cancel()
```

**Gibt zurück:** `boolean, error`

Operation kann trotzdem abgeschlossen werden, wenn bereits in Bearbeitung.

## Timeout-Muster

```lua
local time = require("time")

local future, err = funcs.async("app.compute:slow", data)
if err then
    return nil, err
end

local timeout, err = time.after("5s")
if err then
    return nil, err
end

local r = channel.select {
    future:channel():case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    future:cancel()
    return nil, errors.new({ kind = errors.TIMEOUT, message = "Operation timed out" })
end

local payload, result_err = future:result()
if result_err then
    return nil, result_err
end
local value, data_err = payload:data()
if data_err then return nil, data_err end
return value
```

## First-to-Complete

```lua
local f1, err = funcs.async("app.cache:get", key)
if err then
    return nil, err
end
local f2, err = funcs.async("app.db:get", key)
if err then
    return nil, err
end

local ch1 = f1:channel()
local ch2 = f2:channel()

local r = channel.select {
    ch1:case_receive(),
    ch2:case_receive()
}

-- The slower operation may still complete; this caller ignores its result.
local winner
if r.channel == ch1 then
    winner = f1
else
    winner = f2
end

local payload, result_err = winner:result()
if result_err then
    return nil, result_err
end
local value, data_err = payload:data()
if data_err then return nil, data_err end
return value
```

## Fehler

| Bedingung | Art |
|-----------|------|
| Operation abgebrochen | `CANCELED` |
| Asynchrone Operation fehlgeschlagen | `result()` behält die Art der Operation bei; `error()` meldet `INTERNAL` |
