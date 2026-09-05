---
title: "Superposiciones de red"
description: "Enruta el tráfico saliente y vincula escuchadores a través de redes de superposición (proxies SOCKS5, Tor, malla Tailscale, I2P). La selección de…"
---

# Superposiciones de red

Enruta el tráfico saliente y vincula escuchadores a través de redes de superposición (proxies SOCKS5, Tor, malla Tailscale, I2P). La selección de superposición es opcional por llamada y se hereda a través de los límites de función, proceso y HTTP.

## Tipos de entrada

| Kind | Descripción |
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

## Tailscale

```yaml
- name: tailnet
  kind: network.tailscale
  hostname: "wippy-node"
  auth_key_env: "TS_AUTHKEY"
  ephemeral: false
  control_url: ""
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `hostname` | string | Nombre del nodo tsnet (usado en el directorio de estado por nodo) |
| `auth_key` | string | Clave de autenticación tailnet en línea |
| `auth_key_env` | string | Nombre de variable de entorno que contiene la clave de autenticación (resuelto a través del registro env) |
| `state_dir` | string | Anulación del directorio de estado tsnet |
| `control_url` | string | Servidor de coordinación alternativo |
| `ephemeral` | bool | Registrar como nodo tailnet efímero |

Se requiere `auth_key` o `auth_key_env`.

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

## Seleccionar una superposición

### En http.service

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

local result, err = funcs.new()
    :with_options({ network = "app.net:proxy" })
    :call("app.api:fetch_data")
```

```lua
local pid, err = process.with_options({ network = "app.net:tailnet" })
    :spawn_monitored("app.workers:probe", "app:processes")
```

El módulo `http_client` acepta la misma seleccion de superposicion en las opciones por llamada bajo la clave `overlay_network`.

## Herencia

La selección de superposición fluye a través de la pila de llamadas. Una función llamada a través de `funcs.new():with_options({network=...})` ve la superposición en cada conexión interna, cada `funcs.call` anidado y cada `process.spawn` que realiza — hasta que un descendiente seleccione explícitamente una superposición diferente o la borre.

La herencia ambiental omite las propias reglas de denegación `network.select` del descendiente. Solo la selección explícita en un borde de Lua está controlada.

## Configuracion de la aplicacion

Los drivers de superposicion leen ajustes a nivel de aplicacion desde un bloque `network_service:` en `.wippy.yaml`:

```yaml
network_service:
  state_dir: .wippy/net          # Directorio base para el estado del driver (claves de Tailscale, etc.)
  default_network: app.net:tailnet  # Superposicion usada cuando ninguna llamada establece una
```

| Campo | Valor por defecto | Descripcion |
|-------|-------------------|-------------|
| `state_dir` | `.wippy/net` | Directorio para el estado del driver. Las rutas relativas se resuelven contra el directorio de configuracion de arranque. |
| `default_network` | — | Registry ID de una superposicion aplicada a cualquier tarea o proceso que no establezca su propia red mediante opciones. |

## Dials en Bruto

La selección de superposición no se limita a los bordes de Lua. Los dials realizados a través del servicio de red del runtime — el [host `socket`](wasm/hosts.md#socket) de WASM y el dispatcher de `wasi:sockets` — leen la superposición del frame y enrutan a través de ella, ya sea que la haya establecido `with_options`, `meta.options.network` en la entrada, o `network_service.default_network`.

La puerta de IP privada se comporta de forma distinta en esa ruta. Un dial directo resuelve el destino y comprueba cada dirección resultante contra `socket.private_ip`. Con una superposición seleccionada, solo se comprueba una dirección IP literal en el destino; los nombres de host se entregan a la superposición para que los resuelva, por lo que nunca se consulta el resolver local y no se comprueba nada de lo que este habría devuelto.

Cuando hay una superposición seleccionada pero el contexto no lleva un registro de red, el dial falla con `network "<id>" selected without a network registry`.

## Actualizar Superposiciones

Las entradas de superposición se intercambian en caliente al actualizar el registro. Cuando la configuración de una superposición cambia, el driver construye primero el servicio de reemplazo y solo lo intercambia una vez que se crea con éxito; si la nueva configuración falla, la superposición existente sigue ejecutándose. Los llamantes concurrentes ven el servicio antiguo o el nuevo, nunca un vacío.

## Permisos

| Acción | Recurso | Descripción |
|--------|----------|-------------|
| `network.select` | Registry ID de red | Selección explícita de superposición en `funcs.call`, `process.spawn`, `http_client` |
| `network.bind` | Registry ID de red | Vincular un listener de `http.service` a través de una superposición (el campo `network:`) |
| `socket.connect` | `host:port` | Cualquier dial saliente a través del servicio de red |
| `socket.listen` | `host:port` | Vincular un listener TCP o un socket UDP a través del servicio de red |
| `socket.resolve` | Nombre de host | Resolución DNS a través del servicio de red |
| `socket.private_ip` | Dirección IP | Alcanzar una dirección de loopback, privada, link-local o no especificada |

Deniega `network.select` en un ámbito para impedir que el código dentro de él elija explícitamente una superposición. Las superposiciones heredadas no se ven afectadas — fueron autorizadas en el llamante. `network.bind` se comprueba cuando un servidor con una superposición `network:` inicia su listener.

Los permisos `socket.*` los comprueba el propio servicio de red. `socket.connect`, `socket.listen` y `socket.resolve` se comprueban antes de cualquier enrutamiento por superposición, por lo que se aplican por igual al tráfico de clearnet y al de superposición; `socket.private_ip` se restringe a las direcciones literales una vez que hay una superposición seleccionada, como se describe en [Dials en Bruto](system/network.md#raw-dials).

## Véase también

- [Seguridad](system/security.md) - Políticas y actores
- [Servicio HTTP](http/server.md) - Vinculación del servidor
- [Cliente HTTP](lua/http/client.md) - Selección de superposición por llamada
- [Funciones Host](wasm/hosts.md) - Imports de socket de WASM
