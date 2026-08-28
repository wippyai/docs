---
title: "Referência de Configuração"
description: "Campos de configuração do runtime, profiles, regras de composição, referências de ambiente e sobrescritas pela linha de comando."
---

# Referência de Configuração

O Wippy lê a configuração do runtime em arquivos `.wippy.yaml`.

Use a opção repetível `wippy run --set section.path=value` para sobrescrever na inicialização os campos de configuração abaixo. Para sobrescrever *entradas* individuais do registro em vez de seções de configuração, use a seção `override:` ou `-o`; consulte [Sobrescrevendo Entradas](./entry-kinds.md#sobrescrevendo-entradas).

## Composição de Configuração {#config-composition}

`--config` é repetível; os arquivos compõem da esquerda para a direita usando o mesmo schema:

```bash
wippy run --config .wippy.yaml --config .wippy.local.yaml
```

- Arquivos posteriores sobrescrevem valores correspondentes e mantêm todo o resto.
- Todo arquivo nomeado explicitamente deve existir. Sem `--config`, o `.wippy.yaml` padrão é opcional.
- O primeiro arquivo ancora o diretório usado para resolver caminhos relativos.
- Nomes de arquivo não carregam significado reservado; nada além do padrão é descoberto automaticamente.

A configuração é aplicada nesta ordem: arquivos compostos, overlays selecionados com `--profile` e, por fim, sobrescritas `--set`. Para aplicações executadas a partir de packs, os padrões de runtime empacotados têm precedência menor que os três; consulte [Padrões de Runtime na Publicação](./publishing.md#publishing-runtime-defaults).

## Perfis {#profiles}

Um arquivo de configuração pode declarar overlays nomeados sob `profiles:`. Cada corpo de profile espelha as seções padrão de configuração. Selecioná-lo com `--profile <name>` aplica esses valores sobre a configuração-base mesclada:

```yaml
version: "1.0"

vars:
  port: 8085

override:
  app:db:kind: db.sql.sqlite

disable:
  namespaces: ["legacy.**"]

profiles:
  pg:
    vars:
      port: 18085
    override:
      app:db:kind: db.sql.postgres
    disable:
      namespaces.add: ["experimental.**"]
```

```bash
wippy run --profile pg
```

- `--profile` é repetível; profiles compõem da esquerda para a direita, depois da composição de arquivos e antes de `--set`. Um nome desconhecido é um erro.
- Valores mesclam por folha (o último escritor vence). A seção `profiles:` em si é removida da configuração resolvida.
- A seção `disable` suporta operações de lista dentro de profiles — `namespaces.add`, `namespaces.remove`, `entries.add`, `entries.remove` — para que um profile possa ajustar a lista base em vez de substituí-la.
- Referências `${name}` interpolam a partir da seção `vars:` mesclada. Referências a variáveis de ambiente do SO não são permitidas dentro de vars de profile; use `${env:NAME}` na configuração base, resolvido no carregamento do arquivo.

`wippy run`, `test` e `pack` aceitam `--profile`; `install`, `update`, `lint` e `registry` também o aceitam para profiles de workspace (junto com `--set`). Aplicações podem incluir profiles nos packs — consulte [Publicando Profiles](./publishing.md#publishing-profiles).

## Logger

Controla o encoder do logger zap. As flags do CLI (`-v`, `-c`, `-s`) sobrescrevem o nível e a saída; a codificação é a única opção configurada por YAML.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `encoding` | string | console | Encoder: `console` (legível) ou `json` (estruturado) |

```yaml
logger:
  encoding: json
```

## Gerenciador de Log

Controla o roteamento de logs do runtime. A saída do console é configurada por [flags do CLI](./cli.md) (`-v`, `-c`, `-s`).

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

Veja: [Módulo Logger](../lua/system/logger.md)

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

Quando habilitado com o endereço padrão, o profiler fica disponível em `http://localhost:6060/debug/pprof/`.

## Segurança

Comportamento global de segurança. Políticas individuais são definidas como [entradas security.policy](./entry-kinds.md).

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `strict_mode` | bool | true | Nega o acesso quando o contexto de segurança está incompleto |

```yaml
security:
  strict_mode: true
```

Veja: [Sistema de Segurança](../system/security.md), [Módulo Security](../lua/security/security.md)

## Registro

Armazenamento de entradas e histórico de versões. O registro armazena todas as entradas de configuração.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `enable_history` | bool | true | Rastreia versões de entradas |
| `history_type` | string | memory | Armazenamento: `memory`, `sqlite`, `postgres`, `nil` |
| `history_path` | string | .wippy/registry.db | Caminho do arquivo SQLite (usado quando `history_type: sqlite`) |
| `history_dsn` | string | | DSN do Postgres (usado quando `history_type: postgres`) |
| `history_schema` | string | | Nome do schema do Postgres (usado quando `history_type: postgres`) |

```yaml
registry:
  history_type: sqlite
  history_path: /var/lib/wippy/registry.db
```

```yaml
registry:
  history_type: postgres
  history_dsn: ${env:WIPPY_REGISTRY_HISTORY_DSN}
  history_schema: wippy_registry
```

Veja: [Conceito de Registro](../concepts/registry.md), [Módulo Registry](../lua/core/registry.md)

## Relay

Roteamento de mensagens entre processos através de nós.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `node_name` | string | ID derivado por instância | Identificador deste nó de relay (padrão: UUIDv5 do machine-id/hostname + diretório de trabalho; pode ser sobrescrito por `WIPPY_NODE_ID` / `WIPPY_RELAY_NODE_NAME`) |

```yaml
relay:
  node_name: worker-1
```

Veja: [Modelo de Processos](../concepts/process-model.md)

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

Veja: [Guia de Supervisão](./supervision.md)

<note>
Workers e filas de cada `process.host` são configurados na própria entrada (`workers`, `queue_size`, `local_queue_size`), não nesta seção global. Consulte o kind de entrada [Process Host](../system/process-host.md).
</note>

## Runtime Lua

Cache de VM Lua e avaliação de expressões.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `proto_cache_size` | int | 60000 | Cache de protótipos compilados |
| `main_cache_size` | int | 10000 | Cache de chunks principais |
| `cache.enabled` | bool | false | Persistir cache de bytecode/typecheck compilado em disco |
| `cache.dir` | string | `.wippy/cache/lua` | Caminho do diretório de cache (relativo ao diretório da configuração/de trabalho) |
| `cache.mode` | string | `readwrite` | Modo de cache: `readwrite` (padrão), `readonly`, `off` |
| `cache.compile.enabled` | bool | true | Persistir bytecode compilado (quando `cache.enabled`) |
| `cache.typecheck.enabled` | bool | true | Persistir resultados do typecheck (quando `cache.enabled`) |
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

Veja: [Visão Geral Lua](../lua/overview.md)

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
| `http.inject_headers` | bool | true | Injeta o contexto de trace na resposta HTTP |
| `process.enabled` | bool | true | Rastreia ciclo de vida de processos |
| `process.trace_lifecycle` | bool | true | Emite spans para spawn/terminate |
| `interceptor.enabled` | bool | true | Rastreia chamadas de funções |
| `interceptor.order` | int | 100 | Campo de compatibilidade decodificado; o runtime v0.3.32a registra o interceptor na ordem 100 independentemente deste valor |
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

Veja: [Guia de Observabilidade](./observability.md)

## Encerramento :id=shutdown

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

Veja: [Módulo Metrics](../lua/system/metrics.md), [Guia de Observabilidade](./observability.md)

## Prometheus

Endpoint de métricas Prometheus.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `enabled` | bool | false | Inicia servidor de métricas |
| `address` | string | | Endereço de escuta; deve ser definido explicitamente quando `enabled: true`, caso contrário o servidor de métricas não inicia |

```yaml
prometheus:
  enabled: true
  address: "0.0.0.0:9090"
```

Expõe endpoint `/metrics` para scraping do Prometheus.

Veja: [Guia de Observabilidade](./observability.md)

## Cluster

Clustering multinó: associação por gossip e um núcleo de consenso Raft limitado. Consulte o [Guia de Cluster](./cluster.md) para conhecer a arquitetura e o modelo operacional; esta seção é a referência das chaves de configuração.

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
| `membership.gossip_interval` | duration | 500ms | Período de disseminação do gossip |
| `membership.push_pull_interval` | duration | 5s | Período de sincronização completa de estado |
| `membership.dead_node_reclaim_time` | duration | 30s | Quando o nome/endereço de um nó morto pode ser reaproveitado |
| `membership.probe_interval` | duration | 1s | Ciclo de probe de detecção de falhas |
| `membership.probe_timeout` | duration | 200ms | Espera por ack por probe |
| `membership.tcp_timeout` | duration | 1s | Timeout do probe de fallback TCP |
| `membership.suspicion_mult` | int | 3 | Multiplicador do timeout de suspeita |

As quatro chaves de probe herdam os defaults de rede local do memberlist quando não definidas; aumente-as para links de alta latência (p. ex. `probe_interval: 2s`, `probe_timeout: 500ms`, `suspicion_mult: 5`).

### Internós (transporte)

Malha TCP que transporta o tráfego de relay e Raft entre nós. O Raft usa esta malha via request/reply internó; não há porta Raft separada.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `internode.bind_addr` | string | 0.0.0.0 | Endereço de bind da malha |
| `internode.bind_port` | int | 0 | Porta da malha (0 = auto: 7950-7959, depois efêmera) |
| `internode.auto_port` | bool | true | Descobrir a porta real no boot, fixá-la e anunciá-la via gossip |
| `internode.advertise_addr` | string | | Endpoint de relay adicional (IP ou nome DNS) publicado para peers atualizados — para alcançabilidade via NAT ou balanceador de carga |
| `internode.advertise_port` | int | 0 | Porta para `advertise_addr` (0 = porta de bind; requer `advertise_addr`) |
| `internode.identity_key` | string | | Seed ou chave privada Ed25519 codificada em base64; obrigatória, a menos que `identity_key_file` esteja definida |
| `internode.identity_key_file` | string | | Arquivo que contém uma seed ou chave privada Ed25519 codificada em base64; obrigatório, a menos que `identity_key` esteja definida |
| `internode.trusted_peer_keys` | map | | Mapa entre nomes de nós e chaves públicas em base64; deve incluir o nó local e cada peer confiável |

`advertise_addr`/`advertise_port` publicam um endpoint aditivo nos metadados do nó enquanto o endpoint de bind continua anunciado sem mudança, de modo que clusters com versões mistas continuam se conectando durante um rolling upgrade.

Cada nó do cluster precisa de sua própria identidade privada internó e de um mapa de chaves públicas confiáveis. Configure exatamente uma fonte de chave privada. Tanto os valores inline quanto os arquivos de chave devem conter uma seed de 32 bytes ou uma chave de 64 bytes codificada em base64; os valores confiáveis são chaves públicas codificadas em base64.

### Raft (consenso)

O núcleo Raft limitado armazena estado durável em `raft.data_dir` por padrão (`~/.wippy/store`). Um nó reiniciado volta a participar do quórum a partir de seus peers. As entradas [`store.kv.raft`](../system/store.md#cluster-kv-stores) são replicadas por esse núcleo, e o gossip coordena o bootstrap usando um modelo `bootstrap_expect`.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `raft.data_dir` | string | `~/.wippy/store` | Diretório para o estado durável do Raft em disco e snapshots duráveis do CRDT (sob `<data_dir>/_sys/`). Sem disco apenas quando nenhum caminho é resolvido (sem diretório home e nenhum definido) |
| `raft.enabled` | bool | true | Executa um nó Raft; `false` torna este um cliente apenas gossip |
| `raft.role` | string | server | `server` executa um nó Raft; `client` é apenas gossip |
| `raft.eligible` | bool | true | Se este nó pode ser selecionado como voter ou standby; false o mantém fora do Raft como cliente |
| `raft.priority` | int | 100 | Prioridade de seleção de voter (menor é preferido) |
| `raft.bootstrap_expect` | int | 1 | Tamanho inicial do quórum: `0`=entrar em um existente, `1`=nó único, `N`=aguardar N nós elegíveis incluindo o nó local e então formar o quórum |
| `raft.max_voters` | int | 5 | Limite de voters (deve ser ímpar); até `max_standbys` nós elegíveis adicionais tornam-se standbys, e os demais permanecem clientes |
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
  internode:
    identity_key: "${env:DEV_PRIVATE_KEY}"
    trusted_peer_keys:
      dev: "${env:DEV_PUBLIC_KEY}"
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
  internode:
    identity_key_file: /etc/wippy/node-1.identity
    trusted_peer_keys:
      node-1: "${env:NODE_1_PUBLIC_KEY}"
      node-2: "${env:NODE_2_PUBLIC_KEY}"
      node-3: "${env:NODE_3_PUBLIC_KEY}"
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
  internode:
    identity_key_file: /etc/wippy/edge-7.identity
    trusted_peer_keys:
      node-1: "${env:NODE_1_PUBLIC_KEY}"
      node-2: "${env:NODE_2_PUBLIC_KEY}"
      edge-7: "${env:EDGE_7_PUBLIC_KEY}"
  raft:
    role: client
```

## LSP

Servidor do Language Server Protocol para integrações com editores.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `enabled` | bool | false | Habilitar o serviço LSP e o servidor TCP; o transporte HTTP também exige esta opção |
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

Veja: [Guia do LSP](./lsp.md)

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

Veja: [Overlays de Rede](../system/network.md)

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

## Consulte Também

- [Referência do CLI](./cli.md) — Opções da linha de comando
- [Guia de Cluster](./cluster.md) — Arquitetura e operações de clustering
- [Kinds de Entrada](./entry-kinds.md) — Kinds de entrada e seus campos
- [Guia de Observabilidade](./observability.md) — Logs, métricas e tracing
