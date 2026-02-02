# Sistema de Banco de Dados

Pool de conexões e configuração de banco de dados SQL. Suporta PostgreSQL, MySQL, SQLite, Microsoft SQL Server e Oracle.

## Tipos de Entradas

| Tipo | Descrição |
|------|-----------|
| `db.sql.postgres` | Banco de dados PostgreSQL |
| `db.sql.mysql` | Banco de dados MySQL |
| `db.sql.sqlite` | Banco de dados SQLite |
| `db.sql.mssql` | Microsoft SQL Server |
| `db.sql.oracle` | Banco de dados Oracle |

## Configuração

### Bancos de Dados Padrão (PostgreSQL, MySQL, MSSQL, Oracle)

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
    file: "/var/data/cache.db"  # Use :memory: para em memória
    pool:
      max_open: 1
      max_idle: 1
      max_lifetime: "1h"
    options:
      cache: "shared"
    lifecycle:
      auto_start: true
```

## Campos de Conexão

### Campos de Banco de Dados Padrão

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `host` | string | Endereço do host do banco de dados |
| `port` | int | Número da porta do banco de dados |
| `database` | string | Nome do banco de dados |
| `username` | string | Usuário do banco de dados |
| `password` | string | Senha do banco de dados |
| `pool` | object | Configurações de pool de conexões |
| `options` | map | Opções específicas do banco de dados |
| `lifecycle` | object | Configuração de ciclo de vida |

### Campos SQLite

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `file` | string | Caminho do arquivo de banco de dados ou `:memory:` |
| `pool` | object | Configurações de pool de conexões |
| `options` | map | Opções específicas do SQLite |
| `lifecycle` | object | Configuração de ciclo de vida |

### Campos de Variáveis de Ambiente

Use o sufixo `_env` para carregar valores de variáveis de ambiente ou entradas [env.variable](system/env.md):

| Campo | Descrição |
|-------|-----------|
| `host_env` | Host de variável de ambiente |
| `port_env` | Porta de variável de ambiente |
| `database_env` | Nome do banco de dados do ambiente |
| `username_env` | Usuário do ambiente |
| `password_env` | Senha do ambiente |

```yaml
- name: prod_db
  kind: db.sql.postgres
  host_env: "DB_HOST"
  port_env: "DB_PORT"
  database_env: "DB_NAME"
  username_env: "DB_USER"
  password_env: "app.secrets:db_password"  # Referencia entrada env.variable
```

<warning>
Evite codificar senhas na configuração. Use variáveis de ambiente ou entradas <code>env.variable</code> para credenciais. Veja <a href="system/env.md">Ambiente</a> para gerenciamento seguro de segredos.
</warning>

## Pool de Conexões

Configure o comportamento de pool de conexões. Configurações de pool mapeiam para o [pool de conexões database/sql](https://pkg.go.dev/database/sql#DB.SetMaxOpenConns) do Go.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `max_open` | int | 0 | Máximo de conexões abertas (0 = ilimitado) |
| `max_idle` | int | 0 | Máximo de conexões ociosas (0 = ilimitado) |
| `max_lifetime` | duration | 1h | Tempo de vida máximo da conexão |

```yaml
pool:
  max_open: 25      # Limita conexões concorrentes
  max_idle: 5       # Mantém 5 conexões prontas
  max_lifetime: "30m"  # Recicla conexões a cada 30 minutos
```

<tip>
Defina <code>max_idle</code> menor ou igual a <code>max_open</code>. Conexões excedendo <code>max_lifetime</code> são fechadas e substituídas, ajudando a recuperar de conexões obsoletas.
</tip>

## Formatos DSN

Cada tipo de banco de dados constrói um DSN a partir da configuração:

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

## Opções de Banco de Dados

Opções comuns específicas de cada banco de dados:

### PostgreSQL {id="options-postgresql"}

```yaml
options:
  sslmode: "require"      # disable, require, verify-ca, verify-full
  connect_timeout: "10"   # Timeout de conexão em segundos
  application_name: "myapp"
```

### MySQL {id="options-mysql"}

```yaml
options:
  charset: "utf8mb4"
  parseTime: "true"       # Analisa valores de tempo para time.Time
  loc: "Local"            # Fuso horário
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

## Exemplos

### PostgreSQL com SSL

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

### Réplica de Leitura MySQL

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

### SQLite Em Memória

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

### Configuração com Múltiplos Bancos de Dados

```yaml
entries:
  # Banco de dados principal
  - name: users_db
    kind: db.sql.postgres
    host_env: "USERS_DB_HOST"
    port: 5432
    database: "users"
    username_env: "USERS_DB_USER"
    password_env: "USERS_DB_PASSWORD"
    lifecycle:
      auto_start: true

  # Banco de dados de analytics
  - name: analytics_db
    kind: db.sql.mysql
    host_env: "ANALYTICS_DB_HOST"
    port: 3306
    database: "analytics"
    username_env: "ANALYTICS_DB_USER"
    password_env: "ANALYTICS_DB_PASSWORD"
    lifecycle:
      auto_start: true

  # Cache local
  - name: cache
    kind: db.sql.sqlite
    file: "/var/cache/app.db"
    lifecycle:
      auto_start: true
```

## Registro em Tempo de Execução

Bancos de dados podem ser registrados em tempo de execução usando o [módulo registry](lua/core/registry.md), permitindo configuração dinâmica de banco de dados baseada no estado da aplicação ou configuração externa.

## API Lua

Veja [Módulo SQL](lua/storage/sql.md) para API de operações de banco de dados.
