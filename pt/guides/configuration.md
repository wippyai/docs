---
title: "Referência de Configuração"
description: "O Wippy é configurado via arquivos .wippy.yaml. Todas as opções têm padrões sensíveis."
---

# Referência de Configuração

O Wippy é configurado via arquivos `.wippy.yaml`. Todas as opções têm padrões sensíveis.

Qualquer valor abaixo pode ser sobrescrito na inicialização com `wippy run --set section.path=value` (repetível, tem precedência sobre o arquivo). Para sobrescrever *entradas* individuais do registro em vez destas seções de configuração, use a seção `override:` ou `-o` — veja [Sobrescrevendo Entradas](guides/entry-kinds.md#overriding-entries).

## Composição de Configuração {#config-composition}

`--config` é repetível; os arquivos compõem da esquerda para a direita usando o mesmo schema:

```bash
wippy run --config .wippy.yaml --config .wippy.local.yaml
```

- Arquivos posteriores sobrescrevem valores correspondentes e mantêm todo o resto.
- Todo arquivo nomeado explicitamente deve existir. Sem `--config`, o `.wippy.yaml` padrão é opcional.
- O primeiro arquivo ancora o diretório usado para resolver caminhos relativos.
- Nomes de arquivo não carregam significado reservado; nada além do padrão é descoberto automaticamente.

A configuração aplica-se nesta ordem: composição de arquivos, depois seleções de `--profile`, depois overrides de `--set`. Para aplicações executadas a partir de packs, os defaults de runtime empacotados ficam abaixo de todos esses (veja [Publicando Defaults de Runtime](guides/publishing.md#publishing-runtime-defaults)).

## Perfis {#profiles}

Um arquivo de configuração pode declarar overlays nomeados sob `profiles:`. Cada corpo de profile espelha as seções normais de configuração; selecioná-lo com `--profile <name>` sobrepõe esses valores à configuração base mesclada:

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

`wippy run`, `test` e `pack` aceitam `--profile`; `run list`, `install`, `update`, `lint` e `registry` também o aceitam para profiles de workspace (junto com `--set`). Aplicações podem embarcar profiles dentro de packs — veja [Publicando Profiles](guides/publishing.md#publishing-profiles).

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
| `min_level` | int | 0 (`-1` com `-v`) | Nível mínimo: -1=debug, 0=info, 1=warn, 2=error. A CLI escreve esta chave a partir de suas flags depois que o arquivo é lido, então um valor no arquivo é ignorado; altere-o com `--set logmanager.min_level=<n>` |

```yaml
logmanager:
  propagate_downstream: true
  stream_to_events: false
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
| `strict_mode` | bool | true | Nega acesso quando o contexto de segurança está incompleto |

```yaml
security:
  strict_mode: false
```

Veja: [Sistema de Segurança](system/security.md), [Módulo Security](lua/security/security.md)

## Registro

Armazenamento de entradas e histórico de versões. O registro armazena todas as entradas de configuração.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `enable_history` | bool | true | Rastreia versões de entradas |
| `history_type` | string | memory | Armazenamento: `memory`, `sqlite`, `postgres`, `nil` |
| `history_path` | string | .wippy/registry.db | Caminho do arquivo SQLite (usado quando `history_type: sqlite`) |
| `history_dsn` | string | | DSN do Postgres (usado quando `history_type: postgres`) |
| `history_schema` | string | | Nome do schema do Postgres (usado quando `history_type: postgres`) |
| `event_wait_timeout` | duration | 30s | Espera por operação pelo reconhecimento do listener durante um apply do registro |
| `dispatch_internal_kinds` | string[] | `[registry.entry, ns.dependency, ns.requirement, ns.definition]` | Tipos de entrada tratados internamente em vez de despachados para listeners de componentes |
| `dependency_resolve_timeout` | duration | 0 (nenhum) | Limite para a resolução de dependências |
| `dependency_download_timeout` | duration | 0 (nenhum) | Limite para cada download de módulo e requisição de URL de download |
| `dependency_lock_path` | string | `wippy.lock` descoberto | Arquivo de lock que o handler de dependências lê e escreve |
| `dependency_vendor_dir` | string | `<dir do lock>/<directories.modules>/vendor` | Diretório contendo os packs de módulos baixados |

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

Veja: [Conceito de Registro](concepts/registry.md), [Módulo Registry](lua/core/registry.md)

## Artifact

Raiz de saída para [artefatos de tempo de build](guides/artifacts.md) materializados.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `materialization_root` | string | diretório pai do vendor de dependências | Raiz de propriedade da aplicação sob a qual cada formato de artefato escreve sua própria subárvore |

```yaml
artifact:
  materialization_root: build/wippy
```

Veja: [Artefatos de tempo de build](guides/artifacts.md#where-output-lands)

## Workspace

Substituições locais de módulos, indexadas por `org/module`. Os valores são diretórios; caminhos relativos resolvem contra o diretório do primeiro arquivo `--config`, e `null` desabilita uma substituição herdada de uma camada de configuração ou perfil anterior.

```yaml
workspace:
  replacements:
    acme/http: ../local-http
    acme/sql: null
```

Substituições nunca são escritas em `wippy.lock`. Veja [Desenvolvimento Local com Replacements](guides/dependency-management.md#local-development-with-replacements).

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
| `cache.enabled` | bool | `type_system.enabled` | Persistir cache de bytecode/typecheck compilado em disco; segue `type_system.enabled` a menos que seja definido explicitamente |
| `cache.dir` | string | `.wippy/cache/lua` | Caminho do diretório de cache (relativo ao diretório de configuração/trabalho) |
| `cache.mode` | string | `readwrite` | Modo de cache: `readwrite` (padrão), `readonly`, `off`; valores desconhecidos usam `readwrite` |
| `cache.compile.enabled` | bool | true | Persistir bytecode compilado (quando `cache.enabled`) |
| `cache.typecheck.enabled` | bool | true | Persistir resultados de typecheck (quando `cache.enabled`) |
| `cache.max_bytes` | int | 1073741824 | Limite de tamanho do cache em disco, em bytes |
| `cache.max_entries` | int | 20000 | Máximo de entradas em cache |
| `cache.prune_interval` | int | 256 | Escritas entre passagens de poda do cache |
| `type_system.enabled` | bool | false | Habilitar verificação estática de tipos |
| `type_system.strict` | bool | false | Tratar avisos de tipo como erros |
| `invalidation_wait_timeout` | duration | `registry.event_wait_timeout` (30s) | Espera pelo reconhecimento da invalidação de código após a alteração de uma entrada |
| `eval.max_steps` | int | 10000 | Orçamento padrão de passos do scheduler para uma execução de `eval`; valores negativos são rejeitados |
| `eval.cache_size` | int | 256 | Entradas de cache de programas compilados para código avaliado |
| `eval.cache_ttl` | duration | 0 (sem expiração) | Tempo de vida de um programa compilado em cache |

```yaml
lua:
  cache:
    enabled: true
    dir: .cache/lua
  type_system:
    enabled: true
```

Veja: [Visão Geral Lua](lua/overview.md)

## Scheduler

Particionamento de núcleos para o runtime WASM. Quando habilitado, `reserved_cores` CPUs são reservadas para execução WASM e as demais atendem ao scheduler de atores; uma divisão inválida (por exemplo, mais núcleos reservados do que disponíveis) é registrada em log e ignorada.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `wasm_isolation.enabled` | bool | false | Particiona núcleos entre trabalho WASM e de atores |
| `wasm_isolation.reserved_cores` | int | 1 | Núcleos reservados para execução WASM |

```yaml
scheduler:
  wasm_isolation:
    enabled: true
    reserved_cores: 2
```

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

Variáveis de ambiente OTEL padrão (`OTEL_SDK_DISABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_PROTOCOL`, `OTEL_EXPORTER_OTLP_INSECURE`, `OTEL_SERVICE_NAME`, `OTEL_SERVICE_VERSION`, `OTEL_TRACES_SAMPLER`, `OTEL_TRACES_SAMPLER_ARG`, `OTEL_PROPAGATORS`) sobrescrevem os campos correspondentes.

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
| `interceptor.enabled` | bool | true | Rastreia chamadas de funções automaticamente |

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
| `max_cardinality` | int | 1024 | Conjuntos de labels distintos retidos por métrica (LRU); `0` ou menos usa o padrão |

```yaml
prometheus:
  enabled: true
  address: "0.0.0.0:9090"
```

Expõe endpoint `/metrics` para scraping do Prometheus, além de `/livez`.

Veja: [Guia de Observabilidade](guides/observability.md)

## Cluster

Clustering multi-nó: associação gossip mais um núcleo Raft de consenso limitado. Consulte o [Guia de Cluster](guides/cluster.md) para a arquitetura e modelo operacional; esta seção é a referência de chaves de configuração.

### Nível superior

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `enabled` | bool | false | Habilita clustering |
| `name` | string | hostname | Nome do nó; deve ser único no cluster |
| `failure_domain` | string | | Label de zona/rack; anunciado via gossip para que voters se distribuam entre domínios |
| `kv_crdt_tombstone_retention` | duration | 0 | Idade a partir da qual tombstones de exclusão do `store.kv.crdt` são recuperados; `0` desabilita a GC por idade |
| `kv_crdt_tombstone_gc_alive_peers` | bool | false | Usa a associação viva atual como conjunto de reconhecimento de tombstones |

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

Um segredo de gossip é obrigatório. Defina `membership.secret_key` ou `membership.secret_file` (o arquivo prevalece se ambos forem fornecidos); sem nenhum dos dois, o componente de cluster falha ao iniciar. O valor é codificado em base64.

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
| `internode.identity_key` | string | | Chave privada ed25519 codificada em base64 que identifica este nó (inline) |
| `internode.identity_key_file` | string | | Caminho para um arquivo contendo essa chave |
| `internode.trusted_peer_keys` | map | | Chave pública ed25519 codificada em base64 por nome de nó, incluindo este nó |

`advertise_addr`/`advertise_port` publicam um endpoint aditivo nos metadados do nó enquanto o endpoint de bind continua anunciado sem mudança, de modo que clusters com versões mistas continuam se conectando durante um rolling upgrade.

A identidade internós é obrigatória sempre que o clustering está habilitado. `identity_key` e `identity_key_file` são mutuamente exclusivos e um deles deve estar presente; o valor decodifica (base64 padrão ou raw) para uma seed ed25519 de 32 bytes ou uma chave privada ed25519 de 64 bytes. `trusted_peer_keys` mapeia cada nome de nó para a chave pública ed25519 de 32 bytes daquele nó, e deve conter uma entrada para o `cluster.name` local cujo valor corresponda à identidade local — caso contrário a inicialização falha. Veja o [Guia de Cluster](guides/cluster.md#internode-identity).

### Raft (consenso)

Raft limitado. O estado do Raft é durável em disco por padrão, armazenado sob `raft.data_dir` (padrão `~/.wippy/store`); um nó reiniciado ainda rejoina o quórum a partir dos peers. As entradas [`store.kv.raft`](system/store.md#cluster-kv-stores) replicam através dele. O bootstrap é conduzido por gossip (estilo `bootstrap_expect` do Consul/Nomad).

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `raft.data_dir` | string | `~/.wippy/store` | Diretório para o estado durável do Raft em disco e snapshots duráveis do CRDT (sob `<data_dir>/_sys/`). Sem disco apenas quando nenhum caminho é resolvido (sem diretório home e nenhum definido) |
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
| `raft.registry_backend` | string | kv | Implementação do registro de nomes do cluster: `kv` (keyspace kv compartilhado) ou `fsm` (FSM Raft dedicada) |
| `raft.global_dissem_tombstone_retention` | duration | 0 | Por quanto tempo o cache de disseminação de nomes globais mantém tombstones de exclusão |

Nó único (desenvolvimento) — clustering ativo, bootstrap imediato:

```yaml
cluster:
  enabled: true
  name: dev
  membership:
    secret_key: "d2lwcHktZG9jcy1nb3NzaXAtc2VjcmV0LTMyYnl0ZXM="
  internode:
    identity_key: "d2lwcHktZG9jcy1kZXYtbm9kZS1leGFtcGxlc2VlZCE="
    trusted_peer_keys:
      dev: "rNqImcjOzef28dzvma80mSrCW1px5LBAc5TbaYqAgm0="
  raft:
    bootstrap_expect: 1
```

Cluster de três voters — cada nó lista os outros como seeds e aguarda os três antes de formar quórum. Todo nó carrega o mesmo mapa `trusted_peer_keys` e sua própria chave privada:

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
    identity_key_file: /etc/wippy/node-1.key
    trusted_peer_keys:
      node-1: "okmamN3PKkMpPwPBurknHy2Wi3dwp/rz+uTM2fF9aD0="
      node-2: "PWX+oOYrFdtjUxbgmTkXCFI0KEvG++ZM52HOWfDkqP8="
      node-3: "QfP0fgllbj4s95VAztTORhy3bv9mst1l0lwuUNvO/hE="
  raft:
    bootstrap_expect: 3
    max_voters: 5
```

Cliente apenas gossip — junta-se ao cluster para nomeação/mensagens mas nunca executa Raft. Ele ainda precisa da própria identidade e deve aparecer no mapa de confiança de todos os nós:

```yaml
cluster:
  enabled: true
  name: edge-7
  membership:
    join_addrs: "node-1:7946,node-2:7946"
    secret_file: /etc/wippy/cluster.key
  internode:
    identity_key_file: /etc/wippy/edge-7.key
    trusted_peer_keys:
      node-1: "okmamN3PKkMpPwPBurknHy2Wi3dwp/rz+uTM2fF9aD0="
      node-2: "PWX+oOYrFdtjUxbgmTkXCFI0KEvG++ZM52HOWfDkqP8="
      node-3: "QfP0fgllbj4s95VAztTORhy3bv9mst1l0lwuUNvO/hE="
      edge-7: "7lzP4jBAkC3P+0jq4vtMsC45571BlVXk3mSlOD/Z0SA="
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
