---
title: "Server-Sent Events"
description: "El middleware SSE transmite eventos desde el servidor a clientes HTTP usando el protocolo Server-Sent Events."
---

# Server-Sent Events

El middleware SSE transmite eventos desde el servidor a clientes HTTP usando el protocolo [Server-Sent Events](https://html.spec.whatwg.org/multipage/server-sent-events.html).

Hay dos mecanismos disponibles: **streaming directo** desde un handler HTTP, y **relay respaldado por procesos** mediante el middleware `sse_relay`.

## Streaming Directo

Use `res:write_event()` para enviar eventos SSE directamente desde un handler HTTP. La respuesta cambia automáticamente al modo SSE en la primera llamada, estableciendo las cabeceras apropiadas.

```lua
local http = require("http")

local function handler()
    local res = http.response()

    res:write_event({name = "status", data = {state = "started"}})
    res:write_event({name = "progress", data = {percent = 50}})
    res:write_event({name = "status", data = {state = "complete"}})
end
```

Cada evento requiere los campos `name` y `data`. El valor de `data` se codifica como JSON automáticamente.

<tip>
El streaming directo es adecuado para flujos de solicitud-respuesta de corta duración como actualizaciones de progreso. Para conexiones de larga duración gestionadas por procesos en segundo plano, use el SSE Relay.
</tip>

## SSE Relay

El middleware SSE Relay crea streams SSE de larga duración respaldados por procesos. Sigue el mismo patrón de relay que [WebSocket Relay](http/websocket-relay.md).

### Cómo Funciona

1. El handler HTTP establece la cabecera `X-SSE-Relay` con una configuración de relay JSON
2. El middleware intercepta la respuesta y crea una sesión SSE
3. La sesión se registra como un proceso con su propio PID
4. Los mensajes enviados al PID de la sesión se reenvían como eventos SSE al cliente

## Semántica de Procesos

Los streams SSE son procesos completos con su propio PID. Se integran con el sistema de procesos:

- **Direccionables** — Cualquier proceso puede enviar mensajes al PID de un stream
- **Monitoreables** — Los procesos pueden monitorear streams SSE para eventos de salida
- **Vinculables** — Los streams SSE pueden vincularse a otros procesos
- **Eventos EXIT** — Cuando un stream se cierra, los monitores reciben notificaciones de salida

```lua
-- Enviar evento al cliente SSE desde cualquier proceso
process.send(stream_pid, "sse.message", {event = "update", value = 42})

-- Monitorear un stream SSE
process.monitor(stream_pid)
```

<tip>
El relay monitorea el proceso objetivo. Si el objetivo termina, el stream SSE se cierra automáticamente y el cliente recibe un evento `done`.
</tip>

## Configuración

Agregar como middleware post-match en un router:

```yaml
- name: sse_router
  kind: http.router
  meta:
    server: gateway
  prefix: /sse
  post_middleware:
    - sse_relay
  post_options:
    sserelay.allowed.origins: "https://app.example.com"
```

| Opción | Descripción |
|--------|-------------|
| `sserelay.allowed.origins` | Orígenes permitidos separados por comas (admite comodines) |

<note>
Si no se configuran orígenes, solo se permiten solicitudes del mismo origen.
</note>

## Configuración del Handler

El handler HTTP genera un proceso y configura el relay:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local res = http.response()

    -- Generar proceso handler
    local pid = process.spawn("app.sse:handler", "app:processes")

    -- Configurar relay
    res:set_header("X-SSE-Relay", json.encode({
        target_pid = tostring(pid),
        message_topic = "sse.message",
        heartbeat_interval = "30s",
        metadata = {
            user_id = http.request():query("user_id")
        }
    }))
end
```

### Campos de Configuración del Relay

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|----------------|-------------|
| `target_pid` | string | — | PID del proceso que recibe los mensajes (omitir para modo desacoplado) |
| `message_topic` | string | `sse.message` | Filtro de tópico para eventos reenviados |
| `heartbeat_interval` | duration | `30s` | Frecuencia de heartbeat (ej. `30s`, `1m`) |
| `idle_timeout` | duration | — | Cerrar stream tras inactividad |
| `hard_timeout` | duration | — | Cerrar stream tras duración absoluta |
| `metadata` | object | — | Adjuntado a mensajes de join/leave/heartbeat |

## Modo Gestionado vs Desacoplado

### Modo Gestionado

Cuando `target_pid` está establecido, el relay opera en modo gestionado:

- Monitorea el proceso objetivo
- Envía `sse.join` al conectarse y `sse.leave` al desconectarse
- Cierra el stream automáticamente si el objetivo termina

### Modo Desacoplado

Cuando `target_pid` se omite, el relay arranca en modo desacoplado:

- Emite un evento `ready` al cliente con `stream_pid` y `message_topic`
- No se monitorea ningún proceso inicialmente
- Un proceso puede vincularse después enviando un mensaje `sse.control`

```lua
-- Configuración desacoplada: sin target_pid
res:set_header("X-SSE-Relay", json.encode({
    heartbeat_interval = "30s"
}))
```

El cliente recibe un evento `ready`:

```json
{"stream_pid": "sse@node/abc123", "message_topic": "sse.message"}
```

## Tópicos de Mensajes

El relay usa estos tópicos para la comunicación entre el stream y el proceso objetivo:

| Tópico | Dirección | Cuándo | Carga útil |
|--------|-----------|--------|------------|
| `sse.join` | stream → objetivo | El cliente se conecta | `client_pid`, `metadata` |
| `sse.message` | objetivo → stream | Tópico de evento por defecto | Reenviado como evento SSE |
| `sse.heartbeat` | stream → objetivo | Periódico (si está configurado) | `client_pid`, `uptime`, `message_count` |
| `sse.leave` | stream → objetivo | El cliente se desconecta | `client_pid`, `metadata` |
| `sse.control` | cualquiera → stream | Comando de control | Campos de configuración del relay |
| `sse.close` | cualquiera → stream | Cierre forzado | Cadena opcional de motivo |

## Recepción en el Proceso Objetivo

```lua
local json = require("json")

local function handler()
    local inbox = process.inbox()

    while true do
        local msg, ok = inbox:receive()
        if not ok then break end

        local topic = msg:topic()
        local data = msg:payload():data()

        if topic == "sse.join" then
            local client_pid = data.client_pid

        elseif topic == "sse.heartbeat" then
            -- Verificación periódica de salud

        elseif topic == "sse.leave" then
            cleanup(data.client_pid)
        end
    end
end
```

## Envío de Eventos

Envíe eventos al cliente enviando mensajes al PID del stream:

```lua
-- Enviar en el tópico de mensaje por defecto
process.send(stream_pid, "sse.message", {
    event = "update",
    value = 42
})

-- Forzar cierre del stream
process.send(stream_pid, "sse.close", "session expired")
```

Los eventos enviados en el `message_topic` configurado se reenvían al cliente como eventos SSE. El nombre del tópico se convierte en el nombre del evento SSE.

## Transferencia de Conexión

Envíe un mensaje de control para cambiar dinámicamente el proceso objetivo, el filtro de tópico o los timeouts:

```lua
process.send(stream_pid, "sse.control", {
    target_pid = tostring(new_pid),
    message_topic = "custom.topic",
    idle_timeout = "5m"
})
```

Cuando cambia el objetivo, el relay envía `sse.leave` al objetivo anterior y `sse.join` al nuevo. Establezca `target_pid` en una cadena vacía para desvincular sin volver a vincular.

## Véase También

- [Middleware](http/middleware.md) — Configuración de middleware
- [WebSocket Relay](http/websocket-relay.md) — Equivalente WebSocket
- [Process](lua/core/process.md) — Mensajería de procesos
