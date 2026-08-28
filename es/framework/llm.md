---
title: "LLM"
description: "Usa wippy/llm para generación, prompts, streaming, herramientas, salida estructurada, selección de modelos y embeddings."
---

# LLM

El módulo `wippy/llm` proporciona una interfaz para modelos de OpenAI, Anthropic, Google y providers locales. Admite generación de texto, llamadas a herramientas, salida estructurada, embeddings y streaming.

Esta página es una introducción a la API con fragmentos de referencia componibles, no un tutorial independiente. Los fragmentos suponen un proyecto Wippy existente, un modelo y provider registrados y las credenciales que requiera ese provider. Sustituya los nombres de ejemplo por un modelo expuesto por su registro; las llamadas remotas pueden generar cargos. Para un proyecto ejecutable completo, siga [Construir un agente LLM](tutorials/llm-agent.md).

## Configuracion

Agrega el modulo a tu proyecto:

```bash
wippy add wippy/llm
wippy install
```

Declare la dependencia en `_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.llm
    kind: ns.dependency
    component: wippy/llm
    version: "*"
```

El módulo proporciona almacenamiento de entorno OS y usa `wippy.terminal:host` como process host predeterminado. Sobrescriba los parámetros `env_storage` o `process_host` solo si la aplicación necesita otras entradas. Configure claves mediante variables como `OPENAI_API_KEY` y `ANTHROPIC_API_KEY`.

## Generacion de Texto

Importa la biblioteca `llm` en tu entrada y llama a `generate()`:

```yaml
entries:
  - name: ask
    kind: function.lua
    source: file://ask.lua
    method: handler
    imports:
      llm: wippy.llm:llm
```

```lua
local llm = require("llm")

local function handler()
    local response, err = llm.generate("What are the three laws of robotics?", {
        model = "gpt-4o"
    })

    if err then
        return nil, err
    end

    return response.result
end

return { handler = handler }
```

El primer argumento de `generate()` puede ser un prompt de texto, un constructor de prompts o una tabla de mensajes. El segundo argumento es una tabla de opciones.

### Opciones de Generate

| Opcion | Tipo | Descripcion |
|--------|------|-------------|
| `model` | string | Nombre o clase del modelo (requerido) |
| `temperature` | number | Control de aleatoriedad, 0-2; el soporte depende del provider |
| `max_tokens` | number | Maximo de tokens a generar |
| `top_p` | number | Parametro de muestreo nucleus |
| `top_k` | number | Filtrado top-k |
| `thinking_effort` | number | Profundidad de razonamiento 0-100 (modelos con capacidad de razonamiento) |
| `tools` | table | Array de definiciones de herramientas |
| `tool_choice` | string | `"auto"`, `"none"`, `"any"`, o nombre de herramienta |
| `stream` | table | Configuracion de streaming: `{ reply_to, topic, buffer_size }` |
| `timeout` | number | Tiempo limite de solicitud en segundos (por defecto 600) |

### Estructura de la Respuesta

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `result` | string | Contenido de texto generado |
| `tokens` | table | Uso de tokens: `prompt_tokens`, `completion_tokens`, `thinking_tokens`, `total_tokens`, más los opcionales `cache_read_input_tokens`, `cache_read_tokens`, `cache_creation_input_tokens`, `cache_write_tokens` |
| `finish_reason` | string | Razon por la que se detuvo la generacion: `"stop"`, `"length"`, `"tool_call"`, `"filtered"`, `"error"` |
| `tool_calls` | table? | Array de llamadas a herramientas (si el modelo invoco herramientas) |
| `metadata` | table | Metadatos especificos del proveedor |
| `usage_record` | table? | Registro de seguimiento de uso |

## Constructor de Prompts

Para conversaciones multi-turno y prompts complejos, usa el constructor de prompts:

```yaml
imports:
  llm: wippy.llm:llm
  prompt: wippy.llm:prompt
```

