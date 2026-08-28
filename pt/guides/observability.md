---
title: "Observabilidade"
description: "Configure logs do Wippy, métricas Prometheus, tracing OpenTelemetry e estatísticas do runtime."
---

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
  encoding: json       # json or console
```

O nível e a saída são controlados por flags da CLI (`-v`, `-c`, `-s`) — apenas `encoding` é lido do yaml.

### Gerenciador de Log

O gerenciador de log controla propagação de logs e streaming de eventos:

```yaml
logmanager:
  propagate_downstream: true   # Propagate to child components
  stream_to_events: false      # Forward logs to event bus
  min_level: 0                 # -1=debug, 0=info, 1=warn, 2=error
```

Quando `stream_to_events` está habilitado, entradas de log se tornam eventos que processos podem assinar via barramento de eventos.

O padrão incorporado do gerenciador de logs é `-1`, mas `wippy run` aplica sua escolha de logging do CLI na inicialização: info (`0`) por padrão e debug (`-1`) com `-v` ou `--very-verbose`.

### Contexto Automático

Logs emitidos a partir de Lua via [módulo logger](lua/system/logger.md) incluem automaticamente:

- `pid` - PID do processo atual
- `location` - ID da entrada e linha chamadora (ex: `app.api:handler:45`)

## Métricas Prometheus

```yaml
prometheus:
  enabled: true
  address: "localhost:9090"
```

O servidor Prometheus inicia somente quando `enabled` é `true` e `address` não está vazio. Ele expõe métricas em `/metrics` e o handler de liveness do runtime em `/livez` nesse endereço.

### Configuração de Scrape

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'wippy'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
```

Para a API de métricas Lua, veja [Módulo Metrics](lua/system/metrics.md).

## OpenTelemetry

OTEL fornece tracing distribuído e exportação opcional de métricas.

### Configuração Básica

```yaml
otel:
  enabled: true
  endpoint: "localhost:4318"
  protocol: http/protobuf      # grpc or http/protobuf
  service_name: my-app
  service_version: "1.0.0"
  insecure: true               # Use plaintext for a local collector
  sample_rate: 1.0             # 0.0 to 1.0
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

  # HTTP request tracing
  http:
    enabled: true
    extract_headers: true      # Read incoming trace context
    inject_headers: true       # Write trace context to the HTTP response

  # Process lifecycle tracing
  process:
    enabled: true
    trace_lifecycle: true      # Trace spawn/exit events

  # Queue message tracing
  queue:
    enabled: true

  # Function call tracing
  interceptor:
    enabled: true
```

Quando OTEL está habilitado, tracing e propagação HTTP, tracing de processos e spans de ciclo de vida, interceptação de funções, tracing de filas e exportação de traces ficam habilitados por padrão. Tracing Temporal e exportação de métricas ficam desabilitados por padrão. O runtime fixado registra o interceptor de funções na ordem 100; embora um valor `interceptor.order` possa ser decodificado da configuração, ele não altera essa ordem de registro.

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
| Ciclo de vida de processo | `<source-id>.started/terminated`, ou `process.started/terminated` sem um frame de origem | process.pid, lifecycle.event |
| Publicação em fila | `<queue-id>.publish` | Atributos de mensagens e contexto de trace nos headers |
| Consumo de fila | ID da função handler | Atributos de mensagens herdados pelo span da função |
| Workflows Temporal | Nome da operação do SDK Temporal | Metadados de workflow e execução do SDK Temporal |

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
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Endpoint do coletor; um schema `http://` ou `https://` é removido antes da configuração do exporter |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` ou `http/protobuf` |
| `OTEL_EXPORTER_OTLP_INSECURE` | Defina como `true` para usar uma conexão sem criptografia com o coletor |
| `OTEL_SERVICE_NAME` | Nome do serviço |
| `OTEL_SERVICE_VERSION` | Versão do serviço |
| `OTEL_TRACES_SAMPLER` | `always_on`, `always_off`, `traceidratio` ou `parentbased_traceidratio` |
| `OTEL_TRACES_SAMPLER_ARG` | Taxa de amostragem (0.0-1.0) |
| `OTEL_PROPAGATORS` | Lista de propagadores |

## Estatísticas do Runtime

O módulo `system` fornece estatísticas internas do runtime:

```lua
local system = require("system")

-- Memory statistics
local mem, mem_err = system.memory.stats()
-- mem.alloc, mem.heap_alloc, mem.heap_objects, etc.

-- Goroutine count
local count, count_err = system.runtime.goroutines()

-- Supervisor states
local states, states_err = system.supervisor.states()
```

Essas funções retornam `value, error`. Elas exigem a permissão `system.read` no escopo de segurança atual.

## Veja Também

- [Módulo Logger](lua/system/logger.md) - API de logging Lua
- [Módulo Metrics](lua/system/metrics.md) - API de métricas Lua
- [Módulo System](lua/system/system.md) - Estatísticas do runtime
