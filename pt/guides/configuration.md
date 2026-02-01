# Referência de Configuração

O Wippy é configurado via arquivos `.wippy.yaml`. Todas as opções têm padrões sensíveis.

## Gerenciador de Log

Controla o roteamento de logs do runtime. A saída do console é configurada via [flags do CLI](guide-cli.md) (`-v`, `-c`, `-s`).

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `propagate_downstream` | bool | true | Envia logs para saída console/arquivo |
| `stream_to_events` | bool | false | Publica logs no barramento de eventos para acesso programático |
| `min_level` | int | -1 | Nível mínimo: -1=debug, 0=info, 1=warn, 2=error |

```yaml
logmanager:
  propagate_downstream: true
  stream_to_events: false
  min_level: 0
```

Veja: [Módulo Logger](lua-logger.md)

## Profiler

Servidor HTTP pprof do Go para profiling de CPU/memória. Habilite com a flag `-p` ou configuração.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `enabled` | bool | false | Inicia servidor do profiler |
| `address` | string | localhost:6060 | Endereço de escuta |
| `read_timeout` | duration | 15s | Timeout de leitura HTTP |
| `write_timeout` | duration | 15s | Timeout de escrita HTTP |
| `idle_timeout` | duration | 60s | Timeout de keep-alive |

```yaml
profiler:
  enabled: true
  address: "localhost:6060"
```

Acesse em `http://localhost:6060/debug/pprof/`

## Segurança

Comportamento de segurança global. Políticas individuais são definidas como [entradas security.policy](guide-entry-kinds.md).

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `strict_mode` | bool | false | Nega acesso quando contexto de segurança está incompleto |

```yaml
security:
  strict_mode: true
```

Veja: [Sistema de Segurança](system-security.md), [Módulo Security](lua-security.md)

## Registro

Armazenamento de entradas e histórico de versões. O registro armazena todas as entradas de configuração.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `enable_history` | bool | true | Rastreia versões de entradas |
| `history_type` | string | memory | Armazenamento: memory, sqlite, nil |
| `history_path` | string | .wippy/registry.db | Caminho do arquivo SQLite |

```yaml
registry:
  history_type: sqlite
  history_path: /var/lib/wippy/registry.db
```

Veja: [Conceito de Registro](concept-registry.md), [Módulo Registry](lua-registry.md)

## Relay

Roteamento de mensagens entre processos através de nós.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `node_name` | string | local | Identificador para este nó de relay |

```yaml
relay:
  node_name: worker-1
```

Veja: [Modelo de Processos](concept-process-model.md)

## Supervisor

Gerenciamento de ciclo de vida de serviços. Controla como entradas supervisionadas iniciam/param.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `host.buffer_size` | int | 1024 | Capacidade da fila de mensagens |
| `host.worker_count` | int | NumCPU | Workers concorrentes |

```yaml
supervisor:
  host:
    buffer_size: 2048
    worker_count: 32
```

Veja: [Guia de Supervisão](guide-supervision.md)

## Funções

Host de execução de funções. Executa entradas `function.lua`.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `host.buffer_size` | int | 1024 | Capacidade da fila de tarefas |
| `host.worker_count` | int | NumCPU | Workers concorrentes |

```yaml
functions:
  host:
    buffer_size: 2048
    worker_count: 32
```

Veja: [Conceito de Funções](concept-functions.md), [Módulo Funcs](lua-funcs.md)

## Runtime Lua

Cache de VM Lua e avaliação de expressões.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `proto_cache_size` | int | 60000 | Cache de protótipos compilados |
| `main_cache_size` | int | 10000 | Cache de chunks principais |
| `expr.cache_enabled` | bool | true | Cache de expressões compiladas |
| `expr.capacity` | int | 5000 | Tamanho do cache de expressões |
| `json.cache_enabled` | bool | true | Cache de schemas JSON |
| `json.capacity` | int | 1000 | Tamanho do cache JSON |

