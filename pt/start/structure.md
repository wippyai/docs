---
title: "YAML e Estrutura do Projeto"
description: "Layout do projeto, arquivos de definição YAML e convenções de nomenclatura."
---

# YAML e Estrutura do Projeto

Layout do projeto, arquivos de definição YAML e convenções de nomenclatura.

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
Definições YAML são carregadas no registro na inicialização. O registro é a fonte da verdade — arquivos YAML são uma forma de populá-lo. Entradas também podem vir de outras fontes ou ser criadas programaticamente.
</note>

### Estrutura do Arquivo

Qualquer arquivo YAML com `version` e `namespace` é válido:

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    meta:
      comment: Busca usuário por ID
    source: file://get_user.lua
    method: handler
    modules:
      - sql
      - json

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      comment: Endpoint da API de usuários
    method: GET
    path: /users/{id}
    func: get_user
```

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `version` | sim | Versão do schema (atualmente `"1.0"`) |
| `namespace` | sim | Namespace das entradas deste arquivo |
| `entries` | sim | Array de definições de entradas |

### Convenção de Nomenclatura

Use pontos (`.`) para separação semântica e underscores (`_`) para palavras:

```yaml
# Função e seu endpoint
- name: get_user              # A função
- name: get_user.endpoint     # Seu endpoint HTTP

# Múltiplos endpoints para a mesma função
- name: list_orders
- name: list_orders.endpoint.get
- name: list_orders.endpoint.post

# Roteadores
- name: api.public            # Roteador da API pública
- name: api.admin             # Roteador da API admin
```

<tip>
Padrão: <code>nome_base.variante</code> — pontos separam partes semânticas, underscores separam palavras dentro de uma parte.
</tip>

### Namespaces

Namespaces são identificadores separados por pontos:

```
app
app.api
app.api.v2
app.workers
```

O ID completo da entrada combina namespace e nome: `app.api:get_user`

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

Cada entrada no array `entries`. Propriedades estão no nível raiz (sem wrapper `data:`):

```yaml
entries:
  - name: hello
    kind: function.lua
    meta:
      comment: Retorna hello world
    source: file://hello.lua
    method: handler
    modules:
      - http
      - json

  - name: hello.endpoint
    kind: http.endpoint
    meta:
      comment: Endpoint hello
    method: GET
    path: /hello
    func: hello
```

### Metadados

Use `meta` para informações amigáveis para interface:

```yaml
- name: payment_handler
  kind: function.lua
  meta:
    title: Processador de Pagamentos
    comment: Processa pagamentos Stripe
  source: file://payment.lua
```

Convenção: `meta.title` e `meta.comment` renderizam bem em interfaces de gerenciamento.

### Entradas de Aplicação

Use o kind `registry.entry` para configuração em nível de aplicação:

```yaml
- name: config
  kind: registry.entry
  meta:
    title: Configurações da Aplicação
    type: application
  environment: production
  features:
    dark_mode: true
    beta_access: false
```

## Tipos Comuns de Entradas

| Tipo | Propósito |
|------|-----------|
| `registry.entry` | Dados de propósito geral |
| `function.lua` | Função Lua executável |
| `process.lua` | Processo de longa duração |
| `http.service` | Servidor HTTP |
| `http.router` | Grupo de rotas |
| `http.endpoint` | Handler HTTP |
| `process.host` | Supervisor de processos |

Consulte o [Guia de Tipos de Entradas](guides/entry-kinds.md) para referência completa.

## Arquivos de Configuração

### .wippy.yaml

Configuração do runtime na raiz do projeto:

```yaml
logger:
  encoding: json

host:
  worker_count: 16

http:
  address: :8080
```

Consulte o [Guia de Configuração](guides/configuration.md) para todas as opções.

### wippy.lock

Diretórios fonte e o grafo de módulos selecionado — veja [O Arquivo de Lock](#o-arquivo-de-lock) acima.

## Referenciando Entradas

Referencie entradas pelo ID completo ou nome relativo:

```yaml
# ID completo (cross-namespace)
- name: main.router
  kind: http.router
  endpoints:
    - app.api:get_user.endpoint
    - app.api:list_orders.endpoint

# Mesmo namespace — apenas use o nome
- name: get_user.endpoint
  kind: http.endpoint
  func: get_user
```

## Exemplo de Projeto

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

## Veja Também

- [Arquitetura de Aplicações](concepts/architecture.md) - Como dividir uma aplicação em slices e camadas
- [Guia de Tipos de Entradas](guides/entry-kinds.md) - Tipos de entradas disponíveis
- [Guia de Configuração](guides/configuration.md) - Opções do runtime
- [Tipos de Entradas Personalizados](internals/kinds.md) - Implementando handlers (avançado)
