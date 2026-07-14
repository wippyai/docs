---
title: "Dataflow"
---

# Dataflow

O módulo `wippy/dataflow` fornece um motor de orquestração de workflows baseado em grafos acíclicos direcionados (DAGs). Os workflows são compostos por nós — funções, agentes, ciclos e processadores paralelos — conectados por rotas de dados tipadas. O orquestrador gerencia a execução, persistência de estado e recuperação.

## Instalação

Adicione o módulo ao seu projeto:

```bash
wippy add wippy/dataflow
wippy install
```

Declare a dependência:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.dataflow
    kind: ns.dependency
    component: wippy/dataflow
    version: "*"
```

O módulo dataflow depende de `wippy/agent`, `wippy/llm` e `wippy/session` — estes são resolvidos automaticamente quando você executa `wippy install`. O módulo requer um recurso de banco de dados em `app:db` para persistência do workflow e executa migrações automaticamente via `wippy/migration`.

O módulo publica uma entrada `env.variable` `userspace.dataflow.env:web_host_origin` (padrão `https://front.wippy.ai`) que os fluxos downstream podem ler para construir URLs públicas. Sobrescreva por meio do router de env ou de um requirement.

## Flow Builder

O flow builder oferece uma interface fluente para compor workflows. Importe-o em sua entrada:

```yaml
imports:
  flow: userspace.dataflow.flow:flow
```

```lua
local flow = require("flow")
```

### API principal

```lua
flow.create()
    :with_title(title)
    :with_metadata(metadata)
    :with_input(data)
    :with_data(data)
    :[operation](config)
    :as(name)
    :to(target, input_key, transform)
    :error_to(target, input_key, transform)
    :when(condition)
    :run()   -- synchronous
    :start() -- asynchronous

flow.template()
    :[operations]...
```

### Pipeline linear

Os nós encadeiam automaticamente quando nenhum roteamento explícito é definido. A saída de cada nó flui para o próximo:

```lua
local result, err = flow.create()
    :with_input({ text = "Hello world" })
    :func("app:tokenize")
    :func("app:translate", { args = { target_lang = "fr" } })
    :func("app:format_output")
    :run()
```

### Roteamento nomeado

Use `:as()` para nomear nós e `:to()` para rotear dados entre eles. Use `:as()` apenas quando o nó precisa ser referenciado:

```lua
local result, err = flow.create()
    :with_input(task)
        :to("router")

    :func("app:router"):as("router")
        :to("context", "routing")
        :to("dev", "routing")

    :agent("app:context_agent"):as("context")
        :to("dev", "gathered_context")

    :agent("app:dev_agent"):as("dev")
        :to("@success")

    :run()
```

O segundo parâmetro de `:to()` é o **discriminador** — a chave de entrada no nó receptor. Quando um nó recebe múltiplas entradas, elas são coletadas como uma tabela indexada pelo discriminador.

### Entrada do workflow e dados estáticos

`:with_input()` é a única entrada primária do workflow. `:with_data()` cria fontes independentes de dados estáticos:

```lua
flow.create()
    :with_input(task)
        :to("router")

    :with_data(config):as("cfg")
        :to("dev", "config")
        :to("logger", "config")

    :with_data(branch):as("branch_data")
        :to("checker", "branch")

    :func("app:router"):as("router")
        :to("dev", "task")

    :func("app:dev"):as("dev")
        :to("@success")
        :error_to("@fail")

    :run()
```

Use `:with_input()` para dados externos que entram no workflow. Use `:with_data()` para configuração, constantes e dados de referência compartilhados entre múltiplos nós. Dados estáticos usam otimização por referência — a primeira rota cria dados reais, rotas subsequentes criam referências leves.

### Roteamento condicional

Use `:when()` após `:to()` para adicionar condições. As condições são avaliadas contra a saída do nó usando a sintaxe `expr`:

```lua
flow.create()
    :with_input(data)
    :func("app:classify"):as("classify")
        :to("handler_a"):when("output.category == 'a'")
        :to("handler_b"):when("output.category == 'b'")
        :to("fallback")
    :func("app:handler_a"):as("handler_a"):to("@success")
    :func("app:handler_b"):as("handler_b"):to("@success")
    :func("app:fallback"):as("fallback"):to("@success")
    :run()
```