```lua
local llm = require("llm")
local prompt = require("prompt")

local conversation = prompt.new()
conversation:add_system("You are a helpful assistant.")
conversation:add_user("What is the capital of France?")

local response, err = llm.generate(conversation, {
    model = "gpt-4o",
    temperature = 0.7,
    max_tokens = 500
})
```

### Metodos del Constructor

| Metodo | Descripcion |
|--------|-------------|
| `prompt.new()` | Crear constructor vacio |
| `prompt.with_system(content)` | Crear constructor con mensaje de sistema |
| `:add_system(content, meta?)` | Agregar mensaje de sistema |
| `:add_user(content, meta?)` | Agregar mensaje de usuario |
| `:add_assistant(content, meta?)` | Agregar mensaje de asistente |
| `:add_developer(content, meta?)` | Agregar mensaje de desarrollador |
| `:add_message(role, content_parts, name?, meta?)` | Agregar mensaje con rol y partes de contenido |
| `:add_function_call(name, arguments, id?, options?)` | Añadir una llamada a herramienta del asistente (`arguments` es la cadena JSON sin procesar) |
| `:add_function_result(name, result, id?)` | Agregar resultado de ejecucion de herramienta |
| `:add_cache_marker(id?)` | Marcar limite de cache (modelos Claude) |
| `:get_messages()` | Obtener array de mensajes |
| `:build()` | Obtener tabla `{ messages = ... }` para `llm.generate()` |
| `:clone()` | Copia profunda del constructor |
| `:clear()` | Eliminar todos los mensajes |

Todos los metodos `add_*` retornan el constructor para encadenamiento.

### Conversaciones Multi-Turno

Construye contexto a traves de turnos agregando mensajes:

```lua
local conversation = prompt.new()
conversation:add_system("You are a helpful assistant.")

-- first turn
conversation:add_user("What is Lua?")
local r1 = llm.generate(conversation, { model = "gpt-4o" })
conversation:add_assistant(r1.result)

-- second turn with full context
conversation:add_user("What makes it different from Python?")
local r2 = llm.generate(conversation, { model = "gpt-4o" })
```

### Contenido Multimodal

Combina texto e imagenes en un solo mensaje:

```lua
local conversation = prompt.new()
conversation:add_message(prompt.ROLE.USER, {
    prompt.text("What's in this image?"),
    prompt.image("https://example.com/photo.jpg")
})
```

| Funcion | Descripcion |
|---------|-------------|
| `prompt.text(content)` | Parte de contenido de texto |
| `prompt.image(url, mime_type?)` | Imagen desde URL |
| `prompt.image_base64(mime_type, data)` | Imagen codificada en Base64 |

### Constantes de Rol

| Constante | Valor |
|-----------|-------|
| `prompt.ROLE.SYSTEM` | `"system"` |
| `prompt.ROLE.USER` | `"user"` |
| `prompt.ROLE.ASSISTANT` | `"assistant"` |
| `prompt.ROLE.DEVELOPER` | `"developer"` |
| `prompt.ROLE.FUNCTION_CALL` | `"function_call"` |
| `prompt.ROLE.FUNCTION_RESULT` | `"function_result"` |
| `prompt.ROLE.CACHE_MARKER` | `"cache_marker"` |

### Clonacion

Clona un constructor para crear variaciones sin modificar el original:

```lua
local base = prompt.new()
base:add_system("You are a helpful assistant.")

local conv1 = base:clone()
conv1:add_user("What is AI?")

local conv2 = base:clone()
conv2:add_user("What is ML?")
```

## Streaming

Transmite respuestas en tiempo real usando comunicacion de procesos. Esto requiere una entrada `process.lua`:

