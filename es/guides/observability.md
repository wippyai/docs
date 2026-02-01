# Observabilidad

Configure logging, metricas y trazado distribuido para aplicaciones Wippy.

## Vision General

Wippy proporciona tres pilares de observabilidad configurados al iniciar:

| Pilar | Backend | Configuracion |
|--------|---------|---------------|
| Logging | Zap (JSON estructurado) | `logger` y `logmanager` |
| Metricas | Prometheus | `prometheus` |
| Trazado | OpenTelemetry | `otel` |

## Configuracion del Logger

### Logger Basico

```yaml
logger:
  mode: production     # development o production
  level: info          # debug, info, warn, error
  encoding: json       # json o console
```

### Gestor de Logs

El gestor de logs controla la propagacion de logs y streaming de eventos:

```yaml
logmanager:
  propagate_downstream: true   # Propagar a componentes hijos
  stream_to_events: false      # Reenviar logs al bus de eventos
  min_level: 0                 # -1=debug, 0=info, 1=warn, 2=error
```

Cuando `stream_to_events` esta habilitado, las entradas de log se convierten en eventos a los que los procesos pueden suscribirse via el bus de eventos.

### Contexto Automatico

Todos los logs incluyen:

- `pid` - ID de Proceso
- `location` - ID de entrada y numero de linea (ej., `app.api:handler:45`)

## Metricas Prometheus

```yaml
prometheus:
  enabled: true
  address: "localhost:9090"
```

Las metricas se exponen en `/metrics` en la direccion configurada.

### Configuracion de Scrape

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'wippy'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
```

Para la API de metricas en Lua, consulte el [Modulo Metrics](lua-metrics.md).

## OpenTelemetry

OTEL proporciona trazado distribuido y exportacion opcional de metricas.

### Configuracion Basica

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  protocol: http/protobuf      # grpc o http/protobuf
  service_name: my-app
  service_version: "1.0.0"
  insecure: false              # Permitir conexiones sin TLS
  sample_rate: 1.0             # 0.0 a 1.0
  traces_enabled: true
  metrics_enabled: false
  propagators:
    - tracecontext
    - baggage
```

### Fuentes de Trazas

Habilite trazado para componentes especificos:

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  service_name: my-app

  # Trazado de solicitudes HTTP
  http:
    enabled: true
    extract_headers: true      # Leer contexto de traza entrante
    inject_headers: true       # Escribir contexto de traza saliente

  # Trazado de ciclo de vida de procesos
  process:
    enabled: true
    trace_lifecycle: true      # Trazar eventos spawn/exit

  # Trazado de mensajes de cola
  queue:
    enabled: true

  # Trazado de llamadas de funciones
  interceptor:
    enabled: true
    order: 0                   # Orden de ejecucion del interceptor
```

### Flujos de Trabajo Temporal

Habilite trazado para flujos de trabajo Temporal:

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  service_name: my-app

  temporal:
    enabled: true
```

Cuando esta habilitado, el interceptor de trazado del SDK de Temporal se registra para operaciones de cliente y worker.

Operaciones trazadas:
- Inicios y completaciones de flujos de trabajo
- Ejecuciones de actividades
- Llamadas a flujos de trabajo hijos
- Manejo de senales y consultas

### Que Se Traza

| Componente | Nombre de Span | Atributos |
|-----------|-----------|------------|
| Solicitudes HTTP | `{METHOD} {route}` | http.method, http.url, http.host |
| Llamadas de funciones | ID de Funcion | process.pid, frame.id |
| Ciclo de vida de procesos | `{source}.started/terminated` | process.pid |
| Mensajes de cola | Topic del mensaje | Contexto de traza en headers |
| Flujos de trabajo Temporal | Nombre de Workflow/Activity | workflow.id, run.id |

### Propagacion de Contexto

El contexto de traza se propaga automaticamente:

- **HTTP -> Funcion**: Headers W3C Trace Context
- **Funcion -> Funcion**: Herencia de contexto de frame
- **Proceso -> Proceso**: Contexto de spawn
- **Cola publish -> consume**: Headers del mensaje

### Variables de Entorno

OTEL puede configurarse via entorno:

| Variable | Descripcion |
|----------|-------------|
| `OTEL_SDK_DISABLED` | Establecer a `true` para deshabilitar OTEL |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Endpoint del colector |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` o `http/protobuf` |
| `OTEL_SERVICE_NAME` | Nombre del servicio |
| `OTEL_SERVICE_VERSION` | Version del servicio |
| `OTEL_TRACES_SAMPLER_ARG` | Tasa de muestreo (0.0-1.0) |
| `OTEL_PROPAGATORS` | Lista de propagadores |

## Estadisticas del Runtime

El modulo `system` proporciona estadisticas internas del runtime:

```lua
local system = require("system")

-- Estadisticas de memoria
local mem = system.memory.stats()
-- mem.alloc, mem.heap_alloc, mem.heap_objects, etc.

-- Conteo de goroutines
local count = system.runtime.goroutines()

-- Estados del supervisor
local states = system.supervisor.states()
```

## Ver Tambien

- [Modulo Logger](lua-logger.md) - API de logging en Lua
- [Modulo Metrics](lua-metrics.md) - API de metricas en Lua
- [Modulo System](lua-system.md) - Estadisticas del runtime
