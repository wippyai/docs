# Funciones Host

Los modulos WASM acceden a las capacidades del runtime a traves de imports de funciones host. Cada import se declara explicitamente por entrada en la lista `imports`.

## Tipos de Import

| Import | Description |
|--------|-------------|
| `funcs` | Invocar otras funciones de Wippy (Lua o WASM) desde dentro de un modulo WASM |
| `wasi:cli` | Entorno, exit, stdin/stdout/stderr, terminal |
| `wasi:io` | Streams, manejo de errores, polling |
| `wasi:clocks` | Reloj de pared y reloj monotonico |
| `wasi:filesystem` | Acceso al sistema de archivos a traves de directorios montados |
| `wasi:random` | Numeros aleatorios criptograficamente seguros |
| `wasi:sockets` | Redes TCP/UDP y resolucion DNS |
| `wasi:http` | Solicitudes HTTP salientes del cliente |

Habilita imports en la configuracion de tu entrada:

```yaml
  - name: my_function
    kind: function.wasm
    fs: myns:assets
    path: /module.wasm
    hash: sha256:...
    method: run
    imports:
      - wasi:cli
      - wasi:io
      - wasi:clocks
      - wasi:filesystem
      - funcs
    pool:
      type: inline
```

Solo declara los imports que tu modulo realmente necesita.

## Host de Funciones Wippy

**Namespace:** `wippy:runtime/funcs@0.1.0`

Permite a los modulos WASM invocar cualquier funcion en el registro de Wippy, incluyendo funciones Lua y otras funciones WASM.

### Interfaz

```wit
interface funcs {
    call-string: func(target: string, input: string) -> result<string, string>;
    call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
}
```

| Function | Description |
|----------|-------------|
| `call-string` | Invoca una funcion con entrada y salida de tipo string |
| `call-bytes` | Invoca una funcion con entrada y salida binaria |

El parametro `target` usa el formato de ID del registro: `namespace:entry_name`.

### Ejemplo

Un componente WASM que invoca una funcion Lua:

```yaml
  - name: orchestrator
    kind: function.wasm
    fs: myns:assets
    path: /orchestrator.wasm
    hash: sha256:...
    method: run
    imports:
      - funcs
    pool:
      type: lazy
      max_size: 4
```

## Imports WASI

Cada import `wasi:*` habilita un grupo de interfaces WASI Preview 2 relacionadas.

### wasi:clocks

**Interfaces:** `wasi:clocks/wall-clock`, `wasi:clocks/monotonic-clock`

Reloj de pared y reloj monotonico para operaciones de tiempo. El reloj monotonico se integra con el dispatcher de Wippy para sleep asincrono.

### wasi:io

**Interfaces:** `wasi:io/error`, `wasi:io/streams`, `wasi:io/poll`

Operaciones de lectura/escritura de streams y polling asincrono. La interfaz poll permite la cesion cooperativa a traves del dispatcher.

### wasi:cli

**Interfaces:** `wasi:cli/environment`, `wasi:cli/exit`, `wasi:cli/stdin`, `wasi:cli/stdout`, `wasi:cli/stderr`

Acceso a variables de entorno, codigos de salida del proceso y flujos de E/S estandar. Las variables de entorno se mapean desde el registro de entorno de Wippy a traves de la configuracion WASI.

### wasi:filesystem

**Interfaces:** `wasi:filesystem/types`, `wasi:filesystem/preopens`

Acceso al sistema de archivos a traves de directorios montados. Los montajes se configuran por entrada y mapean entradas del sistema de archivos de Wippy a rutas del guest.

```yaml
wasi:
  mounts:
    - fs: myns:data
      guest: /data
      read_only: true
```

### wasi:random

**Interfaces:** `wasi:random/random`, `wasi:random/insecure`, `wasi:random/insecure-seed`

Generacion de numeros aleatorios criptograficamente seguros e inseguros.

### wasi:sockets

**Interfaces:** `wasi:sockets/network`, `wasi:sockets/instance-network`, `wasi:sockets/ip-name-lookup`, `wasi:sockets/tcp`, `wasi:sockets/tcp-create-socket`, `wasi:sockets/udp`

Redes TCP y UDP con resolucion DNS. Las operaciones de sockets se integran con el dispatcher para E/S asincrona.

### wasi:http

**Interfaces:** `wasi:http/types`, `wasi:http/outgoing-handler`

Solicitudes HTTP salientes del cliente desde dentro de modulos WASM. Soporta los tipos de solicitud/respuesta definidos por la especificacion WASI HTTP.

## Ver Tambien

- [Descripcion general](wasm/overview.md) - Descripcion general del runtime WebAssembly
- [Funciones](wasm/functions.md) - Configuracion de funciones WASM
- [Procesos](wasm/processes.md) - Ejecucion de WASM como procesos
