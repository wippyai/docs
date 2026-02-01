# Entry Registry
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Consulte e modifique entradas registradas. Acesse metadados, snapshots e historico de versoes.

## Carregamento

```lua
local registry = require("registry")
```

## Estrutura de Entry

```lua
{
    id = "app.lib:assert",     -- string: "namespace:name"
    kind = "function.lua",     -- string: tipo da entrada
    meta = {type = "test"},    -- table: metadados pesquisaveis
    data = {...}               -- any: payload da entrada
}
```

## Obter Entry

```lua
local entry, err = registry.get("app.lib:assert")
```

**Permissao:** `registry.get` no ID da entrada

## Encontrar Entries

```lua
local entries, err = registry.find({kind = "function.lua"})
local entries, err = registry.find({kind = "http.endpoint", namespace = "app.api"})
```

Campos de filtro correspondem aos metadados da entrada.

## Parse de ID

```lua
local id = registry.parse_id("app.lib:assert")
-- id.ns = "app.lib", id.name = "assert"
```

## Snapshots

Visao point-in-time do registry:

```lua
local snap, err = registry.snapshot()           -- estado atual
local snap, err = registry.snapshot_at(5)       -- na versao 5
```

### Metodos de Snapshot

| Metodo | Retorna | Descricao |
|--------|---------|-----------|
| `snap:entries()` | `Entry[], error` | Todas as entradas acessiveis |
| `snap:get(id)` | `Entry, error` | Entrada unica por ID |
| `snap:find(filter)` | `Entry[]` | Filtrar entradas |
| `snap:namespace(ns)` | `Entry[]` | Entradas no namespace |
| `snap:version()` | `Version` | Versao do snapshot |
| `snap:changes()` | `Changes` | Criar changeset |

## Versoes

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- ID numerico
print(version:string())   -- string de exibicao
local prev = version:previous()  -- versao anterior ou nil
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

**Permissao:** `registry.apply` para `changes:apply()`

### Metodos de Changes

| Metodo | Descricao |
|--------|-----------|
| `changes:create(entry)` | Adicionar operacao create |
| `changes:update(entry)` | Adicionar operacao update |
| `changes:delete(id)` | Adicionar operacao delete (string ou `{ns, name}`) |
| `changes:ops()` | Obter operacoes pendentes |
| `changes:apply()` | Aplicar mudancas, retorna nova Version |

## Aplicar Versao

Rollback ou forward para uma versao especifica:

```lua
local prev = current_version:previous()
local ok, err = registry.apply_version(prev)
```

**Permissao:** `registry.apply_version`

## Construir Delta

Computar operacoes para transicao entre estados:

```lua
local from = {{id = "test:a", kind = "test", meta = {}, data = {}}}
local to = {{id = "test:b", kind = "test", meta = {}, data = {}}}

local ops, err = registry.build_delta(from, to)
for _, op in ipairs(ops) do
    print(op.kind, op.entry.id)  -- "entry.create", "entry.update", "entry.delete"
end
```

## Permissoes

| Permissao | Recurso | Descricao |
|-----------|---------|-----------|
| `registry.get` | ID da entrada | Ler entrada (tambem filtra resultados de find/entries) |
| `registry.apply` | - | Aplicar changeset |
| `registry.apply_version` | - | Aplicar/rollback versao |

## Erros

| Condicao | Tipo |
|----------|------|
| Entrada nao encontrada | `errors.NOT_FOUND` |
| Versao nao encontrada | `errors.NOT_FOUND` |
| Permissao negada | `errors.PERMISSION_DENIED` |
| Parametro invalido | `errors.INVALID` |
| Sem mudancas para aplicar | `errors.INVALID` |
| Registry nao disponivel | `errors.INTERNAL` |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
