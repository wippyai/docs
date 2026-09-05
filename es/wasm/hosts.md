---
title: "Funciones Host"
description: "Los modulos WASM acceden a las capacidades del runtime a traves de imports de funciones host. Cada import se declara explicitamente por entrada en la…"
---

# Funciones Host

Los modulos WASM acceden a las capacidades del runtime a traves de imports de funciones host. Cada import se declara explicitamente por entrada en la lista `imports`.

## Tipos de Import

| Import | Namespace | Tipo de módulo | Descripción |
|--------|-----------|----------------|-------------|
| `wasi:cli` | `wasi:cli/*` | component | Entorno, exit, stdin/stdout/stderr, terminal |
| `wasi:io` | `wasi:io/error`, `wasi:io/streams` | component | Streams y manejo de errores |
| `wasi:poll` | `wasi:io/poll` | component | Polling asíncrono / cesión cooperativa |
| `wasi:clocks` | `wasi:clocks/*` | component | Reloj de pared y reloj monotónico |
| `wasi:filesystem` | `wasi:filesystem/*` | component | Acceso al sistema de archivos a través de directorios montados |
| `wasi:random` | `wasi:random/*` | component | Números aleatorios criptográficamente seguros e inseguros |
| `wasi:sockets` | `wasi:sockets/*` | component | Redes TCP/UDP y resolución DNS |
| `wasi:http` | `wasi:http/*` | component | Solicitudes HTTP salientes del cliente |
| `funcs` | `wippy:runtime/funcs@0.1.0` | component | Llamada a funciones del registro desde el guest |
| `wasi1` | `wasi_snapshot_preview1` | core | Imports de compatibilidad con WASI Preview 1 |
| `socket` | `wippy:runtime/socket@0.1.0` | core | TCP saliente propiedad de la instancia mediante imports solo de enteros |

Los ocho perfiles `wasi:*` y `funcs` son exclusivos de componentes: declarar uno en un módulo core hace fallar la entrada. `wasi1` y `socket` exponen imports core.

Cada perfil se resuelve bajo su nombre corto, bajo cualquiera de los namespaces de interfaz que proporciona, y bajo un namespace versionado. El sufijo de versión se elimina antes de la búsqueda, por lo que `wasi:io/poll`, `wasi:io/poll@0.2.3` y `wasi:poll` seleccionan todos el mismo perfil.

Un import que no se resuelve a ningún perfil hace fallar la entrada con `unsupported wasm host import: <id>`; un perfil exclusivo de componentes en un módulo core falla con `wasm host import requires component module: <id>`.

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
    pool:
      type: inline