```lua
local llm = require("llm")

local TOPIC = "llm_stream"

local function main()
    local stream_ch, listen_err = process.listen(TOPIC)
    if listen_err then
        return nil, listen_err
    end

    local function finish(text, response, err)
        local ok, cleanup_err = process.unlisten(stream_ch)
        if not ok then
            cleanup_err = cleanup_err or "Failed to remove LLM stream listener"
            if err then
                return nil, tostring(err) .. "; cleanup failed: " .. tostring(cleanup_err)
            end
            return nil, cleanup_err
        end
        if err then
            return nil, err
        end
        return text, response
    end

    local self_pid, pid_err = process.pid()
    if pid_err then
        return finish(nil, nil, pid_err)
    end

    local done_ch = channel.new(1)
    coroutine.spawn(function()
        local response, err = llm.generate("Write a short story", {
            model = "gpt-4o",
            stream = {
                reply_to = self_pid,
                topic = TOPIC,
            },
        })
        done_ch:send({ response = response, err = err })
    end)

    local full_text = ""
    local generation_result = nil
    local stream_done = false
    local stream_err = nil

    while true do
        local cases = {}
        if not stream_done then
            table.insert(cases, stream_ch:case_receive())
        end
        if not generation_result then
            table.insert(cases, done_ch:case_receive())
        end

        local result = channel.select(cases)
        if not result.ok then
            return finish(nil, nil, "LLM stream closed before completion")
        end

        if result.channel == done_ch then
            generation_result = result.value
            if generation_result.err then
                return finish(nil, nil, generation_result.err)
            end
            if stream_done then
                return finish(full_text, generation_result.response, stream_err)
            end
        else
            local chunk = result.value
            if chunk.type == "chunk" then
                local content = chunk.content or ""
                print(content)
                full_text = full_text .. content
            elseif chunk.type == "thinking" then
                print(chunk.content or "")
            elseif chunk.type == "error" then
                stream_done = true
                stream_err = chunk.error and chunk.error.message or "LLM stream failed"
            elseif chunk.type == "done" then
                stream_done = true
            end

            if stream_done and generation_result then
                return finish(full_text, generation_result.response, stream_err)
            end
        end
    end
end
```

### Tipos de Chunk

| Tipo | Campos | Descripcion |
|------|--------|-------------|
| `"chunk"` | `content` | Fragmento de contenido de texto |
| `"thinking"` | `content` | Proceso de razonamiento del modelo |
| `"tool_call"` | `name`, `arguments`, `id` | Invocacion de herramienta |
| `"error"` | `error.message`, `error.type` | Error en el stream |
| `"done"` | `meta` | Stream completado |

<note>
El streaming requiere una entrada <code>process.lua</code> porque utiliza el sistema de comunicacion de procesos de Wippy (<code>process.pid()</code>, <code>process.listen()</code>).
Ejecute la generación en otra coroutine para drenar los chunks de forma concurrente y elimine el listener en todas las rutas de retorno.
</note>

## Llamadas a Herramientas

Define herramientas como esquemas inline y pasalas a `generate()`:

```lua
local llm = require("llm")
local prompt = require("prompt")
local json = require("json")

local tools = {
    {
        name = "get_weather",
        description = "Get current weather for a location",
        schema = {
            type = "object",
            properties = {
                location = { type = "string", description = "City name" },
            },
            required = { "location" },
        },
    },
}

local conversation = prompt.new()
conversation:add_user("What's the weather in Tokyo?")

local response = llm.generate(conversation, {
    model = "gpt-4o",
    tools = tools,
    tool_choice = "auto",
})

if response.tool_calls and #response.tool_calls > 0 then
    for _, tc in ipairs(response.tool_calls) do
        -- execute the tool and get a result
        local result = { temperature = 22, condition = "sunny" }

        -- add the exchange to the conversation
        conversation:add_function_call(tc.name, json.encode(tc.arguments), tc.id)
        conversation:add_function_result(tc.name, json.encode(result), tc.id)
    end

    -- continue generation with tool results
    local final = llm.generate(conversation, { model = "gpt-4o" })
    print(final.result)
end
```

### Campos de Llamada a Herramienta

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | string | Identificador unico de la llamada |
| `name` | string | Nombre de la herramienta |
| `arguments` | table | Argumentos parseados que coinciden con el esquema |

### Eleccion de Herramienta

| Valor | Comportamiento |
|-------|----------------|
| `"auto"` | El modelo decide cuando usar herramientas (por defecto) |
| `"none"` | Nunca usar herramientas |
| `"any"` | Debe usar al menos una herramienta |
| `"tool_name"` | Debe usar la herramienta especificada |

