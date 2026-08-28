---
title: "Procesos WASM"
description: "Ejecuta módulos WASM bajo un host de procesos de Wippy con process.wasm."
---

# Procesos WASM

Una entrada `process.wasm` ejecuta un módulo WASM bajo un host de procesos de Wippy, con creación, supervisión y apagado supervisado.

**Clasificación: referencia de configuración y ciclo de vida de procesos.** Los bloques respaldados por binarios presuponen una compilación externa del componente y entradas de sistema de archivos, host de procesos, entorno y políticas que pertenecen a la aplicación. Los hashes de marcador de posición deben sustituirse por el resumen exacto del binario.

## Configuración de entrada

```yaml
entries:
  - name: wasm_binaries
    kind: fs.directory
    directory: ./wasm

  - name: compute_worker
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /worker.wasm
    hash: sha256:292b796376f8b4cc360acf2ea6b82d1084871c3607a079f30b446da8e5c984a4
    method: compute
```

### Campos de configuración

| Campo | Obligatorio | Descripción |
|-------|----------|-------------|
| `fs` | Sí | ID de la entrada del sistema de archivos que contiene el binario |
| `path` | Sí | Ruta al archivo `.wasm` dentro del sistema de archivos |
| `hash` | Sí | Hash SHA-256 para verificación de integridad |
| `method` | Sí | Nombre de la función exportada que se ejecuta |
| `transport` | No | Transporte de invocación: `payload` (predeterminado) o `wasi-http` |
| `wit` | No | Firma WIT para módulos raw/core |
| `imports` | No | Imports del host a habilitar |
| `wasi` | No | Configuración WASI (`args`, `cwd`, `env` y `mounts`) |
| `limits` | No | Límites de ejecución |

<note>
`process.wasm` comparte su estructura de configuración con `function.wasm`, por lo que el esquema acepta un bloque `pool` pero lo ignora: los procesos se ejecutan bajo el host de procesos y no bajo un pool de funciones.
</note>

## Comandos CLI

Registra un proceso WASM como un comando con nombre usando `meta.command`:

```yaml
  - name: greet
    kind: process.wasm
    meta:
      command:
        name: greet
        short: Greet someone via WASM
    fs: myns:wasm_binaries
    path: /component.wasm
    hash: sha256:...
    method: greet
```

Ejecútalo con:

```bash
wippy run greet
```

Lista los comandos disponibles:

```bash
wippy run list
```

| Campo | Obligatorio | Descripción |
|-------|----------|-------------|
| `name` | Sí | Nombre del comando utilizado con `wippy run <name>` |
| `short` | No | Descripción breve mostrada en `wippy run list` |
| `main` | No | Marca la entrada como comando predeterminado de un pack o módulo del Hub |
| `use_case` | No | Categoría del punto de entrada; el valor predeterminado es `run` |
| `security` | No | Contexto de seguridad aplicado únicamente cuando el lanzador de terminal de confianza inicia este comando |

Para los comandos CLI debe existir un `terminal.host`. Este posee el planificador que utiliza el proceso del comando, por lo que no se requiere un `process.host` independiente. Si existen varios hosts de terminal, selecciona uno con `--host`.

## Ciclo de Vida del Proceso

Los procesos WASM siguen el modelo de ciclo de vida Init/Step/Close:

1. **Init** - Se capturan el contexto de llamada, el método y los argumentos de entrada
2. **Step** - El primer paso crea la instancia e inicia el módulo. Los pasos posteriores hacen avanzar las operaciones enlazadas al dispatcher; una ejecución síncrona puede completarse en el primer paso.
3. **Close** - Se liberan los recursos de la instancia

## Creación desde Lua

Crea un proceso WASM y supervísalo hasta que termine:

```lua
-- Spawn with monitoring
local pid, err = process.spawn_monitored(
    "myns:compute_worker",   -- entry ID
    "myns:processes",        -- process host
    6, 7                     -- arguments passed to the WASM function
)

if err then
    return nil, err
end

-- Wait for the process to complete
local events = process.events()
while true do
    local event, open = events:receive()
    if not open then return nil, errors.new("process event channel closed") end
    if event.kind == process.event.EXIT and event.from == pid then
        local result = event.result.value  -- return value from the WASM function
        return result, event.result.error
    end
end
```

## Ejecución asíncrona

Los procesos WASM pueden ceder el control para las operaciones del host que el entorno de ejecución enlaza al dispatcher, incluidos el sondeo de relojes compatible y HTTP saliente. El planificador suspende el proceso hasta que termina la operación pendiente y después lo reanuda:

```yaml
  - name: http_worker
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /http_worker.wasm
    hash: sha256:...
    method: run
    imports:
      - wasi:io
      - wasi:cli
      - wasi:http
    wasi:
      env:
        - id: myns:api_url
          name: API_URL
          required: true
```

El mecanismo de cesión y reanudación es transparente para el invitado en esas operaciones transformadas en asíncronas. No presupongas que todas las llamadas WASI bloqueantes ceden el control: las lecturas y escrituras de streams son síncronas en el entorno de ejecución fijado.

## Configuración WASI

Los procesos admiten la misma configuración WASI que las funciones:

```yaml
  - name: file_processor
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /processor.wasm
    hash: sha256:...
    method: process
    imports:
      - wasi:cli
      - wasi:io
      - wasi:clocks
      - wasi:filesystem
    wasi:
      args: ["--input", "/data/input.csv"]
      cwd: "/app"
      env:
        - id: myns:output_format
          name: OUTPUT_FORMAT
      mounts:
        - fs: myns:input_data
          guest: /data
          read_only: true
        - fs: myns:output_dir
          guest: /output
```

## Véase también

- [Descripción general](wasm/overview.md) - Descripción general del entorno de ejecución WebAssembly
- [Funciones](wasm/functions.md) - Configuración de funciones WASM
- [Funciones del host](wasm/hosts.md) - Interfaces disponibles en el host
- [Modelo de procesos](concepts/process-model.md) - Ciclo de vida de los procesos
- [Supervisión](guides/supervision.md) - Árboles de supervisión de procesos
