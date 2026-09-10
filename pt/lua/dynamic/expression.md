---
title: "Linguagem de Expressão"
description: "Avalie expressões dinâmicas usando a sintaxe expr-lang. Compile e execute expressões seguras para filtragem, validação e avaliação de regras sem…"
---

# Linguagem de Expressão
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Avalie expressões dinâmicas usando a sintaxe [expr-lang](https://expr-lang.org/). Compile e execute expressões seguras para filtragem, validação e avaliação de regras sem execução Lua completa.

## Cache

`expr.eval` mantém um cache LRU interno de expressões compiladas (capacidade padrão 1000). O cache é embutido no módulo e não requer configuração.

## Carregamento

```lua
local expr = require("expr")
```

## Avaliando Expressões

Avaliar uma string de expressão e retornar o resultado. Usa cache LRU interno para expressões compiladas:

```lua
-- Matemática simples
local result = expr.eval("1 + 2 * 3")  -- 7

-- Com variáveis
local total = expr.eval("price * quantity", {
    price = 29.99,
    quantity = 3
})
if total_err then
    return nil, total_err
end
-- total == 89.97

-- Expressões booleanas
local is_adult = expr.eval("age >= 18", {age = 21})  -- true

-- Operações com string
local greeting = expr.eval('name + " is " + status', {
    name = "Alice",
    status = "online"
})  -- "Alice is online"

-- Operador ternário
local label = expr.eval('score > 90 ? "A" : score > 80 ? "B" : "C"', {
    score = 85
})
if label_err then
    return nil, label_err
end
-- label == "B"
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `expression` | string | Expressão em sintaxe expr-lang |
| `env` | table | Ambiente de variáveis para expressão (opcional) |

**Retorna:** `any, error`

## Compilando Expressões

Compilar uma expressão em um objeto Program reutilizável para avaliação repetida:

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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `expression` | string | Expressão em sintaxe expr-lang |
| `env` | table | Ambiente de tipos para compilação (opcional) |

**Retorna:** `Program, error`

## Executando Programas Compilados

Executar uma expressão compilada com ambiente fornecido:

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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `env` | table | Ambiente de variáveis para expressão (opcional) |

**Retorna:** `any, error`

## Funções Built-in

Expr-lang fornece muitas funções built-in:

```lua
-- Funções matemáticas
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
expr.eval('"hello" contains "ell"')  -- true

local total, sum_err = expr.eval("sum(values)", {values = {1, 2, 3, 4}})
if sum_err then
    return nil, sum_err
end
-- maximum == 5, uppercase == "HELLO", and total == 10
```

Outras funções integradas incluem `min`, `abs`, `ceil`, `floor`, `len`, `lower` e `trim`. Expr-lang também oferece operadores como `contains` para strings e `in` para testes de pertencimento.

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Expressão vazia | `errors.INVALID` | não |
| Sintaxe de expressão inválida | `errors.INTERNAL` | não |
| Avaliação de expressão falhou | `errors.INTERNAL` | não |
| Conversão de resultado falhou | `errors.INTERNAL` | não |

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.
