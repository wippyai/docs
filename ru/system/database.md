---
title: "База данных"
description: "Пулы подключений к SQL-базам данных. Поддерживаются PostgreSQL, MySQL и SQLite."
---

# База данных

Пулы подключений к SQL-базам данных. Поддерживаются PostgreSQL, MySQL и SQLite.

## Типы записей

| Тип | Описание |
|-----|----------|
| `db.sql.postgres` | PostgreSQL |
| `db.sql.mysql` | MySQL |
| `db.sql.sqlite` | SQLite |

## Настройка

### Стандартные базы данных (PostgreSQL, MySQL)

```yaml
# src/data/_index.yaml
version: "1.0"
namespace: app.data

entries:
  - name: main_db
    kind: db.sql.postgres
    host: "localhost"
    port: 5432
    database: "myapp"
    username: "dbuser"
    password: "dbpass"
    pool:
      max_open: 25
      max_idle: 5
      max_lifetime: "1h"
    options:
      sslmode: "disable"
    lifecycle:
      auto_start: true
```

### SQLite

```yaml
  - name: cache_db
    kind: db.sql.sqlite
    file: "/var/data/cache.db"  # Для in-memory используйте :memory:
    pool:
      max_open: 4
      max_idle: 2
      max_lifetime: "1h"
    lifecycle:
      auto_start: true
```

<note>
Приватная in-memory база SQLite (<code>file: ":memory:"</code>) ограничена одним физическим соединением, поэтому <code>max_open</code> и <code>max_idle</code> принудительно приводятся к <code>1</code>. База на файле соблюдает заданные настройки <code>pool</code>, что необходимо транзакции чтения снапшота CDC, чтобы она не занимала единственное соединение для записи. Режим журнала всегда <code>WAL</code>.
</note>

## Поля подключения

### Стандартные поля

| Поле | Тип | Описание |
|------|-----|----------|
| `host` | string | Адрес сервера БД |
| `port` | int | Порт |
| `database` | string | Имя базы данных |
| `username` | string | Пользователь |
| `password` | string | Пароль |
| `pool` | object | Настройки пула подключений |
| `options` | map | Специфичные для БД опции |
| `lifecycle` | object | Настройки жизненного цикла |

### Поля SQLite

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `file` | string | обязательно | Путь к файлу БД или `:memory:` |
| `pool` | object | - | Настройки пула соединений; для `:memory:` `max_open` и `max_idle` принудительно равны `1` |
| `max_mutation_changes` | int | 100000 | Сколько строк одна транзакция может удерживать в наблюдателе зафиксированных мутаций |
| `max_mutation_bytes` | int | 67108864 | Сколько логических байт одна транзакция может удерживать в наблюдателе (64 МиБ) |
| `options` | map | - | Принимаются, но игнорируются |
| `lifecycle` | object | - | Настройки жизненного цикла |

`max_mutation_changes` и `max_mutation_bytes` ограничивают находящийся в памяти наблюдатель зафиксированных мутаций, который питает источник [`db.cdc.sqlite`](system/cdc.md). Ноль в любом из полей выбирает значение по умолчанию; отрицательные значения отклоняются. Ограничения консервативные, а не точные: SQLite передаёт в pre-update hook целую строку, поэтому одна строка может материализоваться до того, как ограничение отклонит кандидата.

### Секреты и значения из окружения

Значения подключения берутся из [реестра окружения](system/env.md) через плейсхолдеры `${env:NAME}`, разрешаемые при декодировании. `NAME` — публичное имя зарегистрированной переменной или её ID записи (например, `app.secrets:db_password`); это не сырая переменная окружения ОС.

```yaml
- name: prod_db
  kind: db.sql.postgres
  host: ${env:DB_HOST}
  port: ${env:DB_PORT}
  database: ${env:DB_NAME}
  username: ${env:DB_USER}
  password: ${env:app.secrets:db_password}
```

<note>
Более старые конфигурации используют парную директиву <code>&lt;field&gt;_env</code> (<code>host_env</code>, <code>port_env</code>, <code>database_env</code>, <code>username_env</code>, <code>password_env</code>), которая разрешается так же. Эта форма <b>объявлена устаревшей</b> — переводите её на плейсхолдер <code>${env:NAME}</code>, показанный выше.
</note>

<warning>
Не храните пароли в конфигурации напрямую. Используйте записи <code>env.variable</code> для учётных данных. См. <a href="system/env.md">Окружение</a> для безопасного хранения секретов.
</warning>

## Пул подключений

