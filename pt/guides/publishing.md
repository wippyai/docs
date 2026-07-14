---
title: "Publicando Módulos"
description: "Compartilhe código reutilizável no Wippy Hub."
---

# Publicando Módulos

Compartilhe código reutilizável no Wippy Hub.

## Pré-requisitos

1. Crie uma conta em [hub.wippy.ai](https://hub.wippy.ai)
2. Crie uma organização ou junte-se a uma
3. Registre o nome do seu módulo sob sua organização

## Estrutura do Módulo

```
mymodule/
├── wippy.yaml      # Manifesto do módulo
├── src/
│   ├── _index.yaml # Definições de entradas
│   └── *.lua       # Arquivos de código-fonte
└── README.md       # Documentação (opcional)
```

## wippy.yaml

Manifesto do módulo:

```yaml
organization: acme
module: http-utils
description: HTTP utilities and helpers
license: MIT
repository: https://github.com/acme/http-utils
homepage: https://acme.dev
keywords:
  - http
  - utilities
```

| Campo | Obrigatório | Descrição |
|-------|----------|-------------|
| `organization` | Sim | Nome da sua organização no hub |
| `module` | Sim | Nome do módulo |
| `description` | Não | Descrição curta |
| `license` | Não | Identificador SPDX (MIT, Apache-2.0) |
| `repository` | Não | URL do repositório de código |
| `homepage` | Não | Página inicial do projeto |
| `keywords` | Não | Palavras-chave de busca |

## Definições de Entradas

Entradas são definidas em `_index.yaml`:

```yaml
version: "1.0"
namespace: acme.http

entries:
  - name: definition
    kind: ns.definition
    meta:
      title: HTTP Utilities
      description: Helpers for HTTP operations

  - name: client
    kind: library.lua
    source: file://client.lua
    modules:
      - http_client
      - json
```

## Dependências

Declare dependências de outros módulos:

```yaml
entries:
  - name: __dependency.wippy.test
    kind: ns.dependency
    meta:
      description: Testing framework
    component: wippy/test
    version: ">=0.3.0"
```

Restrições de versão:

| Restrição | Significado |
|------------|---------|
| `*` | Qualquer versão |
| `1.0.0` | Versão exata |
| `>=1.0.0` | Versão mínima |
| `^1.0.0` | Compatível (mesmo major) |

## Requisitos

Defina configurações que os consumidores devem fornecer:

```yaml
entries:
  - name: api_endpoint
    kind: ns.requirement
    meta:
      description: API endpoint URL
    targets:
      - entry: acme.http:client
        path: ".meta.endpoint"
    default: "https://api.example.com"
```

Os alvos especificam onde o valor é injetado:
- `entry` - ID de entrada completo a configurar
- `path` - JSONPath para a injeção do valor

Consumidores configuram via override. A flag `-o` aceita um trio `namespace:entry:field=value`:

```bash
wippy run -o acme.http:client:meta.endpoint=https://custom.api.com
```

## Imports

Referencie outras entradas:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  modules:
    - json
  imports:
    client: acme.http:client           # Mesmo namespace
    utils: acme.utils:helpers          # Namespace diferente
    base_registry: :registry           # Built-in
```

Em Lua:

```lua
local client = require("client")
local utils = require("utils")
```

## Contratos

Defina interfaces públicas:

```yaml
- name: http_contract
  kind: contract.definition
  meta:
    name: HTTP Client Contract
  methods:
    - name: get
      description: Perform GET request
    - name: post
      description: Perform POST request

- name: http_contract_binding
  kind: contract.binding
  contracts:
    - contract: acme.http:http_contract
      methods:
        get: acme.http:get_handler
        post: acme.http:post_handler
```

## Fluxo de Publicação

### 1. Autenticar

```bash
wippy auth login
```

### 2. Preparar

```bash
wippy init
wippy update
wippy lint
```

### 3. Validar

```bash
wippy publish --dry-run
```

### 4. Publicar

```bash
wippy publish --version 1.0.0
```

Com notas de release:

```bash
wippy publish --version 1.0.0 --release-notes "Initial release"
```

### Flags Adicionais

| Flag | Descrição |
|------|-------------|
| `--label <name>` | Publica como um rótulo mutável (ex: `latest`, `beta`) ao invés de uma versão imutável |
| `--protected` | Marca a versão publicada como protegida (não pode ser excluída ou sobrescrita) |
| `--registry <url>` | Sobrescreve a URL do registro para esta publicação |
| `--config <dir>` | Diretório contendo `wippy.yaml` (padrão: diretório atual) |
| `--create` | Registra o módulo no hub caso ainda não exista e então publica |
| `--module-visibility <v>` | Visibilidade para `--create`: `private` (padrão) ou `public` |
| `--module-type <t>` | Tipo para `--create`: `application` (padrão), `library`, `agent` ou `plugin` |
| `--module-display-name <n>` | Nome de exibição para `--create` |

### Embutindo Arquivos Estáticos

Módulos com entradas `fs.directory` (assets estáticos, templates, arquivos públicos) devem usar `--embed` para incluí-los no pacote publicado. Sem isso, entradas `fs.directory` são excluídas.

```bash
wippy publish --version 1.0.0 --embed app:public_files
wippy publish --version 1.0.0 --embed app:assets,app:templates
```

A flag `--embed` aceita IDs de entrada ou nomes que correspondam a entradas `fs.directory`. A mesma flag está disponível em `wippy pack`.

### Primeira Publicação

Na primeira vez que você publica um módulo ele é registrado no hub automaticamente (privado por padrão) e a publicação é repetida uma vez. Passe `--create` para registrá-lo antecipadamente e definir suas propriedades:

```bash
wippy publish --create --version 0.1.0 \
  --module-visibility public \
  --module-type library \
  --module-display-name "HTTP Utils"
```

`--create` é idempotente — para um módulo já registrado a etapa de criação é um no-op. Se sua conta não puder criar módulos na organização, o hub retorna um erro de permissão em vez de publicar.

### Publicando em um Hub Local

Aponte `--registry` para um hub rodando localmente para publicar e instalar sem o registro público. HTTP puro é permitido apenas para hosts locais — `localhost`, `127.0.0.1` e os aliases de container `host.docker.internal` (Docker Desktop / OrbStack) e `host.containers.internal` (Podman); qualquer outro host deve usar HTTPS.

```bash
wippy auth login --registry http://localhost:8080 --token wpy_xxx
wippy publish --registry http://localhost:8080 --create --version 0.1.0
```

O registro e o token também podem vir das variáveis de ambiente `WIPPY_REGISTRY` e `WIPPY_TOKEN`. Quando não definido, o registro usa por padrão `https://hub.wippy.ai`.

### Cotas

Se a cota de módulos privados da organização estiver esgotada, a publicação falha com uma mensagem como `cannot publish: Private-module quota exhausted (5 of 5)...`. Torne o módulo público ou peça a um admin da organização para aumentar a cota. Uploads e downloads são repetidos automaticamente em erros transitórios de rede.

## Usando Módulos Publicados

### Adicionar Dependência

```bash
wippy add acme/http-utils
wippy add acme/http-utils@1.0.0
wippy install
```

### Configurar Requisitos

Sobrescreva valores em tempo de execução:

```bash
wippy run -o acme.http:client:meta.endpoint=https://my.api.com
```

Ou em `.wippy.yaml`:

```yaml
override:
  acme.http:client:meta.endpoint: "https://my.api.com"
```

### Importar no Seu Código

```yaml
# seu src/_index.yaml
entries:
  - name: __dependency.acme.http
    kind: ns.dependency
    component: acme/http-utils
    version: ">=1.0.0"

  - name: my_handler
    kind: function.lua
    source: file://handler.lua
    imports:
      http: acme.http:client
```

## Exemplo Completo

**wippy.yaml:**
```yaml
organization: acme
module: cache
description: In-memory caching with TTL
license: MIT
keywords:
  - cache
  - memory
```

**src/_index.yaml:**
```yaml
version: "1.0"
namespace: acme.cache

entries:
  - name: definition
    kind: ns.definition
    meta:
      title: Cache Module

  - name: max_size
    kind: ns.requirement
    meta:
      description: Maximum cache entries
    targets:
      - entry: acme.cache:cache
        path: ".meta.max_size"
    default: "1000"

  - name: cache
    kind: library.lua
    meta:
      max_size: 1000
    source: file://cache.lua
    modules:
      - time
```

**src/cache.lua:**
```lua
local time = require("time")

local cache = {}
local store = {}
local max_size = 1000

function cache.set(key, value, ttl)
    if #store >= max_size then
        cache.evict_oldest()
    end
    store[key] = {
        value = value,
        expires = ttl and (time.now():unix() + ttl) or nil
    }
end

function cache.get(key)
    local entry = store[key]
    if not entry then return nil end
    if entry.expires and time.now():unix() > entry.expires then
        store[key] = nil
        return nil
    end
    return entry.value
end

return cache
```

Publicar:

```bash
wippy init && wippy update && wippy lint
wippy publish --version 1.0.0
```

## Veja Também

- [Referência da CLI](guides/cli.md)
- [Tipos de Entradas](guides/entry-kinds.md)
- [Configuração](guides/configuration.md)
