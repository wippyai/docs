# Expression Language
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Evaluate dynamic expressions using [expr-lang](https://expr-lang.org/) syntax. Compile and execute safe expressions for filtering, validation, and rule evaluation without full Lua execution.

## Configuration

Expression cache is configured at boot:

```yaml
lua:
  expr:
    cache_enabled: true   # Enable expression caching
    capacity: 5000        # Cache capacity
```

## Loading

```lua
local expr = require("expr")
```

## Evaluating Expressions

Evaluate an expression string and return the result. Uses internal LRU cache for compiled expressions:

```lua
-- Simple math
local result = expr.eval("1 + 2 * 3")  -- 7

-- With variables
local total = expr.eval("price * quantity", {
    price = 29.99,
    quantity = 3
})  -- 89.97

-- Boolean expressions
local is_adult = expr.eval("age >= 18", {age = 21})  -- true

-- String operations
local greeting = expr.eval('name + " is " + status', {
    name = "Alice",
    status = "online"
})  -- "Alice is online"

-- Ternary operator
local label = expr.eval('score > 90 ? "A" : score > 80 ? "B" : "C"', {
    score = 85
})  -- "B"

-- Array operations
local has_admin = expr.eval('"admin" in roles', {
    roles = {"user", "admin", "viewer"}
})  -- true
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `expression` | string | expr-lang syntax expression |
| `env` | table | Variable environment for expression (optional) |

**Returns:** `any, error`

## Compiling Expressions

Compile an expression into a reusable Program object for repeated evaluation:

```lua
-- Compile once for repeated use
local discount_calc, err = expr.compile("price * (1 - discount_rate)")
if err then
    return nil, err
end

-- Reuse with different inputs
local price1 = discount_calc:run({price = 100, discount_rate = 0.1})  -- 90
local price2 = discount_calc:run({price = 50, discount_rate = 0.2})   -- 40
local price3 = discount_calc:run({price = 200, discount_rate = 0.15}) -- 170
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `expression` | string | expr-lang syntax expression |
| `env` | table | Type hint environment for compilation (optional) |

**Returns:** `Program, error`

## Running Compiled Programs

Execute a compiled expression with provided environment:

```lua
-- Validation rule
local validator, _ = expr.compile("len(password) >= 8 and len(password) <= 128")

local valid1 = validator:run({password = "short"})       -- false
local valid2 = validator:run({password = "securepass123"}) -- true

-- Pricing rule
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

| Parameter | Type | Description |
|-----------|------|-------------|
| `env` | table | Variable environment for expression (optional) |

**Returns:** `any, error`

## Built-in Functions

Expr-lang provides many built-in functions:

```lua
-- Math functions
expr.eval("max(1, 5, 3)")        -- 5
expr.eval("min(10, 2, 8)")       -- 2
expr.eval("abs(-42)")            -- 42
expr.eval("ceil(3.2)")           -- 4
expr.eval("floor(3.8)")          -- 3

-- String functions
expr.eval('len("hello")')        -- 5
expr.eval('upper("hello")')      -- "HELLO"
expr.eval('lower("HELLO")')      -- "hello"
expr.eval('trim("  hi  ")')      -- "hi"
expr.eval('contains("hello", "ell")')  -- true

-- Array functions
expr.eval("len(items)", {items = {1,2,3}})  -- 3
expr.eval("sum(values)", {values = {1,2,3,4}})  -- 10
```

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Expression is empty | `errors.INVALID` | no |
| Expression syntax invalid | `errors.INTERNAL` | no |
| Expression evaluation fails | `errors.INTERNAL` | no |
| Result conversion fails | `errors.INTERNAL` | no |

See [Error Handling](lua/core/errors.md) for working with errors.

