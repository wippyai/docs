---
title: "Redes Superpuestas"
description: "Enruta llamadas HTTP salientes y procesos generados por SOCKS5, con una receta parcial de integración con Tailscale."
---

# Redes Superpuestas

Configura una red superpuesta SOCKS5 para llamadas HTTP salientes y revisa después
la herencia, los listeners entrantes, los valores predeterminados de la aplicación y
los permisos.

**Clasificación:** Tutorial SOCKS5 ejecutable con una receta parcial de Tailscale.
La sonda directa/enrutada está completa cuando existe un listener SOCKS5 externo. La sección
de Tailscale explica el cableado de Wippy, pero delega deliberadamente a Tailscale el
aprovisionamiento de la cuenta. Para configurar I2P, consulta la referencia del
sistema de red enlazada abajo.

## Descripción General

Wippy representa las redes superpuestas como entradas del registro. El código puede
seleccionar una para una llamada, y esa selección se propaga a las llamadas anidadas
hasta que un descendiente la sobrescribe.

Superposiciones soportadas:

- `network.socks5` — proxy SOCKS5 genérico
- `network.tailscale` — nodo overlay tsnet
- `network.i2p` — puente SAM v3 de I2P

## Requisitos previos

- El runtime Wippy `v0.3.32a`.
- `curl` y acceso HTTPS saliente a `api.ipify.org`.
- Un proxy SOCKS5 escuchando en `127.0.0.1:1080`. Sirve cualquier proxy SOCKS5; lo más
  rápido es el reenvío dinámico de SSH hacia un host al que tengas acceso:

  ```bash
  ssh -N -D 1080 user@remote-host
  ```

  Verifica el listener antes de ejecutar Wippy:

  ```bash
  curl --socks5-hostname 127.0.0.1:1080 https://api.ipify.org?format=json
  ```

  Una comprobación correcta devuelve JSON con la dirección IP del host remoto. Si tu
  proxy escucha en otro puerto, cambia juntos la entrada del registro y el comando de
  verificación.
- Un directorio de trabajo vacío:

  ```bash
  mkdir netdemo
  cd netdemo
  mkdir src
  ```

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
  - name: net_policy
    kind: security.policy
    policy:
      actions:
        - http_client.request
        - network.select
      resources: "*"
      effect: allow

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # SOCKS5 proxy entry
  - name: proxy
    kind: network.socks5
    host: 127.0.0.1
    port: 1080

  - name: probe
    kind: process.lua
    meta:
      command:
        name: probe
        short: Check outbound IP through overlays
        security:
          actor:
            id: system.probe
          policies:
            - app:net_policy
    source: file://probe.lua
    method: main
    modules:
      - io
      - http_client
      - json
```

La seguridad es estricta por defecto, así que el comando lleva el actor y la política bajo los que se ejecuta su lanzamiento. `http_client.request` cubre la llamada saliente y `network.select` cubre la elección explícita de superposición; sin ellos toda comprobación falla en cerrado.

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

    local routed, r_err = fetch_ip("app:proxy")
    if r_err then
        io.print("proxy failed: " .. r_err)
    else
        io.print("proxy IP:  " .. routed)
    end

    return 0
end

return { main = main }
```

La opción `overlay_network` selecciona la superposición para esa llamada HTTP. Sin
ella, la conexión usa el valor predeterminado del proceso: `network_service.default_network`
de `.wippy.yaml`, o una conexión directa si no se define ninguno.

## Paso 3: Ejecutarlo

```bash
wippy init
wippy run probe
```

Con el proxy en ejecución:

```
direct IP: <your public IP>
proxy IP:  <proxy exit IP>
```

Ambas líneas deben contener direcciones IP válidas. Normalmente serán diferentes;
la prueba importante es que la solicitud enrutada solo funciona mediante el listener
SOCKS configurado.

Si el proxy no está en ejecución, la línea `proxy IP` reportará un error de dial — la superposición SOCKS5 no cae silenciosamente a una conexión directa.

