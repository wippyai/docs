# Store (Chave-Valor)

Armazenamentos chave-valor em memoria e com backend SQL com suporte a TTL.

## Tipos de Entradas

| Tipo | Descricao |
|------|-----------|
| `store.memory` | Armazenamento em memoria com limpeza automatica |
| `store.sql` | Armazenamento com backend SQL com persistencia |

## Armazenamento em Memoria

```yaml
- name: sessions
  kind: store.memory
  max_size: 10000
  cleanup_interval: "5m"
  lifecycle:
    auto_start: true
```

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `max_size` | int | 10000 | Maximo de entradas (0 = ilimitado) |
| `cleanup_interval` | duration | 5m | Intervalo de limpeza de entradas expiradas |

Quando `max_size` e atingido, novas entradas sao rejeitadas. Dados sao perdidos ao reiniciar.

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

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `database` | referencia | obrigatorio | Referencia da entrada de banco de dados |
| `table_name` | string | obrigatorio | Nome da tabela para armazenamento |
| `id_column_name` | string | key | Coluna para chaves |
| `payload_column_name` | string | value | Coluna para valores |
| `expire_column_name` | string | expires_at | Coluna para expiracao |
| `cleanup_interval` | duration | 0 | Intervalo de limpeza de entradas expiradas |

Nomes de colunas sao validados contra injecao SQL. Crie a tabela antes de usar:

```sql
CREATE TABLE kv_store (
    key VARCHAR(255) PRIMARY KEY,
    value BYTEA NOT NULL,
    expires_at BIGINT
);

CREATE INDEX idx_expires_at ON kv_store(expires_at) WHERE expires_at IS NOT NULL;
```

## Comportamento de TTL

Ambos os armazenamentos suportam time-to-live. Entradas expiradas persistem brevemente ate a limpeza executar em `cleanup_interval`. Defina como `0` para desabilitar limpeza automatica.

## API Lua

Veja [Modulo Store](lua-store.md) para operacoes (get, set, delete, exists, clear).
