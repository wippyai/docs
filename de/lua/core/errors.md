# Fehler
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Strukturierte Fehlerbehandlung mit Kategorisierung und Retry-Metadaten. Die globale `errors`-Tabelle ist ohne require verfugbar.

## Fehler erstellen

```lua
-- Einfache Nachricht (Art standardmassig UNKNOWN)
local err = errors.new("something went wrong")

-- Mit Art
local err = errors.new(errors.NOT_FOUND, "user not found")

-- Vollstandiger Konstruktor
local err = errors.new({
    message = "user not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})
```

## Fehler wrappen

Kontext hinzufugen und dabei Art, retryable und Details beibehalten:

```lua
local data, err = db.query("SELECT * FROM users")
if err then
    return nil, errors.wrap(err, "failed to load users")
end
```

## Fehlermethoden

| Methode | Gibt zuruck | Beschreibung |
|--------|---------|-------------|
| `err:kind()` | string | Fehlerkategorie |
| `err:message()` | string | Fehlermeldung |
| `err:retryable()` | boolean/nil | Ob die Operation wiederholt werden kann |
| `err:details()` | table/nil | Strukturierte Metadaten |
| `err:stack()` | string | Lua-Stack-Trace |
| `tostring(err)` | string | Vollstandige Darstellung |

## Art prufen

```lua
if errors.is(err, errors.INVALID) then
    -- ungultige Eingabe behandeln
end

-- Oder direkt vergleichen
if err:kind() == errors.NOT_FOUND then
    -- fehlende Ressource behandeln
end
```

## Fehlerarten

| Konstante | Anwendungsfall |
|----------|----------|
| `errors.NOT_FOUND` | Ressource existiert nicht |
| `errors.ALREADY_EXISTS` | Ressource existiert bereits |
| `errors.INVALID` | Ungultige Eingabe oder Argumente |
| `errors.PERMISSION_DENIED` | Zugriff verweigert |
| `errors.UNAVAILABLE` | Service vorubergehend nicht verfugbar |
| `errors.INTERNAL` | Interner Fehler |
| `errors.CANCELED` | Operation wurde abgebrochen |
| `errors.CONFLICT` | Ressourcenzustandskonflikt |
| `errors.TIMEOUT` | Operation hat Zeitlimit uberschritten |
| `errors.RATE_LIMITED` | Zu viele Anfragen |
| `errors.UNKNOWN` | Nicht spezifizierter Fehler |

## Aufrufstack

Strukturierten Aufrufstack abrufen:

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

| Typischerweise wiederholbar | Nicht wiederholbar |
|---------------------|---------------|
| `TIMEOUT` | `INVALID` |
| `UNAVAILABLE` | `NOT_FOUND` |
| `RATE_LIMITED` | `PERMISSION_DENIED` |
| | `ALREADY_EXISTS` |

```lua
if err:retryable() then
    -- sicher zu wiederholen
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
