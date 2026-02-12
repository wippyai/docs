# Agentes

El modulo `wippy/agent` proporciona un framework para construir agentes de IA con uso de herramientas, streaming, delegacion, traits y memoria. Los agentes se definen declarativamente y se ejecutan a traves de un patron de contexto/runner.

## Configuracion

Agrega el modulo a tu proyecto:

```bash
wippy add wippy/agent
wippy install
```

El modulo de agentes requiere `wippy/llm` y un host de procesos. Declara ambas dependencias:

```yaml
version: "1.0"
namespace: app

entries:
  - name: os_env
    kind: env.storage.os

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: dep.llm
    kind: ns.dependency
    component: wippy/llm
    version: "*"
    parameters:
      - name: env_storage
        value: app:os_env
      - name: process_host
        value: app:processes

  - name: dep.agent
    kind: ns.dependency
    component: wippy/agent
    version: "*"
    parameters:
      - name: process_host
        value: app:processes
```

## Definiciones de Agentes

Los agentes son entradas de registro con `meta.type: agent.gen1`:

```yaml
entries:
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
      title: Assistant
      comment: A helpful chat assistant
    prompt: |
      You are a helpful assistant. Be concise and direct.
      Answer questions clearly.
    model: gpt-4o
    max_tokens: 1024
    temperature: 0.7
```

### Campos del Agente

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `meta.type` | string | Debe ser `agent.gen1` |
| `meta.name` | string | Identificador del agente |
| `prompt` | string | Prompt del sistema |
| `model` | string | Nombre o clase del modelo |
| `max_tokens` | number | Maximo de tokens de salida |
| `temperature` | number | Control de aleatoriedad, 0-1 |
| `thinking_effort` | number | Profundidad de razonamiento 0-100 |
| `tools` | array | IDs de registro de herramientas |
| `traits` | array | Referencias a traits |
| `delegates` | array | Referencias a agentes delegados |
| `memory` | array | Elementos de memoria estatica (strings) |
| `memory_contract` | table | Configuracion de memoria dinamica |

## Contexto del Agente

El contexto del agente es el punto de entrada principal. Crea un contexto, configuralo opcionalmente y luego carga un agente:

```yaml
imports:
  agent_context: wippy.agent:context
```

```lua
local agent_context = require("agent_context")

local ctx = agent_context.new()
local runner, err = ctx:load_agent("app:assistant")
if err then
    error("Failed to load agent: " .. tostring(err))
end
```

### Metodos del Contexto

| Metodo | Descripcion |
|--------|-------------|
| `agent_context.new(options?)` | Crear nuevo contexto |
| `:add_tools(specs)` | Agregar herramientas en tiempo de ejecucion |
| `:add_delegates(specs)` | Agregar agentes delegados |
| `:set_memory_contract(config)` | Configurar memoria dinamica |
| `:update_context(updates)` | Actualizar contexto en tiempo de ejecucion |
| `:load_agent(spec_or_id, options?)` | Cargar y compilar agente, retorna runner |
| `:switch_to_agent(id, options?)` | Cambiar a otro agente, retorna `(boolean, string?)` |
| `:switch_to_model(name)` | Cambiar modelo del agente actual, retorna `(boolean, string?)` |
| `:get_current_agent()` | Obtener runner actual |

### Opciones del Contexto

```lua
local ctx = agent_context.new({
    context = { session_id = "abc", user_id = "u1" },
    delegate_tools = { enabled = true },
})
```

### Carga por Especificacion Inline

Carga un agente sin una entrada de registro:

```lua
local runner, err = ctx:load_agent({
    id = "inline-agent",
    name = "helper",
    prompt = "You are a helpful assistant.",
    model = "gpt-4o",
    max_tokens = 1024,
    tools = { "app.tools:search" },
})
```

## Ejecucion de Pasos

El runner ejecuta un solo paso de razonamiento. Pasa un constructor de prompts con la conversacion:

```lua
local prompt = require("prompt")

local conversation = prompt.new()
conversation:add_user("What is the capital of France?")

local response, err = runner:step(conversation)
if err then
    error(tostring(err))
end

print(response.result)
```

### Opciones de Step

```lua
local response, err = runner:step(conversation, {
    context = { session_id = "abc" },
    stream_target = { reply_to = process.pid(), topic = "stream" },
    tool_call = "auto",
})
```

| Opcion | Tipo | Descripcion |
|--------|------|-------------|
| `context` | table | Contexto en tiempo de ejecucion combinado con el contexto del agente |
| `stream_target` | table | Streaming: `{ reply_to, topic }` |
| `tool_call` | string | `"auto"`, `"required"`, `"none"` |

### Respuesta de Step

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `result` | string | Texto generado |
| `tokens` | table | Uso de tokens |
| `finish_reason` | string | Razon de detencion |
| `tool_calls` | table? | Llamadas a herramientas para ejecutar |
| `delegate_calls` | table? | Invocaciones de delegados |

### Estadisticas del Runner

```lua
local stats = runner:get_stats()
-- stats.id, stats.name, stats.total_tokens
```

## Definiciones de Herramientas

Las herramientas son entradas `function.lua` con `meta.type: tool`. Definilas en un `_index.yaml` separado:

```yaml
version: "1.0"
namespace: app.tools

entries:
  - name: calculate
    kind: function.lua
    meta:
      type: tool
      title: Calculate
      input_schema: |
        {
          "type": "object",
          "properties": {
            "expression": {
              "type": "string",
              "description": "Math expression to evaluate"
            }
          },
          "required": ["expression"],
          "additionalProperties": false
        }
      llm_alias: calculate
      llm_description: Evaluate a mathematical expression.
    source: file://calculate.lua
    modules: [expr]
    method: handler
```

```lua
local expr = require("expr")

local function handler(args)
    local result, err = expr.eval(args.expression)
    if err then
        return { error = tostring(err) }
    end
    return { result = result }
end

return { handler = handler }
```

### Metadatos de Herramientas

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `meta.type` | string | Debe ser `tool` |
| `meta.input_schema` | string/table | JSON Schema para los argumentos de la herramienta |
| `meta.llm_alias` | string | Nombre expuesto al LLM |
| `meta.llm_description` | string | Descripcion expuesta al LLM |
| `meta.exclusive` | boolean | Si es true, cancela llamadas concurrentes a herramientas |

### Referencia de Herramientas en Agentes

Lista los IDs de registro de herramientas en la definicion del agente:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
    prompt: You are a helpful assistant with tools.
    model: gpt-4o
    max_tokens: 1024
    tools:
      - app.tools:calculate
      - app.tools:search
      - app.tools:*          # wildcard: all tools in namespace
```

Las herramientas tambien pueden referenciarse con alias personalizados y contexto:

```yaml
    tools:
      - id: app.tools:search
        alias: web_search
        context:
          api_key: "${SEARCH_API_KEY}"
```

## Ejecucion de Herramientas

Cuando un paso del agente retorna `tool_calls`, ejecutalas y alimenta los resultados de vuelta:

```lua
local json = require("json")
local funcs = require("funcs")

local function execute_and_continue(runner, conversation)
    while true do
        local response, err = runner:step(conversation)
        if err then return nil, err end

        local tool_calls = response.tool_calls
        if not tool_calls or #tool_calls == 0 then
            return response.result, nil
        end

        for _, tc in ipairs(tool_calls) do
            local result, call_err = funcs.call(tc.registry_id, tc.arguments)
            local result_str
            if call_err then
                result_str = json.encode({ error = tostring(call_err) })
            else
                result_str = json.encode(result)
            end

            conversation:add_function_call(tc.name, tc.arguments, tc.id)
            conversation:add_function_result(tc.name, result_str, tc.id)
        end
    end