## Herencia

La selección de superposición se propaga por las llamadas anidadas. Selecciona la
superposición en el límite de una llamada a `funcs.call` o `process.spawn` y se aplicará
a las llamadas HTTP, llamadas de función y procesos anidados hasta que uno la
sobrescriba explícitamente:

```lua
local funcs = require("funcs")

local result, err = funcs.new()
    :with_options({ network = "app:proxy" })
    :call("app:scrape_site", url)
```

```lua
local pid, err = process.with_options({ network = "app:proxy" })
    :spawn_monitored("app.workers:probe", "app:processes")
```

La función anidada o el proceso generado utiliza la superposición en cada dial saliente sin necesidad de pasarla explícitamente.

## Vincular un Listener

Tailscale también puede aceptar listeners HTTP. Adjunta la superposición al
`http.service` en lugar del cliente:

```yaml
  - name: bind_policy
    kind: security.policy
    policy:
      actions: "network.bind"
      resources: "*"
      effect: allow

  - name: tailnet
    kind: network.tailscale
    hostname: wippy-node
    auth_key: ${env:TS_AUTHKEY}
    ephemeral: true

  - name: gateway
    kind: http.service
    addr: ":8080"
    network: app:tailnet
    lifecycle:
      auto_start: true
      security:
        actor:
          id: system.gateway
        policies:
          - app:bind_policy
```

`auth_key` se resuelve a través del [registro de entorno](system/env.md), por lo que `TS_AUTHKEY` es una variable registrada — un valor del sistema operativo necesita una `env.variable` respaldada por `env.storage.os`.

Vincular a través de una superposición está controlado por `network.bind`, comprobado cuando arranca el listener, así que el servicio declara un ámbito que lo permite. El servidor se vincula en la interfaz de tailnet; los clientes lo alcanzan a través de la dirección de Tailscale. SOCKS5 es solo para salida — asignarlo a `http.service` hace que el listener falle con `inbound listeners are not exposed over SOCKS5`.

## Predeterminado para Toda la App

Establece una superposición predeterminada en `.wippy.yaml` para que cada llamada la use salvo que se sobreescriba:

```yaml
network_service:
  state_dir: .wippy/net
  default_network: app:proxy
```

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

Las superposiciones heredadas omiten esta comprobación: ya fueron autorizadas en el
límite del caller. Solo se controla la nueva selección explícita en un límite Lua.

## Solución de problemas y limpieza

- `connection refused` en `127.0.0.1:1080` significa que el proxy no escucha en el
  puerto configurado. Verifícalo con el comando `curl` de los requisitos previos
  antes de depurar Wippy.
- Si falla la solicitud directa y funciona la enrutada, normalmente hay reglas
  locales de DNS, proxy o firewall que afectan a la ruta directa. Las dos llamadas
  son independientes.
- `access denied` en la llamada enrutada significa que el contexto de seguridad del
  comando carece de `network.select` para `app:proxy`; mantén `app:probe_policy`
  adjunta bajo `meta.command.security`.
- El driver SOCKS5 nunca recurre a una conexión directa. No elimines el error solo
  para que continúe la demostración.
- Detén el comando Wippy cuando termine y cierra el túnel SSH si lo abriste
  exclusivamente para este tutorial. El ejemplo SOCKS5 no crea estado de red
  persistente. Una entrada Tailscale puede conservar el estado del nodo bajo
  `.wippy/net/tailscale/`; elimina `.wippy/net` solo después de detener Wippy y
  únicamente si quieres descartar esa identidad local de tailnet.

## Siguientes Pasos

- [Sistema de red](system/network.md) — Referencia de tipos de entrada
- [Cliente HTTP](lua/http/client.md) — Opciones de superposición por llamada
- [Modelo de seguridad](system/security.md) — Políticas y scopes
- [Autenticación](tutorials/auth.md) — Seguridad basada en tokens
