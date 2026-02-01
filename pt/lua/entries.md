# Tipos de Entrada Lua

Configuracao para entradas baseadas em Lua: funcoes, processos, workflows e bibliotecas.

## Tipos de Entrada

| Tipo | Descricao |
|------|-----------|
| `function.lua` | Funcao stateless, executa sob demanda |
| `process.lua` | Ator de longa duracao com estado |
| `workflow.lua` | Workflow duravel (Temporal) |
| `library.lua` | Codigo compartilhado importado por outras entradas |

## Campos Comuns

Todas as entradas Lua compartilham estes campos:

| Campo | Obrigatorio | Descricao |
|-------|-------------|-----------|
| `name` | sim | Nome unico dentro do namespace |
| `kind` | sim | Um dos tipos Lua acima |
| `source` | sim | Caminho do arquivo Lua (`file://path.lua`) |
| `method` | sim | Funcao a exportar |
| `modules` | nao | Modulos permitidos para `require()` |
| `imports` | nao | Outras entradas como modulos locais |
| `meta` | nao | Metadados pesquisaveis |

## function.lua

Funcao stateless chamada sob demanda. Cada invocacao e independente.

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
```

Use para: HTTP handlers, transformacoes de dados, utilitarios.

## process.lua

Ator de longa duracao que mantem estado entre mensagens. Comunica via passagem de mensagens.

```yaml
- name: worker
  kind: process.lua
  source: file://worker.lua
  method: main
  modules:
    - process
    - channel
    - sql
```

Use para: Workers em background, daemons de servico, atores com estado.

Para executar como servico supervisionado:

```yaml
- name: worker_service
  kind: process.service
  process: app:worker
  host: app:processes
  lifecycle:
    auto_start: true
    restart:
      max_attempts: 10
```

## workflow.lua

Workflow duravel que sobrevive a reinicializacoes. Estado e persistido no Temporal.

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - workflow
    - time
```

Use para: Processos de negocio multi-etapa, orquestracoes de longa duracao.

## library.lua

Codigo compartilhado que pode ser importado por outras entradas.

```yaml
- name: helpers
  kind: library.lua
  source: file://helpers.lua
  method: main
  modules:
    - json
    - base64
```

Outras entradas referenciam via `imports`:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  imports:
    helpers: app.lib:helpers
```

No codigo Lua:

```lua
local helpers = require("helpers")
helpers.format_date(timestamp)
```

## Modules

O campo `modules` controla quais modulos podem ser carregados com `require()`:

```yaml
modules:
  - http
  - json
  - sql
  - process
  - channel
```

Apenas modulos listados estao disponiveis. Isso fornece:
- Seguranca: Prevenir acesso a modulos de sistema
- Dependencias explicitas: Claro o que o codigo precisa
- Determinismo: Workflows so recebem modulos deterministicos

Veja [Lua Runtime](lua-overview.md) para modulos disponiveis.

## Imports

Importe outras entradas como modulos locais:

```yaml
imports:
  utils: app.lib:utils       # require("utils")
  auth: app.auth:helpers     # require("auth")
```

A chave se torna o nome do modulo no codigo Lua. O valor e o ID da entrada (`namespace:name`).

## Configuracao de Pool

Configure pool de execucao para funcoes:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  pool:
    type: inline    # Executar no contexto do chamador
```

Tipos de pool:
- `inline` - Executar no contexto do chamador (padrao para HTTP handlers)

## Metadados

Use `meta` para roteamento e descoberta:

```yaml
- name: api_handler
  kind: function.lua
  meta:
    type: handler
    version: "2.0"
    tags: [api, users]
  source: file://api.lua
  method: handle
  modules:
    - http
    - json
```

Metadados sao pesquisaveis via registro:

```lua
local registry = require("registry")
local handlers = registry.find({type = "handler"})
```

## Veja Tambem

- [Entry Kinds](guide-entry-kinds.md) - Referencia de todos os tipos de entrada
- [Compute Units](concept-compute-units.md) - Funcoes vs processos vs workflows
- [Lua Runtime](lua-overview.md) - Modulos disponiveis
