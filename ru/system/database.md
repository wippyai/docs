# База данных

Пулы подключений к SQL-базам данных. Поддерживаются PostgreSQL, MySQL, SQLite, Microsoft SQL Server и Oracle.

## Типы записей

| Тип | Описание |
|-----|----------|
| `db.sql.postgres` | PostgreSQL |
| `db.sql.mysql` | MySQL |
| `db.sql.sqlite` | SQLite |
| `db.sql.mssql` | Microsoft SQL Server |
| `db.sql.oracle` | Oracle |

## Настройка

### Стандартные базы данных (PostgreSQL, MySQL, MSSQL, Oracle)

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
      max_open: 1
      max_idle: 1
      max_lifetime: "1h"
    options:
      cache: "shared"
    lifecycle:
      auto_start: true
```

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

| Поле | Тип | Описание |
|------|-----|----------|
| `file` | string | Путь к файлу БД или `:memory:` |
| `pool` | object | Настройки пула |
| `options` | map | Опции SQLite |
| `lifecycle` | object | Настройки жизненного цикла |

### Поля из переменных окружения

Суффикс `_env` позволяет загружать значения из переменных окружения или записей [env.variable](system-env.md):

| Поле | Описание |
|------|----------|
| `host_env` | Хост из переменной окружения |
| `port_env` | Порт из переменной окружения |
| `database_env` | Имя БД из переменной окружения |
| `username_env` | Пользователь из переменной окружения |
| `password_env` | Пароль из переменной окружения |

```yaml
- name: prod_db
  kind: db.sql.postgres
  host_env: "DB_HOST"
  port_env: "DB_PORT"
  database_env: "DB_NAME"
  username_env: "DB_USER"
  password_env: "app.secrets:db_password"  # Ссылка на запись env.variable
```

<warning>
Не храните пароли в конфигурации напрямую. Используйте переменные окружения или записи <code>env.variable</code> для учётных данных. См. <a href="system-env.md">Окружение</a> для безопасного хранения секретов.
</warning>

## Пул подключений

Настройка поведения пула. Параметры соответствуют [пулу подключений database/sql](https://pkg.go.dev/database/sql#DB.SetMaxOpenConns) в Go.

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `max_open` | int | 0 | Максимум открытых подключений (0 = без ограничений) |
| `max_idle` | int | 0 | Максимум простаивающих подключений (0 = без ограничений) |
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

Для каждого типа БД формируется свой DSN из конфигурации:

### PostgreSQL {id="dsn-postgresql"}

```
postgres://username:password@host:port/database?sslmode=disable
```

### MySQL {id="dsn-mysql"}

```
username:password@tcp(host:port)/database?charset=utf8mb4
```

### SQLite {id="dsn-sqlite"}

```
file:/path/to/database.db?cache=shared
:memory:?mode=memory
```

### Microsoft SQL Server {id="dsn-mssql"}

```
sqlserver://username:password@host:port?database=dbname
```

### Oracle {id="dsn-oracle"}

```
oracle://username:password@host:port/service_name
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

```yaml
options:
  cache: "shared"         # shared, private
  mode: "rwc"            # ro, rw, rwc, memory
  _journal_mode: "WAL"   # DELETE, TRUNCATE, PERSIST, MEMORY, WAL, OFF
```

### Microsoft SQL Server {id="options-mssql"}

```yaml
options:
  encrypt: "true"
  TrustServerCertificate: "false"
```

### Oracle {id="options-oracle"}

```yaml
options:
  poolMinSessions: "1"
  poolMaxSessions: "10"
  poolIncrement: "1"
```

## Примеры

### PostgreSQL с SSL

```yaml
- name: secure_postgres
  kind: db.sql.postgres
  host: "db.example.com"
  port: 5432
  database: "production"
  username: "app_user"
  password: "${DB_PASSWORD}"
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
  password_env: "REPLICA_PASSWORD"
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
  pool:
    max_open: 1
    max_idle: 1
  options:
    cache: "shared"
    mode: "memory"
```

### Несколько баз данных

```yaml
entries:
  # Основная база
  - name: users_db
    kind: db.sql.postgres
    host_env: "USERS_DB_HOST"
    port: 5432
    database: "users"
    username_env: "USERS_DB_USER"
    password_env: "USERS_DB_PASSWORD"
    lifecycle:
      auto_start: true

  # Аналитика
  - name: analytics_db
    kind: db.sql.mysql
    host_env: "ANALYTICS_DB_HOST"
    port: 3306
    database: "analytics"
    username_env: "ANALYTICS_DB_USER"
    password_env: "ANALYTICS_DB_PASSWORD"
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

Базы данных можно регистрировать во время работы через [модуль registry](lua-registry.md), что позволяет динамически настраивать подключения на основе состояния приложения или внешней конфигурации.

## Lua API

См. [Модуль SQL](lua-sql.md) для API работы с базами данных.
