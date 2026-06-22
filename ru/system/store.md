# Хранилище ключ-значение

Хранилища ключ-значение с поддержкой TTL: в памяти, на базе SQL и реплицируемые в кластере (Raft и CRDT).

## Типы записей

| Тип | Описание |
|-----|----------|
| `store.memory` | Хранилище в памяти с автоматической очисткой |
| `store.sql` | Хранилище на базе SQL с персистентностью |
| `store.kv.raft` | Реплицируемое в кластере, строго согласованное KV на общем Raft |
| `store.kv.crdt` | Реплицируемое в кластере, согласованное в конечном счёте KV через gossip (CRDT) |

## Хранилище в памяти

```yaml
- name: sessions
  kind: store.memory
  max_size: 10000
  cleanup_interval: "5m"
  lifecycle:
    auto_start: true
```

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `max_size` | int | 10000 | Максимум записей (0 = без ограничений) |
| `cleanup_interval` | duration | 5m | Интервал очистки просроченных записей |

При достижении `max_size` новые записи отклоняются. Данные теряются при перезапуске.

## SQL-хранилище

```yaml
- name: cache
  kind: store.sql
  database: app:postgres
  table_name: kv_store
  cleanup_interval: "10m"
  lifecycle:
    auto_start: true
```

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `database` | reference | обязательно | Ссылка на запись базы данных |
| `table_name` | string | обязательно | Имя таблицы |
| `id_column_name` | string | key | Колонка для ключей |
| `payload_column_name` | string | value | Колонка для значений |
| `expire_column_name` | string | expires_at | Колонка для срока действия |
| `cleanup_interval` | duration | 0 | Интервал очистки просроченных записей |

Имена колонок проверяются на SQL-инъекции. Создайте таблицу перед использованием:

```sql
CREATE TABLE kv_store (
    key VARCHAR(255) PRIMARY KEY,
    value BYTEA NOT NULL,
    expires_at BIGINT
);

CREATE INDEX idx_expires_at ON kv_store(expires_at) WHERE expires_at IS NOT NULL;
```

## Кластерные KV-хранилища {id=cluster-kv-stores}

`store.kv.raft` и `store.kv.crdt` реплицируют данные ключ-значение по нодам кластера. Оба требуют включённой [кластеризации](guides/cluster.md) и используют то же Lua API [Модуля Store](lua/storage/store.md). Каждая запись — это представление с пространством имён в одном общенодовом движке; `namespace` изолирует ключи этой записи и должен соответствовать `^[a-z][a-z0-9._-]*$` (не может начинаться с `_`).

### Raft (строгая согласованность)

```yaml
- name: deployments
  kind: store.kv.raft
  namespace: deploy
```

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `namespace` | string | Да | Пространство имён ключей в общем движке |

Записи предлагаются через общий Raft (фолловеры пересылают лидеру); чтения линеаризуемы. Поддерживаются условные записи (`put` с `only_if_absent`/`if_version`). Состояние Raft по умолчанию долговечно на ФС под `cluster.raft.data_dir` (по умолчанию `~/.wippy/store`); см. [Конфигурация](guides/configuration.md#cluster).

### CRDT (согласованность в конечном счёте)

```yaml
- name: sessions
  kind: store.kv.crdt
  namespace: sess
  durable: false
```

| Поле | Тип | Обязательно | По умолчанию | Описание |
|------|-----|-------------|--------------|----------|
| `namespace` | string | Да | - | Пространство имён ключей |
| `durable` | bool | Нет | false | Сохранять снимки на ФС, чтобы пространство имён пережило перезапуск всего кластера |

Записи изменяют локальное состояние и распространяются через gossip; конфликтующие конкурентные записи сходятся по принципу last-writer-wins. Чтения локальны. Условные записи не поддерживаются. При `durable: false` хранилище работает в памяти и восстанавливается от пиров; при `durable: true` оно делает снимки в `<data_dir>/_sys/kvcrdt`.

<note>
<code>data_dir</code> задаётся на уровне ноды (<code>cluster.raft.data_dir</code>), а не на запись. Общее состояние Raft и долговечные снимки CRDT хранятся под <code>&lt;data_dir&gt;/_sys/</code>.
</note>

## Поведение TTL

Оба хранилища поддерживают время жизни записей. Просроченные записи сохраняются до момента очистки с интервалом `cleanup_interval`. Установите `0` для отключения автоматической очистки.

## Lua API

См. [Модуль Store](lua/storage/store.md) для операций: `get`, `set`, `has`, `delete`, а также `put`, `entry`, `list` и `info` для версионированного и условного доступа.

## См. также

- [Модуль Store](lua/storage/store.md) — справочник Lua API
- [База данных](system/database.md) — SQL-бэкенд для `store.sql`
