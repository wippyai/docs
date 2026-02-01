# Request Context
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Acessa valores de contexto com escopo de requisicao. Contexto e definido via [Funcs](lua-funcs.md) ou [Process](lua-process.md).

## Carregamento

```lua
local ctx = require("ctx")
```

## Acesso ao Contexto

### Obter Valor

```lua
local value, err = ctx.get("key")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `key` | string | Chave do contexto |

**Retorna:** `any, error`

### Obter Todos os Valores

```lua
local values, err = ctx.all()
```

**Retorna:** `table, error`

## Erros

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| Chave vazia | `errors.INVALID` | nao |
| Chave nao encontrada | `errors.NOT_FOUND` | nao |
| Nenhum contexto disponivel | `errors.INTERNAL` | nao |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
