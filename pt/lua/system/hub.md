---
title: "Hub"
description: "Navegue por metadados e artefatos do Wippy Hub, gerencie credenciais e inspecione o cache local de artefatos em Lua."
---

# Hub

O módulo `hub` lê módulos, versões, dependências, arquivos, artefatos e READMEs do Wippy Hub. Ele também gerencia o override de credencial do Hub no runtime e pode remover artefatos não fixados do cache local.

Esta página é uma referência de API. As coordenadas do catálogo são ilustrativas; operações de artefatos, autenticação e cache exigem acesso de rede, credenciais, estado do lock e políticas de segurança correspondentes.

## Carregamento

```lua
local hub = require("hub")
```

## Opções por chamada

Chamadas de catálogo e artefatos que usam a rede aceitam uma tabela opcional com estas chaves comuns:

| Chave | Tipo | Descrição |
|-----|------|-------------|
| `registry` | string | Sobrescreve a URL do registry |
| `token` | string | Sobrescreve o token de API |
| `timeout` | duration/number | Tempo limite da requisição (por exemplo `"3m"` ou segundos) |

Chamadas com suporte a paginação também aceitam `page` e `page_size`.

Chamadas de autenticação recebem diretamente uma URL de registro. Chamadas de cache e métodos do handle de pacote usam as próprias opções descritas abaixo.

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
if err then return nil, err end
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
if err then return nil, err end

local entries, entries_err = pkg:entries({
    kind = "function.lua",       -- string or string[], omit for all kinds
    include_data = false,        -- default true
})
-- each entry: { id = "ns:name", kind = "...", meta = {...}, data = <any> }
local _, close_err = pkg:close()
if entries_err then return nil, entries_err end
if close_err then return nil, close_err end
return entries
```

| Método | Descrição |
|--------|-----------|
| `pkg:metadata()` | Mapa de metadados do pack |
| `pkg:entries(opts?)` | Entradas de registro no artefato; `opts.kind` filtra, `opts.include_data` (default true) controla o campo `data` |
| `pkg:resources()` | Lista de recursos embutidos |
| `pkg:fs(resource)` | Handle de filesystem para um recurso embutido |
| `pkg:close()` | Libera o handle |

O `data` das entradas é retornado cru — referências `${env:...}` não são resolvidas.

## Cache Local de Artefatos

```lua
local entries, err = hub.cache.list()

local removed, err = hub.cache.remove("wippy/terminal", "1.2.3", {
    force = false,
})

local candidates, err = hub.cache.prune({
    dry_run = true,
})
```

| Função | Descrição |
|--------|-----------|
| `hub.cache.list()` | Listar artefatos em cache como registros `{module, version, size, pinned}` |
| `hub.cache.remove(module, version, opts?)` | Remover um artefato; `opts.force = true` permite remover quando o lock file o fixa |
| `hub.cache.prune(opts?)` | Remover artefatos não referenciados pelo lock file; `opts.dry_run = true` apenas informa os candidatos |

`hub.cache.remove` e `hub.cache.prune` excluem arquivos do diretório vendor resolvido pelo lock, salvo quando se aplicam as proteções de dry-run ou pin.

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

As strings de token acima são placeholders. Carregue credenciais reais de uma entrada de ambiente apoiada por secrets ou de outra fonte protegida; não as versione em Lua ou YAML do registro.

| Função | Descrição |
|----------|-------------|
| `hub.auth.authenticate(token, registry?)` | Valida o token contra o registry e, em caso de sucesso, o instala como override do runtime |
| `hub.auth.status(registry?)` | Valida ao vivo a credencial atual |
| `hub.auth.logout(registry?)` | Limpa o override de token do runtime |

`status` contém `authenticated`, `registry` e `orgs`; campos de identidade (`username`, `user_id`, `scope`, `expires_at`, `expired`) estão presentes apenas quando autenticado. Um token que falha na validação não é armazenado — `authenticate` retorna `authenticated = false`. O override tem precedência sobre `WIPPY_TOKEN` e credenciais armazenadas.

## Permissões

Cada operação `hub.*` de nível superior verifica o nome de ação correspondente, como `hub.modules.list`, `hub.versions.open`, `hub.dependencies.get`, `hub.files.list`, `hub.auth.status` ou `hub.cache.prune`. Ações que endereçam um módulo usam a referência fornecida como recurso de segurança; ações de autenticação usam a URL do registro. Os métodos do handle de pacote não executam outra verificação de permissão depois da chamada autorizada a `hub.versions.open`.

## Veja também

- [Referência da CLI](guides/cli.md) — `wippy readme`, `wippy search`, `wippy publish`
- [Guia de Publicação](guides/publishing.md)
