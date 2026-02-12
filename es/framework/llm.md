# LLM

El modulo `wippy/llm` proporciona una interfaz unificada para trabajar con Modelos de Lenguaje Grande de multiples proveedores (OpenAI, Anthropic, Google, modelos locales). Soporta generacion de texto, llamadas a herramientas, salida estructurada, embeddings y streaming.

## Configuracion

Agrega el modulo a tu proyecto:

```bash
wippy add wippy/llm
wippy install
```

Declara la dependencia en tu `_index.yaml`. El modulo LLM requiere un almacenamiento de entorno (para claves API) y un host de procesos:

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
```

La entrada `env.storage.os` expone las variables de entorno del sistema operativo a los proveedores LLM. Configura tus claves API como variables de entorno (por ejemplo, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).

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
| `temperature` | number | Control de aleatoriedad, 0-1 |
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
| `tokens` | table | Uso de tokens: `prompt_tokens`, `completion_tokens`, `thinking_tokens`, `total_tokens` |
| `finish_reason` | string | Razon por la que se detuvo la generacion: `"stop"`, `"length"`, `"tool_call"` |
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
| `:add_function_call(name, args, id?)` | Agregar llamada a herramienta del asistente |
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
    local stream_ch = process.listen(TOPIC)

    local response = llm.generate("Write a short story", {
        model = "gpt-4o",
        stream = {
            reply_to = process.pid(),
            topic = TOPIC,
        },
    })

    while true do
        local chunk, ok = stream_ch:receive()
        if not ok then break end

        if chunk.type == "chunk" then
            io.write(chunk.content)
        elseif chunk.type == "thinking" then
            io.write(chunk.content)
        elseif chunk.type == "error" then
            io.print("Error: " .. chunk.error.message)
            break
        elseif chunk.type == "done" then
            break
        end
    end

    process.unlisten(stream_ch)
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
        conversation:add_function_call(tc.name, tc.arguments, tc.id)
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

## Configuracion de Modelos

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

-- single text
local response = llm.embed("The quick brown fox", {
    model = "text-embedding-3-small",
    dimensions = 512,
})
-- response.result is a float array

-- multiple texts
local response = llm.embed({
    "First document",
    "Second document",
}, { model = "text-embedding-3-small" })
-- response.result is an array of float arrays
```

## Manejo de Errores

Los errores se retornan como el segundo valor de retorno. En caso de error, el primer valor de retorno es `nil`:

```lua
local response, err = llm.generate("Hello", { model = "gpt-4o" })

if err then
    io.print("Error: " .. tostring(err))
    return
end

io.print(response.result)
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

- [Agentes](agents.md) - Framework de agentes con herramientas, delegados y memoria
- [Construir un Agente LLM](../tutorials/llm-agent.md) - Tutorial paso a paso
- [Vision General del Framework](overview.md) - Uso de modulos del framework
