# Хранилище ключ-значение

Хранилища в памяти и на базе SQL с поддержкой TTL.

## Типы записей

| Тип | Описание |
|-----|----------|
| `store.memory` | Хранилище в памяти с автоматической очисткой |
| `store.sql` | Хранилище на базе SQL с персистентностью |

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

## Поведение TTL

Оба хранилища поддерживают время жизни записей. Просроченные записи сохраняются до момента очистки с интервалом `cleanup_interval`. Установите `0` для отключения автоматической очистки.

## Lua API

См. [Модуль Store](lua/storage/store.md) для операций (get, set, delete, exists, clear).
