# Store (Chave-Valor)

Armazenamentos chave-valor em memória e com backend SQL com suporte a TTL.

## Tipos de Entradas

| Tipo | Descrição |
|------|-----------|
| `store.memory` | Armazenamento em memória com limpeza automática |
| `store.sql` | Armazenamento com backend SQL com persistência |

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

## Comportamento de TTL

Ambos os armazenamentos suportam time-to-live. Entradas expiradas persistem brevemente até a limpeza executar em `cleanup_interval`. Defina como `0` para desabilitar limpeza automática.

## API Lua

Veja [Módulo Store](lua-store.md) para operações (get, set, delete, exists, clear).
