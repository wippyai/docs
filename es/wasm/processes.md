# Procesos WASM

Los modulos WASM pueden ejecutarse como procesos a traves del tipo de entrada `process.wasm`. Los procesos se ejecutan dentro del host de procesos de Wippy y soportan el ciclo de vida completo del proceso: creacion, monitoreo y apagado supervisado.

## Configuracion de Entrada

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

### Campos de Configuracion

| Field | Required | Description |
|-------|----------|-------------|
| `fs` | Yes | ID de la entrada del sistema de archivos que contiene el binario |
| `path` | Yes | Ruta al archivo `.wasm` dentro del sistema de archivos |
| `hash` | Yes | Hash SHA-256 para verificacion de integridad |
| `method` | Yes | Nombre de la funcion exportada a ejecutar |
| `imports` | No | Imports del host a habilitar |
| `wasi` | No | Configuracion WASI (args, env, mounts) |
| `limits` | No | Limites de ejecucion |

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

Ejecutalo con:

```bash
wippy run greet
```

Lista los comandos disponibles:

```bash
wippy run list
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Nombre del comando usado con `wippy run <name>` |
| `short` | No | Descripcion corta mostrada en `wippy run list` |

Se requiere un `terminal.host` y un `process.host` para que los comandos CLI funcionen.

## Ciclo de Vida del Proceso

Los procesos WASM siguen el modelo de ciclo de vida Init/Step/Close:

1. **Init** - El modulo se instancia, los argumentos de entrada se capturan
2. **Step** - La ejecucion avanza. Para modulos asincronos, el planificador maneja los ciclos de yield/resume. Para modulos sincronos, la ejecucion se completa en un solo paso.
3. **Close** - Los recursos de la instancia se liberan

## Creacion desde Lua

Crea un proceso WASM y monitorealo hasta su finalizacion:

```lua
local process = require("process")
local time = require("time")

-- Spawn with monitoring
local pid, err = process.spawn_monitored(
    "myns:compute_worker",   -- entry ID
    "myns:processes",        -- process group
    6, 7                     -- arguments passed to the WASM function
)

if err then
    error("spawn failed: " .. tostring(err))
end

-- Wait for the process to complete
local event = process.receive(time.seconds(10))
if event and event.type == "EXIT" then
    local result = event.value  -- return value from the WASM function
end
```

## Ejecucion Asincrona

Los procesos WASM que importan interfaces WASI pueden realizar operaciones asincronas. El planificador suspende el proceso durante la E/S y lo reanuda cuando la operacion se completa:

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
      - funcs
    wasi:
      env:
        - id: myns:api_url
          name: API_URL
          required: true
```

El mecanismo de yield/resume es transparente para el codigo WASM. Las llamadas bloqueantes estandar en el guest (sleep, read, write, solicitudes HTTP) ceden automaticamente el control al dispatcher.

## Configuracion WASI

Los procesos soportan la misma configuracion WASI que las funciones:

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

## Ver Tambien

- [Descripcion general](wasm/overview.md) - Descripcion general del runtime WebAssembly
- [Funciones](wasm/functions.md) - Configuracion de funciones WASM
- [Funciones Host](wasm/hosts.md) - Interfaces host disponibles
- [Modelo de Procesos](concepts/process-model.md) - Ciclo de vida de procesos
- [Supervision](guides/supervision.md) - Arboles de supervision de procesos
