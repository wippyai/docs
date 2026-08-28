---
title: "Dataflow: Ejecutar un DAG duradero"
description: "Construye y ejecuta un pequeño workflow de wippy/dataflow con estado persistido, migraciones automáticas y dos nodos de función."
---

# Dataflow: Ejecutar un DAG duradero

**Clasificación: tutorial ejecutable.** Esta página construye un proyecto
`wippy/dataflow` completo y sin proveedor. No usa embeddings ni un LLM; para
ese caso de uso, consulta [Generación aumentada por recuperación](tutorials/rag.md).

El workflow envía una entrada a través de dos nodos de función:

```text
{ values = { 2, 4, 6 } } -> double -> summarize -> { count = 3, total = 24 }
```

Dataflow persiste el workflow, los nodos, los comandos, las activaciones y los
wakes en SQL. El comando espera a que el bootloader de migraciones cree esas
tablas antes de iniciar el flujo.

## Requisitos previos

- Un proyecto Wippy cuyo directorio de fuentes sea `./src`.
- Wippy runtime `v0.3.32a` o posterior.
- Acceso al registro de módulos para instalar las dependencias por primera vez.

No se requiere ningún proveedor de modelos ni clave de API.

## Estructura del proyecto

```text
dataflow-demo/
├── wippy.lock                 # generated
└── src/
    ├── _index.yaml
    ├── double.lua
    ├── summarize.lua
    └── run.lua
```

## Configurar el runtime

Crea `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: db
    kind: db.sql.sqlite
    file: ./.wippy/dataflow.db
    lifecycle:
      auto_start: true

  - name: env_storage
    kind: env.storage.file
    file_path: ./.wippy/dataflow.env
    auto_create: true

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  # Dataflow includes session views, so its standalone configuration supplies
  # the router those transitive entries target. The HTTP service need not start.
  - name: gateway
    kind: http.service
    addr: ":18080"
    lifecycle:
      auto_start: false

  - name: api.public
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api/public

  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api

  - name: dep.dataflow
    kind: ns.dependency
    component: wippy/dataflow
    version: "0.7.6"
    parameters:
      - name: userspace.dataflow:target_db
        value: app:db
      - name: userspace.dataflow:process_host
        value: app:processes
      - name: wippy.migration:app_db
        value: app:db

  - name: dep.security
    kind: ns.dependency
    component: wippy/security
    version: "*"

  - name: dep.bootloader
    kind: ns.dependency
    component: wippy/bootloader
    version: "*"
    parameters:
      - name: wippy.bootloader:application_host
        value: app:processes
      - name: wippy.bootloader:env_storage
        value: app:env_storage

  - name: dep.llm
    kind: ns.dependency
    component: wippy/llm
    version: "*"
    parameters:
      - name: wippy.llm:process_host
        value: app:processes
      - name: wippy.llm:env_storage
        value: app:env_storage

  - name: dep.session
    kind: ns.dependency
    component: wippy/session
    version: "*"
    parameters:
      - name: wippy.session:database_resource
        value: app:db
      - name: wippy.session:api_router
        value: app:api.public
      - name: wippy.session:env_storage
        value: app:env_storage
      - name: wippy.session:delegation_func_id
        value: userspace.dataflow.session:delegate

  - name: dep.views
    kind: ns.dependency
    component: wippy/views
    version: "*"
    parameters:
      - name: wippy.views:api_router
        value: app:api.public
      - name: wippy.views:env_storage
        value: app:env_storage

  - name: demo_policy
    kind: security.policy
    policy:
      actions: "*"
      resources: "*"
      effect: allow

  - name: double
    kind: function.lua
    source: file://double.lua
    method: handler

  - name: summarize
    kind: function.lua
    source: file://summarize.lua
    method: handler

  - name: run
    kind: process.lua
    meta:
      command:
        name: dataflow-demo
        short: Run the Dataflow tutorial DAG
        security:
          actor:
            id: app:dataflow-demo
          policies:
            - app:demo_policy
    source: file://run.lua
    method: main
    modules:
      - io
      - sql
      - time
    imports:
      flow: userspace.dataflow.flow:flow
```

