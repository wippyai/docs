# Referência de Configuração

O Wippy é configurado via arquivos `.wippy.yaml`. Todas as opções têm padrões sensíveis.

## Logger

Controla o encoder do logger zap. Flags do CLI (`-v`, `-c`, `-s`) sobrescrevem nível/saída; a única opção controlada por yaml é a codificação.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `encoding` | string | console | Encoder: `console` (legível) ou `json` (estruturado) |

```yaml
logger:
  encoding: json
```

## Gerenciador de Log

Controla o roteamento de logs do runtime. A saída do console é configurada via [flags do CLI](guides/cli.md) (`-v`, `-c`, `-s`).

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

Veja: [Módulo Logger](lua/system/logger.md)

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

Comportamento de segurança global. Políticas individuais são definidas como [entradas security.policy](guides/entry-kinds.md).

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `strict_mode` | bool | false | Nega acesso quando contexto de segurança está incompleto |

```yaml
security:
  strict_mode: true
```

Veja: [Sistema de Segurança](system/security.md), [Módulo Security](lua/security/security.md)

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

Veja: [Conceito de Registro](concepts/registry.md), [Módulo Registry](lua/core/registry.md)

## Relay

Roteamento de mensagens entre processos através de nós.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `node_name` | string | local | Identificador para este nó de relay |

```yaml
relay:
  node_name: worker-1
```

Veja: [Modelo de Processos](concepts/process-model.md)

## Supervisor

Gerenciamento de ciclo de vida de serviços. Controla a caixa de mensagens de controle interna do supervisor usada para despachar eventos de ciclo de vida.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `host.buffer_size` | int | 1024 | Capacidade da caixa de mensagens de controle interna |
| `host.worker_count` | int | 16 | Workers despachantes concorrentes |

```yaml
supervisor:
  host:
    buffer_size: 2048
    worker_count: 32
```

Veja: [Guia de Supervisão](guides/supervision.md)

<note>
Workers e filas por `process.host` são configurados na própria entrada (`workers`, `queue_size`, `local_queue_size`), não nesta seção global. Veja o tipo de entrada [Process Host](system/process-host.md).
</note>

## Runtime Lua

Cache de VM Lua e avaliação de expressões.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `proto_cache_size` | int | 60000 | Cache de protótipos compilados |
| `main_cache_size` | int | 10000 | Cache de chunks principais |
| `cache.enabled` | bool | false | Persistir cache de bytecode/typecheck compilado em disco |
| `cache.dir` | string | (diretório de cache do sistema) | Caminho do diretório de cache |
| `cache.mode` | string | `read_write` | Modo de cache: `read_write`, `read_only`, `write_only` |
| `type_system.enabled` | bool | false | Habilitar verificação estática de tipos |
| `type_system.strict` | bool | false | Tratar avisos de tipo como erros |

```yaml
lua:
  proto_cache_size: 60000
  cache:
    enabled: true
    dir: .cache/lua
  type_system:
    enabled: true
```

Veja: [Visão Geral Lua](lua/overview.md)

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
| `service_name` | string | wippy-runtime | Identificador do serviço |
| `service_version` | string | | Tag de versão do serviço |
| `insecure` | bool | true | Permite conexão OTLP em texto plano |
| `sample_rate` | float | 1.0 | Amostragem de trace (0.0-1.0) |
| `propagators` | string[] | `[tracecontext, baggage]` | Propagadores de contexto |
| `traces_enabled` | bool | true | Exporta traces |
| `metrics_enabled` | bool | false | Exporta métricas |
| `http.enabled` | bool | true | Rastreia requisições HTTP |
| `http.extract_headers` | bool | true | Extrai contexto de trace dos cabeçalhos de entrada |
| `http.inject_headers` | bool | true | Injeta contexto de trace nos cabeçalhos de saída |
| `process.enabled` | bool | true | Rastreia ciclo de vida de processos |
| `process.trace_lifecycle` | bool | true | Emite spans para spawn/terminate |
| `interceptor.enabled` | bool | true | Rastreia chamadas de funções |
| `interceptor.order` | int | 100 | Prioridade do interceptor |
| `queue.enabled` | bool | true | Rastreia publicação/consumo de filas |
| `temporal.enabled` | bool | false | Rastreia workflows do Temporal |

