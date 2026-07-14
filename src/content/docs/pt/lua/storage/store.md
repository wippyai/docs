---
title: "Key-Value Store"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='io'/ <secondary-label ref='permissions'/"
---

# Key-Value Store
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Armazenamento key-value rapido com suporte a TTL. Ideal para cache, sessoes e estado temporario.

Para configuração de store, veja [Store](system/store.md).

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

| Parâmetro | Tipo | Descrição |
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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `key` | string | Chave |
| `value` | any | Valor (tabelas, strings, numeros, booleans) |
| `ttl` | number | TTL em segundos (opcional, 0 = sem expiração) |

**Retorna:** `boolean, error`

## Recuperando Valores

Obter um valor por chave:

```lua
local user = cache:get("user:123")
if not user then
    -- Chave não encontrada ou expirada
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `key` | string | Chave para recuperar |

**Retorna:** `any, error`

Retorna `nil` se chave não existe.

## Verificando Existencia

Verificar se uma chave existe sem recuperar:

```lua
if cache:has("lock:" .. resource_id) then
    return nil, errors.new("CONFLICT", "Resource is locked")
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `key` | string | Chave para verificar |

**Retorna:** `boolean, error`

## Deletando Chaves

Remover uma chave do store:

```lua
cache:delete("session:" .. session_id)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `key` | string | Chave para deletar |

**Retorna:** `boolean, error`

Retorna `true` se deletado, `false` se chave não existia.

## Lendo Metadados da Entrada

`entry` retorna o valor junto com sua `version` — uma string opaca usada para concorrência otimista:

```lua
local e, err = cache:entry("user:123")
if e then
    print(e.key, e.value, e.version)
end
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `key` | string | Chave para ler |

**Retorna:** `Entry, error` — `{key: string, value: any, version: string}`

## Listando Chaves

Listar entradas em ordem determinística de chave, com paginação:

```lua
local page, err = cache:list({ prefix = "session:", limit = 100 })
for _, e in ipairs(page.items) do
    print(e.key, e.value)
end

-- próxima página
if page.has_more then
    page = cache:list({ prefix = "session:", after = page.cursor })
end
```

| Opção | Tipo | Descrição |
|-------|------|-----------|
| `prefix` | string | Apenas chaves com este prefixo |
| `after` | string | Continuar após este cursor (de uma página anterior) |
| `limit` | integer | Máximo de itens por página |

**Retorna:** `Page, error` — `{items: Entry[], cursor: string, has_more: boolean}`

## Escritas Condicionais

`put` escreve um valor e retorna sua nova `Entry`. As opções habilitam concorrência otimista:

```lua
-- cria apenas se a chave não existir
local e, err = cache:put("lock:job-1", owner, { only_if_absent = true })
if err and err:kind() == "ALREADY_EXISTS" then
    -- outra pessoa a detém
end

-- compare-and-set: escreve apenas se a versão ainda corresponder
local cur = cache:entry("config")
local e2, err2 = cache:put("config", new_value, { if_version = cur.version })
if err2 and err2:kind() == "CONFLICT" then
    -- um escritor concorrente a alterou; releia e tente novamente
end
```

| Opção | Tipo | Descrição |
|-------|------|-----------|
| `ttl` | number | TTL em segundos |
| `only_if_absent` | boolean | Escreve apenas se a chave não existir |
| `if_version` | string | Escreve apenas se a versão atual corresponder |

`only_if_absent` e `if_version` são mutuamente exclusivos.

**Retorna:** `Entry, error`

<warning>
Escritas condicionais exigem um store cujo <code>info().conditional_put</code> seja true (os stores de memória e <code>store.kv.raft</code>). Em <code>store.kv.crdt</code> e <code>store.sql</code> elas retornam um erro <code>errors.INVALID</code> — use <code>store.kv.raft</code> quando precisar de escritas condicionais.
</warning>

## Capacidades do Store

`info` informa o backend e o que ele suporta, para que o código possa se adaptar a qualquer store vinculado:

```lua
local info = cache:info()
-- info.backend      -> um de store.backend.* (ex.: "kv.raft")
-- info.consistency  -> um de store.consistency.* (ex.: "linearizable")
-- info.durable / info.list / info.versioned / info.conditional_put / info.ttl  (booleans)
```

**Retorna:** `Info, error` — `{id, backend, consistency, durable, list, versioned, conditional_put, ttl}`

### Constantes

| Constante | Valores |
|-----------|---------|
| `store.backend` | `MEMORY`, `SQL`, `KV_RAFT`, `KV_CRDT`, `UNKNOWN` |
| `store.consistency` | `LINEARIZABLE`, `EVENTUAL`, `LOCAL`, `UNKNOWN` |

```lua
if cache:info().consistency == store.consistency.LINEARIZABLE then
    -- seguro usar compare-and-set
end
```

## Métodos do Store

| Método | Retorna | Descrição |
|--------|---------|-----------|
| `get(key)` | `any, error` | Recuperar valor por chave |
| `entry(key)` | `Entry, error` | Recuperar valor com metadados de versão |
| `set(key, value, ttl?)` | `boolean, error` | Armazenar valor com TTL opcional |
| `put(key, value, opts?)` | `Entry, error` | Escrita condicional/versionada, retorna a nova entrada |
| `list(opts?)` | `Page, error` | Listagem paginada em ordem de chave |
| `has(key)` | `boolean, error` | Verificar se chave existe |
| `delete(key)` | `boolean, error` | Remover chave |
| `info()` | `Info, error` | Backend, consistência e flags de capacidade |
| `release()` | `boolean` | Liberar store de volta ao pool |

## Permissões

Operações de store estao sujeitas a avaliação de política de segurança.

| Ação | Recurso | Atributos | Descrição |
|------|---------|-----------|-----------|
| `store.get` | ID do Store | - | Adquirir um recurso store |
| `store.key.get` | ID do Store | `key` | Ler valor de uma chave |
| `store.key.set` | ID do Store | `key` | Escrever valor de uma chave |
| `store.key.delete` | ID do Store | `key` | Deletar uma chave |
| `store.key.has` | ID do Store | `key` | Verificar existencia de chave |

## Erros

`store.get()` e todos os métodos do handle do store (`get`, `set`, `has`, `delete`) retornam erros estruturados (use `err:kind()`).

| Condição | Tipo | Retentável |
|----------|------|------------|
| ID de recurso vazio | `errors.INVALID` | não |
| Recurso não encontrado | `errors.NOT_FOUND` | não |
| Store liberado | `errors.INVALID` | não |
| Permissão negada | `errors.PERMISSION_DENIED` | não |
| `only_if_absent` e chave existe | `errors.ALREADY_EXISTS` | não |
| Divergência de `if_version` | `errors.CONFLICT` | sim |
| Escrita condicional em store sem suporte | `errors.INVALID` | não |

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.