Настройка поведения пула. Параметры соответствуют [пулу подключений database/sql](https://pkg.go.dev/database/sql#DB.SetMaxOpenConns) в Go.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `max_open` | int | 0 | Максимум открытых подключений (0 = без ограничений) |
| `max_idle` | int | 0 | Максимум простаивающих подключений (0 = простаивающие подключения не удерживаются) |
| `max_lifetime` | duration | 1h | Максимальное время жизни подключения |

```yaml
pool:
  max_open: 25      # Ограничить параллельные подключения
  max_idle: 5       # Держать 5 подключений готовыми
  max_lifetime: "30m"  # Обновлять подключения каждые 30 минут
```

<tip>
Устанавливайте <code>max_idle</code> не больше <code>max_open</code>. Подключения старше <code>max_lifetime</code> закрываются и пересоздаются, что помогает справляться с устаревшими подключениями.
</tip>

## Форматы DSN

Для каждого типа БД формируется свой DSN из конфигурации. Любые `options` добавляются в конец (отсортированные по ключу); по умолчанию не включается ни одна.

### PostgreSQL {id="dsn-postgresql"}

```
host='host' port=port user='username' password='password' dbname='database' [option='value' ...]
```

Каждое значение, кроме порта, заключено в одинарные кавычки, а встроенные `'` и `\` экранируются обратным слэшем, поэтому хосты, пароли и значения опций с пробелами или кавычками передаются без искажений.

### MySQL {id="dsn-mysql"}

```
username:password@tcp(host:port)/database[?option=value&...]
```

### SQLite {id="dsn-sqlite"}

```
file:/path/to/database.db?mode=rwc
:memory:
```

## Опции баз данных

Типичные опции для разных БД:

### PostgreSQL {id="options-postgresql"}

```yaml
options:
  sslmode: "require"      # disable, require, verify-ca, verify-full
  connect_timeout: "10"   # Тайм-аут подключения в секундах
  application_name: "myapp"
```

### MySQL {id="options-mysql"}

```yaml
options:
  charset: "utf8mb4"
  parseTime: "true"       # Парсить значения времени в time.Time
  loc: "Local"            # Часовой пояс
```

### SQLite {id="options-sqlite"}

SQLite не применяет карту `options` к своему DSN. Файловые базы всегда открываются с `mode=rwc`, а режим журнала всегда устанавливается в `WAL`. Поле `options` принимается, но игнорируется.

## Примеры

### PostgreSQL с SSL

```yaml
- name: secure_postgres
  kind: db.sql.postgres
  host: "db.example.com"
  port: 5432
  database: "production"
  username: "app_user"
  password: ${env:app.secrets:db_password}
  pool:
    max_open: 50
    max_idle: 10
    max_lifetime: "1h"
  options:
    sslmode: "verify-full"
    sslcert: "/certs/client.crt"
    sslkey: "/certs/client.key"
    sslrootcert: "/certs/ca.crt"
  lifecycle:
    auto_start: true
```

### MySQL реплика для чтения

```yaml
- name: mysql_replica
  kind: db.sql.mysql
  host: "replica.db.example.com"
  port: 3306
  database: "app"
  username: "readonly"
  password: ${env:app.secrets:replica_password}
  pool:
    max_open: 20
    max_idle: 5
    max_lifetime: "30m"
  options:
    charset: "utf8mb4"
    parseTime: "true"
    readTimeout: "30s"
```

### SQLite в памяти

```yaml
- name: test_db
  kind: db.sql.sqlite
  file: ":memory:"
```

### Несколько баз данных

```yaml
entries:
  # Основная база
  - name: users_db
    kind: db.sql.postgres
    host: ${env:USERS_DB_HOST}
    port: 5432
    database: "users"
    username: ${env:USERS_DB_USER}
    password: ${env:app.secrets:users_db_password}
    lifecycle:
      auto_start: true

  # Аналитика
  - name: analytics_db
    kind: db.sql.mysql
    host: ${env:ANALYTICS_DB_HOST}
    port: 3306
    database: "analytics"
    username: ${env:ANALYTICS_DB_USER}
    password: ${env:app.secrets:analytics_db_password}
    lifecycle:
      auto_start: true

  # Локальный кеш
  - name: cache
    kind: db.sql.sqlite
    file: "/var/cache/app.db"
    lifecycle:
      auto_start: true
```

## Регистрация во время работы

Базы данных можно регистрировать во время работы через [модуль registry](lua/core/registry.md), что позволяет динамически настраивать подключения на основе состояния приложения или внешней конфигурации.

## Lua API

См. [Модуль SQL](lua/storage/sql.md) для API работы с базами данных.

## См. также

- [Модуль SQL](lua/storage/sql.md) — справочник Lua API
- [Store](system/store.md) — key-value хранилище на основе базы `db.sql.*`
- [Queue](system/queue.md) — обработчик очередей на основе SQL
- [Change Data Capture](system/cdc.md) — стриминг построчных изменений из базы `db.sql.sqlite` или Postgres
