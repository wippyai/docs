---
title: "Entry Registry"
description: "Leia entradas e metadados do registro, inspecione versões e snapshots e aplique changesets."
---

# Entry Registry
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

O módulo `registry` lê e modifica entradas e fornece acesso a snapshots e ao histórico de versões. Esta página é uma referência de API; os exemplos de mutação usam IDs ilustrativos e exigem políticas que autorizem exatamente esses recursos e tipos de entrada.

## Carregamento

```lua
local registry = require("registry")
```

## Estrutura de Entry

```lua
{
    id = "app.lib:assert",     -- string: "namespace:name"
    kind = "function.lua",     -- string: entry type
    meta = {type = "test"},    -- table: searchable metadata
    data = {...}               -- any: entry payload
}
```

## Obter uma Entrada

```lua
local entry, err = registry.get("app.lib:assert")
```

**Permissão:** `registry.get` no ID da entrada

## Encontrar Entries

```lua
local entries, err = registry.find({[".kind"] = "function.lua"})
local entries, err = registry.find({[".kind"] = "http.endpoint", [".ns"] = "app.api"})
```

Os seletores raiz são `.kind`, `.name`, `.ns` e `.id`; seus valores aceitam correspondência por glob. Filtros de metadados usam o prefixo `meta.`, por exemplo `{["meta.type"] = "test"}`.

## Parse de ID

```lua
local id = registry.parse_id("app.lib:assert")
-- id.ns = "app.lib", id.name = "assert"
```

## Snapshots

Visao point-in-time do registry:

```lua
local snap, err = registry.snapshot()           -- current state
local snap, err = registry.snapshot_at(5)       -- at version 5
```

### Métodos de Snapshot

| Método | Retorna | Descrição |
|--------|---------|-----------|
| `snap:entries()` | `Entry[], error` | Todas as entradas acessiveis |
| `snap:get(id)` | `Entry, error` | Entrada unica por ID |
| `snap:find(filter)` | `Entry[]` | Filtrar entradas |
| `snap:namespace(ns)` | `Entry[]` | Entradas no namespace |
| `snap:version()` | `Version` | Versão do snapshot |
| `snap:changes()` | `Changes` | Criar changeset |

## Overlays Locais ao Processo

`registry.overlay(owner_id)` abre um overlay local ao processo para um proprietário lógico. Ele retorna um snapshot normal do registro efetivo; crie um changeset a partir desse snapshot e aplique-o da mesma forma que uma alteração durável:

```lua
local snap, err = registry.overlay("controllers:customer-db")
if err then
    return nil, err
end

local changes = snap:changes()
changes:create({
    id = "runtime.data_sources:customer-db",
    kind = "db.sql.postgres",
    data = {host = "db.example.com", database = "customer"}
})

local current_version, err = changes:apply()
```

As alterações do overlay afetam a topologia e os recursos do registro neste processo, mas não criam versões duráveis no histórico. Por isso, `changes:apply()` retorna a versão durável atual sem alteração. Um overlay sobrevive a commits normais de histórico e à seleção de versões; ele é limpo por um cold boot ou carregamento explícito do estado do registro e depois reconciliado por seu proprietário.

Os snapshots de overlay usam concorrência otimista baseada em geração. Aplicar alterações de um snapshot obsoleto falha atomicamente com `errors.CONFLICT` retentável; reabra o overlay e reconstrua o changeset. Um changeset pode conter no máximo uma operação por ID de entrada. Os IDs de proprietário são normalizados para sua identidade canônica. O proprietário faz parte do estado do registro, não dos metadados da entrada, e tipos de entrada controlados por diretivas de expansão não podem ser alterados por um overlay.

Chamadas regulares de `registry.get`, `find` e `snapshot` veem o registro efetivo composto e continuam exigindo `registry.get` para cada entrada; a permissão de overlay no nível do proprietário não substitui a autorização de leitura.

## Versoes

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- numeric ID
print(version:string())   -- display string
local prev = version:previous()  -- previous version or nil
local next = version:next()      -- next version or nil
```

## Historico

```lua
local hist, err = registry.history()
local versions, err = hist:versions()
local version, err = hist:get_version(5)
local snap, err = hist:snapshot_at(version)
```

## Changesets

Construir e aplicar modificacoes:

```lua
local snap, err = registry.snapshot()
local changes = snap:changes()

changes:create({
    id = "test:new_entry",
    kind = "test.kind",
    meta = {type = "test"},
    data = {config = "value"}
})

changes:update({
    id = "test:existing",
    kind = "test.kind",
    meta = {updated = true},
    data = {new_value = true}
})

changes:delete("test:old_entry")

local new_version, err = changes:apply()
```

**Permissão:** `registry.apply` para `changes:apply()`

### Métodos de Changes

| Método | Descrição |
|--------|-----------|
| `changes:create(entry)` | Adicionar operação create |
| `changes:update(entry)` | Adicionar operação update |
| `changes:delete(id)` | Adicionar operação delete (string ou `{ns, name}`) |
| `changes:ops()` | Obter operações pendentes |
| `changes:apply()` | Aplicar mudancas, retorna nova Version |

## Aplicar Versão

Rollback ou forward para uma versão específica:

```lua
local prev = current_version:previous()
local ok, err = registry.apply_version(prev)
```

**Permissão:** `registry.apply_version`

## Construir Delta

Computar operações para transicao entre estados:

```lua
local from = {{id = "test:a", kind = "test", meta = {}, data = {}}}
local to = {{id = "test:b", kind = "test", meta = {}, data = {}}}

local ops, err = registry.build_delta(from, to)
for _, op in ipairs(ops) do
    print(op.kind, op.entry.id)  -- "entry.create", "entry.update", "entry.delete"
end
```

## Permissões

| Permissão | Recurso | Descrição |
|-----------|---------|-----------|
| `registry.get` | ID da entrada | Ler entrada (também filtra resultados de find/entries) |
| `registry.apply` | - | Aplicar changeset |
| `registry.apply_version` | - | Aplicar/rollback versão |
| `registry.overlay.get` | ID do proprietário | Abrir o overlay de um proprietário |
| `registry.overlay.apply` | ID do proprietário | Aplicar um changeset de overlay |
| `registry.overlay.create.<kind>` | ID da entrada | Criar uma entrada do tipo indicado em um overlay |
| `registry.overlay.update.<kind>` | ID da entrada | Atualizar uma entrada do tipo indicado em um overlay |
| `registry.overlay.delete.<kind>` | ID da entrada | Excluir uma entrada do tipo indicado em um overlay |

## Erros

| Condição | Tipo |
|----------|------|
| Entrada não encontrada | `errors.NOT_FOUND` |
| Versão não encontrada | `errors.NOT_FOUND` |
| Permissão negada | `errors.PERMISSION_DENIED` |
| Parâmetro inválido | `errors.INVALID` |
| Sem mudanças para aplicar | `errors.INVALID` |
| Proprietário do overlay vazio ou tipo controlado por diretiva | `errors.INVALID` |
| Snapshot de overlay obsoleto | `errors.CONFLICT` (retentável) |
| Registry não disponível | `errors.INTERNAL` |

Veja [Tratamento de Erros](./errors.md) para trabalhar com erros.
