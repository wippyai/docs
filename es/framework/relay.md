# Relay

El módulo `wippy/relay` proporciona infraestructura de relay WebSocket con una arquitectura de hub de dos niveles. Un hub central gestiona hubs por usuario, los cuales a su vez gestionan conexiones de clientes WebSocket y enrutan mensajes a plugins.

## Arquitectura

```
Central Hub
├── User Hub (alice)
│   ├── Plugin: session_
│   ├── Plugin: ai_
│   ├── WebSocket Client 1
│   └── WebSocket Client 2
├── User Hub (bob)
│   ├── Plugin: session_
│   └── WebSocket Client 1
└── ...
```

El hub central se ejecuta como un servicio. Cuando un cliente WebSocket se conecta, el hub central busca o crea un hub de usuario para ese usuario. El hub de usuario gestiona la vida útil del cliente y enruta mensajes a los plugins basándose en prefijos de comando.

## Configuración

Agregue el módulo a su proyecto:

```bash
wippy add wippy/relay
wippy install
```

Declare la dependencia con los parámetros requeridos:

```yaml
version: "1.0"
namespace: app

entries:
  - name: os_env
    kind: env.storage.os

  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: dep.relay
    kind: ns.dependency
    component: wippy/relay
    version: "*"
    parameters:
      - name: application_host
        value: app:processes
      - name: env_storage
        value: app:os_env
      - name: user_security_scope
        value: app.security:user_scope
```

### Parámetros de Configuración

| Parámetro | Requerido | Predeterminado | Descripción |
|-----------|-----------|----------------|-------------|
| `application_host` | sí | — | Host de procesos para procesos del relay |
| `env_storage` | no | interno | Almacenamiento de variables de entorno |
| `user_security_scope` | sí | — | Ámbito de seguridad para hubs de usuario |
| `max_connections_per_user` | no | `5` | Conexiones WebSocket por usuario |
| `queue_multiplier` | no | `100` | Cola de mensajes = conexiones × multiplicador |
| `user_hub_inactivity_timeout` | no | `7200s` | Tiempo de inactividad antes de la limpieza del hub |

## Flujo de Conexión del Cliente

1. El cliente WebSocket se conecta con `user_id` en los metadatos
2. El hub central valida la conexión y verifica los límites por usuario
3. El hub central crea o reutiliza un hub de usuario para el usuario
4. El hub de usuario envía un mensaje `welcome` al cliente:

```json
{
    "user_id": "alice",
    "client_count": 1,
    "plugins": [
        { "prefix": "session_", "process_id": "...", "status": "running" },
        { "prefix": "ai_", "process_id": "...", "status": "pending" }
    ]
}
```

El `status` del plugin es uno de `"not_started"` (registrado, nunca iniciado), `"pending"` (inicio en curso), `"running"`, `"failed"` o `"stopped"`.

## Enrutamiento de Mensajes

Los clientes envían mensajes JSON con un campo `type`. El hub de usuario compara el prefijo del tipo con los plugins registrados y enruta el mensaje:

```json
{ "type": "session_get_state", "data": { "key": "value" } }
```

El prefijo `session_` coincide con el plugin de sesión. El hub elimina el prefijo y envía el mensaje al proceso del plugin con el tipo despojado como tópico:

```lua
-- process topic: "get_state"
-- payload:
{
    conn_pid = client_pid,
    type = "session_get_state",  -- original full type preserved
    data = { key = "value" },
    request_id = "...",
    session_id = "..."
}
```

Los plugins responden enviando mensajes de vuelta a `conn_pid`.

## Plugins

Los plugins son entradas `process.lua` con `meta.type: relay.plugin`:

```yaml
entries:
  - name: session_plugin
    kind: process.lua
    meta:
      type: relay.plugin
      command_prefix: session_
      auto_start: true
    source: file://session_plugin.lua
    modules: [json, time, logger]
    method: run
```

### Metadatos del Plugin

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `meta.type` | string | Debe ser `relay.plugin` |
| `meta.command_prefix` | string | Prefijo del tipo de mensaje que maneja este plugin |
| `meta.auto_start` | boolean | Iniciar cuando se inicialice el hub de usuario |
| `meta.default_host` | string | Anular el host de procesos |

### Ciclo de Vida del Plugin

