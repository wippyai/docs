# Observabilidade

Configure logging, métricas e tracing distribuído para aplicações Wippy.

## Visão Geral

O Wippy fornece três pilares de observabilidade configurados no boot:

| Pilar | Backend | Configuração |
|-------|---------|--------------|
| Logging | Zap (JSON estruturado) | `logger` e `logmanager` |
| Métricas | Prometheus | `prometheus` |
| Tracing | OpenTelemetry | `otel` |

## Configuração do Logger

### Logger Básico

```yaml
logger:
  mode: production     # development ou production
  level: info          # debug, info, warn, error
  encoding: json       # json ou console
```

### Gerenciador de Log

O gerenciador de log controla propagação de logs e streaming de eventos:

```yaml
logmanager:
  propagate_downstream: true   # Propaga para componentes filhos
  stream_to_events: false      # Encaminha logs para barramento de eventos
  min_level: 0                 # -1=debug, 0=info, 1=warn, 2=error
```

Quando `stream_to_events` está habilitado, entradas de log se tornam eventos que processos podem assinar via barramento de eventos.

### Contexto Automático

Todos os logs incluem:

- `pid` - ID do Processo
- `location` - ID da entrada e número da linha (ex: `app.api:handler:45`)

## Métricas Prometheus

```yaml
prometheus:
  enabled: true
  address: "localhost:9090"
```

Métricas são expostas em `/metrics` no endereço configurado.

### Configuração de Scrape

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'wippy'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
```

Para a API de métricas Lua, veja [Módulo Metrics](lua-metrics.md).

## OpenTelemetry

OTEL fornece tracing distribuído e exportação opcional de métricas.

### Configuração Básica

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  protocol: http/protobuf      # grpc ou http/protobuf
  service_name: my-app
  service_version: "1.0.0"
  insecure: false              # Permite conexões sem TLS
  sample_rate: 1.0             # 0.0 a 1.0
  traces_enabled: true
  metrics_enabled: false
  propagators:
    - tracecontext
    - baggage
```

### Fontes de Trace

Habilite tracing para componentes específicos:

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  service_name: my-app

  # Tracing de requisições HTTP
  http:
    enabled: true
    extract_headers: true      # Lê contexto de trace de entrada
    inject_headers: true       # Escreve contexto de trace de saída

  # Tracing de ciclo de vida de processos
  process:
    enabled: true
    trace_lifecycle: true      # Rastreia eventos spawn/exit

  # Tracing de mensagens de fila
  queue:
    enabled: true

  # Tracing de chamadas de função
  interceptor:
    enabled: true
    order: 0                   # Ordem de execução do interceptador
```

### Workflows Temporal

Habilite tracing para workflows Temporal:

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  service_name: my-app

  temporal:
    enabled: true
```

Quando habilitado, o interceptador de tracing do SDK Temporal é registrado para operações de cliente e worker.

Operações rastreadas:
- Inícios e conclusões de workflow
- Execuções de atividade
- Chamadas de workflow filho
- Tratamento de sinais e queries

### O Que é Rastreado

| Componente | Nome do Span | Atributos |
|------------|--------------|-----------|
| Requisições HTTP | `{METHOD} {route}` | http.method, http.url, http.host |
| Chamadas de função | ID da Função | process.pid, frame.id |
| Ciclo de vida de processo | `{source}.started/terminated` | process.pid |
| Mensagens de fila | Tópico da mensagem | Contexto de trace nos headers |
| Workflows Temporal | Nome do Workflow/Atividade | workflow.id, run.id |

### Propagação de Contexto

O contexto de trace se propaga automaticamente:

- **HTTP -> Função**: Headers W3C Trace Context
- **Função -> Função**: Herança de contexto de frame
- **Processo -> Processo**: Contexto de spawn
- **Publicação de fila -> consumo**: Headers de mensagem

### Variáveis de Ambiente

OTEL pode ser configurado via ambiente:

| Variável | Descrição |
|----------|-----------|
| `OTEL_SDK_DISABLED` | Defina como `true` para desabilitar OTEL |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Endpoint do coletor |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` ou `http/protobuf` |
| `OTEL_SERVICE_NAME` | Nome do serviço |
| `OTEL_SERVICE_VERSION` | Versão do serviço |
| `OTEL_TRACES_SAMPLER_ARG` | Taxa de amostragem (0.0-1.0) |
| `OTEL_PROPAGATORS` | Lista de propagadores |

## Estatísticas do Runtime

O módulo `system` fornece estatísticas internas do runtime:

```lua
local system = require("system")

-- Estatísticas de memória
local mem = system.memory.stats()
-- mem.alloc, mem.heap_alloc, mem.heap_objects, etc.

-- Contagem de goroutines
local count = system.runtime.goroutines()

-- Estados do supervisor
local states = system.supervisor.states()
```

## Veja Também

- [Módulo Logger](lua-logger.md) - API de logging Lua
- [Módulo Metrics](lua-metrics.md) - API de métricas Lua
- [Módulo System](lua-system.md) - Estatísticas do runtime