end
```

### Campos de Llamada a Herramienta

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | string | Identificador unico de la llamada |
| `name` | string | Nombre de la herramienta (alias o llm_alias) |
| `arguments` | table | Argumentos parseados |
| `registry_id` | string | ID de registro completo para `funcs.call()` |

<note>
Usa <code>funcs.call(tc.registry_id, tc.arguments)</code> para ejecutar herramientas. El campo <code>registry_id</code> mapea directamente a la entrada de la herramienta en el registro.
</note>

## Streaming

Transmite respuestas del agente en tiempo real usando `stream_target`:

```lua
local TOPIC = "agent_stream"

local function stream_step(runner, conversation)
    local stream_ch = process.listen(TOPIC)

    local done_ch = channel.new(1)
    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = process.pid(),
                topic = TOPIC,
            },
        })
        done_ch:send({ response = response, err = err })
    end)

    local full_text = ""
    while true do
        local result = channel.select({
            stream_ch:case_receive(),
            done_ch:case_receive(),
        })
        if not result.ok then break end

        if result.channel == done_ch then
            process.unlisten(stream_ch)
            local r = result.value
            return full_text, r.response, r.err
        end

        local chunk = result.value
        if chunk.type == "chunk" then
            io.write(chunk.content or "")
            full_text = full_text .. (chunk.content or "")
        elseif chunk.type == "done" then
            -- wait for the step to complete
            local r, ok = done_ch:receive()
            process.unlisten(stream_ch)
            if ok and r then
                return full_text, r.response, r.err
            end
            return full_text, nil, nil
        end
    end

    process.unlisten(stream_ch)
    return full_text, nil, nil
end
```

El stream usa los mismos tipos de chunk que el streaming directo de LLM: `"chunk"`, `"thinking"`, `"tool_call"`, `"error"`, `"done"`.

<tip>
Usa <code>coroutine.spawn</code> para ejecutar <code>runner:step()</code> en una corrutina separada para poder recibir chunks del stream de forma concurrente. Usa <code>channel.select</code> para multiplexar los canales de stream y completado.
</tip>

## Delegados

Los agentes pueden delegar a otros agentes. Los delegados aparecen como herramientas para el agente padre:

```yaml
  - name: coordinator
    kind: registry.entry
    meta:
      type: agent.gen1
      name: coordinator
    prompt: Route questions to the right specialist.
    model: gpt-4o
    max_tokens: 1024
    delegates:
      - id: app:code_agent
        name: ask_coder
        rule: for programming questions
      - id: app:math_agent
        name: ask_mathematician
        rule: for math problems
```

Las llamadas a delegados aparecen en `response.delegate_calls`:

```lua
local response = runner:step(conversation)

if response.delegate_calls then
    for _, dc in ipairs(response.delegate_calls) do
        -- dc.agent_id - target agent registry ID
        -- dc.name - delegate tool name
        -- dc.arguments - forwarded message
    end
end
```

Los delegados tambien pueden agregarse en tiempo de ejecucion:

```lua
ctx:add_delegates({
    { id = "app:specialist", name = "ask_specialist", rule = "for domain questions" },
})
```

## Traits

Los traits son capacidades reutilizables que aportan prompts, herramientas y comportamiento a los agentes:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
    prompt: You are a helpful assistant.
    model: gpt-4o
    traits:
      - time_aware
      - id: custom_trait
        context:
          key: value
```

### Traits Incorporados

| Trait | Descripcion |
|-------|-------------|
| `time_aware` | Inyecta la fecha y hora actual en el prompt |

El trait `time_aware` acepta opciones de contexto:

```yaml
    traits:
      - id: time_aware
        context:
          timezone: America/New_York
          time_interval: 15
```

### Traits Personalizados