Condições podem ser combinadas com transformações inline para roteamento mais complexo:

```lua
:func("app:decompose"):as("decompose")
    :to("@success", nil, "{passed: true, feedback: nil}"):when("len(output.items) == 0")
    :to("processor", "items", "output.items")
```

Expressões condicionais suportam: comparações (`output.score > 0.8`), operadores lógicos (`output.valid && output.count > 5`), funções de array (`len(output.items) > 0`, `any(output.errors, {.critical})`), operações de string (`output.status contains 'success'`) e encadeamento opcional (`output.data?.nested?.value`).

### Terminais do workflow

Roteie para `@success` ou `@fail` para encerrar o workflow explicitamente. Em contextos aninhados (ciclos, paralelo), os terminais criam saídas de nó em vez de saídas do workflow:

```lua
:func("app:final_step"):to("@success")
:func("app:handler"):error_to("@fail")
```

### Roteamento de erros

Use `:error_to()` para rotear erros de nó para um handler. Erros podem ser roteados como entradas normais para nós de recuperação:

```lua
:agent("app:gpt_planner", { model = "gpt-5" }):as("gpt_planner")
    :to("consolidator", "gpt_plan")
    :error_to("consolidator", "gpt_plan")

:agent("app:claude_planner", { model = "claude-4-5-sonnet" }):as("claude_planner")
    :to("consolidator", "claude_plan")
    :error_to("consolidator", "claude_plan")

:agent("app:consolidator", {
    inputs = { required = { "gpt_plan", "claude_plan" } }
}):as("consolidator")
```

Este padrão executa ambos os planejadores em paralelo — se um falhar, seu erro se torna a entrada para o consolidador, que prossegue com quaisquer resultados disponíveis.

## Mesclagem de entradas

Como um nó recebe entradas depende dos discriminadores e se `args` está configurado.

**Sem args — entrada padrão única:**

```lua
:func("source"):to("target")
-- target receives: raw content (unwrapped)
```

**Sem args — entrada nomeada única:**

```lua
:func("source"):to("target", "task")
-- target receives: { task = content }
```

**Sem args — múltiplas entradas:**

```lua
:func("source1"):to("target", "data")
:func("source2"):to("target", "config")
-- target receives: { data = content1, config = content2 }
```

**Com args — entradas se mesclam na base:**

```lua
:func("app:api_client", {
    args = { base_url = "https://api.com", timeout = 5000 }
})
-- with :to("api_client", "body") from upstream
-- api_client receives: { base_url = "https://api.com", timeout = 5000, body = content }
```

<note>
Nós com <code>args</code> não podem receber entradas com o discriminador <code>"default"</code>. Use discriminadores nomeados com <code>:to(target, "input_key")</code> em vez disso.
</note>

## Transformações de entrada

Transforme dados antes que cheguem a um nó:

```lua
-- String transform: single expression
:func("app:step", { input_transform = "input.nested.field" })

-- Table transform: named expressions
:func("app:step", {
    input_transform = {
        task = "inputs.task",
        config = "inputs.settings",
        priority = "output.score > 0.8 ? 'high' : 'normal'"
    }
})
```

Variáveis de contexto disponíveis nas transformações: `input` (entrada do workflow), `inputs` (todas as entradas recebidas pelo nó), `output` (saída do nó atual ao rotear).

### Transformações de rota inline

O terceiro parâmetro de `:to()` é uma expressão de transformação inline:

```lua
:func("source"):as("source")
    :to("target", nil, "output.data")
    :to("other", nil, "{passed: true, value: output.x}")
    :to("list", nil, "map(output.items, {.id})")
```

## Tipos de nós

### Nó de função

Executa uma entrada `function.lua` registrada:

```lua
:func("app:my_function", {
    args = { key = "value" },
    inputs = { required = { "task", "config" } },
    context = { session_id = "abc" },
    input_transform = { task = "inputs.prompt" },
    metadata = { title = "Process Data" }
})
```