```yaml
otel:
  enabled: true
  endpoint: "http://jaeger:4318"
  traces_enabled: true
  process:
    trace_lifecycle: true
```

Variáveis de ambiente OTEL padrão (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `OTEL_TRACES_SAMPLER_ARG`, `OTEL_PROPAGATORS`, `OTEL_SDK_DISABLED`) sobrescrevem os campos correspondentes.

Veja: [Guia de Observabilidade](guides/observability.md)

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

Veja: [Módulo Metrics](lua/system/metrics.md), [Guia de Observabilidade](guides/observability.md)

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

Veja: [Guia de Observabilidade](guides/observability.md)

## Cluster

Clustering multi-nó: associação gossip mais um núcleo Raft de consenso limitado. Consulte o [Guia de Cluster](guides/cluster.md) para a arquitetura e modelo operacional; esta seção é a referência de chaves de configuração.

### Nível superior

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `enabled` | bool | false | Habilita clustering |
| `name` | string | hostname | Nome do nó; deve ser único no cluster |
| `failure_domain` | string | | Label de zona/rack; anunciado via gossip para que voters se distribuam entre domínios |

### Associação (gossip)

Gossip SWIM via memberlist. Usado para descoberta de nós, detecção de falhas e disseminação de metadados.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `membership.bind_addr` | string | 0.0.0.0 | Endereço de bind do gossip |
| `membership.bind_port` | int | 7946 | Porta de bind do gossip (TCP+UDP) |
| `membership.advertise_addr` | string | | Endereço que os peers usam para alcançar este nó (NAT/k8s) |
| `membership.join_addrs` | string | | Pares seed `host:port` separados por vírgula |
| `membership.secret_key` | string | | Chave de criptografia gossip codificada em base64 (inline) |
| `membership.secret_file` | string | | Caminho para arquivo contendo a chave de criptografia gossip |

### Internós (transporte)

Malha TCP que transporta o tráfego de relay e Raft entre nós. O Raft usa esta malha (multiplexado com yamux); não há porta Raft separada.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `internode.bind_addr` | string | 0.0.0.0 | Endereço de bind da malha |
| `internode.bind_port` | int | 0 | Porta da malha (0 = auto: 7950-7959, depois efêmera) |
| `internode.auto_port` | bool | true | Descobrir a porta real no boot, fixá-la e anunciá-la via gossip |

### Raft (consenso)

Raft limitado e sem disco. O estado fica em memória; ao reiniciar um nó, ele rejoina o quórum e reproduz a partir dos peers. Sem `data_dir`. O bootstrap é conduzido por gossip (estilo `bootstrap_expect` do Consul/Nomad), não por uma lista inicial estática de peers.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `raft.enabled` | bool | true | Executa um nó Raft; `false` torna este um cliente apenas gossip |
| `raft.role` | string | server | `server` executa um nó Raft; `client` é apenas gossip |
| `raft.eligible` | bool | true | Se este nó pode ser selecionado como voter |
| `raft.priority` | int | 100 | Prioridade de seleção de voter (menor é preferido) |
| `raft.bootstrap_expect` | int | 1 | Tamanho inicial do quórum: `0`=apenas se juntar a um existente, `1`=nó único, `N`=aguardar N peers elegíveis antes de formar quórum |
| `raft.max_voters` | int | 5 | Teto de voters (deve ser ímpar); nós elegíveis extras tornam-se standbys |
| `raft.max_standbys` | int | 4 | Membros não-votantes mantidos prontos para promoção; nós além de voters+standbys não são membros Raft |
| `raft.reconcile_debounce` | duration | 2s | Janela de coalescência após um evento gossip antes do reconciliador de voters executar |
| `raft.reconcile_timeout` | duration | 2s | Limite por passagem de reconciliação |
| `raft.heartbeat_timeout` | duration | 3s | Tempo de espera ocioso do follower antes de iniciar uma eleição |
| `raft.election_timeout` | duration | 3s | Timeout de eleição do candidato (limitado a >= heartbeat) |
| `raft.commit_timeout` | duration | 500ms | Cadência de heartbeat do leader ocioso |
| `raft.snapshot_threshold` | uint64 | 8192 | Entradas de log desde o último snapshot antes de criar um novo |
| `raft.snapshot_interval` | duration | 2m | Intervalo de verificação de snapshot |
| `raft.snapshot_retain` | int | 3 | Snapshots retidos |
| `raft.trailing_logs` | uint64 | 10240 | Entradas de log retidas após um snapshot |
| `raft.max_append_entries` | int | 16 | Máximo de entradas por RPC AppendEntries |
| `raft.leader_probe_interval` | duration | 3s | Cadência de sondagem de alcançabilidade do leader do registro global |
| `raft.leader_probe_grace` | int | 3 | Falhas consecutivas de sondagem antes de declarar o leader inacessível |

