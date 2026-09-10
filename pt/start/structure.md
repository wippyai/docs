---
title: "YAML e Estrutura do Projeto"
description: "Layout do projeto, arquivos de definição YAML e convenções de nomenclatura."
---

# YAML e Estrutura do Projeto

## Layout de Diretórios

```
myapp/
├── .wippy.yaml          # Configuração do runtime
├── wippy.lock           # Diretórios fonte e módulos travados
├── .wippy/              # Módulos instalados
└── src/                 # Código fonte da aplicação
    ├── _index.yaml      # Definições de entradas
    ├── api/
    │   ├── _index.yaml
    │   └── *.lua
    └── workers/
        ├── _index.yaml
        └── *.lua
```

## Arquivos de Definição YAML

<note>
As definições YAML são carregadas no registro durante a inicialização. O registro é a fonte da verdade; os arquivos YAML são uma forma de preenchê-lo. As entradas também podem vir de outras fontes ou ser criadas por código.
</note>

### Formato do Arquivo de Definição

Qualquer arquivo YAML com um `namespace` mais um array `entries` ou um `name`+`kind` no nível raiz é um arquivo de definição válido. `version` é opcional:

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    meta:
      comment: Fetches user by ID
    source: file://get_user.lua
    method: handler
    modules:
      - sql
      - json

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      comment: User API endpoint
    method: GET
    path: /users/{id}
    func: get_user
```

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `version` | não | Versão do schema (atualmente `"1.0"`) |
| `namespace` | sim | Namespace das entradas deste arquivo |
| `entries` | sim | Array de definições de entradas |

### Convenção de Nomenclatura

Use pontos (`.`) para separação semântica e sublinhados (`_`) para separar palavras:

```yaml
# Function and its endpoint
- name: get_user              # The function
- name: get_user.endpoint     # Its HTTP endpoint

# Multiple endpoints for same function
- name: list_orders
- name: list_orders.endpoint.get
- name: list_orders.endpoint.post

# Routers
- name: api.public            # Public API router
- name: api.admin             # Admin API router
```

<tip>
Padrão: <code>base_name.variant</code> — pontos separam partes semânticas, enquanto sublinhados separam palavras dentro de uma parte.
</tip>

### Namespaces

Namespaces são identificadores separados por pontos:

```
app
app.api
app.api.v2
app.workers
```

O ID completo de uma entrada combina namespace e nome: `app.api:get_user`

### O Arquivo de Lock

O `wippy.lock` registra de onde o Wippy carrega as definições e quais versões de módulos estão selecionadas:

```yaml
directories:
  modules: .wippy
  src: ./src
options:
  unpack_modules: false
modules:
  - name: acme/http
    version: v1.2.0
    hash: 4ea816fe84ca58a1f0869e5ca6afa93d6ddd72fa09e1162d9e600a7fbf39f0a2
```

| Campo | Descrição |
|-------|-----------|
| `directories.src` | Diretório fonte da aplicação, escaneado recursivamente em busca de arquivos YAML de definição |
| `directories.modules` | Diretório base para módulos vendorizados; os packs ficam em `<modules>/vendor/` |
| `options.unpack_modules` | Extrai cada `.wapp` em um diretório ao lado dele em vez de carregar o pack diretamente (padrão `false`) |
| `modules[].name` | Identificador do módulo no formato `org/module` |
| `modules[].version` | Versão selecionada |
| `modules[].hash` | Digest do artefato que o pack vendorizado deve corresponder |
| `modules[].root` | Marca o root de deployment selecionado; no máximo um módulo pode carregá-lo |

Packs vendorizados são mantidos como arquivos `.wapp`. Com `unpack_modules: true`, cada módulo também é extraído em um diretório, e o `.wapp` verificado permanece ao lado dele — a instalação procura pelo pack, então um diretório cujo pack está ausente é baixado novamente.

Uma seção `replacements:` em `wippy.lock` está obsoleta. Ela ainda carrega, com um aviso; declare sobrescritas de módulos locais em `workspace.replacements` em um arquivo de configuração de runtime. Veja [Gerenciamento de Dependências](guides/dependency-management.md#local-development-with-replacements).

## Definições de Entradas

Cada item do array `entries` define uma entrada. Os campos específicos do kind podem aparecer junto de `name`, `kind` e `meta`, como neste exemplo:

```yaml
entries:
  - name: hello
    kind: function.lua
    meta:
      comment: Returns hello world
    source: file://hello.lua
    method: handler
    modules:
      - http
      - json

  - name: hello.endpoint
    kind: http.endpoint
    meta:
      comment: Hello endpoint
    method: GET
    path: /hello
    func: hello
