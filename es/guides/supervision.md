# Supervision

El supervisor gestiona los ciclos de vida de los servicios, manejando el orden de inicio, reinicios automaticos, y apagado graceful. Los servicios con `auto_start: true` se inician cuando la aplicacion arranca.

## Configuracion de Ciclo de Vida

Los servicios se registran con el supervisor usando un bloque `lifecycle`. Para procesos, use `process.service` para envolver una definicion de proceso:

```yaml
# Definicion del proceso (el codigo)
- name: worker_process
  kind: process.lua
  source: file://worker.lua
  method: main

# Servicio supervisado (envuelve el proceso con gestion de ciclo de vida)
- name: worker
  kind: process.service
  process: app:worker_process
  host: app:processes
  lifecycle:
    auto_start: true
    start_timeout: 30s
    stop_timeout: 10s
    stable_threshold: 5s
    depends_on:
      - app:database
    restart:
      initial_delay: 2s
      max_delay: 60s
      max_attempts: 10
```

| Campo | Por Defecto | Descripcion |
|-------|---------|-------------|
| `auto_start` | `false` | Iniciar automaticamente cuando el supervisor inicia |
| `start_timeout` | `10s` | Tiempo maximo permitido para inicio |
| `stop_timeout` | `10s` | Tiempo maximo para apagado graceful |
| `stable_threshold` | `5s` | Tiempo de ejecucion antes de considerarse estable |
| `depends_on` | `[]` | Servicios que deben estar ejecutandose primero |

## Resolucion de Dependencias

El supervisor resuelve dependencias de dos fuentes:

1. **Dependencias explicitas** declaradas en `depends_on`
2. **Dependencias extraidas del registro** desde referencias de entrada (ej., `database: app:db` en su config)

```mermaid
graph LR
    A[Servidor HTTP] --> B[Router]
    B --> C[Funcion Handler]
    C --> D[Base de Datos]
    C --> E[Cache]
```

Las dependencias inician antes que los dependientes. Si el Servicio C depende de A y B, tanto A como B deben alcanzar el estado `Running` antes de que C inicie.

<tip>
No necesita declarar entradas de infraestructura como bases de datos en <code>depends_on</code>. El supervisor extrae automaticamente dependencias de las referencias del registro en la configuracion de su entrada.
</tip>

## Politica de Reinicio

Cuando un servicio falla, el supervisor reintenta con backoff exponencial:

```yaml
lifecycle:
  restart:
    initial_delay: 1s      # Espera del primer reintento
    max_delay: 90s         # Tope maximo de delay
    backoff_factor: 2.0    # Multiplicador de delay por intento
    jitter: 0.1            # +-10% de aleatorizacion
    max_attempts: 0        # 0 = reintentos infinitos
```

| Intento | Delay Base | Con Jitter (+-10%) |
|---------|------------|-------------------|
| 1 | 1s | 0.9s - 1.1s |
| 2 | 2s | 1.8s - 2.2s |
| 3 | 4s | 3.6s - 4.4s |
| 4 | 8s | 7.2s - 8.8s |
| ... | ... | ... |
| N | 90s | 81s - 99s (tope) |

Cuando un servicio se ejecuta por mas tiempo que `stable_threshold`, el contador de reintentos se resetea. Esto previene que fallos transitorios escalen permanentemente los delays.

### Errores Terminales

Estos errores detienen los intentos de reintento:

- Cancelacion de contexto
- Solicitud de terminacion explicita
- Errores marcados como no-reintentables

## Contexto de Seguridad

Los servicios pueden ejecutarse con una identidad de seguridad especifica:

```yaml
# Definicion del proceso
- name: admin_worker_process
  kind: process.lua
  source: file://admin_worker.lua
  method: main

# Servicio supervisado con contexto de seguridad
- name: admin_worker
  kind: process.service
  process: app:admin_worker_process
  host: app:processes
  lifecycle:
    auto_start: true
    security:
      actor:
        id: "service:admin-worker"
        meta:
          role: admin
      groups:
        - app:admin_policies
      policies:
        - app:data_access
```

El contexto de seguridad establece:

| Campo | Descripcion |
|-------|-------------|
| `actor.id` | Cadena de identidad para este servicio |
| `actor.meta` | Metadatos clave-valor (rol, permisos, etc.) |
| `groups` | Grupos de politicas a aplicar |
| `policies` | Politicas individuales a aplicar |

El codigo ejecutandose en el servicio hereda este contexto de seguridad. El modulo `security` puede entonces verificar permisos:

```lua
local security = require("security")

if security.can("delete", "users") then
    -- permitido
end
```

<note>
Cuando no se configura contexto de seguridad, el servicio se ejecuta sin un actor. En modo estricto (por defecto), las verificaciones de seguridad fallan. Configure un contexto de seguridad para servicios que necesiten autorizacion.
</note>

## Estados del Servicio

```mermaid
stateDiagram-v2
    [*] --> Inactive
    Inactive --> Starting
    Starting --> Running
    Running --> Stopping
    Stopping --> Stopped
    Stopped --> [*]

    Running --> Failed
    Starting --> Failed
    Failed --> Starting : reintentar
```

El supervisor transiciona servicios a traves de estos estados:

| Estado | Descripcion |
|-------|-------------|
| `Inactive` | Registrado pero no iniciado |
| `Starting` | Inicio en progreso |
| `Running` | Operando normalmente |
| `Stopping` | Apagado graceful en progreso |
| `Stopped` | Terminado limpiamente |
| `Failed` | Ocurrio un error, puede reintentar |

## Orden de Inicio y Apagado

**Inicio**: Dependencias primero, luego dependientes. Servicios al mismo nivel de dependencia pueden iniciar en paralelo.

**Apagado**: Dependientes primero, luego dependencias. Esto asegura que los servicios dependientes terminen antes de que sus dependencias se detengan.

```
Inicio:  database -> cache -> handler -> http_server
Apagado: http_server -> handler -> cache -> database
```

## Ver Tambien

- [Modelo de Procesos](concept-process-model.md) - Ciclo de vida de procesos
- [Configuracion](guide-configuration.md) - Formato de configuracion YAML
- [Modulo Security](lua-security.md) - Verificaciones de permisos en Lua
