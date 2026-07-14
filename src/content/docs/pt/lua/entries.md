---
title: "Tipos de Entrada Lua"
description: "Configuração para entradas baseadas em Lua: funções, processos, workflows e bibliotecas."
---

# Tipos de Entrada Lua

Configuração para entradas baseadas em Lua: funções, processos, workflows e bibliotecas.

## Tipos de Entrada

| Tipo | Descrição |
|------|-----------|
| `function.lua` | Função stateless, executa sob demanda |
| `process.lua` | Ator de longa duração com estado |
| `workflow.lua` | Workflow durável (Temporal) |
| `library.lua` | Código compartilhado importado por outras entradas |
| `module.lua` | Superfície de módulo (biblioteca com vários métodos) |

Cada tipo tem uma contraparte de bytecode pré-compilado (`function.lua.bc`, `library.lua.bc`, `process.lua.bc`, `workflow.lua.bc`) gerada por `wippy pack --bytecode`. Os autores escrevem entradas `.lua`; os tipos de bytecode são emitidos automaticamente ao empacotar.

## Campos Comuns

Todas as entradas Lua compartilham estes campos:

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `name` | sim | Nome único dentro do namespace |
| `kind` | sim | Um dos tipos Lua acima |
| `source` | sim | Caminho do arquivo Lua (`file://path.lua`) |
| `method` | function/process/workflow | Função a exportar (bibliotecas não usam) |
| `modules` | não | Módulos permitidos para `require()` |
| `imports` | não | Outras entradas como módulos locais |
| `meta` | não | Metadados pesquisáveis |

## function.lua

Função stateless chamada sob demanda. Cada invocação é independente.

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
```

Use para: HTTP handlers, transformações de dados, utilitários.

## process.lua

Ator de longa duração que mantém estado entre mensagens. Comunica via passagem de mensagens.

```yaml
- name: worker
  kind: process.lua
  source: file://worker.lua
  method: main
  modules:
    - process
    - sql
```

Use para: Workers em background, daemons de serviço, atores com estado.

Para executar como serviço supervisionado:

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

Workflow durável que sobrevive a reinicializações. Estado é persistido no Temporal.

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - workflow
    - time
```

Use para: Processos de negócio multi-etapa, orquestrações de longa duração.

## library.lua

Código compartilhado que pode ser importado por outras entradas.

```yaml
- name: helpers
  kind: library.lua
  source: file://helpers.lua
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

No código Lua:

```lua
local helpers = require("helpers")
helpers.format_date(timestamp)
```

## Modules

O campo `modules` controla quais módulos podem ser carregados com `require()`:

```yaml
modules:
  - http
  - json
  - sql
  - process
```

`channel`, `print`, `subscribe` e `unsubscribe` são carregados como globais Lua e não precisam aparecer em `modules:`.

Apenas módulos listados estão disponíveis. Isso fornece:
- Segurança: Prevenir acesso a módulos de sistema
- Dependências explícitas: Claro o que o código precisa
- Determinismo: Workflows só recebem módulos determinísticos

Veja [Lua Runtime](lua/overview.md) para módulos disponíveis.

## Imports

Importe outras entradas como módulos locais:

```yaml
imports:
  utils: app.lib:utils       # require("utils")
  auth: app.auth:helpers     # require("auth")
```

A chave se torna o nome do módulo no código Lua. O valor é o ID da entrada (`namespace:name`).

## Configuração de Pool

Configure pool de execução para funções:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  pool:
    type: adaptive    # padrão
    size: 4           # workers iniciais
    max_size: 16      # limite para pools elásticos
```

| Campo | Pools | Descrição |
|-------|-------|-----------|
| `type` | todos | Implementação do scheduler (ver tabela abaixo) |
| `size` | static, lazy, adaptive | Quantidade inicial de workers |
| `workers` | engine v2 | Quantidade de threads worker |
| `buffer` | static, adaptive | Capacidade da fila de tarefas (padrão `workers * 64`) |
| `warm_start` | adaptive | Pré-compilar entradas na inicialização |
| `max_size` | lazy, adaptive | Limite superior para crescimento elástico (padrão 16) |

| Tipo | Comportamento |
|------|---------------|
| `inline` | Execução síncrona na goroutine do chamador. Latência mínima, sem isolamento entre chamadas. |
| `lazy` | Sem workers ociosos, criados sob demanda, removidos quando ociosos. |
| `static` | Pool de tamanho fixo baseado em canais. Previsível sob carga estável. |
| `adaptive` | Pool com auto-escala — cresce sob carga, encolhe quando ocioso. Padrão. |

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

Metadados são pesquisáveis via registro:

```lua
local registry = require("registry")
local handlers = registry.find({type = "handler"})
```

## Veja Também

- [Entry Kinds](guides/entry-kinds.md) - Referência de todos os tipos de entrada
- [Compute Units](concepts/compute-units.md) - Funções vs processos vs workflows
- [Lua Runtime](lua/overview.md) - Módulos disponíveis