```

Um campo `data:` explícito também é aceito. Quando presente, seu valor é o payload completo e específico do kind; portanto, não o misture com campos específicos do kind no mesmo nível:

```yaml
entries:
  - name: config
    kind: registry.entry
    data:
      environment: production
      features:
        dark_mode: true
```

### Metadados

Use `meta` para informações adequadas à interface:

```yaml
- name: payment_handler
  kind: function.lua
  meta:
    title: Payment Processor
    comment: Handles Stripe payments
  source: file://payment.lua
```

Use `meta.title` e `meta.comment` para informações descritivas que consumidores do registro e interfaces de gerenciamento podem exibir.

### Entradas da Aplicação

Use o kind `registry.entry` para configurações no nível da aplicação:

```yaml
- name: config
  kind: registry.entry
  meta:
    title: Application Settings
    type: application
  environment: production
  features:
    dark_mode: true
    beta_access: false
```

## Kinds de Entrada Comuns

| Tipo | Finalidade |
|------|------------|
| `registry.entry` | Dados de uso geral armazenados sem o despacho normal de eventos |
| `function.lua` | Função Lua invocável |
| `process.lua` | Processo de longa duração |
| `http.service` | Servidor HTTP |
| `http.router` | Grupo de rotas |
| `http.endpoint` | Handler HTTP |
| `process.host` | Host de execução de processos |

Consulte o [Guia de Kinds de Entrada](guides/entry-kinds.md) para ver a referência de kinds de entrada.

## Arquivos de Configuração

### .wippy.yaml

Configuração do runtime na raiz do projeto:

```yaml
version: "1.0"

logger:
  encoding: json

logmanager:
  min_level: 0

supervisor:
  host:
    worker_count: 16
```

Consulte o [Guia de Configuração](guides/configuration.md) para conhecer os campos de configuração do runtime.

### wippy.lock

Diretórios fonte e o grafo de módulos selecionado — veja [O Arquivo de Lock](#o-arquivo-de-lock) acima.

## Referenciando Entradas

Referencie entradas pelo ID completo ou nome relativo. Filhos se vinculam ao pai por meio de `meta`, não por listas do lado do pai:

```yaml
# O roteador se declara contra um servidor
- name: api
  kind: http.router
  meta:
    server: app:gateway
  prefix: /api

# O endpoint referencia o roteador pelo ID de registro (cross-namespace funciona da mesma forma)
- name: get_user.endpoint
  kind: http.endpoint
  meta:
    router: app.api:api
  method: GET
  path: /users/{id}
  func: app.api:get_user
```

## Projeto de Exemplo

```
myapp/
├── .wippy.yaml
├── wippy.lock
└── src/
    ├── _index.yaml           # namespace: app
    ├── api/
    │   ├── _index.yaml       # namespace: app.api
    │   ├── users.lua
    │   └── orders.lua
    ├── lib/
    │   ├── _index.yaml       # namespace: app.lib
    │   └── database.lua
    └── workers/
        ├── _index.yaml       # namespace: app.workers
        └── email_sender.lua
```

## Consulte Também

- [Arquitetura de Aplicações](concepts/architecture.md) — Organize uma aplicação em partes e camadas
- [Guia de Kinds de Entrada](guides/entry-kinds.md) — Consulte os kinds de entrada disponíveis
- [Guia de Configuração](guides/configuration.md) — Configure as opções do runtime
- [Kinds de Entrada Personalizados](internals/kinds.md) — Implemente handlers (avançado)
