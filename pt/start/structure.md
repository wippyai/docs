# YAML e Estrutura do Projeto

Layout do projeto, arquivos de definicao YAML e convencoes de nomenclatura.

## Layout de Diretorios

```
myapp/
├── .wippy.yaml          # Configuracao do runtime
├── wippy.lock           # Configuracao de diretorios fonte
├── .wippy/              # Modulos instalados
└── src/                 # Codigo fonte da aplicacao
    ├── _index.yaml      # Definicoes de entradas
    ├── api/
    │   ├── _index.yaml
    │   └── *.lua
    └── workers/
        ├── _index.yaml
        └── *.lua
```

## Arquivos de Definicao YAML

<note>
Definicoes YAML sao carregadas no registro na inicializacao. O registro e a fonte da verdade - arquivos YAML sao uma forma de popula-lo. Entradas tambem podem vir de outras fontes ou ser criadas programaticamente.
</note>

### Estrutura do Arquivo

Qualquer arquivo YAML com `version` e `namespace` e valido:

```yaml
version: "1.0"
namespace: app.api

entries:
  - name: get_user
    kind: function.lua
    meta:
      comment: Busca usuario por ID
    source: file://get_user.lua
    method: handler
    modules:
      - sql
      - json

  - name: get_user.endpoint
    kind: http.endpoint
    meta:
      comment: Endpoint da API de usuarios
    method: GET
    path: /users/{id}
    func: get_user
```

| Campo | Obrigatorio | Descricao |
|-------|-------------|-----------|
| `version` | sim | Versao do schema (atualmente `"1.0"`) |
| `namespace` | sim | Namespace das entradas deste arquivo |
| `entries` | sim | Array de definicoes de entradas |

### Convencao de Nomenclatura

Use pontos (`.`) para separacao semantica e underscores (`_`) para palavras:

```yaml
# Funcao e seu endpoint
- name: get_user              # A funcao
- name: get_user.endpoint     # Seu endpoint HTTP

# Multiplos endpoints para a mesma funcao
- name: list_orders
- name: list_orders.endpoint.get
- name: list_orders.endpoint.post

# Roteadores
- name: api.public            # Roteador da API publica
- name: api.admin             # Roteador da API admin
```

<tip>
Padrao: <code>nome_base.variante</code> - pontos separam partes semanticas, underscores separam palavras dentro de uma parte.
</tip>

### Namespaces

Namespaces sao identificadores separados por pontos:

```
app
app.api
app.api.v2
app.workers
```

O ID completo da entrada combina namespace e nome: `app.api:get_user`

### Diretorios Fonte

O arquivo `wippy.lock` define de onde o Wippy carrega as definicoes:

```yaml
directories:
  modules: .wippy
  src: ./src
```

O Wippy escaneia recursivamente esses diretorios em busca de arquivos YAML.

## Definicoes de Entradas

Cada entrada no array `entries`. Propriedades estao no nivel raiz (sem wrapper `data:`):

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

Use `meta` para informacoes amigaveis para interface:

```yaml
- name: payment_handler
  kind: function.lua
  meta:
    title: Processador de Pagamentos
    comment: Processa pagamentos Stripe
  source: file://payment.lua
```

Convencao: `meta.title` e `meta.comment` renderizam bem em interfaces de gerenciamento.

### Entradas de Aplicacao

Use o kind `registry.entry` para configuracao em nivel de aplicacao:

```yaml
- name: config
  kind: registry.entry
  meta:
    title: Configuracoes da Aplicacao
    type: application
  environment: production
  features:
    dark_mode: true
    beta_access: false
```

## Tipos Comuns de Entradas

| Tipo | Proposito |
|------|-----------|
| `registry.entry` | Dados de proposito geral |
| `function.lua` | Funcao Lua executavel |
| `process.lua` | Processo de longa duracao |
| `http.service` | Servidor HTTP |
| `http.router` | Grupo de rotas |
| `http.endpoint` | Handler HTTP |
| `process.host` | Supervisor de processos |

Consulte o [Guia de Tipos de Entradas](guide-entry-kinds.md) para referencia completa.

## Arquivos de Configuracao

### .wippy.yaml

Configuracao do runtime na raiz do projeto:

```yaml
logger:
  level: info
  mode: production

host:
  worker_count: 16

http:
  address: :8080
```

Consulte o [Guia de Configuracao](guide-configuration.md) para todas as opcoes.

### wippy.lock

Define diretorios fonte:

```yaml
directories:
  modules: .wippy
  src: ./src
```

## Referenciando Entradas

Referencie entradas pelo ID completo ou nome relativo:

```yaml
# ID completo (cross-namespace)
- name: main.router
  kind: http.router
  endpoints:
    - app.api:get_user.endpoint
    - app.api:list_orders.endpoint

# Mesmo namespace - apenas use o nome
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

## Veja Tambem

- [Guia de Tipos de Entradas](guide-entry-kinds.md) - Tipos de entradas disponiveis
- [Guia de Configuracao](guide-configuration.md) - Opcoes do runtime
- [Tipos de Entradas Personalizados](internal-kinds.md) - Implementando handlers (avancado)
