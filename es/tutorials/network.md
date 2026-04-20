# Redes Superpuestas

Enruta llamadas HTTP salientes y procesos generados a través de superposiciones SOCKS5, Tailscale o I2P.

## Descripción General

Wippy soporta redes superpuestas que transportan de forma transparente el tráfico originado en funciones, procesos y clientes HTTP. Cada superposición es una entrada de registro; el código la selecciona por llamada, y la selección se hereda en las llamadas internas hasta que un descendiente la sobreescribe explícitamente.

Superposiciones soportadas:

- `network.socks5` — proxy SOCKS5 genérico (también el listener SOCKS5 de Tor)
- `network.tailscale` — nodo overlay tsnet
- `network.i2p` — puente SAM v3 de I2P

## Estructura del Proyecto

```
netdemo/
├── wippy.lock
└── src/
    ├── _index.yaml
    └── probe.lua
```

## Paso 1: Definir una Superposición

Crea `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # Entrada de proxy SOCKS5 (Tor lo expone en 127.0.0.1:9050 por defecto)
  - name: tor
    kind: network.socks5
    host: 127.0.0.1
    port: 9050
    isolate_streams: true

  - name: probe
    kind: process.lua
    meta:
      command:
        name: probe
        short: Check outbound IP through overlays
    source: file://probe.lua
    method: main
    modules:
      - io
      - http_client
      - json
```

`isolate_streams: true` hace que el driver SOCKS5 genere credenciales aleatorias por conexión para que Tor abra un circuito nuevo en cada dial.

## Paso 2: Enrutar Llamadas Salientes

Crea `src/probe.lua`:

```lua
local io = require("io")
local http_client = require("http_client")
local json = require("json")

local function fetch_ip(overlay)
    local options = { timeout = "15s" }
    if overlay then
        options.overlay_network = overlay
    end

    local resp, err = http_client.get("https://api.ipify.org?format=json", options)
    if err then
        return nil, tostring(err)
    end
    if resp.status_code ~= 200 then
        return nil, "HTTP " .. resp.status_code
    end

    local body = json.decode(resp.body or "")
    return body and body.ip, nil
end

local function main()
    local direct, d_err = fetch_ip(nil)
    if d_err then
        io.print("direct failed: " .. d_err)
    else
        io.print("direct IP: " .. direct)
    end

    local routed, r_err = fetch_ip("app:tor")
    if r_err then
        io.print("tor failed: " .. r_err)
    else
        io.print("tor IP:    " .. routed)
    end

    return 0
end

return { main = main }
```

La opción `overlay_network` en `http_client` selecciona la superposición solo para esa llamada. Sin ella, el dial va a través del valor predeterminado del proceso (ya sea `network_service.default_network` en `.wippy.yaml` o una conexión directa).

## Paso 3: Ejecutarlo

```bash
wippy init
wippy run probe
```

Con Tor ejecutándose localmente:

```
direct IP: 203.0.113.42
tor IP:    185.220.101.61
```

Si Tor no está en ejecución, la línea `tor IP` reportará un error de dial — la superposición SOCKS5 no cae silenciosamente a una conexión directa.

## Herencia

La selección de superposición fluye a través de llamadas anidadas. Selecciona la superposición una vez en el borde de un `funcs.call` o `process.spawn` y cada llamada HTTP interna, `funcs.call` anidado y `process.spawn` subyacente la utiliza hasta que haya una sobreescritura explícita:

```lua
local funcs = require("funcs")

local result, err = funcs.new()
    :with_options({ network = "app:tor" })
    :call("app:scrape_site", url)
```

```lua
local pid, err = process.with_options({ network = "app:tor" })
    :spawn_monitored("app.workers:probe", "app:processes")
```

La función anidada o el proceso generado utiliza la superposición en cada dial saliente sin necesidad de pasarla explícitamente.

## Vincular un Listener

Las superposiciones que soportan tráfico entrante (Tailscale, I2P) también pueden aceptar listeners HTTP. Adjunta la superposición al `http.service` en lugar del cliente:

```yaml
  - name: tailnet
    kind: network.tailscale
    hostname: wippy-node
    auth_key_env: TS_AUTHKEY
    ephemeral: true

  - name: gateway
    kind: http.service
    addr: ":8080"
    network: app:tailnet
    lifecycle:
      auto_start: true
```

El servidor se vincula en la interfaz de tailnet; los clientes lo alcanzan a través de la dirección de Tailscale. SOCKS5 es solo para salida — asignarlo a `http.service` es rechazado.

## Predeterminado para Toda la App

Establece una superposición predeterminada en `.wippy.yaml` para que cada llamada la use salvo que se sobreescriba:

```yaml
network_service:
  state_dir: .wippy/net
  default_network: app:tor
```

La selección explícita con `network = nil` elimina el predeterminado para esa llamada.

## Permisos

La acción `network.select` controla la selección explícita de superposición. Deniégala en un scope para evitar que el código elija una superposición:

```yaml
  - name: deny_network
    kind: security.policy
    policy:
      actions: "network.select"
      resources: "*"
      effect: deny
    groups:
      - untrusted
```

Las superposiciones heredadas omiten esta comprobación — fueron autorizadas en el borde del caller. Solo la re-selección explícita en un límite Lua está controlada.

## Siguientes Pasos

- [Sistema de Red](system/network.md) - Referencia de tipos de entrada
- [Cliente HTTP](lua/http/client.md) - Opciones de superposición por llamada
- [Modelo de Seguridad](system/security.md) - Políticas y scopes
- [Autenticación](tutorials/auth.md) - Seguridad basada en tokens
