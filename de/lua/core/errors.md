---
title: "Fehler"
description: "Strukturierte Fehler in Lua-Einträgen erstellen, umschließen, untersuchen und klassifizieren."
---

# Fehler
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Die globale Tabelle `errors` erstellt und untersucht strukturierte Fehler mit Kategorien, Details und Wiederholungsmetadaten. Sie ist ohne `require` verfügbar.

Diese Seite ist eine API-Referenz. Jeder Codeblock ist ein isoliertes Snippet und kein vollständiger Eintrag. Variablen wie `err` stehen für einen Fehler, den der umgebende Anwendungscode zurückgibt oder erstellt; das Wrapping-Beispiel setzt voraus, dass `db` ein von der Anwendung bereitgestellter Datenbank-Client ist.

## Fehler erstellen

```lua
-- Simple message (kind defaults to UNKNOWN)
local err = errors.new("something went wrong")

-- With kind, retryable, and details
local err = errors.new({
    message = "user not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})
```

`errors.new` akzeptiert entweder eine String-Nachricht oder eine Tabelle mit mindestens einem `message`-Feld. Die Form `(kind, message)` wird nicht unterstützt.

## Fehler umschließen

Umschließen Sie einen Fehler, um Kontext hinzuzufügen und dabei Art, Wiederholungsmetadaten und Details beizubehalten:

```lua
local data, err = db:query("SELECT * FROM users")
if err then
    return nil, errors.wrap(err, "failed to load users")
end
```

## Fehlermethoden

| Methode | Rückgabewert | Beschreibung |
|---------|--------------|--------------|
| `err:kind()` | string | Fehlerkategorie |
| `err:message()` | string | Fehlermeldung |
| `err:retryable()` | boolean/nil | Ob die Operation wiederholt werden kann |
| `err:details()` | table/nil | Strukturierte Metadaten |
| `err:stack()` | string | Lua-Stacktrace |
| `tostring(err)` | string | Vollständige Darstellung |

## Art prüfen

```lua
if errors.is(err, errors.INVALID) then
    -- handle invalid input
end

-- Or compare directly
if err:kind() == errors.NOT_FOUND then
    -- handle missing resource
end
```

## Fehlerarten

| Konstante | Anwendungsfall |
|-----------|----------------|
| `errors.NOT_FOUND` | Ressource ist nicht vorhanden |
| `errors.ALREADY_EXISTS` | Ressource ist bereits vorhanden |
| `errors.INVALID` | Ungültige Eingabe oder Argumente |
| `errors.PERMISSION_DENIED` | Zugriff verweigert |
| `errors.UNAVAILABLE` | Service vorübergehend nicht verfügbar |
| `errors.INTERNAL` | Interner Fehler |
| `errors.CANCELED` | Operation wurde abgebrochen |
| `errors.CONFLICT` | Konflikt im Ressourcenzustand |
| `errors.TIMEOUT` | Zeitlimit der Operation überschritten |
| `errors.RATE_LIMITED` | Zu viele Anfragen |
| `errors.UNKNOWN` | Nicht spezifizierter Fehler |

## Aufrufstack

Mit `errors.call_stack` untersuchen Sie einen strukturierten Aufrufstack:

```lua
local stack = errors.call_stack(err)
if stack then
    print("Thread:", stack.thread)
    for _, frame in ipairs(stack.frames) do
        print(frame.source .. ":" .. frame.line, frame.name)
    end
end
```

## Wiederholbare Fehler

Die Wiederholbarkeit ist eine Fehlermetadatenangabe und keine Eigenschaft, die eine Fehlerart garantiert. Prüfen Sie den Rückgabewert von `err:retryable()`, statt ihn aus `err:kind()` abzuleiten. `nil` bedeutet, dass der Fehler keine Aussage dazu enthält, ob ein weiterer Versuch sinnvoll ist.

```lua
if err:retryable() then
    -- safe to retry
end
```

## Fehlerdetails

```lua
local err = errors.new({
    message = "validation failed",
    kind = errors.INVALID,
    details = {
        errors = {
            {field = "email", message = "invalid format"},
            {field = "age", message = "must be positive"}
        }
    }
})

local details = err:details()
for _, e in ipairs(details.errors) do
    print(e.field, e.message)
end
```