```yaml
lua:
  proto_cache_size: 60000
  expr:
    cache_enabled: true
    capacity: 5000
```

Veja: [Visão Geral Lua](lua-overview.md)

## Finder

Cache de busca do registro. Usado internamente para consultas de entradas.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `query_cache_size` | int | 1000 | Resultados de consulta em cache |
| `regex_cache_size` | int | 100 | Padrões regex compilados |

```yaml
finder:
  query_cache_size: 2000
```

## OpenTelemetry

Tracing distribuído e exportação de métricas via OTLP.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `enabled` | bool | false | Habilita OTEL |
| `endpoint` | string | localhost:4318 | Endpoint OTLP |
| `protocol` | string | http/protobuf | Protocolo: grpc, http/protobuf |
| `service_name` | string | wippy | Identificador do serviço |
| `sample_rate` | float | 1.0 | Amostragem de trace (0.0-1.0) |
| `traces_enabled` | bool | false | Exporta traces |
| `metrics_enabled` | bool | false | Exporta métricas |
| `http.enabled` | bool | true | Rastreia requisições HTTP |
| `process.enabled` | bool | true | Rastreia ciclo de vida de processos |
| `interceptor.enabled` | bool | false | Rastreia chamadas de funções |

```yaml
otel:
  enabled: true
  endpoint: "http://jaeger:4318"
  traces_enabled: true
  process:
    trace_lifecycle: true
```

Veja: [Guia de Observabilidade](guide-observability.md)

## Shutdown

Comportamento de encerramento gracioso.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `timeout` | duration | 30s | Tempo máximo de espera para componentes pararem |

```yaml
shutdown:
  timeout: 60s
```

## Métricas

Buffer de coleta de métricas internas.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `buffer.size` | int | 10000 | Capacidade do buffer de métricas |
| `interceptor.enabled` | bool | false | Rastreia chamadas de funções automaticamente |

```yaml
metrics:
  buffer:
    size: 20000
  interceptor:
    enabled: true
```

Veja: [Módulo Metrics](lua-metrics.md), [Guia de Observabilidade](guide-observability.md)

## Prometheus

Endpoint de métricas Prometheus.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `enabled` | bool | false | Inicia servidor de métricas |
| `address` | string | localhost:9090 | Endereço de escuta |

```yaml
prometheus:
  enabled: true
  address: "0.0.0.0:9090"
```

Expõe endpoint `/metrics` para scraping do Prometheus.

Veja: [Guia de Observabilidade](guide-observability.md)

## Cluster

Clustering multi-nó com descoberta gossip.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `enabled` | bool | false | Habilita clustering |
| `name` | string | hostname | Identificador do nó |
| `internode.bind_addr` | string | 0.0.0.0 | Endereço de bind entre nós |
| `internode.bind_port` | int | 0 | Porta (0=auto 7950-7959) |
| `membership.bind_port` | int | 7946 | Porta gossip |
| `membership.join_addrs` | string | | Nós seed (separados por vírgula) |
| `membership.secret_key` | string | | Chave de criptografia (base64) |
| `membership.secret_file` | string | | Caminho do arquivo de chave |
| `membership.advertise_addr` | string | | Endereço público para NAT |

```yaml
cluster:
  enabled: true
  name: node-1
  membership:
    bind_port: 7946
    join_addrs: "10.0.0.1:7946,10.0.0.2:7946"
    secret_file: /etc/wippy/cluster.key
```

Veja: [Guia de Cluster](guide-cluster.md)

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `GOMEMLIMIT` | Limite de memória (sobrescreve flag `--memory-limit`) |

## Veja Também

- [Referência do CLI](guide-cli.md) - Opções de linha de comando
- [Tipos de Entradas](guide-entry-kinds.md) - Todos os tipos de entradas
- [Guia de Cluster](guide-cluster.md) - Configuração multi-nó
- [Guia de Observabilidade](guide-observability.md) - Logging, métricas, tracing