| Option | Type | Description |
|--------|------|-------------|
| `args` | table | Argumentos base mesclados com as entradas do nó |
| `inputs` | table | Requisitos de entrada: `{ required = {...}, optional = {...} }` |
| `context` | table | Contexto de execução passado à função |
| `input_transform` | string/table | Expressão para transformar entradas |
| `metadata` | table | Metadados do nó (ex.: `{ title = "..." }`) |

Se a função retornar `{ _control = { commands = [...] } }`, o orquestrador gera um workflow filho. É assim que os fluxos aninhados funcionam.

### Nó agente

Executa um agente com chamada de ferramentas e saída estruturada opcional:

```lua
:agent("app:content_writer", {
    model = "gpt-5",
    inputs = { required = { "context", "content_plan", "analysis" } },
    arena = {
        prompt = "Write content based on the provided context.",
        max_iterations = 12,
        tool_calling = "any",
        exit_schema = {
            type = "object",
            properties = {
                content = { type = "string" },
                title = { type = "string" }
            },
            required = { "content", "title" }
        }
    },
    show_tool_calls = true,
    metadata = { title = "Content Writer" }
})
```

| Option | Type | Description |
|--------|------|-------------|
| `model` | string | Sobrescrever modelo |
| `arena.prompt` | string | Prompt do sistema |
| `arena.max_iterations` | number | Máx. loops de raciocínio (padrão: 64) |
| `arena.min_iterations` | number | Mín. iterações antes de sair (padrão: 1) |
| `arena.tool_calling` | string | `"auto"`, `"any"` (requer `exit_schema`), `"none"` (rejeita `exit_schema`) |
| `arena.tools` | array | IDs do registro de ferramentas |
| `arena.exit_schema` | table | JSON schema para saída estruturada |
| `arena.exit_func_id` | string | Função para validar a saída de exit |
| `arena.context` | table | Contexto adicional |
| `inputs` | table | Requisitos de entrada |
| `show_tool_calls` | boolean | Incluir chamadas de ferramentas na saída |
| `input_transform` | string/table | Transformar entradas |
| `metadata` | table | Metadados do nó |

**Seleção dinâmica de agente:** Passe uma string vazia como ID do agente e resolva via `input_transform`:

```lua
:agent("", {
    inputs = { required = { "spec", "task" } },
    input_transform = {
        agent_id = "inputs.spec.agent_id",
        task = "inputs.task"
    },
    arena = {
        prompt = "Process according to spec",
        max_iterations = 25
    }
})
```

**Validação de saída:** Quando `exit_func_id` está definido, a função valida a saída de exit do agente. Em caso de falha de validação, o agente recebe o erro como observação e continua (até `max_iterations`).

### Nó de ciclo

Itera uma função ou template repetidamente com estado persistente:

```lua
:cycle({
    func_id = "app:content_cycle",
    max_iterations = 3,
    initial_state = {
        entry_id = entry_id,
        content_prompt = prompt,
        min_score = 8.0,
        feedback_history = {}
    }
})
```

A função de ciclo recebe em cada iteração:

```lua
{
    input = <workflow_input>,
    state = <accumulated_state>,
    last_result = <previous_iteration_output>,
    iteration = <current_iteration_number>
}
```

A função controla a continuação:

```lua
function my_cycle(cycle_context)
    -- stop if approved
    if cycle_context.last_result and cycle_context.last_result.approved then
        return {
            state = cycle_context.state,
            result = cycle_context.last_result,
            continue = false
        }
    end

    -- spawn child workflow for this iteration
    return flow.create()
        :with_input({ task = cycle_context.input.task })
        :agent("app:worker")
        :agent("app:qa")
        :run()
end
```

| Option | Type | Description |
|--------|------|-------------|
| `func_id` | string | Função de iteração (mutuamente exclusiva com `template`) |
| `template` | FlowBuilder | Template para cada iteração (mutuamente exclusivo com `func_id`) |
| `max_iterations` | number | Iterações máximas |
| `initial_state` | table | Estado inicial |
| `continue_condition` | string | Expressão: continuar enquanto verdadeira |

