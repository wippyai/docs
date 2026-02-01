# Lenguaje de Expresiones
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Evaluar expresiones dinamicas usando sintaxis [expr-lang](https://expr-lang.org/). Compilar y ejecutar expresiones seguras para filtrado, validacion y evaluacion de reglas sin ejecucion completa de Lua.

## Configuracion

El cache de expresiones se configura al inicio:

```yaml
lua:
  expr:
    cache_enabled: true   # Habilitar cache de expresiones
    capacity: 5000        # Capacidad del cache
```

## Carga

```lua
local expr = require("expr")
```

## Evaluar Expresiones

Evaluar un string de expresion y devolver el resultado. Usa cache LRU interno para expresiones compiladas:

```lua
-- Matematica simple
local result = expr.eval("1 + 2 * 3")  -- 7

-- Con variables
local total = expr.eval("price * quantity", {
    price = 29.99,
    quantity = 3
})  -- 89.97

-- Expresiones booleanas
local is_adult = expr.eval("age >= 18", {age = 21})  -- true

-- Operaciones de string
local greeting = expr.eval('name + " is " + status', {
    name = "Alice",
    status = "online"
})  -- "Alice is online"

-- Operador ternario
local label = expr.eval('score > 90 ? "A" : score > 80 ? "B" : "C"', {
    score = 85
})  -- "B"

-- Operaciones de array
local has_admin = expr.eval('"admin" in roles', {
    roles = {"user", "admin", "viewer"}
})  -- true
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `expression` | string | Expresion en sintaxis expr-lang |
| `env` | table | Entorno de variables para expresion (opcional) |

**Devuelve:** `any, error`

## Compilar Expresiones

Compilar una expresion en un objeto Program reutilizable para evaluacion repetida:

```lua
-- Compilar una vez para uso repetido
local discount_calc, err = expr.compile("price * (1 - discount_rate)")
if err then
    return nil, err
end

-- Reutilizar con diferentes entradas
local price1 = discount_calc:run({price = 100, discount_rate = 0.1})  -- 90
local price2 = discount_calc:run({price = 50, discount_rate = 0.2})   -- 40
local price3 = discount_calc:run({price = 200, discount_rate = 0.15}) -- 170
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `expression` | string | Expresion en sintaxis expr-lang |
| `env` | table | Entorno de pista de tipo para compilacion (opcional) |

**Devuelve:** `Program, error`

## Ejecutar Programas Compilados

Ejecutar una expresion compilada con entorno proporcionado:

```lua
-- Regla de validacion
local validator, _ = expr.compile("len(password) >= 8 and len(password) <= 128")

local valid1 = validator:run({password = "short"})       -- false
local valid2 = validator:run({password = "securepass123"}) -- true

-- Regla de precios
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

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `env` | table | Entorno de variables para expresion (opcional) |

**Devuelve:** `any, error`

## Funciones Integradas

Expr-lang proporciona muchas funciones integradas:

```lua
-- Funciones matematicas
expr.eval("max(1, 5, 3)")        -- 5
expr.eval("min(10, 2, 8)")       -- 2
expr.eval("abs(-42)")            -- 42
expr.eval("ceil(3.2)")           -- 4
expr.eval("floor(3.8)")          -- 3

-- Funciones de string
expr.eval('len("hello")')        -- 5
expr.eval('upper("hello")')      -- "HELLO"
expr.eval('lower("HELLO")')      -- "hello"
expr.eval('trim("  hi  ")')      -- "hi"
expr.eval('contains("hello", "ell")')  -- true

-- Funciones de array
expr.eval("len(items)", {items = {1,2,3}})  -- 3
expr.eval("sum(values)", {values = {1,2,3,4}})  -- 10
```

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| Expresion vacia | `errors.INVALID` | no |
| Sintaxis de expresion invalida | `errors.INTERNAL` | no |
| Evaluacion de expresion falla | `errors.INTERNAL` | no |
| Conversion de resultado falla | `errors.INTERNAL` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
