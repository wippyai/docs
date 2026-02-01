# Key-Value Store
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Armazenamento key-value rapido com suporte a TTL. Ideal para cache, sessoes e estado temporario.

Para configuracao de store, veja [Store](system-store.md).

## Carregamento

```lua
local store = require("store")
```

## Adquirindo um Store

Obter um recurso store por ID do registro:

```lua
local cache, err = store.get("app:cache")
if err then
    return nil, err
end

cache:set("user:123", {name = "Alice"}, 3600)
local user = cache:get("user:123")

cache:release()
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `id` | string | ID do recurso store |

**Retorna:** `Store, error`

## Armazenando Valores

Armazenar um valor com TTL opcional:

```lua
local cache = store.get("app:cache")

-- Set simples
cache:set("user:123:name", "Alice")

-- Set com TTL (expira em 300 segundos)
cache:set("session:abc", {user_id = 123, role = "admin"}, 300)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `key` | string | Chave |
| `value` | any | Valor (tabelas, strings, numeros, booleans) |
| `ttl` | number | TTL em segundos (opcional, 0 = sem expiracao) |

**Retorna:** `boolean, error`

## Recuperando Valores

Obter um valor por chave:

```lua
local user = cache:get("user:123")
if not user then
    -- Chave nao encontrada ou expirada
end
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `key` | string | Chave para recuperar |

**Retorna:** `any, error`

Retorna `nil` se chave nao existe.

## Verificando Existencia

Verificar se uma chave existe sem recuperar:

```lua
if cache:has("lock:" .. resource_id) then
    return nil, errors.new("CONFLICT", "Resource is locked")
end
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `key` | string | Chave para verificar |

**Retorna:** `boolean, error`

## Deletando Chaves

Remover uma chave do store:

```lua
cache:delete("session:" .. session_id)
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `key` | string | Chave para deletar |

**Retorna:** `boolean, error`

Retorna `true` se deletado, `false` se chave nao existia.

## Metodos do Store

| Metodo | Retorna | Descricao |
|--------|---------|-----------|
| `get(key)` | `any, error` | Recuperar valor por chave |
| `set(key, value, ttl?)` | `boolean, error` | Armazenar valor com TTL opcional |
| `has(key)` | `boolean, error` | Verificar se chave existe |
| `delete(key)` | `boolean, error` | Remover chave |
| `release()` | `boolean` | Liberar store de volta ao pool |

## Permissoes

Operacoes de store estao sujeitas a avaliacao de politica de seguranca.

| Acao | Recurso | Atributos | Descricao |
|------|---------|-----------|-----------|
| `store.get` | ID do Store | - | Adquirir um recurso store |
| `store.key.get` | ID do Store | `key` | Ler valor de uma chave |
| `store.key.set` | ID do Store | `key` | Escrever valor de uma chave |
| `store.key.delete` | ID do Store | `key` | Deletar uma chave |
| `store.key.has` | ID do Store | `key` | Verificar existencia de chave |

## Erros

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| ID de recurso vazio | `errors.INVALID` | nao |
| Recurso nao encontrado | `errors.NOT_FOUND` | nao |
| Store liberado | `errors.INVALID` | nao |
| Permissao negada | `errors.PERMISSION_DENIED` | nao |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
