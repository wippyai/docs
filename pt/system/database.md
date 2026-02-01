# Sistema de Banco de Dados

Pool de conexoes e configuracao de banco de dados SQL. Suporta PostgreSQL, MySQL, SQLite, Microsoft SQL Server e Oracle.

## Tipos de Entradas

| Tipo | Descricao |
|------|-----------|
| `db.sql.postgres` | Banco de dados PostgreSQL |
| `db.sql.mysql` | Banco de dados MySQL |
| `db.sql.sqlite` | Banco de dados SQLite |
| `db.sql.mssql` | Microsoft SQL Server |
| `db.sql.oracle` | Banco de dados Oracle |

## Configuracao

### Bancos de Dados Padrao (PostgreSQL, MySQL, MSSQL, Oracle)

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
    file: "/var/data/cache.db"  # Use :memory: para em memoria
    pool:
      max_open: 1
      max_idle: 1
      max_lifetime: "1h"
    options:
      cache: "shared"
    lifecycle:
      auto_start: true
```

## Campos de Conexao

### Campos de Banco de Dados Padrao

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `host` | string | Endereco do host do banco de dados |
| `port` | int | Numero da porta do banco de dados |
| `database` | string | Nome do banco de dados |
| `username` | string | Usuario do banco de dados |
| `password` | string | Senha do banco de dados |
| `pool` | object | Configuracoes de pool de conexoes |
| `options` | map | Opcoes especificas do banco de dados |
| `lifecycle` | object | Configuracao de ciclo de vida |

### Campos SQLite

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `file` | string | Caminho do arquivo de banco de dados ou `:memory:` |
| `pool` | object | Configuracoes de pool de conexoes |
| `options` | map | Opcoes especificas do SQLite |
| `lifecycle` | object | Configuracao de ciclo de vida |

### Campos de Variaveis de Ambiente

Use o sufixo `_env` para carregar valores de variaveis de ambiente ou entradas [env.variable](system-env.md):

| Campo | Descricao |
|-------|-----------|
| `host_env` | Host de variavel de ambiente |
| `port_env` | Porta de variavel de ambiente |
| `database_env` | Nome do banco de dados do ambiente |
| `username_env` | Usuario do ambiente |
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
Evite codificar senhas na configuracao. Use variaveis de ambiente ou entradas <code>env.variable</code> para credenciais. Veja <a href="system-env.md">Ambiente</a> para gerenciamento seguro de segredos.
</warning>

## Pool de Conexoes

Configure o comportamento de pool de conexoes. Configuracoes de pool mapeiam para o [pool de conexoes database/sql](https://pkg.go.dev/database/sql#DB.SetMaxOpenConns) do Go.

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `max_open` | int | 0 | Maximo de conexoes abertas (0 = ilimitado) |
| `max_idle` | int | 0 | Maximo de conexoes ociosas (0 = ilimitado) |
| `max_lifetime` | duration | 1h | Tempo de vida maximo da conexao |

```yaml
pool:
  max_open: 25      # Limita conexoes concorrentes
  max_idle: 5       # Mantem 5 conexoes prontas
  max_lifetime: "30m"  # Recicla conexoes a cada 30 minutos
```

<tip>
Defina <code>max_idle</code> menor ou igual a <code>max_open</code>. Conexoes excedendo <code>max_lifetime</code> sao fechadas e substituidas, ajudando a recuperar de conexoes obsoletas.
</tip>

## Formatos DSN

Cada tipo de banco de dados constroi um DSN a partir da configuracao:

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

## Opcoes de Banco de Dados

Opcoes comuns especificas de cada banco de dados:

### PostgreSQL {id="options-postgresql"}

```yaml
options:
  sslmode: "require"      # disable, require, verify-ca, verify-full
  connect_timeout: "10"   # Timeout de conexao em segundos
  application_name: "myapp"
```

### MySQL {id="options-mysql"}

```yaml
options:
  charset: "utf8mb4"
  parseTime: "true"       # Analisa valores de tempo para time.Time
  loc: "Local"            # Fuso horario
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

### Replica de Leitura MySQL

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

### SQLite Em Memoria

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

### Configuracao com Multiplos Bancos de Dados

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

## Registro em Tempo de Execucao

Bancos de dados podem ser registrados em tempo de execucao usando o [modulo registry](lua-registry.md), permitindo configuracao dinamica de banco de dados baseada no estado da aplicacao ou configuracao externa.

## API Lua

Veja [Modulo SQL](lua-sql.md) para API de operacoes de banco de dados.
