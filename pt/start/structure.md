---
title: "YAML e Estrutura do Projeto"
description: "Layout do projeto, arquivos de definição YAML e convenções de nomenclatura."
---

# YAML e Estrutura do Projeto

## Layout de Diretórios

```
myapp/
├── .wippy.yaml          # Runtime configuration
├── wippy.lock           # Source directories config
├── .wippy/              # Installed modules
└── src/                 # Application source
    ├── _index.yaml      # Entry definitions
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

Um arquivo de definição contém um `namespace` e um array `entries` ou os campos `name` e `kind` no nível superior. O marcador opcional `version` usa, por convenção, o valor `"1.0"`; o carregador da versão v0.3.32a não o exige.

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
| `version` | Não | Marcador de versão do manifesto (por convenção, `"1.0"`) |
| `namespace` | Sim | Namespace das entradas deste arquivo |
| `entries` | Condicional | Array de definições de entradas; omita apenas ao usar `name` e `kind` no nível superior |

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

### Diretórios de Código-Fonte

O arquivo `wippy.lock` define a raiz do código-fonte da aplicação e o diretório-base usado para resolver módulos bloqueados:

```yaml
directories:
  modules: .wippy
  src: ./src
```

O Wippy adiciona `directories.src` como caminho de carregamento da aplicação. `directories.modules` não é percorrido como uma única árvore de código-fonte: cada módulo bloqueado resolve para seu arquivo `.wapp` versionado ou para o caminho de um módulo descompactado, e cada substituição resolve para sua raiz de entradas configurada. O carregador percorre recursivamente o código-fonte da aplicação e as raízes selecionadas de módulos ou substituições baseadas em diretório em busca de manifestos `.yaml`, `.yml` e `.json`; módulos `.wapp` são lidos como arquivos compactados. Somente arquivos em formato de objeto que contenham `namespace` são tratados como manifestos do registro, e diretórios `node_modules` são ignorados. `_index.yaml` é uma convenção do projeto, não o único nome de arquivo aceito.

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

Consulte o [Guia de Kinds de Entrada](../guides/entry-kinds.md) para ver a referência de kinds de entrada.

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

Consulte o [Guia de Configuração](../guides/configuration.md) para conhecer os campos de configuração do runtime.

### wippy.lock

Define os diretórios de código-fonte:

```yaml
directories:
  modules: .wippy
  src: ./src
```

## Referenciando Entradas

Referencie entradas pelo ID completo ou pelo nome relativo quando o kind da entrada oferecer suporte. Roteadores e endpoints HTTP são vinculados por `meta.server` e `meta.router`, e não por listas de filhos mantidas pelo pai:

```yaml
# Router declares itself against a server
- name: api
  kind: http.router
  meta:
    server: app:gateway
  prefix: /api

# Endpoint references router by registry ID (cross-namespace works the same way)
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

- [Arquitetura de Aplicações](../concepts/architecture.md) — Organize uma aplicação em partes e camadas
- [Guia de Kinds de Entrada](../guides/entry-kinds.md) — Consulte os kinds de entrada disponíveis
- [Guia de Configuração](../guides/configuration.md) — Configure as opções do runtime
- [Kinds de Entrada Personalizados](../internals/kinds.md) — Implemente handlers (avançado)
