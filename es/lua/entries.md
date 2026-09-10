---
title: "Tipos de Entrada Lua"
description: "Configuración para entradas basadas en Lua: funciones, procesos, flujos de trabajo y bibliotecas."
---

# Tipos de Entrada Lua

Los tipos de entrada Lua definen cómo se carga y ejecuta el código fuente como función, proceso, workflow o biblioteca.

Esta página es una referencia de configuración. Los bloques YAML son definiciones parciales de entradas pensadas para colocarse bajo un mapping `entries:` en un índice de Wippy; no son aplicaciones completas por sí solas. Los archivos fuente, imports, dependencias, hosts de procesos y políticas de seguridad referenciados deben existir en el proyecto que los rodea.

## Tipos de Entrada

| Tipo | Descripción |
|------|-------------|
| `function.lua` | Función sin estado, se ejecuta bajo demanda |
| `process.lua` | Actor de larga duración con estado |
| `workflow.lua` | Flujo de trabajo durable (Temporal) |
| `library.lua` | Código compartido importado por otras entradas |

Cada tipo tiene una contraparte de bytecode precompilado (`function.lua.bc`, `library.lua.bc`, `process.lua.bc`, `workflow.lua.bc`) producida por `wippy pack --bytecode '**'` (o un patrón como `--bytecode 'app:**'`). Los autores escriben entradas `.lua`; los tipos de bytecode se emiten al empaquetar con esa bandera.

## Campos Comunes

Todas las entradas Lua comparten estos campos:

| Campo | Requerido | Descripción |
|-------|----------|-------------|
| `name` | sí | Nombre único dentro del namespace |
| `kind` | sí | Uno de los tipos Lua anteriores |
| `source` | sí | Código fuente Lua inline o una referencia `file://path.lua` resuelta al cargar el registro |
| `method` | function/process/workflow | Función a exportar (las bibliotecas no la usan) |
| `modules` | no | Módulos permitidos para `require()` |
| `imports` | no | Otras entradas como módulos locales |
| `meta` | no | Metadatos buscables |

`pool` solo se aplica a `function.lua`. `security` se aplica a `function.lua` y `process.lua`.

## `function.lua`

Una entrada `function.lua` se ejecuta bajo demanda y cada invocación se gestiona de forma independiente.

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  modules:
    - http
    - json
```

Usar para: Manejadores HTTP, transformaciones de datos, utilidades.

## `process.lua`

Una entrada `process.lua` es un actor de larga duración que conserva estado y se comunica mediante mensajes.

```yaml
- name: worker
  kind: process.lua
  source: file://worker.lua
  method: main
  modules:
    - sql
```

Usar para: Trabajadores en segundo plano, demonios de servicio, actores con estado.

Para ejecutar como servicio supervisado:

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

Una entrada `workflow.lua` define un workflow durable cuyo estado se conserva en Temporal.

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - workflow
    - time
```

Usar para: Procesos de negocio de múltiples pasos, orquestaciones de larga duración.

## `library.lua`

Una entrada `library.lua` proporciona código compartido que otras entradas pueden importar.

```yaml
- name: helpers
  kind: library.lua
  source: file://helpers.lua
  modules:
    - json
    - base64
```

Otras entradas lo referencian vía `imports`:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  imports:
    helpers: app.lib:helpers
```

En código Lua:

```lua
local helpers = require("helpers")
helpers.format_date(timestamp)
```

## Módulos

El campo `modules` controla qué módulos pueden cargarse con `require()`:

```yaml
modules:
  - http
  - json
  - sql
```

`channel`, `payload`, `print`, `process`, `subscribe` y `unsubscribe` se cargan como globales de Lua y no necesitan aparecer en `modules:`. `require("process")` también está permitido sin una declaración `modules:`.

Solo están disponibles los módulos integrados incluidos en la lista y los aliases declarados en `imports`. La allowlist de módulos limita el acceso a capacidades del runtime, hace explícitas las dependencias y restringe los workflows a clases de módulos compatibles con workflows.

Consulta [Runtime de Lua](lua/overview.md) para ver los módulos disponibles.

## Imports

Importe otras entradas como módulos locales:

```yaml
imports:
  utils: app.lib:utils       # require("utils")
  auth: app.auth:helpers     # require("auth")
```

La clave se convierte en el nombre del módulo en código Lua. El valor es el ID de entrada (`namespace:name`).

## Pools de funciones

Usa `pool` para configurar cómo se ejecuta una entrada de función:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  pool:
    type: adaptive    # explícito; omítalo para usar la auto-selección (lazy)
    max_size: 16      # tope para el crecimiento elástico
```

| Campo | Pools | Descripción |
|-------|-------|-------------|
| `type` | todos | Implementación del scheduler (ver tabla abajo) |
| `workers` | static | Cantidad de hilos worker (recurre a `size`, y luego a 8) |
| `size` | static | Cantidad de workers cuando `workers` no está definido; con `type` omitido, `size` sin `max_size` selecciona un pool inline |
| `buffer` | static | Capacidad de la cola de tareas (por defecto: `workers * 64`) |
| `max_size` | lazy, adaptive | Tope superior para crecimiento elástico (por defecto: 16; 100 cuando se omite `type`) |

| Tipo | Comportamiento |
|------|----------------|
| `inline` | Ejecución síncrona en la goroutine del llamador. Sin aislamiento entre llamadas. |
| `lazy` | Cero workers en reposo, se crean bajo demanda y se eliminan cuando están inactivos. |
| `static` | Pool de tamaño fijo basado en canales. Predecible bajo carga estable. |
| `adaptive` | Pool auto-escalable — crece bajo carga, se reduce cuando está inactivo. |

Cuando se omite `type`, el pool se auto-selecciona a partir de los demás campos: un pool lazy por defecto, un pool static si `workers` está definido, un pool inline si solo `size` está definido.

## Metadatos

Usa `meta` para adjuntar campos buscables de routing y discovery:

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

Los metadatos son buscables vía el registro:

```lua
local registry = require("registry")
local handlers = registry.find({["meta.type"] = "handler"})
```

La consulta devuelve todas las entradas coincidentes del registro. El código Lua pertenece a una entrada ejecutable cuya lista `modules` incluye `registry`, como la entrada `api_handler` anterior.

## Vea También

- [Tipos de entrada](guides/entry-kinds.md) - Referencia de todos los tipos de entrada
- [Unidades de cómputo](concepts/compute-units.md) - Funciones vs. procesos vs. workflows
- [Runtime de Lua](lua/overview.md) - Módulos disponibles