**Ciclo baseado em template:**

```lua
:cycle({
    template = flow.template()
        :agent("app:worker")
        :func("app:validator"),
    max_iterations = 5
})
```

### Nó paralelo

Padrão map-reduce sobre arrays:

```lua
:parallel({
    inputs = { required = { "specs", "task" } },
    source_array_key = "specs",
    iteration_input_key = "spec",
    passthrough_keys = { "task" },
    batch_size = 10,
    on_error = "collect_errors",
    filter = "successes",
    unwrap = true,
    template = flow.template()
        :agent("app:processor", {
            inputs = { required = { "spec", "task" } },
            input_transform = {
                agent_id = "inputs.spec.agent_id",
                task = "inputs.task"
            },
            arena = {
                prompt = "Process according to spec",
                max_iterations = 25
            }
        })
        :to("@success"),
    metadata = { title = "Process Specs" }
})
```

| Option | Type | Description |
|--------|------|-------------|
| `source_array_key` | string | Chave de entrada contendo o array (obrigatório) |
| `template` | FlowBuilder | Template para cada item (obrigatório, deve rotear para `@success`) |
| `iteration_input_key` | string | Chave de entrada para o item atual (padrão: `"default"`) |
| `batch_size` | number | Itens por lote paralelo (padrão: 1 = sequencial) |
| `on_error` | string | `"collect_errors"` (padrão) ou `"fail_fast"` |
| `filter` | string | `"all"` (padrão), `"successes"`, `"failures"` |
| `unwrap` | boolean | Retornar resultados brutos em vez de metadados encapsulados (padrão: false) |
| `passthrough_keys` | array | Chaves de entrada encaminhadas para cada iteração |

**Passthrough keys** fornecem contexto compartilhado (configuração, descrição da tarefa) para cada iteração sem duplicar dados no array de origem:

```lua
:with_data(file_list):as("files"):to("processor", "files")
:with_data("secret"):as("api_key"):to("processor", "api_key")

:parallel({
    inputs = { required = { "files", "api_key" } },
    source_array_key = "files",
    iteration_input_key = "filename",
    passthrough_keys = { "api_key" },
    template = flow.template()
        :func("app:upload", {
            inputs = { required = { "filename", "api_key" } }
        })
        :to("@success")
}):as("processor")
```

### Nó signal

Pausa a execução até que um sinal externo chegue. Use para aprovações humanas, eventos externos ou workflows em estágios:

```lua
:signal({
    signal_id = "approval",
    inputs = { required = { "draft" } },
    metadata = { title = "Wait for approval" }
})
```

| Option | Type | Description |
|--------|------|-------------|
| `signal_id` | string | Nome do sinal comparado com `client:signal()`. Se vazio ou omitido, um UUID v7 é gerado em tempo de execução |
| `inputs` | table | Requisitos de entrada |
| `input_transform` | string/table | Transforma entradas antes de o nó recebê-las |
| `metadata` | table | Metadados do nó |

Envie o sinal de fora do workflow usando a API do cliente (veja `client:signal()` abaixo).

#### Comportamento

O nó faz yield com `wait_for_signal = true` e persiste esse yield no estado do workflow. O orquestrador retoma o nó quando um commit `NODE_SIGNAL` correspondente chega.

- O sinal é satisfeito por qualquer payload não-`nil`. `false`, `0`, `""` e `{}` satisfazem o yield; apenas `nil` o mantém pendente.
- Um yield de sinal bloqueia `COMPLETE_WORKFLOW` mas não bloqueia outros nós pendentes — ramos paralelos continuam executando enquanto um ramo espera.
- Sinais podem ser pré-enfileirados antes de `:start()`: se um commit `NODE_SIGNAL` correspondente chega antes de o nó signal alcançar o yield, ele é entregue no momento em que o yield é rastreado.
- Apenas um sinal satisfaz cada yield. Se um segundo sinal com o mesmo `signal_id` chega antes de o yield ser satisfeito, ele sobrescreve o primeiro.
- Quando múltiplos yields de sinal compartilham o mesmo `signal_id`, o primeiro yield correspondente recebe os dados.
- Se o campo `signal_id` está ausente, a correspondência recai no discriminador do nó.
- Os dados do sinal entregue são passados para a saída do nó como payload do sinal.

