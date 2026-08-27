---
title: "Change Data Capture"
description: "Transmita alterações de linhas da replicação lógica do Postgres com db.cdc.postgres."
---

# Change Data Capture

Uma fonte `db.cdc.postgres` transmite alterações de linhas da replicação lógica do Postgres por meio do plugin `pgoutput`. Ela cria um slot de replicação, pode gerar um snapshot das linhas existentes e depois emite inserções, atualizações e exclusões. Esta página é uma referência de configuração; o exemplo pressupõe um banco de dados existente, uma publication ou um conjunto de tabelas, credenciais de replicação e valores de ambiente. As fontes são endereçadas pelo ID do entry e consumidas em Lua pelo [módulo `cdc`](../lua/storage/cdc.md).

## Configuração

```yaml
- name: pg_cdc
  kind: db.cdc.postgres
  host: ${env:DB_HOST}
  port: 5432
  database: app
  username: ${env:DB_USER}
  password: ${env:app.secrets:db_password}
  slot_name: wippy_slot
  publication: wippy_pub
  tables:
    - public.users
    - public.orders
  snapshot: true
  streaming: true
  standby_interval: "10s"
  status_interval: "10s"
  lifecycle:
    auto_start: true
```

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `host` | string | obrigatório | Host do Postgres |
| `port` | int | obrigatório | Porta do Postgres (deve ser maior que 0) |
| `database` | string | obrigatório | Nome do banco de dados |
| `username` | string | obrigatório | Usuário de replicação (deve ter o privilégio `REPLICATION`) |
| `password` | string | obrigatório | Senha (inline ou `${env:NAME}`) |
| `slot_name` | string | obrigatório | Nome do slot de replicação lógica |
| `publication` | string | - | Publication do Postgres; obrigatória quando `tables` está vazio |
| `tables` | []string | - | Tabelas a capturar (`schema.table`); omita para usar as tabelas da publication |
| `snapshot` | bool | false | Emitir as linhas existentes como snapshot inicial antes do streaming |
| `streaming` | bool | false | Transmitir alterações contínuas após o snapshot |
| `temporary` | bool | false | Usar um slot de replicação temporário, removido ao desconectar |
| `failover` | bool | false | Ativar o modo de slot de failover; incompatível com `temporary` |
| `standby_interval` | duration | `10s` | Intervalo das mensagens de status do standby |
| `status_interval` | duration | `30s` | Intervalo de amostragem de WAL retido e atraso de replicação |
| `snapshot_fetch_size` | int | `1000` | Linhas obtidas por lote do snapshot; `0` usa o padrão |
| `options` | map | - | Opções adicionais de conexão |
| `lifecycle` | object | - | Configuração do ciclo de vida |

As credenciais resolvem placeholders `${env:NAME}` pelo [registry de ambiente](./env.md) durante a decodificação.

## Como funciona

1. A fonte se conecta ao Postgres como usuário de replicação e cria ou retoma o slot indicado por `slot_name`.
2. Se `snapshot` estiver ativo, as linhas existentes das tabelas configuradas são emitidas primeiro como eventos com `op = "r"` (read).
3. Se `streaming` estiver ativo, alterações contínuas (`insert`, `update`, `delete`, `truncate`) são transmitidas do WAL pelo plugin `pgoutput`.
4. Um loop de status do standby confirma periodicamente o LSN para que o Postgres retenha segmentos de WAL (`standby_interval`).
5. A fonte é registrada sob seu ID de entry; código Lua assina com [`cdc.stream`](../lua/storage/cdc.md).

## Informações da fonte

Cada fonte é descrita por um registro de informações:

| Campo | Descrição |
|-------|-----------|
| `name` | Nome da fonte, igual ao ID do entry |
| `slot` | Nome do slot de replicação |
| `publication` | Publication do Postgres, quando houver |
| `tables` | Tabelas capturadas, quando configuradas |
| `streaming` | Indica se o streaming está ativo |
| `failover` | Indica se o modo de failover está ativo |
| `temporary` | Indica se o slot é temporário |
| `snapshot` | Indica se o snapshot está ativo |

## Consulte também

- [Módulo CDC](../lua/storage/cdc.md) - API de streaming em Lua
- [Banco de dados](./database.md) - Serviços de banco de dados SQL
- [Ambiente](./env.md) - Resolução de credenciais por `${env:NAME}`
