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
│   └── *.lua       # Arquivos fonte
└── README.md       # Documentação (opcional)
```

## wippy.yaml

Manifesto do módulo:

```yaml
organization: acme
module: http-utils
description: Utilitários e helpers HTTP
license: MIT
repository: https://github.com/acme/http-utils
homepage: https://acme.dev
keywords:
  - http
  - utilities
```

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `organization` | Sim | Nome da sua org no hub |
| `module` | Sim | Nome do módulo |
| `description` | Sim | Descrição curta |
| `license` | Não | Identificador SPDX (MIT, Apache-2.0) |
| `repository` | Não | URL do repositório fonte |
| `homepage` | Não | Homepage do projeto |
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
      title: Utilitários HTTP
      description: Helpers para operações HTTP

  - name: client
    kind: library.lua
    source: file://client.lua
    modules:
      - http_client
      - json
```

## Dependências

Declare dependências em outros módulos:

```yaml
entries:
  - name: __dependency.wippy.test
    kind: ns.dependency
    meta:
      description: Framework de testes
    component: wippy/test
    version: ">=0.3.0"
```

Restrições de versão:

| Restrição | Significado |
|-----------|-------------|
| `*` | Qualquer versão |
| `1.0.0` | Versão exata |
| `>=1.0.0` | Versão mínima |
| `^1.0.0` | Compatível (mesmo major) |

## Requisitos

Defina configuração que consumidores devem fornecer:

```yaml
entries:
  - name: api_endpoint
    kind: ns.requirement
    meta:
      description: URL do endpoint da API
    targets:
      - entry: acme.http:client
        path: ".meta.endpoint"
    default: "https://api.example.com"
```

Targets especificam onde o valor é injetado:
- `entry` - ID completo da entrada a configurar
- `path` - JSONPath para injeção do valor

Consumidores configuram via override:

```bash
wippy run -o acme.http:api_endpoint=https://custom.api.com
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
    base_registry: :registry           # Embutido
```

No Lua:

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
    name: Contrato de Cliente HTTP
  methods:
    - name: get
      description: Executa requisição GET
    - name: post
      description: Executa requisição POST

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

Com notas de lançamento:

```bash
wippy publish --version 1.0.0 --release-notes "Release inicial"
```

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
wippy run -o acme.http:api_endpoint=https://my.api.com
```

Ou em `.wippy.yaml`:

```yaml
override:
  acme.http:api_endpoint: "https://my.api.com"
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
description: Cache em memória com TTL
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
      title: Módulo de Cache

  - name: max_size
    kind: ns.requirement
    meta:
      description: Máximo de entradas no cache
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

- [Referência do CLI](guides/cli.md)
- [Tipos de Entradas](guides/entry-kinds.md)
- [Configuração](guides/configuration.md)
