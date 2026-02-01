# Referencia de Configuracao

O Wippy e configurado via arquivos `.wippy.yaml`. Todas as opcoes tem padroes sensiveis.

## Gerenciador de Log

Controla o roteamento de logs do runtime. A saida do console e configurada via [flags do CLI](guide-cli.md) (`-v`, `-c`, `-s`).

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `propagate_downstream` | bool | true | Envia logs para saida console/arquivo |
| `stream_to_events` | bool | false | Publica logs no barramento de eventos para acesso programatico |
| `min_level` | int | -1 | Nivel minimo: -1=debug, 0=info, 1=warn, 2=error |

```yaml
logmanager:
  propagate_downstream: true
  stream_to_events: false
  min_level: 0
```

Veja: [Modulo Logger](lua-logger.md)

## Profiler

Servidor HTTP pprof do Go para profiling de CPU/memoria. Habilite com a flag `-p` ou configuracao.

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `enabled` | bool | false | Inicia servidor do profiler |
| `address` | string | localhost:6060 | Endereco de escuta |
| `read_timeout` | duration | 15s | Timeout de leitura HTTP |
| `write_timeout` | duration | 15s | Timeout de escrita HTTP |
| `idle_timeout` | duration | 60s | Timeout de keep-alive |

```yaml
profiler:
  enabled: true
  address: "localhost:6060"
```

Acesse em `http://localhost:6060/debug/pprof/`

## Seguranca

Comportamento de seguranca global. Politicas individuais sao definidas como [entradas security.policy](guide-entry-kinds.md).

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `strict_mode` | bool | false | Nega acesso quando contexto de seguranca esta incompleto |

```yaml
security:
  strict_mode: true
```

Veja: [Sistema de Seguranca](system-security.md), [Modulo Security](lua-security.md)

## Registro

Armazenamento de entradas e historico de versoes. O registro armazena todas as entradas de configuracao.

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `enable_history` | bool | true | Rastreia versoes de entradas |
| `history_type` | string | memory | Armazenamento: memory, sqlite, nil |
| `history_path` | string | .wippy/registry.db | Caminho do arquivo SQLite |

```yaml
registry:
  history_type: sqlite
  history_path: /var/lib/wippy/registry.db
```

Veja: [Conceito de Registro](concept-registry.md), [Modulo Registry](lua-registry.md)

## Relay

Roteamento de mensagens entre processos atraves de nos.

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `node_name` | string | local | Identificador para este no de relay |

```yaml
relay:
  node_name: worker-1
```

Veja: [Modelo de Processos](concept-process-model.md)

## Supervisor

Gerenciamento de ciclo de vida de servicos. Controla como entradas supervisionadas iniciam/param.

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `host.buffer_size` | int | 1024 | Capacidade da fila de mensagens |
| `host.worker_count` | int | NumCPU | Workers concorrentes |

```yaml
supervisor:
  host:
    buffer_size: 2048
    worker_count: 32
```

Veja: [Guia de Supervisao](guide-supervision.md)

## Funcoes

Host de execucao de funcoes. Executa entradas `function.lua`.

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `host.buffer_size` | int | 1024 | Capacidade da fila de tarefas |
| `host.worker_count` | int | NumCPU | Workers concorrentes |

```yaml
functions:
  host:
    buffer_size: 2048
    worker_count: 32
```

Veja: [Conceito de Funcoes](concept-functions.md), [Modulo Funcs](lua-funcs.md)

## Runtime Lua

Cache de VM Lua e avaliacao de expressoes.

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `proto_cache_size` | int | 60000 | Cache de prototipos compilados |
| `main_cache_size` | int | 10000 | Cache de chunks principais |
| `expr.cache_enabled` | bool | true | Cache de expressoes compiladas |
| `expr.capacity` | int | 5000 | Tamanho do cache de expressoes |
| `json.cache_enabled` | bool | true | Cache de schemas JSON |
| `json.capacity` | int | 1000 | Tamanho do cache JSON |

```yaml
lua:
  proto_cache_size: 60000
  expr:
    cache_enabled: true
    capacity: 5000
```

Veja: [Visao Geral Lua](lua-overview.md)

## Finder

Cache de busca do registro. Usado internamente para consultas de entradas.

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `query_cache_size` | int | 1000 | Resultados de consulta em cache |
| `regex_cache_size` | int | 100 | Padroes regex compilados |

```yaml
finder:
  query_cache_size: 2000
```

## OpenTelemetry

Tracing distribuido e exportacao de metricas via OTLP.

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `enabled` | bool | false | Habilita OTEL |
| `endpoint` | string | localhost:4318 | Endpoint OTLP |
| `protocol` | string | http/protobuf | Protocolo: grpc, http/protobuf |
| `service_name` | string | wippy | Identificador do servico |
| `sample_rate` | float | 1.0 | Amostragem de trace (0.0-1.0) |
| `traces_enabled` | bool | false | Exporta traces |
| `metrics_enabled` | bool | false | Exporta metricas |
| `http.enabled` | bool | true | Rastreia requisicoes HTTP |
| `process.enabled` | bool | true | Rastreia ciclo de vida de processos |
| `interceptor.enabled` | bool | false | Rastreia chamadas de funcoes |

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

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `timeout` | duration | 30s | Tempo maximo de espera para componentes pararem |

```yaml
shutdown:
  timeout: 60s
```

## Metricas

Buffer de coleta de metricas internas.

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `buffer.size` | int | 10000 | Capacidade do buffer de metricas |
| `interceptor.enabled` | bool | false | Rastreia chamadas de funcoes automaticamente |

```yaml
metrics:
  buffer:
    size: 20000
  interceptor:
    enabled: true
```

Veja: [Modulo Metrics](lua-metrics.md), [Guia de Observabilidade](guide-observability.md)

## Prometheus

Endpoint de metricas Prometheus.

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `enabled` | bool | false | Inicia servidor de metricas |
| `address` | string | localhost:9090 | Endereco de escuta |

```yaml
prometheus:
  enabled: true
  address: "0.0.0.0:9090"
```

Expoe endpoint `/metrics` para scraping do Prometheus.

Veja: [Guia de Observabilidade](guide-observability.md)

## Cluster

Clustering multi-no com descoberta gossip.

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `enabled` | bool | false | Habilita clustering |
| `name` | string | hostname | Identificador do no |
| `internode.bind_addr` | string | 0.0.0.0 | Endereco de bind entre nos |
| `internode.bind_port` | int | 0 | Porta (0=auto 7950-7959) |
| `membership.bind_port` | int | 7946 | Porta gossip |
| `membership.join_addrs` | string | | Nos seed (separados por virgula) |
| `membership.secret_key` | string | | Chave de criptografia (base64) |
| `membership.secret_file` | string | | Caminho do arquivo de chave |
| `membership.advertise_addr` | string | | Endereco publico para NAT |

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

## Variaveis de Ambiente

| Variavel | Descricao |
|----------|-----------|
| `GOMEMLIMIT` | Limite de memoria (sobrescreve flag `--memory-limit`) |

## Veja Tambem

- [Referencia do CLI](guide-cli.md) - Opcoes de linha de comando
- [Tipos de Entradas](guide-entry-kinds.md) - Todos os tipos de entradas
- [Guia de Cluster](guide-cluster.md) - Configuracao multi-no
- [Guia de Observabilidade](guide-observability.md) - Logging, metricas, tracing
