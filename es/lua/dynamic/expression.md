---
title: "Lenguaje de expresiones"
description: "Compila y evalúa expresiones expr-lang desde Lua."
---

# Lenguaje de expresiones
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

El módulo `expr` compila y evalúa expresiones [expr-lang](https://expr-lang.org/) para
filtrado, validación, cálculos y reglas sin ejecutar código fuente Lua. Esta página es
la referencia canónica de la API Lua; los ejemplos se ejecutan dentro de un proceso
Lua Wippy existente cuya entrada declara `expr`, pero no son aplicaciones Wippy
independientes. Consulta [Evaluación dinámica](./eval.md) al elegir entre expresiones
y Lua con capacidades restringidas.

## Carga

```lua
local expr = require("expr")
```

## Caché

`expr.eval` conserva una caché LRU interna de expresiones compiladas (capacidad
predeterminada 1000). Está integrada en el módulo y no requiere configuración.

## Evaluar Expresiones

Evaluar un string de expresion y devolver el resultado. Usa cache LRU interno para expresiones compiladas:

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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `expression` | string | Expresion en sintaxis expr-lang |
| `env` | `any` | Entorno de variables (opcional; normalmente una tabla) |

**Devuelve:** `any, error`

## Compilar Expresiones

Compila una expresión en un objeto `Program` reutilizable para evaluaciones repetidas:

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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `expression` | string | Expresion en sintaxis expr-lang |
| `env` | `any` | Entorno de pistas de tipo (opcional; normalmente una tabla) |

**Devuelve:** `Program, error`

## Ejecutar Programas Compilados

Ejecutar una expresion compilada con entorno proporcionado:

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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `env` | `any` | Entorno de variables (opcional; normalmente una tabla) |

**Devuelve:** `any, error`

## Funciones Integradas

Expr-lang incluye funciones integradas para operaciones comunes:

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

Otras funciones integradas son `min`, `abs`, `ceil`, `floor`, `len`, `lower` y
`trim`. Expr-lang también proporciona operadores como `contains` para strings e
`in` para comprobar pertenencia.

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Expresion vacia | `errors.INVALID` | no |
| Sintaxis de expresion invalida | `errors.INTERNAL` | no |
| Evaluacion de expresion falla | `errors.INTERNAL` | no |
| Conversion de resultado falla | `errors.INTERNAL` | no |

Consulta [Manejo de errores](lua/core/errors.md) para trabajar con errores.
