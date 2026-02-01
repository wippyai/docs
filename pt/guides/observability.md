# Observabilidade

Configure logging, metricas e tracing distribuido para aplicacoes Wippy.

## Visao Geral

O Wippy fornece tres pilares de observabilidade configurados no boot:

| Pilar | Backend | Configuracao |
|-------|---------|--------------|
| Logging | Zap (JSON estruturado) | `logger` e `logmanager` |
| Metricas | Prometheus | `prometheus` |
| Tracing | OpenTelemetry | `otel` |

## Configuracao do Logger

### Logger Basico

```yaml
logger:
  mode: production     # development ou production
  level: info          # debug, info, warn, error
  encoding: json       # json ou console
```

### Gerenciador de Log

O gerenciador de log controla propagacao de logs e streaming de eventos:

```yaml
logmanager:
  propagate_downstream: true   # Propaga para componentes filhos
  stream_to_events: false      # Encaminha logs para barramento de eventos
  min_level: 0                 # -1=debug, 0=info, 1=warn, 2=error
```

Quando `stream_to_events` esta habilitado, entradas de log se tornam eventos que processos podem assinar via barramento de eventos.

### Contexto Automatico

Todos os logs incluem:

- `pid` - ID do Processo
- `location` - ID da entrada e numero da linha (ex: `app.api:handler:45`)

## Metricas Prometheus

```yaml
prometheus:
  enabled: true
  address: "localhost:9090"
```

Metricas sao expostas em `/metrics` no endereco configurado.

### Configuracao de Scrape

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'wippy'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
```

Para a API de metricas Lua, veja [Modulo Metrics](lua-metrics.md).

## OpenTelemetry

OTEL fornece tracing distribuido e exportacao opcional de metricas.

### Configuracao Basica

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  protocol: http/protobuf      # grpc ou http/protobuf
  service_name: my-app
  service_version: "1.0.0"
  insecure: false              # Permite conexoes sem TLS
  sample_rate: 1.0             # 0.0 a 1.0
  traces_enabled: true
  metrics_enabled: false
  propagators:
    - tracecontext
    - baggage
```

### Fontes de Trace

Habilite tracing para componentes especificos:

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  service_name: my-app

  # Tracing de requisicoes HTTP
  http:
    enabled: true
    extract_headers: true      # Le contexto de trace de entrada
    inject_headers: true       # Escreve contexto de trace de saida

  # Tracing de ciclo de vida de processos
  process:
    enabled: true
    trace_lifecycle: true      # Rastreia eventos spawn/exit

  # Tracing de mensagens de fila
  queue:
    enabled: true

  # Tracing de chamadas de funcao
  interceptor:
    enabled: true
    order: 0                   # Ordem de execucao do interceptador
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

Quando habilitado, o interceptador de tracing do SDK Temporal e registrado para operacoes de cliente e worker.

Operacoes rastreadas:
- Inicios e conclusoes de workflow
- Execucoes de atividade
- Chamadas de workflow filho
- Tratamento de sinais e queries

### O Que e Rastreado

| Componente | Nome do Span | Atributos |
|------------|--------------|-----------|
| Requisicoes HTTP | `{METHOD} {route}` | http.method, http.url, http.host |
| Chamadas de funcao | ID da Funcao | process.pid, frame.id |
| Ciclo de vida de processo | `{source}.started/terminated` | process.pid |
| Mensagens de fila | Topico da mensagem | Contexto de trace nos headers |
| Workflows Temporal | Nome do Workflow/Atividade | workflow.id, run.id |

### Propagacao de Contexto

O contexto de trace se propaga automaticamente:

- **HTTP → Funcao**: Headers W3C Trace Context
- **Funcao → Funcao**: Heranca de contexto de frame
- **Processo → Processo**: Contexto de spawn
- **Publicacao de fila → consumo**: Headers de mensagem

### Variaveis de Ambiente

OTEL pode ser configurado via ambiente:

| Variavel | Descricao |
|----------|-----------|
| `OTEL_SDK_DISABLED` | Defina como `true` para desabilitar OTEL |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Endpoint do coletor |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` ou `http/protobuf` |
| `OTEL_SERVICE_NAME` | Nome do servico |
| `OTEL_SERVICE_VERSION` | Versao do servico |
| `OTEL_TRACES_SAMPLER_ARG` | Taxa de amostragem (0.0-1.0) |
| `OTEL_PROPAGATORS` | Lista de propagadores |

## Estatisticas do Runtime

O modulo `system` fornece estatisticas internas do runtime:

```lua
local system = require("system")

-- Estatisticas de memoria
local mem = system.memory.stats()
-- mem.alloc, mem.heap_alloc, mem.heap_objects, etc.

-- Contagem de goroutines
local count = system.runtime.goroutines()

-- Estados do supervisor
local states = system.supervisor.states()
```

## Veja Tambem

- [Modulo Logger](lua-logger.md) - API de logging Lua
- [Modulo Metrics](lua-metrics.md) - API de metricas Lua
- [Modulo System](lua-system.md) - Estatisticas do runtime