#### Durabilidade e recuperação

O yield de sinal faz parte do estado do workflow, persistido pelo mesmo mecanismo de outbox que qualquer outro comando. Se o processo do orquestrador for finalizado enquanto espera:

- O yield pendente é restaurado no restart.
- Sinais entregues durante a interrupção são enfileirados e aplicados quando o estado é recarregado.
- Pipelines compostos (`func → signal → signal → func`) se recuperam passo a passo — cada sinal pode ser entregue em um restart separado.

Yields de sinal órfãos (yields cujo processo pai saiu sem conclusão) são limpos pelo handler de saída de processo do estado do workflow.

#### Padrões de pipeline

Nós signal participam de qualquer topologia:

```lua
-- Human-in-the-loop approval between two functions
flow.create()
    :func("app:draft")
    :signal({ signal_id = "approve_draft" })
    :func("app:publish")
    :run()

-- Two parallel approvals that must both arrive before release
flow.create()
    :with_input({ doc = "release-notes" })
        :as("trigger")
        :to("legal", "doc")
        :to("finance", "doc")

    :signal({ signal_id = "legal_ok", inputs = { required = { "doc" } } })
        :as("legal")
        :to("gate", "legal")

    :signal({ signal_id = "finance_ok", inputs = { required = { "doc" } } })
        :as("finance")
        :to("gate", "finance")

    :join({ inputs = { required = { "legal", "finance" } } })
        :as("gate")
        :to("release")

    :func("app:release"):as("release"):to("@success")
    :run()
```

Os dados do sinal são expostos como saída do nó, portanto nós downstream recebem o que foi passado para `client:signal()`.

### Nó join

Coleta múltiplas entradas antes de prosseguir:

```lua
:join({
    inputs = { required = { "source1", "source2" } },
    output_mode = "object",
    ignored_keys = { "triggered" }
})
```

| Option | Type | Description |
|--------|------|-------------|
| `output_mode` | string | `"object"` (padrão) ou `"array"` (ordem de chegada) |
| `ignored_keys` | array | Chaves de entrada excluídas da saída |
| `inputs` | table | Requisitos de entrada |

## Templates

Templates definem sub-workflows reutilizáveis. Use `flow.template()` para criar, `:use()` para inline:

```lua
local preprocessor = flow.template()
    :func("app:clean")
    :func("app:tokenize")

flow.create()
    :with_input(data)
    :use(preprocessor)
    :func("app:process")
    :run()
```

Templates fazem inline de suas operações no flow pai em tempo de compilação.

## Workflows aninhados

Funções usadas em nós de ciclo e paralelos podem gerar workflows filhos retornando `flow.create():run()`:

```lua
function my_processor(input)
    return flow.create()
        :with_input(input)
        :func("app:step_a")
        :func("app:step_b")
        :run()
end
```

Quando `:run()` executa dentro de um contexto dataflow existente, ele retorna `{ _control = { commands = [...] } }` em vez de executar diretamente. O orquestrador lida com o workflow filho através do mecanismo de yield.

<note>
Funções que participam da composição de dataflow <strong>devem</strong> retornar <code>flow.create():run()</code>. Funções que retornam qualquer outra coisa não podem gerar workflows filhos.
</note>

## Síncrono vs Assíncrono

`:run()` bloqueia até que o workflow complete e retorna a saída:

```lua
local result, err = flow.create()
    :with_input({ text = "hello" })
    :func("app:process")
    :run()
```

`:start()` retorna imediatamente com um ID de workflow:

```lua
local dataflow_id, err = flow.create()
    :with_input({ text = "hello" })
    :func("app:process")
    :start()
```

`:start()` não pode ser usado em contextos aninhados.

## API do cliente

Para gerenciamento programático de workflows:

