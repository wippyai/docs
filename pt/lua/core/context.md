# Request Context
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Acessa valores de contexto com escopo de requisição. Contexto é definido via [Funcs](lua-funcs.md) ou [Process](lua-process.md).

## Carregamento

```lua
local ctx = require("ctx")
```

## Acesso ao Contexto

### Obter Valor

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

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Chave vazia | `errors.INVALID` | não |
| Chave não encontrada | `errors.NOT_FOUND` | não |
| Nenhum contexto disponível | `errors.INTERNAL` | não |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
