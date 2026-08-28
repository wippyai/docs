---
title: "Publicando Módulos"
description: "Prepare, valide, publique, configure e consuma módulos por meio do Wippy Hub."
---

# Publicando Módulos

A publicação empacota um módulo e disponibiliza uma versão ou um rótulo mutável por meio do Wippy Hub.

Este é um fluxo de publicação e uma referência. Os módulos `acme/*`, URLs, tokens, credenciais e códigos-fonte de exemplo são ilustrativos; substitua-os por recursos pertencentes à sua organização.

## Pré-requisitos

1. Crie uma conta em [hub.wippy.ai](https://hub.wippy.ai).
2. Crie uma organização ou entre em uma existente.
3. Escolha um nome de módulo. A primeira publicação pode registrar um nome inexistente se sua conta tiver permissão; use `--create` para registrá-lo antes do upload e definir explicitamente suas propriedades.

## Estrutura do Módulo

```
mymodule/
├── wippy.yaml      # Module manifest
├── src/
│   ├── _index.yaml # Entry definitions
│   └── *.lua       # Source files
└── README.md       # Documentation (optional)
```

## wippy.yaml

Defina os metadados do módulo em `wippy.yaml`:

```yaml
organization: acme
module: http-utils
type: library
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
| `organization` | Sim | Nome da organização no Hub |
| `module` | Sim | Nome do módulo |
| `type` | Não | Tipo do módulo: `library`, `application`, `agent` ou `plugin` |
| `description` | Não | Descrição curta |
| `license` | Não | Identificador SPDX (MIT, Apache-2.0) |
| `repository` | Não | URL do repositório de código |
| `homepage` | Não | Página inicial do projeto |
| `keywords` | Não | Palavras-chave de busca |

`type` controla como o Hub classifica o módulo e pode ser alterado em uma publicação posterior. A flag `--module-type` o sobrescreve em uma única publicação. Quando omitido, um módulo recém-criado usa `application` por padrão e apresenta um aviso de obsolescência.

## Definições de Entradas

Defina as entradas do módulo em `_index.yaml`:

```yaml
version: "1.0"
namespace: acme.http

entries:
  - name: definition
    kind: ns.definition
    meta:
      title: HTTP Utilities
      description: Helpers for HTTP operations
    readme: file://README.md
    wiki:
      GUIDE.md: file://docs/GUIDE.md
      examples/auth.md: file://docs/auth.md

  - name: client
    kind: library.lua
    source: file://client.lua
    modules:
      - http_client
      - json
```

O mapa `wiki:` em `ns.definition` publica páginas de documentação junto ao README. As chaves são caminhos de página, e os valores são referências `file://`. O conteúdo é incorporado durante o empacotamento e servido pelo Hub como uma wiki do módulo.

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

- `entry` — ID completo da entrada a configurar
- `path` — Caminho com notação de pontos dentro da entrada de destino

`default` aceita qualquer tipo escalar — `default: 20` flui para um alvo numérico como número, não string. O mesmo vale para `parameters[].value` em entradas `ns.dependency`, e ambos aceitam referências `${env:NAME}`, carregadas literalmente e resolvidas quando a entrada alvo é decodificada.

Os consumidores podem configurar o destino por meio de um override. A flag `-o` aceita um valor `namespace:entry:field=value`:

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
    client: acme.http:client           # Same namespace
    utils: acme.utils:helpers          # Different namespace
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

## Fluxo para Publicar

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

### Flags de Publicação

| Flag | Descrição |
|------|-------------|
| `--label <name>` | Publica como um rótulo mutável (ex: `latest`, `beta`) ao invés de uma versão imutável |
| `--protected` | Marca a versão publicada como protegida (não pode ser excluída ou sobrescrita) |
| `--registry <url>` | Sobrescreve a URL do registro para esta publicação |
| `--config <dir>` | Diretório contendo `wippy.yaml` (padrão: diretório atual) |
| `--create` | Registra o módulo no hub caso ainda não exista e então publica |
| `--module-visibility <v>` | Visibilidade para `--create`: `private` (padrão) ou `public` |
| `--module-type <t>` | Tipo do módulo: `library`, `application`, `agent` ou `plugin` (sobrescreve `type:` no wippy.yaml) |
| `--module-display-name <n>` | Nome de exibição para `--create` |

### Incorporar Arquivos Estáticos

Selecione uma entrada `fs.directory` para incorporação com `--embed` ou com a lista persistente `embed:` do manifesto do projeto. As entradas selecionadas são transformadas em recursos `fs.embed`. Uma entrada `fs.directory` não selecionada permanece no pack, mas o conteúdo do diretório referenciado não é incluído.

```yaml
# wippy.yaml
embed:
  - app:public_files
  - app:assets
```

```bash
wippy publish --version 1.0.0 --embed app:public_files
wippy publish --version 1.0.0 --embed app:assets,app:templates
```

A lista do manifesto e a flag `--embed` aceitam IDs ou nomes de entradas que correspondam a entradas `fs.directory`. A mesma flag do CLI está disponível em `wippy pack`; uma seleção pelo CLI sobrescreve a lista do manifesto nessa execução.

### Primeira Publicação

Na primeira publicação, o módulo é registrado no Hub como privado por padrão, e a publicação é repetida uma vez. Use `--create` para registrá-lo antes da publicação e definir suas propriedades:

```bash
wippy publish --create --version 0.1.0 \
  --module-visibility public \
  --module-type library \
  --module-display-name "HTTP Utils"
```

`--create` é idempotente — para um módulo já registrado a etapa de criação é um no-op. Se sua conta não puder criar módulos na organização, o hub retorna um erro de permissão em vez de publicar.

### Publicando em um Hub Local

Aponte `--registry` para um Hub em execução local para publicar e instalar sem usar o registro público. HTTP sem criptografia é permitido somente para hosts locais: `localhost`, `127.0.0.1` e os aliases de container `host.docker.internal` (Docker Desktop ou OrbStack) e `host.containers.internal` (Podman). Outros hosts devem usar HTTPS.

```bash
wippy auth login --registry http://localhost:8080 --token wpy_xxx
wippy publish --registry http://localhost:8080 --create --version 0.1.0
```

O registro e o token também podem vir das variáveis de ambiente `WIPPY_REGISTRY` e `WIPPY_TOKEN`. Quando não definido, o registro usa por padrão `https://hub.wippy.ai`.

### Cotas

Se a cota de módulos privados da organização estiver esgotada, a publicação falha com uma mensagem como `cannot publish: Private-module quota exhausted (5 of 5)...`. Torne o módulo público ou peça a um administrador da organização para aumentar a cota. Uploads e downloads são repetidos automaticamente após erros transitórios de rede.

## Publicando Defaults de Runtime {#publishing-runtime-defaults}

Aplicações com `type: application` podem incluir padrões de configuração do runtime nos packs por meio de `publish.runtime` no `wippy.yaml`:

```yaml
type: application
publish:
  runtime:
    source: .wippy.yaml            # default: .wippy.yaml
    sections: [security, registry, override]
    vars: [public_url]
```

| Campo | Descrição |
|-------|-----------|
| `source` | Arquivo de configuração de onde as seções são lidas (padrão: `.wippy.yaml`) |
| `sections` | Seções de configuração de runtime copiadas para os metadados do pack como defaults |
| `vars` | Allowlist explícita de variáveis a empacotar mesmo quando não referenciadas |

Regras:

- Apenas variáveis referenciadas pelas seções selecionadas ou pelos profiles publicados são empacotadas (seguidas transitivamente); todo o resto precisa de uma entrada em `vars`.
- Referências `${env:...}` na configuração exportada são rejeitadas — o ambiente do publicador nunca vaza para um pack.
- As seções locais da máquina `boot`, `extensions` e `workspace` não podem ser exportadas.
- Apenas o pack da aplicação principal fornece defaults de runtime do host; metadados de runtime em packs de dependências são ignorados.

No destino, a precedência da configuração parte dos padrões do pack da aplicação, passa pelos padrões do runtime, pelos arquivos de configuração locais e pelos profiles selecionados e termina nas sobrescritas do CLI.

## Publicando Profiles {#publishing-profiles}

Profiles da aplicação raiz são exportados para os metadados `runtime.profiles` do pack. A publicação não seleciona nem fixa um profile — os consumidores escolhem um em tempo de execução com `wippy run --profile <name>`:

```yaml
publish:
  profiles:
    enabled: true
    source: config/profiles.yaml   # default: .wippy.yaml
    include: [production]          # omit to publish all non-workspace profiles
```

`include: []` não publica nenhum; um nome desconhecido faz a publicação falhar. Subseções `workspace` nunca são exportadas, mesmo dentro de um profile publicado. Consulte [Configuração](guides/configuration.md#profiles) para declarar profiles.

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
# your src/_index.yaml
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

## Módulo de Exemplo

**wippy.yaml:**
```yaml
organization: acme
module: cache
type: library
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

  - name: cache
    kind: library.lua
    source: file://cache.lua
    modules:
      - time
```

**src/cache.lua:**
```lua
local time = require("time")

local cache = {}
local store = {}

function cache.set(key, value, ttl)
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
wippy init
wippy update
wippy lint
wippy publish --version 1.0.0
```

## Consulte Também

- [Referência do CLI](guides/cli.md) — Comandos e flags de publicação
- [Kinds de Entrada](guides/entry-kinds.md) — Entradas de módulo e dependência
- [Configuração](guides/configuration.md) — Configuração de runtime e profiles