```yaml
imports:
  client: userspace.dataflow:client
```

```lua
local client = require("client")

local c, err = client.new()
```

| Method | Description |
|--------|-------------|
| `client.new()` | Criar cliente (requer ator de segurança) |
| `:create_workflow(commands, options?)` | Criar workflow, retorna `dataflow_id` |
| `:execute(dataflow_id, options?)` | Executar sincronamente, retorna resultado |
| `:start(dataflow_id, options?)` | Executar assincronamente, retorna `dataflow_id` |
| `:output(dataflow_id)` | Buscar saídas do workflow |
| `:get_status(dataflow_id)` | Obter status atual |
| `:cancel(dataflow_id, timeout?)` | Cancelar graciosamente (padrão: 30s) |
| `:terminate(dataflow_id)` | Terminar à força |
| `:signal(dataflow_id, signal_id, data?)` | Entregar um sinal externo a um nó signal em espera |

## Status do workflow

| Status | Description |
|--------|-------------|
| `template` | Nó é uma instância de template |
| `pending` | Aguardando entradas |
| `ready` | Entradas coletadas, pronto para executar |
| `running` | Em execução ativa |
| `paused` | Yield, aguardando workflow filho |
| `completed` | Concluído com sucesso |
| `failed` | Falhou |
| `cancelled` | Cancelado pelo usuário |
| `skipped` | Ramo condicional não seguido |
| `terminated` | Terminado à força |

## Metadados

```lua
flow.create()
    :with_title("Document Processing Pipeline")
    :with_metadata({ source = "api", priority = "high" })
    :func("app:process", { metadata = { title = "Process Document" } })
    :run()
```

O título padrão é "Flow Builder Workflow" se não fornecido.

## Regras de validação

O compilador valida os workflows em tempo de compilação:

- Todos os nomes `:as(name)` devem ser únicos
- Todos os destinos `:to()` e `:error_to()` devem referenciar nomes existentes (exceto `@success`, `@fail`)
- O grafo deve ser acíclico
- Todos os nós devem ter rotas de entrada (de outro nó, entrada do workflow ou dados estáticos)
- `:cycle()` requer `func_id` ou `template` (não ambos)
- `:parallel()` requer `source_array_key` e `template`
- Pelo menos um caminho deve levar a `@success` ou ter auto-saída
- `:when()` segue apenas `:to()` ou `:error_to()` de nós (não de dados estáticos)
- Nós com `args` não podem receber entradas com o discriminador `"default"`

## Referência de expressões

As expressões usam a sintaxe do módulo `expr`, disponível em condições `:when()` e valores de `input_transform`.

**Operadores:** `+`, `-`, `*`, `/`, `%`, `**`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`, `!`, `contains`, `startsWith`, `endsWith`

**Funções de array:** `all()`, `any()`, `none()`, `one()`, `filter()`, `map()`, `count()`, `len()`, `first()`, `last()`

**Funções matemáticas:** `max()`, `min()`, `abs()`, `ceil()`, `floor()`, `round()`, `sqrt()`, `pow()`

**Funções de string:** `len()`, `upper()`, `lower()`, `trim()`, `split()`, `join()`

**Funções de tipo:** `type()`, `int()`, `float()`, `string()`

**Literais:** números, strings, booleanos (`true`/`false`), null (`nil`), arrays (`[1, 2, 3]`), objetos (`{key: value}`)

**Ternário:** `output.age >= 18 ? output.verified : false`

**Encadeamento opcional:** `output.data?.nested?.value`

## Tratamento de erros

Tanto `:run()` quanto `:start()` seguem as convenções de erro padrão do Lua:

- Sucesso: `data, nil` (run) ou `dataflow_id, nil` (start)
- Falha: `nil, error_message`

Categorias de erro: erros de compilação, erros do cliente, erros de criação de workflow, erros de execução e falhas de workflow.

## Veja também

- [Agents](framework/agents.md) - Framework de agentes usado pelos nós agente
- [LLM](framework/llm.md) - Módulo LLM
- [Framework Overview](framework/overview.md) - Uso do módulo de framework
