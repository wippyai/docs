---
title: "Ausdruckssprache"
description: "Expr-lang-Ausdrücke aus Lua kompilieren und auswerten."
---

# Ausdruckssprache
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Das Modul `expr` kompiliert und wertet [expr-lang](https://expr-lang.org/)-Ausdrücke für Filterung, Validierung, Berechnungen und Regeln aus, ohne Lua-Quellcode auszuführen. Diese Seite ist die kanonische Lua-API-Referenz. Die Beispiele laufen in einem vorhandenen Wippy-Lua-Prozess, dessen Eintrag das Modul `expr` deklariert; sie sind keine eigenständigen Wippy-Anwendungen. Zur Wahl zwischen Ausdrücken und Lua mit eingeschränkten Fähigkeiten siehe [Dynamische Auswertung](./eval.md).

## Laden

```lua
local expr = require("expr")
```

## Caching

`expr.eval` hält intern einen LRU-Cache kompilierter Ausdrücke mit einer Standardkapazität von 1000. Der Cache ist in das Modul eingebaut und benötigt keine Konfiguration.

## Ausdrücke auswerten

Werten Sie einen Ausdruck-String aus und geben Sie das Ergebnis zurück. Verwendet internen LRU-Cache für kompilierte Ausdrücke:

```lua
-- Simple math
local result, err = expr.eval("1 + 2 * 3")
if err then
    return nil, err
end
-- result == 7

-- With variables
local total, total_err = expr.eval("price * quantity", {
    price = 29.99,
    quantity = 3
})
if total_err then
    return nil, total_err
end
-- total == 89.97

-- Ternary operator
local label, label_err = expr.eval('score > 90 ? "A" : score > 80 ? "B" : "C"', {
    score = 85
})
if label_err then
    return nil, label_err
end
-- label == "B"
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `expression` | string | Ausdruck in expr-lang-Syntax |
| `env` | `any` | Variablenumgebung für den Ausdruck; optional und üblicherweise eine Tabelle |

**Gibt zurück:** `any, error`

## Ausdrücke kompilieren

Kompilieren Sie einen Ausdruck in ein wiederverwendbares `Program` für wiederholte Auswertungen:

```lua
-- Compile once for repeated use
local discount_calc, err = expr.compile("price * (1 - discount_rate)")
if err then
    return nil, err
end

-- Reuse with different inputs
local price1, run_err = discount_calc:run({price = 100, discount_rate = 0.1})
if run_err then
    return nil, run_err
end

local price2, second_run_err = discount_calc:run({price = 50, discount_rate = 0.2})
if second_run_err then
    return nil, second_run_err
end
-- price1 == 90 and price2 == 40
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `expression` | string | Ausdruck in expr-lang-Syntax |
| `env` | `any` | Typhinweis-Umgebung für die Kompilierung; optional und üblicherweise eine Tabelle |

**Gibt zurück:** `Program, error`

## Kompilierte Programme ausführen

Führen Sie einen kompilierten Ausdruck mit bereitgestellter Umgebung aus:

```lua
-- Validation rule
local validator, compile_err = expr.compile("len(password) >= 8 and len(password) <= 128")
if compile_err then
    return nil, compile_err
end

local valid, run_err = validator:run({password = "securepass123"})
if run_err then
    return nil, run_err
end
-- valid == true

-- Pricing rule
local pricer, pricing_compile_err = expr.compile([[
    base_price * quantity * (1 - bulk_discount) + shipping
]])
if pricing_compile_err then
    return nil, pricing_compile_err
end

local order_total, pricing_run_err = pricer:run({
    base_price = 25.00,
    quantity = 10,
    bulk_discount = 0.15,
    shipping = 12.50
})
if pricing_run_err then
    return nil, pricing_run_err
end
-- order_total == 225.00
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `env` | `any` | Variablenumgebung für den Ausdruck; optional und üblicherweise eine Tabelle |

**Gibt zurück:** `any, error`

## Eingebaute Funktionen

Expr-lang enthält eingebaute Funktionen für häufige Operationen:

```lua
local maximum, max_err = expr.eval("max(1, 5, 3)")
if max_err then
    return nil, max_err
end

local uppercase, upper_err = expr.eval('upper("hello")')
if upper_err then
    return nil, upper_err
end

local total, sum_err = expr.eval("sum(values)", {values = {1, 2, 3, 4}})
if sum_err then
    return nil, sum_err
end
-- maximum == 5, uppercase == "HELLO", and total == 10
```

Weitere eingebaute Funktionen sind `min`, `abs`, `ceil`, `floor`, `len`, `lower` und `trim`. Expr-lang stellt außerdem Operatoren wie `contains` für Zeichenketten und `in` für Mitgliedschaftstests bereit.

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Ausdruck ist leer | `errors.INVALID` | nein |
| Ausdruck-Syntax ungültig | `errors.INTERNAL` | nein |
| Ausdrucksauswertung schlägt fehl | `errors.INTERNAL` | nein |
| Ergebniskonvertierung schlägt fehl | `errors.INTERNAL` | nein |

Siehe [Fehlerbehandlung](../core/errors.md) für die Arbeit mit Fehlern.