Nó único (desenvolvimento) — clustering ativo, bootstrap imediato:

```yaml
cluster:
  enabled: true
  name: dev
  raft:
    bootstrap_expect: 1
```

Cluster de três voters — cada nó lista os outros como seeds e aguarda os três antes de formar quórum:

```yaml
cluster:
  enabled: true
  name: node-1
  failure_domain: us-east-1a
  membership:
    bind_port: 7946
    join_addrs: "node-2:7946,node-3:7946"
    secret_file: /etc/wippy/cluster.key
  raft:
    bootstrap_expect: 3
    max_voters: 5
```

Cliente apenas gossip — junta-se ao cluster para nomeação/mensagens mas nunca executa Raft:

```yaml
cluster:
  enabled: true
  name: edge-7
  membership:
    join_addrs: "node-1:7946,node-2:7946"
  raft:
    role: client
```

## LSP

Servidor do Language Server Protocol para integrações com editores.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `enabled` | bool | false | Habilitar o servidor TCP |
| `address` | string | :7777 | Endereço de escuta TCP |
| `http_enabled` | bool | false | Habilitar o transporte HTTP |
| `http_address` | string | :7778 | Endereço de escuta HTTP |
| `http_path` | string | /lsp | Caminho do endpoint HTTP |
| `http_allow_origin` | string | * | Origem permitida por CORS |
| `max_message_bytes` | int | 8388608 | Tamanho máximo de mensagem recebida |

```yaml
lsp:
  enabled: true
  address: ":7777"
  http_enabled: true
```

Veja: [Guia do LSP](guides/lsp.md)

## Serviço de Rede

Gerenciador de redes overlay (drivers SOCKS5, I2P, Tailscale).

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `state_dir` | string | .wippy/net | Diretório de armazenamento do estado do driver |
| `default_network` | string | | ID de rede padrão aplicado quando entradas omitem `network` |

```yaml
network_service:
  state_dir: /var/lib/wippy/net
  default_network: app:tailscale
```

Veja: [Overlays de Rede](system/network.md)

## Dispatcher HTTP

Ajuste para o pool de clientes HTTP compartilhado usado por funções despachadas via HTTP e requisições de saída.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `dispatcher.http.timeout` | duration | 0 (nenhum) | Timeout por requisição |
| `dispatcher.http.max_idle_conns` | int | 0 (stdlib) | Máximo de conexões ociosas em todos os hosts |
| `dispatcher.http.max_idle_per_host` | int | 0 (stdlib) | Máximo de conexões ociosas por host |
| `dispatcher.http.idle_conn_timeout` | duration | 0 (stdlib) | Timeout de conexão ociosa |
| `dispatcher.http.max_clients` | int | 0 (ilimitado) | Máximo de clientes distintos em pool |

```yaml
dispatcher:
  http:
    timeout: 30s
    max_idle_per_host: 32
```

## Módulos

Cliente do registro de módulos usado por `wippy install`/`update`.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `registry_url` | string | https://hub.wippy.ai | Endpoint do registro |

```yaml
modules:
  registry_url: https://internal-registry.example.com
```

## Extensões

Extensões nativas de plugin Go carregadas no boot (somente Unix).

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `enabled` | bool | true | Carregar extensões |
| `paths` | string[] | | Caminhos dos arquivos de plugin (relativos ao diretório de configuração) |

```yaml
extensions:
  enabled: true
  paths:
    - ./extensions/myplugin.so
```

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `GOMEMLIMIT` | Limite de memória (sobrescreve flag `--memory-limit`) |

## Veja Também

- [Referência do CLI](guides/cli.md) - Opções de linha de comando
- [Guia de Cluster](guides/cluster.md) - Arquitetura e operações de clustering
- [Tipos de Entradas](guides/entry-kinds.md) - Todos os tipos de entradas
- [Guia de Observabilidade](guides/observability.md) - Logging, métricas, tracing
