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
    method: run
    imports:
      - wippy:actor
      - wasi:io
      - wasi:poll
    options:
      limits:
        memory_bytes: 67108864
      mailbox:
        capacity: 128
        bytes: 8388608
        message_bytes: 1048576
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
| `options` | No | Controles del actor: `worker_class`, `limits` y `mailbox` |

<note>
Un actor `process.wasm` posee una instancia del módulo durante toda la vida de
su PID y conserva el estado del guest entre mensajes. Por ello no se aplica el
pool de funciones y un bloque `pool` se rechaza. Los límites del actor van en
`options.limits`; las formas antiguas `limits` y `meta.options` se aceptan
temporalmente con una advertencia de obsolescencia.
</note>

### Actores WASM con estado

El import de componente `wippy:actor` expone `self`, `send`, `try-receive`,
`receive` y `subscribe` mediante `wippy:actor/process@0.1.0`. Cada PID tiene un
buzón limitado (128 mensajes, 8 MiB en total y 1 MiB por mensaje de forma
predeterminada). `send` se autoriza como `process.send` contra el PID de destino.
Los formatos de payload admitidos son `bytes`, `text` UTF-8 y `json` UTF-8. La
clase de worker predeterminada es `wasm`; el límite de memoria es 64 MiB, hasta
4 GiB en múltiplos de 64 KiB.

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

Se requiere un `terminal.host` para que los comandos CLI funcionen; es el host de procesos que ejecuta el comando.

## Ciclo de Vida del Proceso

Los procesos WASM siguen el modelo de ciclo de vida Init/Step/Close:

1. **Init** - Se capturan el contexto de llamada, el método y los argumentos de entrada
2. **Step** - El primer paso crea la instancia e inicia el módulo. Los pasos posteriores hacen avanzar las operaciones enlazadas al dispatcher; una ejecución síncrona puede completarse en el primer paso.
3. **Close** - Se liberan los recursos de la instancia

## Creación desde Lua

Crea un proceso WASM y supervísalo hasta que termine:

```lua
local errors = require("errors")

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

Los actores WASM pueden ceder el control para las operaciones del host que el
entorno de ejecución enlaza al dispatcher, incluidos la recepción y el envío
del buzón, el sondeo, los relojes, los sockets, DNS, los streams del sistema de
archivos y HTTP saliente. El planificador suspende el proceso hasta que termina
la operación y después reanuda la misma instancia invitada:

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

El mecanismo de cesión y reanudación es transparente para un módulo core
transformado en asíncrono o un componente que use las interfaces sondeables
compatibles.

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
