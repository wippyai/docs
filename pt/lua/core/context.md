---
title: "Contexto da Requisição"
description: "Leia valores com escopo de requisição propagados por chamadas de funções e processos."
---

# Contexto da Requisição
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

O módulo `ctx` lê valores com escopo de requisição propagados por [chamadas de funções](lua/core/funcs.md) ou [operações de processos](lua/core/process.md). Esta página é uma referência de API; os trechos mostram chamadas individuais dentro de uma entrada Lua executável.

## Carregamento

```lua
local ctx = require("ctx")
```

## Acesso ao Contexto

### Obter um Valor

```lua
local value, err = ctx.get("key")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `key` | string | Chave do contexto |

**Retorna:** `any, error`

### Obter Todos os Valores

```lua
local values, err = ctx.all()
```

**Retorna:** `table, error`

`ctx.all()` retorna uma tabela vazia quando há um contexto de execução sem valores de requisição. Quando não há contexto de execução, retorna `nil, errors.INTERNAL`.

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Chave vazia | `errors.INVALID` | não |
| Chave não encontrada | `errors.NOT_FOUND` | não |
| Nenhum contexto de execução disponível | `errors.INTERNAL` | não |

Veja [Tratamento de Erros](lua/core/errors.md) para trabalhar com erros.
