# Tipos de Entrada Lua

Configuración para entradas basadas en Lua: funciones, procesos, flujos de trabajo y bibliotecas.

## Tipos de Entrada

| Tipo | Descripción |
|------|-------------|
| `function.lua` | Función sin estado, se ejecuta bajo demanda |
| `process.lua` | Actor de larga duración con estado |
| `workflow.lua` | Flujo de trabajo durable (Temporal) |
| `library.lua` | Código compartido importado por otras entradas |

## Campos Comunes

Todas las entradas Lua comparten estos campos:

| Campo | Requerido | Descripción |
|-------|----------|-------------|
| `name` | sí | Nombre único dentro del namespace |
| `kind` | sí | Uno de los tipos Lua anteriores |
| `source` | sí | Ruta del archivo Lua (`file://path.lua`) |
| `method` | sí | Función a exportar |
| `modules` | no | Módulos permitidos para `require()` |
| `imports` | no | Otras entradas como módulos locales |
| `meta` | no | Metadatos buscables |

## function.lua

Función sin estado llamada bajo demanda. Cada invocación es independiente.

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

Actor de larga duración que mantiene estado entre mensajes. Se comunica mediante paso de mensajes.

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

Usar para: Procesos de negocio de múltiples pasos, orquestaciones de larga duración.

## library.lua

Código compartido que puede ser importado por otras entradas.

```yaml
- name: helpers
  kind: library.lua
  source: file://helpers.lua
  method: main
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
  - process
  - channel
```

Solo los módulos listados están disponibles. Esto proporciona:
- Seguridad: Prevenir acceso a módulos del sistema
- Dependencias explícitas: Claro qué necesita el código
- Determinismo: Los flujos de trabajo solo obtienen módulos determinísticos

Consulte [Runtime de Lua](lua/overview.md) para módulos disponibles.

## Imports

Importe otras entradas como módulos locales:

```yaml
imports:
  utils: app.lib:utils       # require("utils")
  auth: app.auth:helpers     # require("auth")
```

La clave se convierte en el nombre del módulo en código Lua. El valor es el ID de entrada (`namespace:name`).

## Configuración de Pool

Configure el pool de ejecución para funciones:

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

Los metadatos son buscables vía el registro:

```lua
local registry = require("registry")
local handlers = registry.find({type = "handler"})
```

## Vea También

- [Tipos de Entrada](guides/entry-kinds.md) - Referencia de todos los tipos de entrada
- [Unidades de Cómputo](concepts/compute-units.md) - Funciones vs procesos vs flujos de trabajo
- [Runtime de Lua](lua/overview.md) - Módulos disponibles
