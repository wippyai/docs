---
title: "Sistema de Banco de Dados"
description: "Pool de conexões e configuração de banco de dados SQL. Suporta PostgreSQL, MySQL e SQLite."
---

# Sistema de Banco de Dados

O Wippy fornece entradas SQL com pool de conexões para PostgreSQL e MySQL, além de uma entrada SQLite de conexão única.

Esta página é uma referência de configuração. A menos que um bloco inclua `version`, `namespace` e `entries`, trate-o como um fragmento a inserir em uma lista de entradas existente.

## Tipos de Entradas

| Tipo | Descrição |
|------|-----------|
| `db.sql.postgres` | Banco de dados PostgreSQL |
| `db.sql.mysql` | Banco de dados MySQL |
| `db.sql.sqlite` | Banco de dados SQLite |

## Configuração

### Bancos de Dados Padrão (PostgreSQL, MySQL)

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
    password: ${env:app.secrets:db_password}
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
    file: "/var/data/cache.db"  # Use :memory: for in-memory
    pool:
      max_lifetime: "1h"
    lifecycle:
      auto_start: true
```

<note>
O SQLite sempre usa uma única conexão (<code>max_open</code> e <code>max_idle</code> são forçados para <code>1</code>) e o modo de journal <code>WAL</code>. Somente <code>max_lifetime</code> de <code>pool</code> é aplicado.
</note>

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
| `pool` | object | Somente `max_lifetime` é aplicado; as conexões permanecem fixas em 1 |
| `options` | map | Aceito, mas ignorado |
| `lifecycle` | object | Configuração de ciclo de vida |

### Valores Secretos e de Ambiente

Obtenha valores do [registro de ambiente](system/env.md) com placeholders `${env:NAME}`, resolvidos durante a decodificação. `NAME` é o nome público de uma variável registrada ou seu ID de entrada, como `app.secrets:db_password`; não é uma variável bruta do sistema operacional.

```yaml
- name: prod_db
  kind: db.sql.postgres
  host: ${env:DB_HOST}
  port: ${env:DB_PORT|5432}
  database: ${env:DB_NAME}
  username: ${env:DB_USER}
  password: ${env:app.secrets:db_password}
```

<note>
Configurações antigas usam uma diretiva irmã <code>&lt;field&gt;_env</code> (<code>host_env</code>, <code>port_env</code>, <code>database_env</code>, <code>username_env</code>, <code>password_env</code>) resolvida da mesma forma. Esse formato está <b>obsoleto</b>; migre para o placeholder <code>${env:NAME}</code> acima.
</note>

<warning>
Evite codificar senhas na configuração. Use entradas <code>env.variable</code> para credenciais. Consulte <a href="./env.md">Ambiente</a> para configurar segredos.
</warning>

## Pool de Conexões

Configure o comportamento de pool de conexões. Configurações de pool mapeiam para o [pool de conexões database/sql](https://pkg.go.dev/database/sql#DB.SetMaxOpenConns) do Go.

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `max_open` | int | 0 | Máximo de conexões abertas (0 = ilimitado) |
| `max_idle` | int | 0 | Máximo de conexões ociosas (0 = nenhuma conexão ociosa retida) |
| `max_lifetime` | duration | 1h | Tempo de vida máximo da conexão |

```yaml
pool:
  max_open: 25      # Limit concurrent connections
  max_idle: 5       # Keep 5 connections ready
  max_lifetime: "30m"  # Recycle connections every 30 minutes
```

<tip>
Defina <code>max_idle</code> menor ou igual a <code>max_open</code>. Conexões excedendo <code>max_lifetime</code> são fechadas e substituídas, ajudando a recuperar de conexões obsoletas.
</tip>

## Formatos DSN

Cada tipo de banco constrói um DSN a partir da configuração. Todas as `options` são anexadas em ordem de chave; nenhuma é incluída por padrão.

### PostgreSQL {id="dsn-postgresql"}

```
host=host port=port user=username password=password dbname=database [option=value ...]
```

### MySQL {id="dsn-mysql"}

```
username:password@tcp(host:port)/database[?option=value&...]
```

### SQLite {id="dsn-sqlite"}

```
file:/path/to/database.db?mode=rwc
:memory:
```

## Opções de Banco de Dados

Opções comuns específicas de cada banco de dados:

### PostgreSQL {id="options-postgresql"}

```yaml
options:
  sslmode: "require"      # disable, require, verify-ca, verify-full
  connect_timeout: "10"   # Connection timeout in seconds
  application_name: "myapp"
```

### MySQL {id="options-mysql"}

```yaml
options:
  charset: "utf8mb4"
  parseTime: "true"       # Parse time values to time.Time
  loc: "Local"            # Timezone
```

### SQLite {id="options-sqlite"}

O SQLite não aplica o mapa `options` ao DSN. Bancos em arquivo sempre abrem com `mode=rwc`, e o modo de journal é sempre `WAL`. O campo `options` é aceito, mas ignorado.

## Exemplos

### PostgreSQL com SSL

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

### Réplica de Leitura MySQL

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

### SQLite Em Memória

```yaml
- name: test_db
  kind: db.sql.sqlite
  file: ":memory:"
```

### Configuração com Múltiplos Bancos de Dados

```yaml
entries:
  # Primary database
  - name: users_db
    kind: db.sql.postgres
    host: ${env:USERS_DB_HOST}
    port: 5432
    database: "users"
    username: ${env:USERS_DB_USER}
    password: ${env:app.secrets:users_db_password}
    lifecycle:
      auto_start: true

  # Analytics database
  - name: analytics_db
    kind: db.sql.mysql
    host: ${env:ANALYTICS_DB_HOST}
    port: 3306
    database: "analytics"
    username: ${env:ANALYTICS_DB_USER}
    password: ${env:app.secrets:analytics_db_password}
    lifecycle:
      auto_start: true

  # Local cache
  - name: cache
    kind: db.sql.sqlite
    file: "/var/cache/app.db"
    lifecycle:
      auto_start: true
```

## Registro em Tempo de Execução

Bancos de dados podem ser registrados em runtime com o [módulo registry](lua/core/registry.md).

## API Lua

Consulte o [Módulo SQL](lua/storage/sql.md) para consultas, transações e operações de conexão.

## Veja Também

- [Módulo SQL](lua/storage/sql.md) - Referência da API Lua
- [Store](system/store.md) - Armazenamento chave-valor baseado em um banco `db.sql.*`
- [Queue](system/queue.md) - Handler de fila baseado em SQL
