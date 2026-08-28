---
title: "Funciones del host"
description: "Habilita llamadas a funciones de Wippy, compatibilidad con WASI Preview 1 o interfaces WASI Preview 2 seleccionadas mediante los imports de una entrada."
---

# Funciones del host

Cada entrada habilita explícitamente las interfaces del host que se indican a continuación mediante su campo `imports`.

**Clasificación: referencia de interfaces del host.** El bloque YAML es una entrada parcial: sustituye el ID del sistema de archivos, la ruta, el método y el hash por valores de un módulo compilado. El resumen debe ser el valor SHA-256 real del módulo.

## Tipos de import

| Importación | Descripción |
|--------|-------------|
| `funcs` | Llamadas a funciones del registro de Wippy desde un módulo del modelo de componentes |
| `wasi1` | Compatibilidad con WASI Preview 1 para módulos raw/core |
| `wasi:cli` | Entorno, exit, stdin/stdout/stderr, terminal |
| `wasi:io` | Streams y manejo de errores |
| `wasi:poll` | Sondeo asíncrono y cesión cooperativa (interfaz `wasi:io/poll`) |
| `wasi:clocks` | Reloj de pared y reloj monotónico |
| `wasi:filesystem` | Acceso al sistema de archivos a través de directorios montados |
| `wasi:random` | Números aleatorios criptográficamente seguros |
| `wasi:sockets` | Redes TCP/UDP y resolución DNS |
| `wasi:http` | Solicitudes HTTP salientes del cliente |

Habilita imports en la configuración de la entrada:

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

Declara únicamente los imports que el módulo realmente necesita.

Los perfiles `funcs` y `wasi:*` que aparecen a continuación requieren un módulo del modelo de componentes. Utiliza `wasi1` para un módulo raw/core que importe `wasi_snapshot_preview1`; los alias `wasi-preview1`, `preview1` y `wasi_snapshot_preview1` se resuelven al mismo perfil. Los imports no admitidos, o los perfiles exclusivos del modelo de componentes aplicados a un módulo core, hacen fallar la preparación del módulo.

## Llamadas a funciones de Wippy

El perfil `funcs` registra la interfaz `wippy:runtime/funcs@0.1.0` para módulos del modelo de componentes:

```wit
interface funcs {
  call-string: func(target: string, input: string) -> result<string, string>;
  call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
}
```

Ambos métodos invocan el destino mediante el registro de funciones de Wippy. La llamada hereda el contexto de seguridad de la ejecución y requiere el permiso `funcs.call` para el ID de registro de destino.

## Imports de WASI

Cada import `wasi:*` habilita un grupo de interfaces WASI Preview 2 relacionadas.

### wasi:clocks

**Interfaces WASI:** `wasi:clocks/wall-clock`, `wasi:clocks/monotonic-clock`

Reloj de pared y reloj monotónico para operaciones temporales. El reloj monotónico se integra con el dispatcher de Wippy para la espera asíncrona.

### wasi:io

**Interfaces WASI:** `wasi:io/error`, `wasi:io/streams`

Operaciones de lectura y escritura de streams, y manejo de errores. La interfaz `wasi:io/poll` se proporciona por separado mediante el import `wasi:poll`.

### wasi:poll

**Interfaces WASI:** `wasi:io/poll`

Sondeo asíncrono. La interfaz de sondeo permite ceder cooperativamente mediante el dispatcher.

### wasi:cli

**Interfaces WASI:** `wasi:cli/environment`, `wasi:cli/exit`, `wasi:cli/stdin`, `wasi:cli/stdout`, `wasi:cli/stderr`, `wasi:cli/terminal-stdin`, `wasi:cli/terminal-stdout`, `wasi:cli/terminal-stderr`

Acceso a variables de entorno, códigos de salida del proceso y flujos de E/S estándar. Las variables de entorno se mapean desde el registro de entorno de Wippy mediante la configuración WASI.

### wasi:filesystem

**Interfaces WASI:** `wasi:filesystem/types`, `wasi:filesystem/preopens`

Acceso al sistema de archivos mediante directorios montados. Los montajes se configuran por entrada y mapean entradas del sistema de archivos de Wippy a rutas del invitado.

```yaml
wasi:
  mounts:
    - fs: myns:data
      guest: /data
      read_only: true
```

### wasi:random

**Interfaces WASI:** `wasi:random/random`, `wasi:random/insecure`, `wasi:random/insecure-seed`

Generación de números aleatorios criptográficamente seguros e inseguros.

### wasi:sockets

**Interfaces WASI:** `wasi:sockets/instance-network`, `wasi:sockets/ip-name-lookup`, `wasi:sockets/tcp`, `wasi:sockets/tcp-create-socket`, `wasi:sockets/udp`, `wasi:sockets/udp-create-socket`

Redes TCP y UDP con resolución DNS. Las operaciones de sockets se integran con el dispatcher para E/S asíncrona.

### wasi:http

**Interfaces WASI:** `wasi:http/types`, `wasi:http/outgoing-handler`

Solicitudes HTTP salientes del cliente desde módulos WASM. Admite los tipos de solicitud y respuesta definidos por la especificación WASI HTTP.

Las solicitudes salientes requieren el permiso `http_client.request` para la URL. Las solicitudes a direcciones IP privadas también requieren `http_client.private_ip` para la dirección resuelta.

## Permisos de sockets

Habilitar `wasi:sockets` hace que las interfaces estén disponibles, pero no autoriza el acceso a la red. La resolución DNS requiere `socket.resolve` para el nombre; las conexiones TCP salientes requieren `socket.connect` para la dirección; y la vinculación TCP o UDP requiere `socket.listen` para la dirección.

## Véase también

- [Descripción general](./overview.md) - Descripción general del entorno de ejecución WebAssembly
- [Funciones](./functions.md) - Configuración de funciones WASM
- [Procesos](./processes.md) - Ejecución de WASM como procesos
