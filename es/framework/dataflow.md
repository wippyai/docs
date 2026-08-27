---
title: "Dataflow"
description: "Compón y ejecuta workflows DAG con nodos, enrutado, persistencia, señales, plantillas y APIs de cliente de Wippy Dataflow."
---

# Dataflow

El módulo `wippy/dataflow` orquesta workflows como grafos acíclicos dirigidos (DAG). Las funciones, agentes, ciclos, procesadores paralelos y otros nodos intercambian datos mediante rutas con nombre y claves discriminadoras, mientras el orquestador gestiona la ejecución, el estado persistido y la recuperación.

Esta página es una introducción a la API con fragmentos conceptuales y de referencia, no un tutorial autónomo. Valores como `task`, `config` y `file_list`, e IDs como `app:tokenize` o `app:worker`, representan datos y entradas del registro proporcionados por la aplicación. Los fragmentos también presuponen la base de datos de persistencia y el host de procesos descritos en [Instalación](#instalación). Para un proyecto ejecutable completo, sigue [Construir un workflow de Dataflow](../tutorials/dataflow.md).

## Instalación

Añade el módulo a tu proyecto:

```bash
wippy add wippy/dataflow
wippy install
```

Declara la dependencia:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.dataflow
    kind: ns.dependency
    component: wippy/dataflow
    version: "*"
```

El módulo dataflow depende de `wippy/agent`, `wippy/llm`, `wippy/session`, `wippy/test` y `wippy/migration`; `wippy install` los resuelve. De forma predeterminada, el módulo usa `app:db` para persistir workflows y `app:processes` para su servicio de activación. Proporciona esas entradas o sobrescribe los requirements `target_db` y `process_host`. Las migraciones de Dataflow se ejecutan mediante `wippy/migration`.

El módulo publica una entrada `env.variable` `userspace.dataflow.env:web_host_origin` (por defecto `https://front.wippy.ai`) que los flujos descendentes pueden leer para construir URLs públicas. Sobrescríbela a través del router de env o una requirement.

## Flow Builder

El flow builder proporciona una interfaz fluida para componer workflows. Impórtalo en la entrada que define el flujo:

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

### Pipeline lineal

Sin rutas explícitas, los nodos forman una cadena lineal y la salida de cada nodo se convierte en la entrada del siguiente:

```lua
local result, err = flow.create()
    :with_input({ text = "Hello world" })
    :func("app:tokenize")
    :func("app:translate", { args = { target_lang = "fr" } })
    :func("app:format_output")
    :run()
```

### Enrutado con nombre

Usa `:as()` para nombrar un nodo y `:to()` para enrutar datos a otro. Un nodo necesita un nombre cuando otra ruta hace referencia a él:

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

El segundo parámetro de `:to()` es el **discriminador** — la clave de entrada en el nodo receptor. Cuando un nodo recibe varias entradas, se recopilan como una tabla indexada por discriminador.

### Entrada del workflow y datos estáticos

`:with_input()` es la única entrada primaria del workflow. `:with_data()` crea fuentes independientes de datos estáticos:

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

Usa `:with_input()` para datos externos del workflow y `:with_data()` para configuración, constantes y datos de referencia compartidos por varios nodos. Los datos estáticos usan optimización por referencia: la primera ruta crea los datos y las posteriores crean referencias.

### Enrutado condicional

Usa `:when()` después de `:to()` para añadir condiciones. Las condiciones se evalúan contra la salida del nodo usando la sintaxis `expr`:

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

Las condiciones pueden combinarse con transformaciones en línea para un enrutado más complejo:

```lua
:func("app:decompose"):as("decompose")
    :to("@success", nil, "{passed: true, feedback: nil}"):when("len(output.items) == 0")
    :to("processor", "items", "output.items")
```

Las expresiones condicionales soportan: comparaciones (`output.score > 0.8`), operadores lógicos (`output.valid && output.count > 5`), funciones de array (`len(output.items) > 0`, `any(output.errors, {.critical})`), operaciones de cadena (`output.status contains 'success'`) y encadenamiento opcional (`output.data?.nested?.value`).

### Terminales del workflow

Enruta a `@success` o `@fail` para terminar el workflow explícitamente. En contextos anidados (ciclos, paralelo), los terminales crean salidas de nodo en lugar de salidas del workflow:

```lua
:func("app:final_step"):to("@success")
:func("app:handler"):error_to("@fail")
```

### Enrutado de errores

Usa `:error_to()` para enrutar errores de nodos a un manejador. Los errores pueden enrutarse como entradas normales a nodos de recuperación:

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

En este grafo, ambos planificadores pueden ejecutarse en paralelo. El error de un planificador sigue la misma ruta al consolidador que su salida correcta.

## Fusión de entradas

La forma de la entrada depende de los discriminadores de ruta y de si el nodo define `args`.

**Sin args — entrada por defecto única:**

```lua
:func("source"):to("target")
-- target receives: raw content (unwrapped)
```

**Sin args — entrada con nombre única:**

```lua
:func("source"):to("target", "task")
-- target receives: { task = content }
```

**Sin args — múltiples entradas:**

```lua
:func("source1"):to("target", "data")
:func("source2"):to("target", "config")
-- target receives: { data = content1, config = content2 }
```

**Con args — las entradas se fusionan con la base:**

```lua
:func("app:api_client", {
    args = { base_url = "https://api.com", timeout = 5000 }
})
-- with :to("api_client", "body") from upstream
-- api_client receives: { base_url = "https://api.com", timeout = 5000, body = content }
```

<note>
Los nodos con <code>args</code> o <code>input_transform</code> en forma de cadena no pueden recibir entradas con el discriminador <code>"default"</code>. Usa discriminadores con nombre mediante <code>:to(target, "input_key")</code> en su lugar.
</note>

## Transformaciones de entrada

Transforma los datos antes de que lleguen a un nodo:

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

Variables de contexto disponibles en las transformaciones: `input` (entrada del workflow), `inputs` (todas las entradas entrantes del nodo), `output` (salida del nodo actual al enrutar).

### Transformaciones de ruta en línea

El tercer parámetro de `:to()` es una expresión de transformación en línea:

```lua
:func("source"):as("source")
    :to("target", nil, "output.data")
    :to("other", nil, "{passed: true, value: output.x}")
    :to("list", nil, "map(output.items, {.id})")
```

## Tipos de nodos

### Nodo función

Ejecuta una entrada `function.lua` registrada.

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
| `args` | table | Argumentos base fusionados con las entradas del nodo |
| `inputs` | table | Requisitos de entrada: `{ required = {...}, optional = {...} }` |
| `context` | table | Contexto de ejecución pasado a la función |
| `input_transform` | string/table | Expresión para transformar entradas |
| `metadata` | table | Metadatos del nodo (p. ej., `{ title = "..." }`) |

Si la función devuelve `{ _control = { commands = [...] } }`, el orquestador genera un workflow hijo. Así es como funcionan los flujos anidados.

### Nodo agente

Ejecuta un agente con llamada a herramientas y una salida estructurada opcional.

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
| `model` | string | Sobrescribir el modelo |
| `arena.prompt` | string | Prompt del sistema |
| `arena.max_iterations` | number | Máx. bucles de razonamiento (por defecto: 64) |
| `arena.min_iterations` | number | Mín. iteraciones antes de salir (por defecto: 1) |
| `arena.tool_calling` | string | `"auto"`, `"any"` (requiere `exit_schema`), `"none"` (rechaza `exit_schema`) |
| `arena.tools` | array | IDs del registro de herramientas |
| `arena.exit_schema` | table | JSON schema para salida estructurada |
| `arena.exit_func_id` | string | Función para validar la salida de exit |
| `arena.context` | table | Contexto adicional |
| `inputs` | table | Requisitos de entrada |
| `active_traits` | array | Sobrescribe los traits activos del agente seleccionado; un array vacío los desactiva para este nodo |
| `active_tools` | array | Sobrescribe las herramientas activas del agente seleccionado; un array vacío las desactiva para este nodo |
| `show_tool_calls` | boolean | Incluir llamadas a herramientas en la salida |
| `input_transform` | string/table | Transformar entradas |
| `metadata` | table | Metadatos del nodo |

**Selección dinámica de agente:** Pasa una cadena vacía como ID de agente y resuélvela vía `input_transform`:

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

**Validación de salida:** Cuando `exit_func_id` está establecido, la función valida la salida de exit del agente. En caso de fallo de validación, el agente recibe el error como observación y continúa (hasta `max_iterations`).

### Nodo ciclo

Repite una función o plantilla mientras mantiene el estado entre iteraciones.

```lua
:cycle({
    func_id = "app:content_cycle",
    max_iterations = 3,
    initial_state = {
        entry_id = entry_id,
        content_prompt = prompt,
        task = task,
        min_score = 8.0,
        feedback_history = {}
    }
})
```

La función de ciclo recibe en cada iteración:

```lua
{
    input = <workflow_input>,  -- only on the first iteration (iteration == 1); nil thereafter
    state = <accumulated_state>,
    last_result = <previous_iteration_output>,
    iteration = <current_iteration_number>
}
```

`input` solo está disponible en la primera iteración y después es `nil`; conserva los datos necesarios en `state` para las iteraciones posteriores.

La función controla la continuación:

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
    -- task is read from state since cycle_context.input is nil after iteration 1
    return flow.create()
        :with_input({ task = cycle_context.state.task })
        :agent("app:worker")
        :agent("app:qa")
        :run()
end
```

| Option | Type | Description |
|--------|------|-------------|
| `func_id` | string | Función de iteración (mutuamente exclusiva con `template`) |
| `template` | FlowBuilder | Plantilla para cada iteración (mutuamente exclusiva con `func_id`) |
| `max_iterations` | number | Iteraciones máximas (por defecto: 100) |
| `initial_state` | table | Estado inicial (por defecto: `{}`) |
| `continue_condition` | string | Expresión: continuar mientras sea verdadera |
| `inputs` | table | Requisitos de entrada |
| `context` | table | Contexto de ejecución pasado a la función de ciclo |
| `input_transform` | string/table | Transforma las entradas antes de que el ciclo las reciba |
| `metadata` | table | Metadatos del nodo |

**Ciclo basado en plantilla:**

```lua
:cycle({
    template = flow.template()
        :agent("app:worker")
        :func("app:validator"),
    max_iterations = 5
})
```

### Nodo paralelo

Procesa elementos de un array mediante una plantilla reutilizable.

```lua
:parallel({
    inputs = { required = { "specs", "task" } },
    source_array_key = "specs",
    iteration_input_key = "spec",
    passthrough_keys = { "task" },
    batch_size = 10,
    scheduling = "rolling",
    on_error = "continue",
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
| `source_array_key` | string | Clave de entrada que contiene un array no vacío (requerido) |
| `template` | FlowBuilder | Plantilla para cada ítem (requerido, debe enrutar a `@success`) |
| `iteration_input_key` | string | Clave de entrada para el ítem actual (por defecto: `"default"`) |
| `batch_size` | number | Entero positivo de hasta 1000; máximo de elementos en curso (por defecto: 1) |
| `scheduling` | string | `"batch"` (por defecto) espera una oleada completa; `"rolling"` repone los huecos completados y requiere `on_error = "continue"` |
| `on_error` | string | `"continue"` (por defecto) o `"fail_fast"`; `"collect_errors"` es un alias de compatibilidad de `"continue"` |
| `filter` | string | `"all"` (por defecto), `"successes"`, `"failures"` |
| `unwrap` | boolean | Devolver resultados en bruto en lugar de metadatos envueltos (por defecto: false) |
| `passthrough_keys` | array | Claves de entrada reenviadas a cada iteración |
| `inputs` | table | Requisitos de entrada |
| `input_transform` | string/table | Transforma las entradas antes del procesamiento paralelo |
| `metadata` | table | Metadatos del nodo |

**Las passthrough keys** proporcionan contexto compartido (configuración, descripción de tarea) a cada iteración sin duplicar datos en el array origen:

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

### Nodo signal

Pausa un nodo hasta que llega una señal externa. Esto permite aprobaciones humanas, eventos externos y workflows por etapas:

```lua
:signal({
    signal_id = "approval",
    inputs = { required = { "draft" } },
    metadata = { title = "Wait for approval" }
})
```

| Option | Type | Description |
|--------|------|-------------|
| `signal_id` | string | Nombre de la señal comparado con `client:signal()`. Si está vacío u omitido, se genera un UUID v7 en tiempo de ejecución |
| `timeout` | string/number | Cadena de duración positiva o milisegundos positivos finitos; al vencer emite `{ timeout = true, code = "SIGNAL_TIMEOUT" }` |
| `inputs` | table | Requisitos de entrada |
| `input_transform` | string/table | Transforma entradas antes de que el nodo las reciba |
| `metadata` | table | Metadatos del nodo |

Envía la señal desde fuera del workflow usando la API del cliente (ver `client:signal()` más abajo).

#### Comportamiento

El nodo hace yield con `wait_for_signal = true` y persiste ese yield en el estado del workflow. El orquestador reanuda el nodo cuando llega un commit `NODE_SIGNAL` coincidente.

- `client:signal()` almacena datos omitidos, `nil` o `false` como `{}`. Ese objeto vacío, además de valores conservados como `0` y `""`, satisface el yield.
- Un yield de señal bloquea `COMPLETE_WORKFLOW` pero no bloquea otros nodos pendientes — las ramas paralelas continúan ejecutándose mientras una rama espera.
- `client:signal()` encola la señal de forma duradera y solicita la activación del workflow. Si llega antes de que el nodo alcance su yield, se entrega cuando ese yield se registra; no hace falta una llamada separada a `:start()`.
- Solo una señal satisface cada yield. Si una segunda señal con el mismo `signal_id` llega antes de que el yield se satisfaga, sobrescribe la primera.
- Cuando varios yields activos comparten un `signal_id`, uno de los yields coincidentes recibe los datos; cuál no está definido. Usa IDs únicos cuando importe el destinatario.
- Omitir `signal_id` genera un UUID v7 que el builder no devuelve. Establece un ID explícito y estable para señales entregadas mediante la API de cliente.
- Los datos de la señal entregada se pasan a la salida del nodo como payload de la señal.

#### Durabilidad y recuperación

El yield de la señal es parte del estado del workflow, persistido a través del mismo mecanismo de outbox que cualquier otro comando. Si el proceso del orquestador es matado mientras espera:

- El yield pendiente se restaura al reiniciar.
- Las señales entregadas durante la interrupción se encolan y aplican cuando el estado se recarga.
- Los pipelines compuestos (`func → signal → signal → func`) se recuperan paso a paso — cada señal puede entregarse a través de un reinicio separado.

Los yields de señal huérfanos (yields cuyo proceso padre salió sin completar) son limpiados por el manejador de salida de proceso del estado del workflow.

#### Patrones de pipeline

Los nodos signal participan en cualquier topología. Añade el binding del cliente junto al import de `flow` mostrado anteriormente:

```yaml
imports:
  client: userspace.dataflow:client
```

```lua
local client = require("client")
local c, client_err = client.new()
if client_err then return nil, client_err end

-- Human-in-the-loop approval between two functions
local approval_id, start_err = flow.create()
    :with_input({ draft_id = "draft-123" })
    :func("app:draft")
    :signal({ signal_id = "approve_draft" })
    :func("app:publish")
    :start()
if start_err then return nil, start_err end

local _, signal_err = c:signal(approval_id, "approve_draft", { approved = true })
if signal_err then return nil, signal_err end

-- Two parallel approvals that must both arrive before release
local release_id, release_err = flow.create()
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
    :start()
if release_err then return nil, release_err end

local _, legal_err = c:signal(release_id, "legal_ok", { approved_by = "legal" })
if legal_err then return nil, legal_err end

local _, finance_err = c:signal(release_id, "finance_ok", { approved_by = "finance" })
if finance_err then return nil, finance_err end
```

Los datos almacenados de la señal se exponen como salida del nodo. Los nodos descendentes reciben el payload enviado, salvo que los datos omitidos, `nil` o `false` se normalizan a `{}`.

### Nodo join

Recolecta múltiples entradas antes de proceder:

```lua
:join({
    inputs = { required = { "source1", "source2" } },
    output_mode = "object",
    ignored_keys = { "triggered" }
})
```

| Option | Type | Description |
|--------|------|-------------|
| `output_mode` | string | `"object"` (por defecto) o `"array"` (orden de llegada) |
| `ignored_keys` | array | Claves de entrada excluidas de la salida |
| `inputs` | table | Requisitos de entrada |
| `input_transform` | string/table | Transforma las entradas antes de unirlas |
| `metadata` | table | Metadatos del nodo |

## Plantillas

Las plantillas definen sub-workflows reutilizables. Crea una con `flow.template()` e insértala con `:use()`:

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

Las plantillas insertan sus operaciones en el flujo padre en tiempo de compilación.

## Workflows anidados

Las funciones usadas en nodos de ciclo y paralelo pueden generar workflows hijos devolviendo `flow.create():run()`:

```lua
function my_processor(input)
    return flow.create()
        :with_input(input)
        :func("app:step_a")
        :func("app:step_b")
        :run()
end
```

Cuando `:run()` se ejecuta dentro de un contexto dataflow existente, devuelve `{ _control = { commands = [...] } }` en lugar de ejecutarse directamente. El orquestador maneja el workflow hijo a través del mecanismo de yield.

<note>
Una función que necesite generar un workflow hijo debe devolver <code>flow.create():run()</code>. Las demás funciones de dataflow pueden devolver resultados normales.
</note>

## Síncrono vs Asíncrono

`:run()` se ejecuta de forma síncrona. Normalmente devuelve la salida terminal del workflow, pero una espera duradera puede pasivar primero la ejecución; en ese caso, el resultado devuelto incluye `pending = true` y `passivated = true` junto al ID del workflow.

```lua
local result, err = flow.create()
    :with_input({ text = "hello" })
    :func("app:process")
    :run()
```

`:start()` devuelve inmediatamente un ID de workflow:

```lua
local dataflow_id, err = flow.create()
    :with_input({ text = "hello" })
    :func("app:process")
    :start()
```

`:start()` no se puede usar en contextos anidados.

## API del cliente

Usa la API de cliente para gestionar workflows mediante programación:

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
| `client.new()` | Crear cliente (requiere el actor y scope de seguridad actuales) |
| `:create_workflow(commands, options?)` | Crear workflow, devuelve `dataflow_id` |
| `:execute(dataflow_id, options?)` | Ejecutar sincrónicamente, devuelve el resultado |
| `:start(dataflow_id, options?)` | Ejecutar asincrónicamente, devuelve `dataflow_id` |
| `:output(dataflow_id)` | Obtener salidas del workflow |
| `:get_status(dataflow_id)` | Obtener estado actual |
| `:cancel(dataflow_id, timeout?)` | Cancelar con gracia (por defecto: 30s) |
| `:terminate(dataflow_id)` | Terminación forzada |
| `:signal(dataflow_id, signal_id, data?)` | Entregar una señal externa a un nodo signal en espera |
| `:revive(dataflow_id)` | Solicitar la activación de un workflow no terminal |

## Estado del workflow

| Status | Description |
|--------|-------------|
| `pending` | Creado, pero aún sin ejecutar |
| `running` | La ejecución del workflow está activa |
| `waiting` | Pasivado mientras espera un evento duradero, como una señal |
| `completed` | Terminado con éxito |
| `failed` | Falló |
| `cancelled` | Cancelado por el usuario |
| `terminated` | Terminado forzadamente |

Los nodos tienen un ciclo de vida separado. Las transiciones actuales usan `template`, `pending`, `running`, `waiting`, `completed`, `failed` y `cancelled`. `ready` se acepta como estado de activación de un workflow cargado; `paused`, `skipped` y `terminated` a nivel de nodo siguen siendo valores de compatibilidad reconocidos, pero no se escriben como transiciones actuales.

## Metadatos

```lua
flow.create()
    :with_title("Document Processing Pipeline")
    :with_metadata({ source = "api", priority = "high" })
    :with_input({ document_id = "doc-123" })
    :func("app:process", { metadata = { title = "Process Document" } })
    :run()
```

El título por defecto es "Flow Builder Workflow" si no se proporciona.

## Reglas de validación

El compilador valida el grafo del workflow antes de la ejecución:

- Todos los nombres de `:as(name)` deben ser únicos
- Todos los destinos `:to()` y `:error_to()` deben referenciar nombres existentes (excepto `@success`, `@fail`)
- El grafo debe ser acíclico
- Todos los nodos deben tener rutas entrantes (de otro nodo, entrada del workflow o datos estáticos)
- `:cycle()` requiere `func_id` o `template` (no ambos)
- `:parallel()` requiere `source_array_key` y `template`
- Al menos una ruta debe llevar a `@success` o tener auto-salida
- `:when()` solo sigue a `:to()` o `:error_to()` de nodos (no de datos estáticos)
- Los nodos con `args` o `input_transform` en forma de cadena no pueden recibir entradas con el discriminador `"default"`

## Referencia de expresiones

Las expresiones usan la sintaxis del módulo `expr`, disponible en las condiciones `:when()` y los valores de `input_transform`.

**Operadores:** `+`, `-`, `*`, `/`, `%`, `**`, `&`, `|`, `^`, `<<`, `>>`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`, `!`, `in`, `contains`, `startsWith`, `endsWith`

**Funciones de array:** `all()`, `any()`, `none()`, `one()`, `filter()`, `map()`, `count()`, `len()`, `first()`, `last()`

**Funciones matemáticas:** `max()`, `min()`, `abs()`, `ceil()`, `floor()`, `round()`, `sqrt()`, `pow()`

**Funciones de cadena:** `len()`, `upper()`, `lower()`, `trim()`, `split()`, `join()`

**Funciones de tipo:** `type()`, `int()`, `float()`, `string()`

**Literales:** números, cadenas, booleanos (`true`/`false`), null (`nil`), arrays (`[1, 2, 3]`), objetos (`{key: value}`)

**Ternario:** `output.age >= 18 ? output.verified : false`

**Encadenamiento opcional:** `output.data?.nested?.value`

## Manejo de errores

Tanto `:run()` como `:start()` siguen las convenciones estándar de errores de Lua:

- Éxito: `data, nil` (run) o `dataflow_id, nil` (start)
- Fallo: `nil, error_message`

Categorías de error: errores de compilación, errores del cliente, errores de creación de workflow, errores de ejecución y fallos de workflow.

## Véase también

- [Agents](./agents.md) — Framework de agentes usado por los nodos agente
- [LLM](./llm.md) — Interfaz de modelos usada por los agentes
- [Descripción general del Framework](./overview.md) — Instalar e importar módulos del framework