Los traits son entradas de registro con `meta.type: agent.trait`. Pueden aportar:
- **prompt** - texto estatico agregado al prompt del sistema
- **build_func_id** - funcion llamada en tiempo de compilacion para aportar herramientas, prompts y delegados
- **prompt_func_id** - funcion llamada en cada paso para inyectar contenido dinamico
- **step_func_id** - funcion llamada en cada paso para efectos secundarios

## Memoria

### Memoria Estatica

Elementos de memoria simples agregados al prompt del sistema:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      name: assistant
    prompt: You are a helpful assistant.
    model: gpt-4o
    memory:
      - "User prefers concise answers"
      - "Always cite sources when possible"
```

### Contrato de Memoria Dinamica

Configura la recuperacion de memoria dinamica desde una fuente externa:

```yaml
    memory_contract:
      implementation_id: app:memory_store
      context:
        user_id: "${user_id}"
      options:
        max_items: 5
        max_length: 2000
        recall_cooldown: 2
        min_conversation_length: 3
```

El contrato de memoria se invoca durante `runner:step()` para recuperar elementos relevantes basados en el contexto de la conversacion. Los resultados se inyectan como mensajes de desarrollador.

| Opcion | Descripcion |
|--------|-------------|
| `max_items` | Maximo de elementos de memoria por recuperacion |
| `max_length` | Longitud total maxima de caracteres |
| `recall_cooldown` | Minimo de pasos entre recuperaciones |
| `min_conversation_length` | Minimo de turnos de conversacion antes de la primera recuperacion |

## Contrato de Resolucion

Cuando `load_agent()` recibe un identificador de tipo string, primero intenta resolverlo a traves del contrato `wippy.agent:resolver`. Si no hay un resolver vinculado o el resolver retorna nil, recurre a la busqueda en el registro.

Esto permite a las aplicaciones implementar resolucion personalizada de agentes, como cargar definiciones de agentes desde una base de datos.

### Vincular un Resolver

Define una funcion de resolucion y vinculala al contrato:

```yaml
entries:
  - name: agent_resolver.resolve
    kind: function.lua
    source: file://agent_resolver.lua
    method: resolve
    modules:
      - logger
    imports:
      agent_registry: wippy.agent.discovery:registry

  - name: agent_resolver_binding
    kind: contract.binding
    contracts:
      - contract: wippy.agent:resolver
        default: true
        methods:
          resolve: app:agent_resolver.resolve
```

### Implementacion del Resolver

El resolver recibe `{ agent_id = "..." }` y retorna una tabla de especificacion del agente o nil:

```lua
local agent_registry = require("agent_registry")

local CUSTOM_PREFIX = "custom:"

function resolve(args)
    local agent_id = args.agent_id
    if not agent_id then
        return nil, "agent_id is required"
    end

    if agent_id:sub(1, #CUSTOM_PREFIX) == CUSTOM_PREFIX then
        local id = agent_id:sub(#CUSTOM_PREFIX + 1)

        -- load from database, config file, or any other source
        return {
            id = agent_id,
            name = "custom-agent",
            prompt = "You are a custom agent.",
            model = "class:balanced",
            max_tokens = 1024,
            tools = {},
        }
    end

    -- fall back to registry
    local spec, err = agent_registry.get_by_id(agent_id)
    if not spec then
        spec, err = agent_registry.get_by_name(agent_id)
    end
    return spec, err
end

return {
    resolve = resolve,
}
```

### Orden de Resolucion

1. Intenta el contrato `wippy.agent:resolver` (si esta vinculado)
2. Intenta busqueda en el registro por ID
3. Intenta busqueda en el registro por nombre
4. Retorna error si no se encuentra

Este patron habilita aplicaciones multi-tenant donde los agentes se configuran por usuario o por workspace y se almacenan fuera del registro del framework.

## Ver Tambien

- [LLM](llm.md) - Modulo LLM subyacente
- [Construir un Agente LLM](../tutorials/llm-agent.md) - Tutorial paso a paso
- [Vision General del Framework](overview.md) - Uso de modulos del framework
