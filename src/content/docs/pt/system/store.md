---
title: "Store (Chave-Valor)"
---

# Store (Chave-Valor)

Armazenamentos chave-valor com suporte a TTL: em memória, com backend SQL e replicados em cluster (Raft e CRDT).

## Tipos de Entradas

| Tipo | Descrição |
|------|-----------|
| `store.memory` | Armazenamento em memória com limpeza automática |
| `store.sql` | Armazenamento com backend SQL com persistência |
| `store.kv.raft` | KV replicado em cluster, fortemente consistente, sobre o Raft compartilhado |
| `store.kv.crdt` | KV replicado em cluster, eventualmente consistente, via gossip (CRDT) |

## Armazenamento em Memória

```yaml
- name: sessions
  kind: store.memory
  max_size: 10000
  cleanup_interval: "5m"
  lifecycle:
    auto_start: true
```

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `max_size` | int | 10000 | Máximo de entradas (0 = ilimitado) |
| `cleanup_interval` | duration | 5m | Intervalo de limpeza de entradas expiradas |

Quando `max_size` é atingido, novas entradas são rejeitadas. Dados são perdidos ao reiniciar.

## Armazenamento SQL

```yaml
- name: cache
  kind: store.sql
  database: app:postgres
  table_name: kv_store
  cleanup_interval: "10m"
  lifecycle:
    auto_start: true
```

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `database` | referência | obrigatório | Referência da entrada de banco de dados |
| `table_name` | string | obrigatório | Nome da tabela para armazenamento |
| `id_column_name` | string | key | Coluna para chaves |
| `payload_column_name` | string | value | Coluna para valores |
| `expire_column_name` | string | expires_at | Coluna para expiração |
| `cleanup_interval` | duration | 0 | Intervalo de limpeza de entradas expiradas |

Nomes de colunas são validados contra injeção SQL. Crie a tabela antes de usar:

```sql
CREATE TABLE kv_store (
    key VARCHAR(255) PRIMARY KEY,
    value BYTEA NOT NULL,
    expires_at BIGINT
);

CREATE INDEX idx_expires_at ON kv_store(expires_at) WHERE expires_at IS NOT NULL;
```

## Armazenamentos KV em Cluster {id=cluster-kv-stores}

`store.kv.raft` e `store.kv.crdt` replicam dados chave-valor entre os nós do cluster. Ambos exigem que o [clustering](guides/cluster.md) esteja habilitado e reutilizam a mesma API Lua do [Módulo Store](lua/storage/store.md). Cada entrada é uma visão com namespace de um único engine ao nível do nó; `namespace` isola as chaves desta entrada e deve corresponder a `^[a-z][a-z0-9._-]*$` (não pode começar com `_`).

### Raft (consistência forte)

```yaml
- name: deployments
  kind: store.kv.raft
  namespace: deploy
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `namespace` | string | Sim | Namespace de chaves no engine compartilhado |

Escritas são propostas através do Raft compartilhado (followers encaminham para o leader); leituras são linearizáveis. Escritas condicionais (`put` com `only_if_absent`/`if_version`) são suportadas. O estado do Raft é durável em disco por padrão, sob `cluster.raft.data_dir` (padrão `~/.wippy/store`); veja [Configuração](guides/configuration.md#cluster).

### CRDT (consistência eventual)

```yaml
- name: sessions
  kind: store.kv.crdt
  namespace: sess
  durable: false
```

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|-------|------|-------------|--------|-----------|
| `namespace` | string | Sim | - | Namespace de chaves |
| `durable` | bool | Não | false | Persiste snapshots em disco para que o namespace sobreviva a um reinício de todo o cluster |

Escritas mutam o estado local e se disseminam via gossip; escritas concorrentes conflitantes convergem por last-writer-wins. Leituras são locais. Escritas condicionais não são suportadas. Com `durable: false` o armazenamento é em memória e reconstrói a partir dos peers; com `durable: true` ele faz snapshot em `<data_dir>/_sys/kvcrdt`.

<note>
<code>data_dir</code> é ao nível do nó (<code>cluster.raft.data_dir</code>), não por entrada. O estado do Raft compartilhado e os snapshots duráveis do CRDT ficam sob <code>&lt;data_dir&gt;/_sys/</code>.
</note>

## Comportamento de TTL

Ambos os armazenamentos suportam time-to-live. Entradas expiradas persistem brevemente até a limpeza executar em `cleanup_interval`. Defina como `0` para desabilitar limpeza automática.

## API Lua

Veja [Módulo Store](lua/storage/store.md) para operações: `get`, `set`, `has`, `delete`, além de `put`, `entry`, `list` e `info` para acesso versionado e condicional.

## Veja Também

- [Módulo Store](lua/storage/store.md) - Referência da API Lua
- [Banco de Dados](system/database.md) - Backend SQL para `store.sql`
