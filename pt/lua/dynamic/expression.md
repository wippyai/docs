# Linguagem de Expressao
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Avalie expressoes dinamicas usando a sintaxe [expr-lang](https://expr-lang.org/). Compile e execute expressoes seguras para filtragem, validação e avaliação de regras sem execução Lua completa.

## Configuração

O cache de expressoes e configurado no boot:

```yaml
lua:
  expr:
    cache_enabled: true   # Habilitar cache de expressoes
    capacity: 5000        # Capacidade do cache
```

## Carregamento

```lua
local expr = require("expr")
```

## Avaliando Expressoes

Avaliar uma string de expressao e retornar o resultado. Usa cache LRU interno para expressoes compiladas:

```lua
-- Matematica simples
local result = expr.eval("1 + 2 * 3")  -- 7

-- Com variaveis
local total = expr.eval("price * quantity", {
    price = 29.99,
    quantity = 3
})  -- 89.97

-- Expressoes booleanas
local is_adult = expr.eval("age >= 18", {age = 21})  -- true

-- Operações com string
local greeting = expr.eval('name + " is " + status', {
    name = "Alice",
    status = "online"
})  -- "Alice is online"

-- Operador ternario
local label = expr.eval('score > 90 ? "A" : score > 80 ? "B" : "C"', {
    score = 85
})  -- "B"

-- Operações com array
local has_admin = expr.eval('"admin" in roles', {
    roles = {"user", "admin", "viewer"}
})  -- true
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `expression` | string | Expressao em sintaxe expr-lang |
| `env` | table | Ambiente de variaveis para expressao (opcional) |

**Retorna:** `any, error`

## Compilando Expressoes

Compilar uma expressao em um objeto Program reutilizavel para avaliação repetida:

```lua
-- Compilar uma vez para uso repetido
local discount_calc, err = expr.compile("price * (1 - discount_rate)")
if err then
    return nil, err
end

-- Reutilizar com diferentes inputs
local price1 = discount_calc:run({price = 100, discount_rate = 0.1})  -- 90
local price2 = discount_calc:run({price = 50, discount_rate = 0.2})   -- 40
local price3 = discount_calc:run({price = 200, discount_rate = 0.15}) -- 170
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `expression` | string | Expressao em sintaxe expr-lang |
| `env` | table | Ambiente de tipos para compilação (opcional) |

**Retorna:** `Program, error`

## Executando Programas Compilados

Executar uma expressao compilada com ambiente fornecido:

```lua
-- Regra de validação
local validator, _ = expr.compile("len(password) >= 8 and len(password) <= 128")

local valid1 = validator:run({password = "short"})       -- false
local valid2 = validator:run({password = "securepass123"}) -- true

-- Regra de precificação
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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `env` | table | Ambiente de variaveis para expressao (opcional) |

**Retorna:** `any, error`

## Funções Built-in

Expr-lang fornece muitas funções built-in:

```lua
-- Funções matematicas
expr.eval("max(1, 5, 3)")        -- 5
expr.eval("min(10, 2, 8)")       -- 2
expr.eval("abs(-42)")            -- 42
expr.eval("ceil(3.2)")           -- 4
expr.eval("floor(3.8)")          -- 3

-- Funções de string
expr.eval('len("hello")')        -- 5
expr.eval('upper("hello")')      -- "HELLO"
expr.eval('lower("HELLO")')      -- "hello"
expr.eval('trim("  hi  ")')      -- "hi"
expr.eval('contains("hello", "ell")')  -- true

-- Funções de array
expr.eval("len(items)", {items = {1,2,3}})  -- 3
expr.eval("sum(values)", {values = {1,2,3,4}})  -- 10
```

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Expressao vazia | `errors.INVALID` | não |
| Sintaxe de expressao invalida | `errors.INTERNAL` | não |
| Avaliação de expressao falhou | `errors.INTERNAL` | não |
| Conversao de resultado falhou | `errors.INTERNAL` | não |

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.
