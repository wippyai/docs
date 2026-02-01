# Ausdruckssprache
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Werten Sie dynamische Ausdrucke mit [expr-lang](https://expr-lang.org/)-Syntax aus. Kompilieren und fuhren Sie sichere Ausdrucke fur Filterung, Validierung und Regelauswertung ohne vollstandige Lua-Ausfuhrung aus.

## Konfiguration

Ausdruck-Cache wird beim Start konfiguriert:

```yaml
lua:
  expr:
    cache_enabled: true   # Ausdruck-Caching aktivieren
    capacity: 5000        # Cache-Kapazitat
```

## Laden

```lua
local expr = require("expr")
```

## Ausdrucke auswerten

Werten Sie einen Ausdruck-String aus und geben Sie das Ergebnis zuruck. Verwendet internen LRU-Cache fur kompilierte Ausdrucke:

```lua
-- Einfache Mathematik
local result = expr.eval("1 + 2 * 3")  -- 7

-- Mit Variablen
local total = expr.eval("price * quantity", {
    price = 29.99,
    quantity = 3
})  -- 89.97

-- Boolesche Ausdrucke
local is_adult = expr.eval("age >= 18", {age = 21})  -- true

-- String-Operationen
local greeting = expr.eval('name + " is " + status', {
    name = "Alice",
    status = "online"
})  -- "Alice is online"

-- Ternarer Operator
local label = expr.eval('score > 90 ? "A" : score > 80 ? "B" : "C"', {
    score = 85
})  -- "B"

-- Array-Operationen
local has_admin = expr.eval('"admin" in roles', {
    roles = {"user", "admin", "viewer"}
})  -- true
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `expression` | string | Ausdruck in expr-lang-Syntax |
| `env` | table | Variablenumgebung fur Ausdruck (optional) |

**Gibt zuruck:** `any, error`

## Ausdrucke kompilieren

Kompilieren Sie einen Ausdruck in ein wiederverwendbares Program-Objekt fur wiederholte Auswertung:

```lua
-- Einmal kompilieren fur wiederholte Verwendung
local discount_calc, err = expr.compile("price * (1 - discount_rate)")
if err then
    return nil, err
end

-- Mit verschiedenen Eingaben wiederverwenden
local price1 = discount_calc:run({price = 100, discount_rate = 0.1})  -- 90
local price2 = discount_calc:run({price = 50, discount_rate = 0.2})   -- 40
local price3 = discount_calc:run({price = 200, discount_rate = 0.15}) -- 170
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `expression` | string | Ausdruck in expr-lang-Syntax |
| `env` | table | Typhinweis-Umgebung fur Kompilierung (optional) |

**Gibt zuruck:** `Program, error`

## Kompilierte Programme ausfuhren

Fuhren Sie einen kompilierten Ausdruck mit bereitgestellter Umgebung aus:

```lua
-- Validierungsregel
local validator, _ = expr.compile("len(password) >= 8 and len(password) <= 128")

local valid1 = validator:run({password = "short"})       -- false
local valid2 = validator:run({password = "securepass123"}) -- true

-- Preisregel
local pricer, _ = expr.compile([[
    base_price * quantity * (1 - bulk_discount) + shipping
]])

local order_total = pricer:run({
    base_price = 25.00,
    quantity = 10,
    bulk_discount = 0.15,
    shipping = 12.50
})  -- 225.00
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `env` | table | Variablenumgebung fur Ausdruck (optional) |

**Gibt zuruck:** `any, error`

## Eingebaute Funktionen

Expr-lang bietet viele eingebaute Funktionen:

```lua
-- Mathematische Funktionen
expr.eval("max(1, 5, 3)")        -- 5
expr.eval("min(10, 2, 8)")       -- 2
expr.eval("abs(-42)")            -- 42
expr.eval("ceil(3.2)")           -- 4
expr.eval("floor(3.8)")          -- 3

-- String-Funktionen
expr.eval('len("hello")')        -- 5
expr.eval('upper("hello")')      -- "HELLO"
expr.eval('lower("HELLO")')      -- "hello"
expr.eval('trim("  hi  ")')      -- "hi"
expr.eval('contains("hello", "ell")')  -- true

-- Array-Funktionen
expr.eval("len(items)", {items = {1,2,3}})  -- 3
expr.eval("sum(values)", {values = {1,2,3,4}})  -- 10
```

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Ausdruck ist leer | `errors.INVALID` | nein |
| Ausdruck-Syntax ungultig | `errors.INTERNAL` | nein |
| Ausdrucksauswertung schlagt fehl | `errors.INTERNAL` | nein |
| Ergebniskonvertierung schlagt fehl | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) fur die Arbeit mit Fehlern.
