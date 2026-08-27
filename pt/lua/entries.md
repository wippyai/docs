---
title: "Tipos de Entrada Lua"
description: "Configuração para entradas baseadas em Lua: funções, processos, workflows e bibliotecas."
---

# Tipos de Entrada Lua

Os tipos de entrada Lua definem como o código-fonte é carregado e executado como função, processo, workflow ou biblioteca.

Esta página é uma referência de configuração. Os blocos YAML são definições parciais de entradas que devem ficar sob um mapeamento `entries:` em um índice Wippy; não são aplicações completas por si só. Os arquivos-fonte, imports, dependências, hosts de processos e políticas de segurança referenciados devem existir no projeto.

## Tipos de Entrada

| Tipo | Descrição |
|------|-----------|
| `function.lua` | Função stateless, executa sob demanda |
| `process.lua` | Ator de longa duração com estado |
| `workflow.lua` | Workflow durável (Temporal) |
| `library.lua` | Código compartilhado importado por outras entradas |

Cada tipo tem uma contraparte de bytecode pré-compilado (`function.lua.bc`, `library.lua.bc`, `process.lua.bc`, `workflow.lua.bc`) gerada por `wippy pack --bytecode '**'` ou por um padrão como `--bytecode 'app:**'`. Os autores escrevem entradas `.lua`; os tipos de bytecode são emitidos ao empacotar com essa opção.

`module.lua` é reservado para definições de módulos integrados criadas pelo runtime. Não é uma entrada de código-fonte que possa ser criada pelo autor e não tem contraparte de bytecode.

## Campos Comuns

Todas as entradas Lua compartilham estes campos:

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `name` | sim | Nome único dentro do namespace |
| `kind` | sim | Um dos tipos Lua acima |
| `source` | sim | Código-fonte Lua inline ou referência `file://path.lua` resolvida quando o registro é carregado |
| `method` | function/process/workflow | Função a exportar (bibliotecas não usam) |
| `modules` | não | Módulos permitidos para `require()` |
| `imports` | não | Outras entradas como módulos locais |
| `meta` | não | Metadados pesquisáveis |

`pool` aplica-se apenas a `function.lua`. `security` aplica-se a `function.lua` e `process.lua`.

## `function.lua`

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

## `process.lua`

Ator de longa duração que mantém estado entre mensagens. Comunica via passagem de mensagens.

```yaml
- name: worker
  kind: process.lua
  source: file://worker.lua
  method: main
  modules:
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

## `workflow.lua`

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

## `library.lua`

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
```

`channel`, `payload`, `print`, `process`, `subscribe` e `unsubscribe` são carregados como globais Lua e não precisam aparecer em `modules:`. `require("process")` também é permitido sem uma declaração em `modules:`.

Apenas módulos integrados listados e aliases declarados em `imports` estão disponíveis. A allowlist de módulos limita o acesso a recursos do runtime, torna as dependências explícitas e restringe workflows a classes de módulos compatíveis com workflows.

Veja [Runtime Lua](overview.md) para os módulos disponíveis.

## Imports

Importe outras entradas como módulos locais:

```yaml
imports:
  utils: app.lib:utils       # require("utils")
  auth: app.auth:helpers     # require("auth")
```

A chave se torna o nome do módulo no código Lua. O valor é o ID da entrada (`namespace:name`).

## Pools de Funções

Use `pool` para configurar como uma entrada de função é executada:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  pool:
    type: adaptive    # explicit; omit to use auto-select (lazy)
    max_size: 16      # cap for elastic growth
```

| Campo | Pools | Descrição |
|-------|-------|-----------|
| `type` | todos | Implementação do scheduler (ver tabela abaixo) |
| `workers` | static | Quantidade de workers; quando definido, `size` também deve ser positivo durante a validação da configuração |
| `size` | static | Quantidade de workers quando `workers` não é definido; sem `type`, apenas um `size` positivo seleciona `inline` |
| `buffer` | static | Capacidade da fila de tarefas (padrão: `workers * 64`) |
| `max_size` | lazy, adaptive | Limite superior do crescimento elástico (padrão: 16 para um tipo explícito) |
| `warm_start` | todos | Flag de configuração aceita; não tem efeito nesta versão do runtime |

| Tipo | Comportamento |
|------|---------------|
| `inline` | Execução síncrona na goroutine do chamador. Latência mínima, sem isolamento entre chamadas. |
| `lazy` | Sem workers ociosos, criados sob demanda, removidos quando ociosos. |
| `static` | Pool de tamanho fixo baseado em canais. Previsível sob carga estável. |
| `adaptive` | Pool com autoescala — cresce sob carga e encolhe quando ocioso. |

Quando `type` é omitido, o runtime seleciona:

- `static` quando `workers` é positivo;
- `lazy` quando `workers` é zero e `size` é zero ou `max_size` é positivo; ou
- `inline` quando `size` é positivo e `max_size` é zero.

O pool lazy selecionado automaticamente usa `max_size` quando positivo e, caso contrário, usa 100. Um pool `lazy` ou `adaptive` explícito usa 16 como padrão de `max_size`. Um pool `static` explícito usa `workers`, depois `size` e depois 8; o buffer padrão é o número selecionado de workers multiplicado por 64.

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
    - registry
```

Metadados são pesquisáveis via registro:

```lua
local registry = require("registry")
local handlers, err = registry.find({["meta.type"] = "handler"})
if err then
    return nil, err
end
```

A consulta retorna todas as entradas correspondentes no registro. O código Lua pertence a uma entrada executável cuja lista `modules` inclui `registry`, como a entrada `api_handler` acima.

## Veja Também

- [Tipos de Entrada](../guides/entry-kinds.md) - Referência de todos os tipos de entrada
- [Unidades de Computação](../concepts/compute-units.md) - Funções, processos e workflows
- [Runtime Lua](overview.md) - Módulos disponíveis
