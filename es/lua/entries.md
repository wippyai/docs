# Tipos de Entrada Lua

Configuracion para entradas basadas en Lua: funciones, procesos, flujos de trabajo y bibliotecas.

## Tipos de Entrada

| Tipo | Descripcion |
|------|-------------|
| `function.lua` | Funcion sin estado, se ejecuta bajo demanda |
| `process.lua` | Actor de larga duracion con estado |
| `workflow.lua` | Flujo de trabajo durable (Temporal) |
| `library.lua` | Codigo compartido importado por otras entradas |

## Campos Comunes

Todas las entradas Lua comparten estos campos:

| Campo | Requerido | Descripcion |
|-------|----------|-------------|
| `name` | si | Nombre unico dentro del namespace |
| `kind` | si | Uno de los tipos Lua anteriores |
| `source` | si | Ruta del archivo Lua (`file://path.lua`) |
| `method` | si | Funcion a exportar |
| `modules` | no | Modulos permitidos para `require()` |
| `imports` | no | Otras entradas como modulos locales |
| `meta` | no | Metadatos buscables |

## function.lua

Funcion sin estado llamada bajo demanda. Cada invocacion es independiente.

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

## process.lua

Actor de larga duracion que mantiene estado entre mensajes. Se comunica mediante paso de mensajes.

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

## workflow.lua

Flujo de trabajo durable que sobrevive a reinicios. El estado se persiste en Temporal.

```yaml
- name: order_processor
  kind: workflow.lua
  source: file://order_workflow.lua
  method: main
  modules:
    - workflow
    - time
```

Usar para: Procesos de negocio de multiples pasos, orquestaciones de larga duracion.

## library.lua

Codigo compartido que puede ser importado por otras entradas.

```yaml
- name: helpers
  kind: library.lua
  source: file://helpers.lua
  method: main
  modules:
    - json
    - base64
```

Otras entradas lo referencian via `imports`:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  imports:
    helpers: app.lib:helpers
```

En codigo Lua:

```lua
local helpers = require("helpers")
helpers.format_date(timestamp)
```

## Modulos

El campo `modules` controla que modulos pueden cargarse con `require()`:

```yaml
modules:
  - http
  - json
  - sql
  - process
  - channel
```

Solo los modulos listados estan disponibles. Esto proporciona:
- Seguridad: Prevenir acceso a modulos del sistema
- Dependencias explicitas: Claro que necesita el codigo
- Determinismo: Los flujos de trabajo solo obtienen modulos deterministicos

Consulte [Runtime de Lua](lua-overview.md) para modulos disponibles.

## Imports

Importe otras entradas como modulos locales:

```yaml
imports:
  utils: app.lib:utils       # require("utils")
  auth: app.auth:helpers     # require("auth")
```

La clave se convierte en el nombre del modulo en codigo Lua. El valor es el ID de entrada (`namespace:name`).

## Configuracion de Pool

Configure el pool de ejecucion para funciones:

```yaml
- name: handler
  kind: function.lua
  source: file://handler.lua
  method: main
  pool:
    type: inline    # Ejecutar en contexto del llamador
```

Tipos de pool:
- `inline` - Ejecutar en contexto del llamador (por defecto para manejadores HTTP)

## Metadatos

Use `meta` para enrutamiento y descubrimiento:

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

Los metadatos son buscables via el registro:

```lua
local registry = require("registry")
local handlers = registry.find({type = "handler"})
```

## Vea Tambien

- [Tipos de Entrada](guide-entry-kinds.md) - Referencia de todos los tipos de entrada
- [Unidades de Computo](concept-compute-units.md) - Funciones vs procesos vs flujos de trabajo
- [Runtime de Lua](lua-overview.md) - Modulos disponibles
