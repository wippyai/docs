---
title: "Hub"
description: "Acesso somente leitura ao catálogo de módulos do Wippy Hub: listar módulos, pesquisar, obter metadados, versões, dependências e READMEs."
---

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
local versions, err = hub.versions.list("wippy/terminal", {
    include_yanked = false,
    page_size = 50,
})

local v, err = hub.versions.get("wippy/terminal", "1.0.0")
```

| Função | Descrição |
|----------|-------------|
| `hub.versions.list(module, opts?)` | Lista versões de um módulo |
| `hub.versions.get(module, version, opts?)` | Obtém uma versão específica |
| `hub.versions.inspect(module, version, opts?)` | Inspeciona o artefato de uma versão (baixa e lê o bundle) |
| `hub.versions.open(module, version, opts?)` | Abre o artefato de uma versão como um handle de pacote |

### Handle de Pacote

`hub.versions.open` baixa o artefato e retorna um handle com os campos `version`, `digest`, `packed`:

```lua
local pkg, err = hub.versions.open("wippy/terminal", "1.2.3")

local entries, err = pkg:entries({
    kind = "function.lua",       -- string or string[], omit for all kinds
    include_data = false,        -- default true
})
-- each entry: { id = "ns:name", kind = "...", meta = {...}, data = <any> }

pkg:close()
```

| Método | Descrição |
|--------|-----------|
| `pkg:metadata()` | Mapa de metadados do pack |
| `pkg:entries(opts?)` | Entradas de registro no artefato; `opts.kind` filtra, `opts.include_data` (default true) controla o campo `data` |
| `pkg:resources()` | Lista de recursos embutidos |
| `pkg:fs(resource)` | Handle de filesystem para um recurso embutido |
| `pkg:close()` | Libera o handle |

O `data` das entradas é retornado cru — referências `${env:...}` não são resolvidas.

## Dependências

```lua
local deps, err = hub.dependencies.get("wippy/terminal", "1.0.0")
local users, err = hub.dependents.get("wippy/terminal")
```

| Função | Descrição |
|----------|-------------|
| `hub.dependencies.get(module, version?, opts?)` | Dependências de uma versão de módulo |
| `hub.dependents.get(module, opts?)` | Módulos que dependem deste |

## Arquivos

```lua
local files, err = hub.files.list("wippy/terminal", "1.0.0")
```

| Função | Descrição |
|----------|-------------|
| `hub.files.list(module, version, opts?)` | Lista arquivos de uma versão (`version` obrigatório); retorna `{items, total, page, page_size}` |

## Autenticação

Injeta um token de registry no processo em execução — todo consumidor do hub o adota na próxima chamada, sem reinício:

```lua
local status, err = hub.auth.authenticate("wpy_xxx")          -- default registry
local status, err = hub.auth.authenticate("wpy_xxx", "https://hub.example.com")

local status, err = hub.auth.status()
local ok, err = hub.auth.logout()
```

| Função | Descrição |
|----------|-------------|
| `hub.auth.authenticate(token, registry?)` | Valida o token contra o registry e, em caso de sucesso, o instala como override do runtime |
| `hub.auth.status(registry?)` | Valida ao vivo a credencial atual |
| `hub.auth.logout(registry?)` | Limpa o override de token do runtime |

`status` contém `authenticated`, `registry` e `orgs`; campos de identidade (`username`, `user_id`, `scope`, `expires_at`, `expired`) estão presentes apenas quando autenticado. Um token que falha na validação não é armazenado — `authenticate` retorna `authenticated = false`. O override tem precedência sobre `WIPPY_TOKEN` e credenciais armazenadas.

**Permissões:** `hub.auth.authenticate`, `hub.auth.status`, `hub.auth.logout`

## Veja também

- [CLI Reference](guides/cli.md) — `wippy readme`, `wippy search`, `wippy publish`
- [Publishing Guide](guides/publishing.md)
