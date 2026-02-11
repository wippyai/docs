# Funciones WASM

Las funciones WASM son entradas del registro que ejecutan codigo WebAssembly. Hay dos tipos de entrada disponibles: `function.wat` para fuente WAT en linea y `function.wasm` para binarios precompilados.

## Funciones WAT en Linea

Define funciones WASM pequenas directamente en tu `_index.yaml` usando el formato WebAssembly Text:

```yaml
entries:
  - name: answer
    kind: function.wat
    source: |
      (module
        (func (export "answer") (result i32)
          i32.const 42
        )
      )
    wit: |
      answer: func() -> s32;
    method: answer
    pool:
      type: inline
```

Para fuentes WAT mas grandes, usa una referencia a archivo:

```yaml
  - name: answer
    kind: function.wat
    source: file://answer.wat
    wit: |
      answer: func() -> s32;
    method: answer
    pool:
      type: inline
```

### Campos de Configuracion WAT

| Field | Required | Description |
|-------|----------|-------------|
| `source` | Yes | Fuente WAT en linea o referencia `file://` |
| `method` | Yes | Nombre de la funcion exportada a invocar |
| `wit` | No | Firma WIT para modulos raw/core |
| `pool` | No | Configuracion del pool de workers |
| `transport` | No | Mapeo de entrada/salida (por defecto: `payload`) |
| `imports` | No | Imports del host a habilitar (ej., `wasi:cli`, `wasi:io`) |
| `wasi` | No | Configuracion WASI (args, env, mounts) |
| `limits` | No | Limites de ejecucion |

## Funciones WASM Precompiladas

Carga binarios `.wasm` compilados desde una entrada del sistema de archivos:

```yaml
entries:
  - name: assets
    kind: fs.directory
    directory: ./wasm

  - name: compute
    kind: function.wasm
    fs: myns:assets
    path: /compute.wasm
    hash: sha256:292b796376f8b4cc360acf2ea6b82d1084871c3607a079f30b446da8e5c984a4
    method: compute
    pool:
      type: lazy
      max_size: 4
```

### Campos de Configuracion WASM

| Field | Required | Description |
|-------|----------|-------------|
| `fs` | Yes | ID de la entrada del sistema de archivos que contiene el binario |
| `path` | Yes | Ruta al archivo `.wasm` dentro del sistema de archivos |
| `hash` | Yes | Hash SHA-256 para verificacion de integridad (`sha256:...`) |
| `method` | Yes | Nombre de la funcion exportada a invocar |
| `wit` | No | Firma WIT para modulos raw/core |
| `pool` | No | Configuracion del pool de workers |
| `transport` | No | Mapeo de entrada/salida (por defecto: `payload`) |
| `imports` | No | Imports del host a habilitar |
| `wasi` | No | Configuracion WASI |
| `limits` | No | Limites de ejecucion |

## Pools de Workers

Cada funcion WASM usa un pool de instancias precompiladas. El tipo de pool controla la concurrencia y el uso de recursos.

| Type | Description |
|------|-------------|
| `inline` | Sincronico, un solo hilo. Nueva instancia por llamada. |
| `lazy` | Cero workers inactivos. Escala bajo demanda hasta `max_size`. |
| `static` | Numero fijo de workers con cola de solicitudes. |
| `adaptive` | Pool elastico con auto-escalado. |

### Configuracion del Pool

```yaml
pool:
  type: static
  size: 4            # Total pool size
  workers: 2         # Worker threads
  buffer: 16         # Request queue buffer (default: workers * 64)
```

```yaml
pool:
  type: lazy
  max_size: 8        # Maximum concurrent instances
```

```yaml
pool:
  type: adaptive
  max_size: 16       # Upper scaling bound
  warm_start: true   # Pre-instantiate initial workers
```

El maximo por defecto del pool elastico es 100 workers cuando `max_size` no esta especificado.

## Transportes

Los transportes controlan como se mapean la entrada y salida entre el runtime y el modulo WASM.

| Transport | Description |
|-----------|-------------|
| `payload` | Mapea los payloads del runtime directamente a los argumentos de la llamada WASM (por defecto) |
| `wasi-http` | Mapea el contexto de solicitud/respuesta HTTP a los argumentos y resultados WASM |

### Transporte Payload