`wippy/dataflow` es propietario de las entradas de migración. La dependencia
`wippy/migration` es transitiva, mientras `wippy/bootloader` ejecuta su
bootloader de migraciones durante el arranque del runtime. Los parámetros
explícitos anteriores vinculan ambos sistemas a `app:db`.

La política amplia mantiene este tutorial aislado centrado en el comportamiento
del workflow. Los comandos de producción deben sustituirla por las acciones
exactas de función, base de datos y proceso que necesite el workflow.

## Implementar los nodos

Crea `src/double.lua`:

```lua
local function handler(input)
    local result = { values = {} }
    for _, value in ipairs(input.values or {}) do
        table.insert(result.values, value * 2)
    end
    return result
end

return { handler = handler }
```

Crea `src/summarize.lua`:

```lua
local function handler(input)
    local total = 0
    for _, value in ipairs(input.values or {}) do
        total = total + value
    end
    return { count = #(input.values or {}), total = total }
end

return { handler = handler }
```

## Construir y ejecutar el flujo

Crea `src/run.lua`:

```lua
local io = require("io")
local sql = require("sql")
local time = require("time")
local flow = require("flow")

local function wait_for_schema()
    for _ = 1, 100 do
        local db, err = sql.get("app:db")
        if not err then
            local rows, query_err = db:query(
                "SELECT name FROM sqlite_master " ..
                "WHERE type='table' AND name='dataflows'"
            )
            db:release()
            if not query_err and rows and #rows > 0 then
                return true
            end
        end
        time.sleep("100ms")
    end
    return nil, "Dataflow migrations did not finish within 10 seconds"
end

local function main()
    local ready, ready_err = wait_for_schema()
    if not ready then
        io.print("dataflow failed: " .. ready_err)
        return 1
    end

    local result, err = flow.create()
        :with_title("Double and summarize")
        :with_input({ values = { 2, 4, 6 } })
        :func("app:double")
        :as("double")
        :to("summarize", "default")
        :func("app:summarize")
        :as("summarize")
        :run()

    if err then
        io.print("dataflow failed: " .. tostring(err))
        return 1
    end

    io.print(string.format("count=%d total=%d", result.count, result.total))
    return 0
end

return { main = main }
```

Inicializa el lock, resuelve el grafo de dependencias, instálalo y ejecuta el
comando con nombre y los logs de consola habilitados:

```bash
wippy init
wippy update
wippy install
wippy run -c dataflow-demo
```

En la primera ejecución, el bootloader aplica las migraciones de Dataflow. A
continuación, el comando imprime:

```text
count=3 total=24
```

Las ejecuciones posteriores informan que las migraciones ya están aplicadas y
ejecutan un nuevo workflow persistido.

## Verificar la persistencia

El archivo SQLite es `./.wippy/dataflow.db`. Tras una ejecución correcta,
contiene las tablas de Dataflow propiedad del módulo, incluido el
almacenamiento de workflows, nodos, datos, commits, wakes y activaciones. Las
aplicaciones deben inspeccionarlas mediante el cliente de Dataflow o Keeper, no
escribiendo directamente en las tablas.

Usa `:start()` en lugar de `:run()` cuando el llamador deba recibir
inmediatamente un ID de workflow. Usa el cliente de Dataflow para leer el
estado o la salida, o para cancelar, terminar, reactivar o enviar señales a un
workflow asíncrono.

## Siguientes pasos

- [Framework Dataflow](../framework/dataflow.md) — Enrutado, nodos paralelos,
  ciclos, agentes, señales y la API de cliente
- [Generación aumentada por recuperación](tutorials/rag.md) — Recuperación respaldada por embeddings
- [Keeper mediante MCP](./keeper-mcp.md) — Inspeccionar workflows en ejecución desde un cliente MCP
