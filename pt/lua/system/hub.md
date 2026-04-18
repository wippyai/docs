# Hub

Acesso somente leitura ao catálogo de módulos do Wippy Hub: listar módulos, pesquisar, obter metadados, versões, dependências e READMEs.

## Carregamento

```lua
local hub = require("hub")
```

## Opções por chamada

Cada chamada aceita uma tabela opcional de opções. Chaves comuns a todas as chamadas:

| Chave | Tipo | Descrição |
|-----|------|-------------|
| `registry` | string | Sobrescreve a URL do registry |
| `token` | string | Sobrescreve o token de API |
| `timeout` | duration/number | Tempo limite da requisição (por exemplo `"3m"` ou segundos) |

Chamadas com suporte a paginação também aceitam `page` e `page_size`.

## Módulos

```lua
local result, err = hub.modules.list({
    org = "wippy",
    visibility = "public",
    type = "library",
    sort_order = "downloads_desc",
    page = 1,
    page_size = 20,
})
-- result = { items, total, page, page_size }
```

| Função | Descrição |
|----------|-------------|
| `hub.modules.list(opts?)` | Lista módulos com filtros |
| `hub.modules.search(query, opts?)` | Pesquisa por string de consulta |
| `hub.modules.get(module, opts?)` | Obtém módulo por `org/name` ou id do módulo |
| `hub.modules.readme(module, opts?)` | Obtém o README; retorna `{content, filename, version}` |

### Opções de List/Search

| Opção | Valores |
|--------|--------|
| `organization_id` / `org` | string |
| `visibility` | `public`, `private`, `internal` |
| `type` | `library`, `application`, `agent`, `plugin` |
| `sort_order` | `name_asc`, `name_desc`, `created_desc`, `updated_desc`, `downloads_desc` |
| `keywords` (search) | array de strings |
| `license` (search) | string |
| `include_deprecated` (search) | boolean |

### README

```lua
local readme, err = hub.modules.readme("wippy/terminal", {
    version = "1.2.3"
})
print(readme.content)
```

A opção `version` aceita uma string de versão ou uma tabela como `{id, version, label}`.

## Versões

```lua
local versions, err = hub.versions.list("wippy/http", {
    include_yanked = false,
    page_size = 50,
})

local v, err = hub.versions.get("wippy/http", "1.0.0")
```

| Função | Descrição |
|----------|-------------|
| `hub.versions.list(module, opts?)` | Lista versões de um módulo |
| `hub.versions.get(module, version, opts?)` | Obtém uma versão específica |

## Dependências

```lua
local deps, err = hub.dependencies.get("wippy/http", "1.0.0")
local users, err = hub.dependents.get("wippy/http")
```

| Função | Descrição |
|----------|-------------|
| `hub.dependencies.get(module, version?, opts?)` | Dependências de uma versão de módulo |
| `hub.dependents.get(module, opts?)` | Módulos que dependem deste |

## Arquivos

```lua
local files, err = hub.files.list("wippy/http", "1.0.0")
```

Retorna a lista de arquivos de uma versão publicada.

## Veja também

- [CLI Reference](guides/cli.md) — `wippy readme`, `wippy search`, `wippy publish`
- [Publishing Guide](guides/publishing.md)
