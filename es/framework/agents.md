---
title: "Agentes"
description: "Define y ejecuta agentes Wippy con herramientas, streaming, delegates, traits, memoria y resolución personalizada."
---

# Agentes

El módulo `wippy/agent` define agentes declarativamente y los ejecuta mediante un contexto y un runner. Los agentes pueden usar herramientas, hacer streaming, delegar trabajo, aplicar traits y recordar memoria.

Esta página es una introducción a la API con fragmentos de referencia componibles, no un tutorial independiente. Los fragmentos suponen un proyecto Wippy existente, modelo y provider LLM registrados, credenciales configuradas y las entradas de agente, herramienta o resolver que referencia cada ejemplo. Los fragmentos posteriores usan variables como `ctx`, `runner` y `conversation` creadas antes. Para un proyecto ejecutable completo, siga [Construir un agente LLM](../tutorials/llm-agent.md).

## Configuracion

Agrega el modulo a tu proyecto:

```bash
wippy add wippy/agent
wippy install
```

El módulo de agentes declara por sí mismo su dependencia `wippy/llm`. Añada la dependencia de agent si todavía no está presente:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.agent
    kind: ns.dependency
    component: wippy/agent
    version: "*"
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
| `max_tokens` | number | Maximo de tokens de salida (por defecto `512`) |
| `temperature` | number | Temperatura opcional; se omite de forma predeterminada y su rango depende del provider |
| `thinking_effort` | number | Solo se reenvia al modelo cuando `> 0` (escala definida por el proveedor) |
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
  prompt: wippy.llm:prompt
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
| `:configure_delegate_tools(config)` | Configurar como los delegados se exponen como herramientas |
| `:set_memory_contract(config)` | Configurar memoria dinamica |
| `:set_context_merger(fn)` | Proporcionar una funcion para fusionar actualizaciones del contexto en tiempo de ejecucion |
| `:update_context(updates)` | Actualizar contexto en tiempo de ejecucion |
| `:load_agent(spec_or_id, options?)` | Cargar y compilar agente, retorna runner |
| `:switch_to_agent(id, options?)` | Cambiar a otro agente, retorna `(boolean, string?)` |
| `:switch_to_model(name)` | Cambiar modelo del agente actual, retorna `(boolean, string?)` |
| `:get_current_agent()` | Obtener runner actual |
| `:get_config()` | Retornar un resumen de la configuracion del contexto |

### Opciones del Contexto

```lua
local ctx = agent_context.new({
    context = { session_id = "abc", user_id = "u1" },
    delegate_tools = { enabled = true },
    enable_cache = true,
})
```

| Opcion | Descripcion |
|--------|-------------|
| `context` | Contexto base en tiempo de ejecucion reenviado a herramientas y delegados |
| `delegate_tools` | Configuracion predeterminada de delegate-tool (sobrescrita por `configure_delegate_tools`) |
| `enable_cache` | Ajuste de marcadores de prompt cache para Claude. La implementación actual siempre los activa, incluso con `false`. |

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
local self_pid, pid_err = process.pid()
if pid_err then
    error("Failed to get process PID: " .. tostring(pid_err))
end

local response, err = runner:step(conversation, {
    context = { session_id = "abc" },
    stream_target = { reply_to = self_pid, topic = "stream" },
    tool_call = "auto",
})
if err then
    error("Agent step failed: " .. tostring(err))
end
```

| Opcion | Tipo | Descripcion |
|--------|------|-------------|
| `context` | table | Contexto en tiempo de ejecucion combinado con el contexto del agente |
| `stream_target` | table | Streaming: `{ reply_to, topic }` |
| `tool_call` | string | `"auto"`, `"any"`, `"none"` o un nombre de herramienta |

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

            conversation:add_function_call(tc.name, json.encode(tc.arguments), tc.id)
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
Usa <code>funcs.call(tc.registry_id, tc.arguments)</code> para ejecutar herramientas. El campo <code>registry_id</code> mapea directamente a la entrada de la herramienta en el registro. Consulte el [modelo de seguridad](../concepts/security-model.md) para el control y observabilidad del acceso a herramientas.
</note>

## Streaming

Transmite respuestas del agente en tiempo real usando `stream_target`:

```lua
local TOPIC = "agent_stream"

local function stream_step(runner, conversation)
    local stream_ch, listen_err = process.listen(TOPIC)
    if listen_err then
        return nil, nil, listen_err
    end

    local function finish(text, response, err)
        local ok, cleanup_err = process.unlisten(stream_ch)
        if not ok then
            cleanup_err = cleanup_err or "Failed to remove agent stream listener"
            if err then
                return text, nil, tostring(err) .. "; cleanup failed: " .. tostring(cleanup_err)
            end
            return text, nil, cleanup_err
        end
        if err then
            return text, nil, err
        end
        return text, response, nil
    end

    local self_pid, pid_err = process.pid()
    if pid_err then
        return finish("", nil, pid_err)
    end

    local done_ch = channel.new(1)
    coroutine.spawn(function()
        local response, err = runner:step(conversation, {
            stream_target = {
                reply_to = self_pid,
                topic = TOPIC,
            },
        })
        done_ch:send({ response = response, err = err })
    end)

    local full_text = ""
    local step_result = nil
    local stream_done = false
    local stream_err = nil

    while true do
        local cases = {}
        if not stream_done then
            table.insert(cases, stream_ch:case_receive())
        end
        if not step_result then
            table.insert(cases, done_ch:case_receive())
        end

        local result = channel.select(cases)
        if not result.ok then
            return finish(full_text, nil, "Agent stream closed before completion")
        end

        if result.channel == done_ch then
            step_result = result.value
            if step_result.err then
                return finish(full_text, nil, step_result.err)
            end
            if stream_done then
                return finish(full_text, step_result.response, stream_err)
            end
        else
            local chunk = result.value
            if chunk.type == "chunk" then
                local content = chunk.content or ""
                print(content)
                full_text = full_text .. content
            elseif chunk.type == "error" then
                stream_done = true
                stream_err = chunk.error and chunk.error.message or "Agent stream failed"
            elseif chunk.type == "done" then
                stream_done = true
            end

            if stream_done and step_result then
                return finish(full_text, step_result.response, stream_err)
            end
        end
    end
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
local response, err = runner:step(conversation)
if err then
    error("Delegate step failed: " .. tostring(err))
end

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
        max_items: 3
        max_length: 1000
        recall_cooldown: 1
        min_conversation_length: 2
```

El contrato de memoria se invoca durante `runner:step()` para recuperar elementos relevantes basados en el contexto de la conversacion. Los resultados se inyectan como mensajes de desarrollador.

| Opcion | Por defecto | Descripcion |
|--------|-------------|-------------|
| `max_items` | `3` | Maximo de elementos de memoria por recuperacion |
| `max_length` | `1000` | Longitud total maxima de caracteres |
| `recall_cooldown` | `1` | Minimo de pasos entre recuperaciones |
| `min_conversation_length` | `2` | Minimo de turnos de conversacion antes de la primera recuperacion |

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

La resolución personalizada puede cargar definiciones fuera del registro del framework, incluidas las definidas por usuario o workspace.

## Ver Tambien

- [LLM](./llm.md) — Interfaz de modelos subyacente
- [Construir un agente LLM](../tutorials/llm-agent.md) — Crear un agente paso a paso
- [Visión general del framework](./overview.md) — Instalar e importar módulos del framework