## Salida Estructurada

Genera JSON validado que coincida con un esquema:

```lua
local llm = require("llm")

local schema = {
    type = "object",
    properties = {
        name = { type = "string" },
        age = { type = "number" },
        hobbies = {
            type = "array",
            items = { type = "string" },
        },
    },
    required = { "name", "age", "hobbies" },
    additionalProperties = false,
}

local response, err = llm.structured_output(schema, "Describe a fictional character", {
    model = "gpt-4o",
})

if not err then
    print(response.result.name)
    print(response.result.age)
end
```

<tip>
Para modelos OpenAI, todas las propiedades deben estar en el array <code>required</code>. Usa tipos union para campos opcionales: <code>type = {"string", "null"}</code>. Establece <code>additionalProperties = false</code>.
</tip>

## Configuracion de Modelos :id=model-configuration

Los modelos se definen como entradas de registro con `meta.type: llm.model`:

```yaml
entries:
  - name: gpt-4o
    kind: registry.entry
    meta:
      name: gpt-4o
      type: llm.model
      title: GPT-4o
      comment: OpenAI's flagship model
      capabilities:
        - generate
        - tool_use
        - structured_output
        - vision
      class:
        - balanced
      priority: 100
    max_tokens: 128000
    output_tokens: 16384
    pricing:
      input: 2.5
      output: 10
    providers:
      - id: wippy.llm.openai:provider
        provider_model: gpt-4o
```

### Campos de Entrada del Modelo

| Campo | Descripcion |
|-------|-------------|
| `meta.name` | Identificador del modelo usado en llamadas API |
| `meta.type` | Debe ser `llm.model` |
| `meta.capabilities` | Lista de capacidades: `generate`, `tool_use`, `structured_output`, `embed`, `thinking`, `vision`, `caching` |
| `meta.class` | Pertenencia a clase: `fast`, `balanced`, `reasoning`, etc. |
| `meta.priority` | Prioridad numerica para resolucion basada en clase (mayor gana) |
| `max_tokens` | Ventana de contexto maxima |
| `output_tokens` | Maximo de tokens de salida |
| `pricing` | Costo por millon de tokens: `input`, `output` |
| `providers` | Array con `id` (entrada del proveedor) y `provider_model` (nombre del modelo especifico del proveedor) |

### Modelos Locales

Para modelos alojados localmente (LM Studio, Ollama), define una entrada de proveedor separada con un `base_url` personalizado:

```yaml
  - name: local_provider
    kind: registry.entry
    meta:
      name: ollama
      type: llm.provider
      title: Ollama Local
    driver:
      id: wippy.llm.openai:driver
      options:
        api_key_env: none
        base_url: http://127.0.0.1:11434/v1

  - name: local-llama
    kind: registry.entry
    meta:
      name: local-llama
      type: llm.model
      title: Local Llama
      capabilities:
        - generate
    max_tokens: 4096
    output_tokens: 4096
    pricing:
      input: 0
      output: 0
    providers:
      - id: app:local_provider
        provider_model: llama-3.2
```

## Resolucion de Modelos

Los modelos pueden referenciarse por nombre exacto, clase o prefijo de clase explicito:

```lua
-- exact model name
llm.generate("Hello", { model = "gpt-4o" })

-- model class (picks highest priority in that class)
llm.generate("Hello", { model = "fast" })

-- explicit class syntax
llm.generate("Hello", { model = "class:reasoning" })
```

Orden de resolucion:
1. Coincidencia por `meta.name` exacto
2. Coincidencia por nombre de clase (mayor `meta.priority` gana)
3. Con prefijo `class:`, busca solo en esa clase

## Descubrimiento de Modelos

Consulta los modelos disponibles y sus capacidades en tiempo de ejecucion:

```lua
local llm = require("llm")

-- all models
local models = llm.available_models()

-- filter by capability
local tool_models = llm.available_models("tool_use")
local embed_models = llm.available_models("embed")

-- list model classes
local classes = llm.get_classes()
for _, c in ipairs(classes) do
    print(c.name .. ": " .. c.title)
end
```

## Embeddings

Genera embeddings vectoriales para busqueda semantica:

```lua
local llm = require("llm")

-- A single input still returns an array of vectors.
local single_response, single_err = llm.embed("The quick brown fox", {
    model = "text-embedding-3-small",
    dimensions = 512,
})
if single_err then
    error("Embedding failed: " .. tostring(single_err))
end
local vector = single_response.result[1]

-- Multiple inputs return one vector per input.
local batch_response, batch_err = llm.embed({
    "First document",
    "Second document",
}, { model = "text-embedding-3-small" })
if batch_err then
    error("Batch embedding failed: " .. tostring(batch_err))
end
local vectors = batch_response.result
```

## Estado del Proveedor

Sondea un proveedor antes de enviar trabajo. Util para verificaciones de disponibilidad y monitoreo ligero del estado:

```lua
local status, err = llm.status({
    model = "gpt-4o",
})
```

| Opcion | Descripcion |
|--------|-------------|
| `model` | Requerido. Modelo a verificar. |
| `provider_id` | Opcional. Omite la resolucion del modelo y apunta a un proveedor especifico. |

Devuelve el `StatusResponse` del proveedor (el contenido depende del proveedor).

## Manejo de Errores

Los errores se retornan como el segundo valor de retorno. En caso de error, el primer valor de retorno es `nil`:

```lua
local response, err = llm.generate("Hello", { model = "gpt-4o" })

if err then
    print("Error: " .. tostring(err))
    return
end

print(response.result)
```

### Tipos de Error

| Constante | Descripcion |
|-----------|-------------|
| `llm.ERROR_TYPE.INVALID_REQUEST` | Solicitud malformada |
| `llm.ERROR_TYPE.AUTHENTICATION` | Clave API invalida |
| `llm.ERROR_TYPE.RATE_LIMIT` | Limite de tasa del proveedor excedido |
| `llm.ERROR_TYPE.SERVER_ERROR` | Error del servidor del proveedor |
| `llm.ERROR_TYPE.CONTEXT_LENGTH` | La entrada excede la ventana de contexto |
| `llm.ERROR_TYPE.CONTENT_FILTER` | Contenido filtrado por sistemas de seguridad |
| `llm.ERROR_TYPE.TIMEOUT` | Tiempo de solicitud agotado |
| `llm.ERROR_TYPE.MODEL_ERROR` | Modelo invalido o no disponible |

### Razones de Finalizacion

| Constante | Descripcion |
|-----------|-------------|
| `llm.FINISH_REASON.STOP` | Completado normalmente |
| `llm.FINISH_REASON.LENGTH` | Alcanzo el maximo de tokens |
| `llm.FINISH_REASON.CONTENT_FILTER` | Contenido filtrado |
| `llm.FINISH_REASON.TOOL_CALL` | El modelo realizo una llamada a herramienta |
| `llm.FINISH_REASON.ERROR` | Error durante la generacion |

## Capacidades

| Constante | Descripcion |
|-----------|-------------|
| `llm.CAPABILITY.GENERATE` | Generacion de texto |
| `llm.CAPABILITY.TOOL_USE` | Llamadas a herramientas/funciones |
| `llm.CAPABILITY.STRUCTURED_OUTPUT` | Salida estructurada JSON |
| `llm.CAPABILITY.EMBED` | Embeddings vectoriales |
| `llm.CAPABILITY.THINKING` | Razonamiento extendido |
| `llm.CAPABILITY.VISION` | Comprension de imagenes |
| `llm.CAPABILITY.CACHING` | Cache de prompts |

## Ver Tambien

- [Agentes](framework/agents.md) — Framework de agentes con herramientas, delegates y memoria
- [Construir un agente LLM](../tutorials/llm-agent.md) — Crear un agente paso a paso
- [Visión general del framework](framework/overview.md) — Instalar e importar módulos del framework
