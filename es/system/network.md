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

El módulo `httpclient` acepta la misma clave en las opciones por llamada.

## Herencia

La selección de superposición fluye a través de la pila de llamadas. Una función llamada a través de `funcs.new():with_options({network=...})` ve la superposición en cada conexión interna, cada `funcs.call` anidado y cada `process.spawn` que realiza — hasta que un descendiente seleccione explícitamente una superposición diferente o la borre.

La herencia ambiental omite las propias reglas de denegación `network.select` del descendiente. Solo la selección explícita en un borde de Lua está controlada.

## Permisos

| Acción | Recurso | Descripción |
|--------|----------|-------------|
| `network.select` | Registry ID de red | Selección explícita de superposición en `funcs.call`, `process.spawn`, `http_client` |

Deniega `network.select` en un ámbito para impedir que el código dentro de él elija explícitamente una superposición. Las superposiciones heredadas no se ven afectadas — fueron autorizadas en el llamante.

## Véase también

- [Seguridad](system/security.md) - Políticas y actores
- [Servicio HTTP](http/server.md) - Vinculación del servidor
- [Cliente HTTP](lua/http/client.md) - Selección de superposición por llamada
