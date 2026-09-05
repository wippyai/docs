---
title: "Entry Registry"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='permissions'/"
---

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

Entradas lidas de volta por `registry.get`, `registry.find`, `snap:entries()`, `snap:get()`, `snap:namespace()` e `snap:find()` carregam apenas esses quatro campos voltados ao autor.

`dependency_root` e um campo de escrita aceito por `changes:create()` e `changes:update()`. E um booleano que marca uma entrada `ns.dependency` como raiz de deployment. Ele nunca e retornado pelas APIs de entrada; o estado de propriedade do registry e lido atraves de [`snap:state()`](lua/core/registry.md#snapshot-state).

## Obter Entry

```lua
local entry, err = registry.get("app.lib:assert")
```

**Permissão:** `registry.get` no ID da entrada

## Encontrar Entries

```lua
local entries, err = registry.find({[".kind"] = "function.lua"})
local entries, err = registry.find({[".kind"] = "http.endpoint", [".ns"] = "app.api"})
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
local snap, err = registry.snapshot_at(5)       -- na versão 5
```

### Métodos de Snapshot

| Método | Retorna | Descrição |
|--------|---------|-----------|
| `snap:entries()` | `Entry[], error` | Todas as entradas acessiveis |
| `snap:state()` | `State, error` | Entradas com metadados de propriedade do registry, mais o grafo de modulos resolvido |
| `snap:get(id)` | `Entry, error` | Entrada unica por ID |
| `snap:find(filter)` | `Entry[]` | Filtrar entradas |
| `snap:namespace(ns)` | `Entry[]` | Entradas no namespace |
| `snap:version()` | `Version` | Versão do snapshot |
| `snap:changes()` | `Changes` | Criar changeset |

### Estado do Snapshot

`snap:state()` retorna o estado das entradas junto com o grafo de modulos selecionado para a versao do snapshot. A proveniencia de propriedade do registry e carregada em cada entrada em vez de mesclada em `meta`, entao nao pode ser confundida com metadados escritos pelo autor.

```lua
local snap, err = registry.snapshot()
local state, err = snap:state()

for _, entry in ipairs(state.entries) do
    print(entry.id, entry.registry.owner, entry.registry.root)
end

if state.resolution then
    print(state.resolution.digest, state.resolution.input_digest)
    for _, module in ipairs(state.resolution.modules) do
        print(module.name, module.version)
    end
end
```

Cada entrada em `state.entries` tem os quatro campos voltados ao autor mais:

- `registry.owner` - fonte de deployment que forneceu a entrada
- `registry.root` - `true` quando a entrada e uma declaracao de dependencia selecionada pelo deployment

`state.resolution` descreve o grafo de modulos de uma visao `registry.snapshot()`. Esta ausente em snapshots que nao carregam um grafo proprio, incluindo `registry.snapshot_at()` e snapshots de overlay:

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `digest` | string | Digest de conteudo da selecao imutavel completa |
| `input_digest` | string | Digest do conjunto de raizes declarado |
| `baseline_digest` | string | Digest da baseline de deployment contra a qual o grafo foi resolvido; omitido quando nao vinculado |
| `roots` | array | Declaracoes de dependencia escritas usadas como entradas do solver |
| `references` | array | Declaracoes em forma de raiz agrupadas em uma raiz existente para o mesmo componente; omitido quando vazio |
| `modules` | array | Modulos selecionados |

Entradas de `roots` e `references` tem `id`, `component` e `version`. Entradas de `modules` tem `name` e `version`, mais `version_id`, `source`, `digest`, `size_bytes` e `protected` quando definidos.

## Versoes

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- ID numerico
print(version:string())   -- string de exibicao
local prev = version:previous()  -- versão anterior ou nil
local next = version:next()      -- próxima versão ou nil
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

### Deletando Entradas

`changes:delete()` aceita uma string de ID, uma tabela com uma string `id`, uma tabela com strings `ns` e `name`, ou um array de qualquer um desses. Arrays podem ser aninhados, e IDs duplicados colapsam em uma unica operacao de delete.

```lua
changes:delete("test:old_entry")
changes:delete({id = "test:old_entry"})
changes:delete({ns = "test", name = "old_entry"})
changes:delete({"test:a", {ns = "test", name = "b"}, {"test:c"}})
```

Uma lista vazia, uma tabela que referencia a si mesma, e um valor que nao e nem string nem tabela sao rejeitados com `errors.INVALID`.

### Métodos de Changes

| Método | Descrição |
|--------|-----------|
| `changes:create(entry)` | Adicionar operação create |
| `changes:update(entry)` | Adicionar operação update |
| `changes:delete(id)` | Adicionar operação delete |
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

## Overlays

Um overlay e um conjunto de entradas do registry local ao processo, pertencente a uma identidade logica. Entradas de overlay participam da topologia comum e das transicoes de handler, entao servicos iniciam e param para elas exatamente como para entradas duraveis, mas elas nunca avancam o historico do registry e nunca aparecem em uma versao. Elas existem apenas no processo em execucao e ficam vazias apos um cold boot, entao o servico de controle proprietario as reconcilia na inicializacao.

```lua
local snap, err = registry.overlay("data-sources:crm")
```

**Retorna:** `Snapshot, error`

O snapshot expoe as entradas de overlay do owner atraves dos metodos usuais e reporta a versao atual do registry em `snap:version()`. Ele tambem captura a geracao do overlay no momento em que e aberto, que e o que torna as escritas seguras.

```lua
local snap, err = registry.overlay("data-sources:crm")
if err then return nil, err end

local changes = snap:changes()
changes:create({
    id = "data.crm:connection",
    kind = "registry.entry",
    meta = {},
    data = {endpoint = "https://crm.internal"}
})

local version, err = changes:apply()
```

`changes:apply()` em um snapshot de overlay escreve o overlay e retorna a versao atual do registry. Nenhuma versao de historico e criada, entao a versao retornada permanece inalterada a menos que uma mudanca duravel tenha ocorrido concorrentemente.

### Concorrencia

Cada overlay carrega um contador de geracao que aumenta a cada aplicacao bem-sucedida. `changes:apply()` so tem sucesso se a geracao ainda corresponder a que foi capturada quando o snapshot foi aberto. Uma aplicacao concorrente ao mesmo overlay falha com `errors.CONFLICT` marcado como retentavel: reabra o overlay e reconstrua o changeset.

```lua
local last_err
for _ = 1, 3 do
    local snap, err = registry.overlay("data-sources:crm")
    if err then return nil, err end

    local _, apply_err = snap:changes():delete("data.crm:connection"):apply()
    if not apply_err then return true end
    if not apply_err:retryable() then return nil, apply_err end
    last_err = apply_err
end
return nil, last_err
```

### Restricoes

- A string de owner e obrigatoria e nao pode estar em branco.
- Um changeset deve ser nao vazio e nao pode nomear a mesma entrada duas vezes.
- `create` falha quando o ID ja existe no estado duravel ou em qualquer overlay.
- `update` e `delete` so funcionam em entradas que este owner criou.
- Entradas de overlay nao podem definir `dependency_root` nem qualquer outro metadado de propriedade do registry.
- Entradas de overlay nao podem usar kinds pertencentes a uma diretiva do registry, como `ns.dependency`.
- Um delete que remove uma entrada da qual uma entrada sobrevivente depende e rejeitado.
- Dependencias nao podem cruzar fronteiras de owner de overlay, e entradas duraveis nao podem depender de entradas de overlay.

Todas essas se manifestam como `errors.CONFLICT` ou `errors.INVALID`, e nenhuma e retentavel: apenas a divergencia de geracao acima e.

**Permissões:** `registry.overlay.get` no owner para abrir e ler, `registry.overlay.apply` no owner para escrever, e `registry.overlay.<create|update|delete>.<kind>` em cada ID de entrada no changeset.

## Permissões

| Permissão | Recurso | Descrição |
|-----------|---------|-----------|
| `registry.get` | ID da entrada | Ler entrada (também filtra resultados de find/entries) |
| `registry.apply` | - | Aplicar changeset |
| `registry.apply_version` | - | Aplicar/rollback versão |
| `registry.overlay.get` | ID do owner | Abrir e ler um snapshot de overlay |
| `registry.overlay.apply` | ID do owner | Aplicar um changeset de overlay |
| `registry.overlay.create.<kind>` | ID da entrada | Criar uma entrada de overlay desse kind |
| `registry.overlay.update.<kind>` | ID da entrada | Atualizar uma entrada de overlay desse kind |
| `registry.overlay.delete.<kind>` | ID da entrada | Deletar uma entrada de overlay desse kind |

## Erros

| Condição | Tipo |
|----------|------|
| Entrada não encontrada | `errors.NOT_FOUND` |
| Versão não encontrada | `errors.NOT_FOUND` |
| Permissão negada | `errors.PERMISSION_DENIED` |
| Parâmetro inválido | `errors.INVALID` |
| Sem mudancas para aplicar | `errors.INVALID` |
| Overlay alterado durante a aplicação | `errors.CONFLICT` (retentável) |
| Entrada de overlay pertencente a outro owner ou em conflito com o estado durável | `errors.CONFLICT` |
| Registry não disponível | `errors.INTERNAL` |

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.