```

Solo declara los imports que tu modulo realmente necesita.

## Imports WASI

Cada import `wasi:*` habilita un grupo de interfaces WASI Preview 2 relacionadas.

### wasi:clocks

**Interfaces:** `wasi:clocks/wall-clock`, `wasi:clocks/monotonic-clock`

Reloj de pared y reloj monotonico para operaciones de tiempo. El reloj monotonico se integra con el dispatcher de Wippy para sleep asincrono.

### wasi:io

**Interfaces:** `wasi:io/error`, `wasi:io/streams`

Operaciones de lectura/escritura de streams y manejo de errores. La interfaz `wasi:io/poll` la proporciona por separado el import `wasi:poll`.

### wasi:poll

**Interfaces:** `wasi:io/poll`

Polling asíncrono. La interfaz poll permite la cesión cooperativa a través del dispatcher.

### wasi:cli

**Interfaces:** `wasi:cli/environment`, `wasi:cli/exit`, `wasi:cli/stdin`, `wasi:cli/stdout`, `wasi:cli/stderr`, `wasi:cli/terminal-stdin`, `wasi:cli/terminal-stdout`, `wasi:cli/terminal-stderr`

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

**Interfaces:** `wasi:sockets/instance-network`, `wasi:sockets/ip-name-lookup`, `wasi:sockets/tcp`, `wasi:sockets/tcp-create-socket`, `wasi:sockets/udp`, `wasi:sockets/udp-create-socket`

Redes TCP y UDP con resolucion DNS. Las operaciones de sockets suspenden el guest y se ejecutan a través del dispatcher, que realiza cada dial, bind y lookup en el [servicio de red](system/network.md).

### wasi:http

**Interfaces:** `wasi:http/types`, `wasi:http/outgoing-handler`

Solicitudes HTTP salientes del cliente desde dentro de modulos WASM. Soporta los tipos de solicitud/respuesta definidos por la especificacion WASI HTTP.

## funcs

**Namespace:** `wippy:runtime/funcs@0.1.0`

Llama a funciones del registro desde un guest de componente. Se exponen dos puntos de entrada:

```wit
interface funcs {
  call-string: func(target: string, input: string) -> result<string, string>;
  call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
}
```

`target` es un ID de registro en forma `namespace:name`. Cada llamada se comprueba contra la política como `funcs.call` sobre ese target, de modo que un guest solo puede alcanzar funciones que el scope del llamador ya permite.

## wasi1

**Namespace:** `wasi_snapshot_preview1`

Declara que un módulo core enlaza contra WASI Preview 1. El perfil también se resuelve bajo `preview1` y `wasi-preview1`. No registra hosts propios; los imports de Preview 1 los satisface el runtime WASM subyacente.

## socket

**Namespace:** `wippy:runtime/socket@0.1.0`

TCP saliente para módulos core (no componentes). El host exporta cuatro funciones solo de enteros, por lo que un guest no necesita herramientas de componentes para usarlo:

| Función | Firma | Resultado |
|---------|-------|-----------|
| `connect` | `(host_ptr: i32, host_len: i32, port: i32, timeout_ms: i32) -> i64` | `status << 32 \| handle` |
| `send` | `(handle: i32, buf_ptr: i32, buf_len: i32) -> i64` | `status << 32 \| written` |
| `recv` | `(handle: i32, out_ptr: i32, out_cap: i32) -> i64` | `status << 32 \| read` |
| `close` | `(handle: i32) -> i32` | `status` |

Los 32 bits altos del resultado de 64 bits llevan el estado; los 32 bits bajos llevan el valor.

| Estado | Valor | Significado |
|--------|-------|-------------|
| `OK` | 0 | La operación tuvo éxito |
| `Invalid` | 1 | Argumentos incorrectos o región de memoria fuera de rango |
| `Denied` | 2 | El servicio de red denegó el dial |
| `Failed` | 3 | La operación falló |
| `UnknownHandle` | 4 | El handle no es una conexión abierta de esta instancia |
| `Limit` | 5 | Se alcanzó `max_open_sockets` |
| `Timeout` | 6 | Expiró el dial o el deadline de lectura/escritura |

`connect` lee el nombre de host desde la memoria del guest; `host_len` debe estar entre 1 y 253 bytes y `port` entre 1 y 65535. `timeout_ms` estrecha el deadline del dial: el deadline efectivo es el menor entre `timeout_ms` y el `socket_timeout_ms` de la entrada. `send` y `recv` están acotados por `socket_timeout_ms`. `recv` informa un fin de stream limpio como `OK` con un recuento de lectura de 0.

Las conexiones pertenecen a la instancia que las abrió. Un handle no tiene sentido para otra instancia, el recuento de sockets abiertos se lleva por instancia, y cada conexión se cierra cuando la instancia se cierra o el worker caliente se recicla.

## Autorización de Red

Ninguno de los dos hosts de sockets decide el acceso por sí mismo. Cada dial, bind y lookup pasa por el servicio de red del runtime, que comprueba los permisos `socket.connect`, `socket.listen` y `socket.resolve`, aplica la política de IPs privadas, y enruta a través de una [red overlay](system/network.md) cuando hay una seleccionada. `wasi:sockets` además pre-comprueba `socket.resolve` antes de una búsqueda DNS y `socket.listen` antes de un bind UDP.

## Ver Tambien

- [Descripcion general](wasm/overview.md) - Descripcion general del runtime WebAssembly
- [Funciones](wasm/functions.md) - Configuracion de funciones WASM
- [Procesos](wasm/processes.md) - Ejecucion de WASM como procesos
- [Redes Overlay](system/network.md) - Selección de overlay y permisos de sockets