El transporte por defecto pasa los argumentos directamente. Los valores Lua se transcodifican a tipos Go, luego se reducen a tipos WIT:

```yaml
  - name: compute
    kind: function.wasm
    fs: myns:assets
    path: /compute.wasm
    hash: sha256:...
    method: compute
    pool:
      type: inline
```

```lua
-- Arguments passed directly as WASM function parameters
local result, err = funcs.call("myns:compute", 6, 7)
-- result: 42
```

### Transporte WASI HTTP

El transporte `wasi-http` mapea solicitudes HTTP a WASM y escribe los resultados de vuelta en la respuesta HTTP. Usa esto para exponer funciones WASM como endpoints HTTP:

```yaml
  - name: greet_wasm
    kind: function.wasm
    fs: myns:assets
    path: /greet.wasm
    hash: sha256:...
    method: greet
    transport: wasi-http
    pool:
      type: inline

  - name: greet_endpoint
    kind: http.endpoint
    method: POST
    path: /api/greet
    func: greet_wasm
```

## Limites de Ejecucion

Establece un tiempo maximo de ejecucion para una funcion:

```yaml
limits:
  max_execution_ms: 5000   # 5 second timeout
```

Cuando se excede el limite, la ejecucion se cancela y se retorna un error.

## Configuracion WASI

Configura las capacidades WASI para el modulo guest:

```yaml
wasi:
  args: ["--verbose"]
  cwd: "/app"
  env:
    - id: myns:api_key
      name: API_KEY
      required: true
    - id: myns:debug_mode
      name: DEBUG
  mounts:
    - fs: myns:data_files
      guest: /data
      read_only: true
    - fs: myns:output
      guest: /output
```

| Field | Description |
|-------|-------------|
| `args` | Argumentos de linea de comandos pasados al guest |
| `cwd` | Directorio de trabajo dentro del guest (debe ser absoluto) |
| `env` | Variables de entorno mapeadas desde entradas env del registro |
| `mounts` | Montajes del sistema de archivos desde entradas filesystem del registro |

Las variables de entorno se resuelven desde el registro de entorno en el momento de la llamada. Las variables requeridas causan un error si no se encuentran.

Las rutas de montaje deben ser absolutas y unicas. Cada montaje mapea una entrada del sistema de archivos del runtime a una ruta de directorio del guest.

## Ejemplos

### Pipeline de Transformacion de Datos

```yaml
entries:
  - name: wasm_binaries
    kind: fs.directory
    directory: ./wasm

  - name: transform_users
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /mapper.wasm
    hash: sha256:7304fc7d19778605458ae5804dae9a7343dcd3f5fc22bcc9415e98b5047192dd
    method: transform-users
    pool:
      type: lazy
      max_size: 4

  - name: filter_active
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /mapper.wasm
    hash: sha256:7304fc7d19778605458ae5804dae9a7343dcd3f5fc22bcc9415e98b5047192dd
    method: filter-active
    pool:
      type: lazy
      max_size: 4
```

```lua
local funcs = require("funcs")

local users = {
    {id = 1, name = "Alice", tags = {"admin", "dev"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
    {id = 3, name = "Carol", tags = {"dev"}, active = true},
}

-- Transform: adds display field and tag count
local transformed, err = funcs.call("myns:transform_users", users)

-- Filter: returns only active users
local active, err = funcs.call("myns:filter_active", users)
```

### Sleep Asincrono con WASI Clocks

Los componentes WASM que importan `wasi:clocks` y `wasi:io` pueden usar relojes y polling. El mecanismo de yield asincrono se integra con el dispatcher de Wippy:

```yaml
  - name: sleep_ms
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /sleep_test.wasm
    hash: sha256:...
    method: "test-sleep#sleep-ms"
    imports:
      - wasi:io
      - wasi:clocks
    pool:
      type: inline
```

El separador `#` en el campo method referencia un metodo de interfaz: `test-sleep#sleep-ms` invoca la funcion `sleep-ms` de la interfaz `test-sleep`.

## Ver Tambien

- [Descripcion general](wasm/overview.md) - Descripcion general del runtime WebAssembly
- [Funciones Host](wasm/hosts.md) - Interfaces host disponibles
- [Procesos](wasm/processes.md) - Ejecucion de WASM como procesos
- [Tipos de Entradas](guides/entry-kinds.md) - Todos los tipos de entradas del registro
