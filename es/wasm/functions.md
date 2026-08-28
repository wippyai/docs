---
title: "Funciones WASM"
description: "Configura funciones WAT en línea y funciones WASM precompiladas como entradas del registro."
---

# Funciones WASM

Utiliza `function.wat` para código fuente WebAssembly Text en línea y `function.wasm` para binarios precompilados.

**Clasificación: referencia de configuración de funciones.** Los bloques WAT son ejemplos pequeños del registro. Los ejemplos precompilados presuponen una compilación externa del componente, una entrada de sistema de archivos, métodos exportados que coinciden con el WIT del invitado y un resumen SHA-256 calculado a partir del binario exacto. Los hashes de ejemplo que parecen reales son ilustrativos.

## Funciones WAT en línea

Define una función WAT directamente en `_index.yaml`:

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

### Campos de configuración WAT

| Campo | Obligatorio | Descripción |
|-------|----------|-------------|
| `source` | Sí | Fuente WAT en línea o referencia `file://` |
| `method` | Sí | Nombre de la función exportada que se invoca |
| `wit` | No | Firma WIT para módulos raw/core |
| `pool` | No | Configuración del pool de workers |
| `transport` | No | Mapeo de entrada y salida (valor predeterminado: `payload`) |
| `imports` | No | Imports del host que se habilitan (p. ej., `wasi:cli`, `wasi:io`) |
| `wasi` | No | Configuración WASI (args, env, mounts) |
| `limits` | No | Límites de ejecución |

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

### Campos de configuración WASM

| Campo | Obligatorio | Descripción |
|-------|----------|-------------|
| `fs` | Sí | ID de la entrada del sistema de archivos que contiene el binario |
| `path` | Sí | Ruta al archivo `.wasm` dentro del sistema de archivos |
| `hash` | Sí | Hash SHA-256 para verificación de integridad (`sha256:...`) |
| `method` | Sí | Nombre de la función exportada que se invoca |
| `wit` | No | Firma WIT para módulos raw/core |
| `pool` | No | Configuración del pool de workers |
| `transport` | No | Mapeo de entrada y salida (valor predeterminado: `payload`) |
| `imports` | No | Imports del host a habilitar |
| `wasi` | No | Configuración WASI |
| `limits` | No | Límites de ejecución |

## Pools de Workers

Cada función WASM utiliza un pool de instancias precompiladas. El tipo de pool controla la concurrencia y el uso de recursos.

| Tipo | Descripción |
|------|-------------|
| `inline` | Serializado mediante mutex. Las llamadas síncronas secuenciales reutilizan una instancia preparada; las llamadas transformadas en asíncronas la cierran después de cada llamada, y la política de memoria retenida también puede provocar su sustitución. |
| `lazy` | Cero workers inactivos. Escala bajo demanda hasta `max_size`. |
| `static` | Número fijo de workers con cola de solicitudes. |
| `adaptive` | Pool elástico con escalado automático. |

### Configuración del pool

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
```

El valor predeterminado de 100 workers se aplica únicamente al pool seleccionado implícitamente, cuando no se establece `type`. Si se define explícitamente `type: lazy` o `type: adaptive` sin `max_size`, el máximo predeterminado es de 16 workers.

### Clases de workers y afinidad de núcleos

Definir `pool.worker_class` enruta la función a un pool dedicado de workers fijados a hilos del SO en lugar de los tipos de pool compartidos anteriores (`type` se ignora cuando está definido; nombre convencional: `wasm`):

```yaml
pool:
  worker_class: wasm
  workers: 8         # optional; defaults to reserved cores, else min(NumCPU, 4)
```

El aislamiento de nucleos se activa por runtime en `.wippy.yaml`:

```yaml
scheduler:
  wasm_isolation:
    enabled: true      # default: false
    reserved_cores: 2  # cores reserved for WASM pools (default: 1)
```

Con el aislamiento habilitado, el scheduler de actores y los pools WASM fijados se ejecutan en conjuntos de CPU disjuntos (`sched_setaffinity`, solo Linux — otras plataformas dimensionan los pools pero no fijan los hilos). Las llamadas WASM de larga duracion no pueden entonces privar de CPU a la planificacion de actores.

## Transportes

Los transportes controlan como se mapean la entrada y salida entre el runtime y el modulo WASM.

| Transporte | Descripción |
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
if err then return nil, err end
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

## Límites de ejecución

Limita el tiempo de ejecución y recicla las instancias preparadas que retengan demasiada memoria lineal:

```yaml
limits:
  max_execution_ms: 5000
  max_retained_memory_bytes: 67108864
  retained_memory_check_interval: 16
```

| Campo | Predeterminado | Descripción |
|-------|---------|-------------|
| `max_execution_ms` | `0` | Duración máxima de la llamada en milisegundos; `0` deshabilita el tiempo límite |
| `max_retained_memory_bytes` | 64 MiB | Recicla una instancia preparada después de una llamada cuando la memoria retenida supera este valor; un `0` explícito deshabilita el reciclaje |
| `retained_memory_check_interval` | Consulta más abajo | Número de llamadas completadas entre comprobaciones de memoria retenida |

Cuando se supera el límite de ejecución, la llamada se cancela y devuelve un error. El límite predeterminado de 64 MiB de memoria retenida se comprueba cada 16 llamadas. Si `max_retained_memory_bytes` se establece explícitamente en un valor positivo y se omite el intervalo, el entorno de ejecución comprueba después de cada llamada. Define un intervalo positivo para amortizar esas comprobaciones.

## Configuración WASI

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

| Campo | Descripción |
|-------|-------------|
| `args` | Argumentos de línea de comandos pasados al invitado |
| `cwd` | Directorio de trabajo dentro del invitado (debe ser absoluto) |
| `env` | Variables de entorno mapeadas desde entradas env del registro |
| `mounts` | Montajes del sistema de archivos desde entradas filesystem del registro |

Las variables de entorno se resuelven desde el registro de entorno en el momento de la llamada. Las variables requeridas causan un error si no se encuentran.

Las rutas de montaje deben ser absolutas y unicas. Cada montaje mapea una entrada del sistema de archivos del runtime a una ruta de directorio del guest.

## Ejemplos

### Pipeline de transformación de datos

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
if err then return nil, err end

-- Filter: returns only active users
local active, filter_err = funcs.call("myns:filter_active", users)
if filter_err then return nil, filter_err end
```

### Espera asíncrona con relojes WASI

Los componentes WASM que importan `wasi:clocks`, `wasi:io` y el perfil independiente `wasi:poll` pueden usar relojes y sondeo. El mecanismo de cesión asíncrona se integra con el dispatcher de Wippy:

```yaml
  - name: sleep_ms
    kind: function.wasm
    fs: myns:wasm_binaries
    path: /sleep_test.wasm
    hash: sha256:...
    method: "test-sleep#sleep-ms"
    imports:
      - wasi:io
      - wasi:poll
      - wasi:clocks
    pool:
      type: inline
```

El separador `#` del campo de método hace referencia a un método de interfaz: `test-sleep#sleep-ms` invoca la función `sleep-ms` de la interfaz `test-sleep`.

## Véase también

- [Descripción general](wasm/overview.md) - Descripción general del entorno de ejecución WebAssembly
- [Funciones del host](wasm/hosts.md) - Interfaces disponibles en el host
- [Procesos](wasm/processes.md) - Ejecución de WASM como procesos
- [Tipos de entradas](guides/entry-kinds.md) - Todos los tipos de entradas del registro