Los plugins son generados por el hub de usuario. Al arrancar, el plugin recibe:

```lua
function run(args)
    local user_id = args.user_id
    local user_metadata = args.user_metadata
    local user_hub_pid = args.user_hub_pid
    local config = args.config
end
```

El plugin `session_` recibe mensajes de ciclo de vida:

| Mensaje | Cuándo |
|---------|--------|
| `"resume"` | Primer cliente se conecta al hub de usuario |
| `"shutdown"` | Último cliente se desconecta del hub de usuario |

Los plugins reciben 1 reinicio automático en caso de fallo. Después de un segundo fallo, el plugin se marca como `"failed"` y no se reinicia.

### Implementación del Plugin

Los plugins reciben mensajes en su buzón de proceso. Cada mensaje tiene un tópico (el prefijo de comando despojado) y una carga útil que contiene los datos originales del mensaje junto con `conn_pid` para enviar respuestas de vuelta al cliente.

```lua
local json = require("json")

local function handle_message(topic, payload)
    if topic == "get_state" then
        process.send(payload.conn_pid, "ws.message", json.encode({
            type = "session_state",
            data = { status = "active" }
        }))
    end
end

local function run(args)
    local user_id = args.user_id
    local inbox = process.inbox()
    local events = process.events()

    while true do
        local result = channel.select({
            inbox:case_receive(),
            events:case_receive()
        })
        if not result.ok then break end

        if result.channel == inbox then
            local msg = result.value
            local topic = msg:topic()
            local payload = msg:payload():data()

            if topic == "resume" then
                -- first client connected
            elseif topic == "shutdown" then
                -- last client disconnected
            else
                handle_message(topic, payload)
            end
        elseif result.channel == events then
            local event = result.value
            if event.kind == process.event.CANCEL then
                break
            end
        end
    end
end

return { run = run }
```

## Manejo de Errores

El relay envía mensajes de error estructurados a los clientes:

| Código de Error | Descripción |
|-----------------|-------------|
| `max_connections_reached` | Usuario en el límite de conexiones |
| `missing_user_id` | Sin user_id en los metadatos de conexión |
| `hub_creation_failed` | Falló la generación del hub de usuario |
| `invalid_json` | Error de decodificación del mensaje |
| `unknown_command` | Mensaje sin campo type |
| `plugin_not_found` | Ningún plugin coincide con el prefijo del comando |
| `plugin_failed` | Plugin no disponible o caído |

## Ciclo de Vida del Hub

### Creación del Hub de Usuario

Los hubs de usuario se crean bajo demanda cuando el primer cliente de un usuario se conecta. El hub se genera con el actor de seguridad y el ámbito del usuario.

### Recolección de Basura

El hub central verifica periódicamente hubs de usuario inactivos. Un hub sin clientes conectados durante más de `user_hub_inactivity_timeout` (predeterminado 2 horas) se termina de forma elegante con un timeout de cancelación de 10 segundos.

El intervalo de verificación de GC se deriva automáticamente: `inactivity_timeout / 2.5`.

### Seguridad

El hub central se ejecuta bajo su propio grupo de seguridad (`wippy.relay.security:root`) con acceso completo. Cada hub de usuario se genera con el `user_security_scope` configurado, aislando las operaciones a nivel de usuario.

## Tópicos Internos

| Tópico | Dirección | Descripción |
|--------|-----------|-------------|
| `ws.join` | Cliente → Hub Central/Usuario | Solicitud de conexión |
| `ws.leave` | Cliente → Hub Central/Usuario | Desconexión |
| `ws.message` | Cliente → Hub de Usuario | Mensaje WebSocket |
| `ws.cancel` | Central → Hub de Usuario | Apagado elegante |
| `ws.control` | Central → Hub de Usuario | Control de enrutamiento |
| `hub.activity_update` | Hub de Usuario → Central | Actualización del conteo de clientes |

## Véase También

- [WebSocket Relay](../http/websocket-relay.md) - Configuración del endpoint WebSocket HTTP
- [Modelo de Procesos](../concepts/process-model.md) - Ciclo de vida y mensajería de procesos
- [Seguridad](../system/security.md) - Actores y ámbitos de seguridad
- [Resumen del Framework](overview.md) - Uso del módulo del framework
