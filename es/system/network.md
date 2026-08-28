---
title: "Superposiciones de red"
description: "Enruta conexiones salientes y vincula escuchadores mediante superposiciones SOCKS5, Tor, Tailscale o I2P."
---

# Superposiciones de red

Las entradas de superposición de red enrutan conexiones salientes o vinculan escuchadores mediante SOCKS5, Tor, Tailscale o I2P. La superposición seleccionada se propaga a través de los límites de función, proceso y HTTP.

Esta página es una referencia de configuración. Los bloques YAML son fragmentos de entrada o de configuración de la aplicación y presuponen que el proxy externo, la tailnet o el servicio SAM de I2P ya existen.

## Tipos de entrada

| Tipo | Descripción |
|------|-------------|
| `network.socks5` | Proxy SOCKS5 genérico (también cubre el escuchador SOCKS5 de Tor) |
| `network.tailscale` | Nodo de superposición Tailscale tsnet |
| `network.i2p` | Puente I2P SAM v3 |

## SOCKS5

```yaml
- name: proxy
  kind: network.socks5
  host: 127.0.0.1
  port: 1080
  username: "optional"
  password: "optional"
  isolate_streams: false
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `host` | string | Host del proxy |
| `port` | int | Puerto del proxy (1-65535) |
| `username` | string | Autenticación SOCKS5 opcional |
| `password` | string | Autenticación SOCKS5 opcional |
| `isolate_streams` | bool | Credenciales aleatorias por conexión (aislamiento de flujos de Tor) |

`host` y `port` son obligatorios. `isolate_streams` tiene como valor predeterminado `false`. Cuando se activa el aislamiento, el entorno de ejecución genera un nombre de usuario y una contraseña nuevos para cada conexión en lugar de usar las credenciales configuradas.

## Tailscale

```yaml
- name: tailnet
  kind: network.tailscale
  hostname: "wippy-node"
  auth_key: ${env:TS_AUTHKEY}
  ephemeral: false
  control_url: ""
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `hostname` | string | Nombre del nodo tsnet (usado en el directorio de estado por nodo) |
| `auth_key` | string | Clave de autenticación de la tailnet, especificada directamente o como `${env:NAME}` y resuelta mediante el [registro de entorno](./env.md) |
| `state_dir` | string | Anulación del directorio de estado tsnet |
| `control_url` | string | Servidor de coordinación alternativo |
| `ephemeral` | bool | Registrar como nodo tailnet efímero |

`auth_key` es obligatorio (proporciónalo directamente o mediante `${env:NAME}`). La directiva heredada `auth_key_env` se resuelve del mismo modo, pero está obsoleta; utiliza preferentemente `auth_key: ${env:NAME}`.

El nombre de host de tsnet tiene como valor predeterminado `wippy`. Si se omite `state_dir`, el entorno de ejecución utiliza `<network_service.state_dir>/tailscale/<node>`, donde `<node>` es el nombre de host configurado o, si no hay ninguno, el nombre de la entrada del registro.

## I2P

```yaml
- name: i2p_bridge
  kind: network.i2p
  host: 127.0.0.1
  port: 7656
  session_name: "wippy"
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `host` | string | Host del puente SAM v3 |
| `port` | int | Puerto del puente SAM v3 |
| `session_name` | string | Identificador de sesión opcional |

`host` y `port` son obligatorios. `session_name` tiene como valor predeterminado `wippy` y se utiliza como prefijo para los identificadores de sesión SAM de cada conexión y escuchador.

## Seleccionar una superposición

### En `http.service`

Vincula el escuchador del servidor a través de una superposición (Tailscale, I2P):

```yaml
- name: gateway
  kind: http.service
  addr: ":8080"
  network: app.net:tailnet
```

SOCKS5 no admite escucha entrante — úsalo solo para conexiones salientes.

### Desde Lua

Enruta una función llamada o un proceso generado a través de una superposición usando `with_options`:

```lua
local funcs = require("funcs")

local caller, err = funcs.new():with_options({ network = "app.net:proxy" })
if err then return nil, err end
local result, call_err = caller:call("app.api:fetch_data")
if call_err then return nil, call_err end
```

```lua
local process = require("process")

local pid, err = process.with_options({ network = "app.net:tailnet" })
    :spawn_monitored("app.workers:probe", "app:processes")
if err then return nil, err end
```

Crear el generador de procesos con opciones personalizadas también requiere `process.context` sobre `context`. Una denegación genera un error de Lua antes de devolver el generador; `network.select` se comprueba por separado para el ID de red seleccionado.

El módulo `http_client` acepta la misma selección de superposición en las opciones de cada llamada mediante la clave `overlay_network`.

## Herencia

La selección de superposición se propaga por la pila de llamadas. Una función llamada mediante `funcs.new():with_options({network=...})` utiliza la superposición para las conexiones internas, las llamadas anidadas y los procesos generados, salvo que un nuevo límite seleccione otra. Una opción `network` vacía significa «sin anulación»; no elimina una superposición heredada ni la predeterminada de la aplicación.

En una llamada de función, las opciones de ejecución prevalecen sobre `meta.options` de la entrada de función antes de seleccionar la red. En un nuevo límite de función o proceso se selecciona primero un valor no vacío de `options.network`. Si no existe, se selecciona `network_service.default_network` cuando está configurado; si tampoco existe, se conserva la selección heredada del marco. El ID seleccionado ya debe estar registrado. Un ID desconocido hace fallar la llamada o la creación del proceso en lugar de recurrir a la red del host.

La herencia ambiental omite las propias reglas de denegación `network.select` del descendiente. Solo la selección explícita en un borde de Lua está controlada.

## Configuración de la aplicación

Los controladores de superposición leen la configuración de toda la aplicación desde un bloque `network_service:` de `.wippy.yaml`:

```yaml
network_service:
  state_dir: .wippy/net          # base dir for driver state (Tailscale keys, etc.)
  default_network: app.net:tailnet  # overlay applied when no call sets one
```

| Campo | Valor por defecto | Descripcion |
|-------|-------------------|-------------|
| `state_dir` | `.wippy/net` | Directorio para el estado del controlador. Las rutas relativas se resuelven respecto al directorio de configuración de arranque. |
| `default_network` | — | ID de registro de una superposición aplicada a cualquier tarea o proceso que no fije su propia red mediante opciones. |

## Actualizar Superposiciones

Las entradas de superposición se sustituyen al actualizar el registro. El controlador construye el reemplazo antes de activarlo; si no puede crearlo, la superposición existente sigue en ejecución. El cambio correcto es atómico para las nuevas búsquedas y después se cierra el servicio anterior. Por tanto, el trabajo que ya utilizaba el servicio anterior puede observar ese cierre.

## Permisos

| Acción | Recurso | Descripción |
|--------|----------|-------------|
| `network.select` | Registry ID de red | Selección explícita de superposición en `funcs.call`, `process.spawn`, `http_client` |
| `network.bind` | Registry ID de red | Vincular un listener de `http.service` a través de una superposición (el campo `network:`) |
| `process.context` | `context` | Crear un generador de procesos con `process.with_options(...)` |

Deniega `network.select` en un ámbito para impedir que el código dentro de él elija explícitamente una superposición. Las superposiciones heredadas no se ven afectadas — fueron autorizadas en el llamante. `network.bind` se comprueba cuando un servidor con una superposición `network:` inicia su listener.

## Véase también

- [Seguridad](./security.md) - Políticas y actores
- [Servicio HTTP](../http/server.md) - Vinculación del servidor
- [Cliente HTTP](../lua/http/client.md) - Selección de superposición por llamada
