---
title: "Sistema de Banco de Dados"
description: "Pool de conexões e configuração de banco de dados SQL. Suporta PostgreSQL, MySQL e SQLite."
---

# Sistema de Banco de Dados

Pool de conexões e configuração de banco de dados SQL. Suporta PostgreSQL, MySQL e SQLite.

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
      max_open: 4
      max_idle: 2
      max_lifetime: "1h"
    lifecycle:
      auto_start: true
```

<note>
Um banco de dados SQLite privado em memória (<code>file: ":memory:"</code>) é limitado a uma conexão física, portanto <code>max_open</code> e <code>max_idle</code> são forçados para <code>1</code>. Um banco de dados baseado em arquivo respeita as configurações de <code>pool</code>, das quais uma transação de leitura de snapshot CDC precisa para não consumir a única conexão de escrita. O modo de journal é sempre <code>WAL</code>.
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

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `file` | string | obrigatório | Caminho do arquivo de banco de dados ou `:memory:` |
| `pool` | object | - | Configurações de pool de conexões; `max_open` e `max_idle` são forçados para `1` com `:memory:` |
| `max_mutation_changes` | int | 100000 | Linhas que uma transação pode manter no observador de mutações commitadas |
| `max_mutation_bytes` | int | 67108864 | Bytes lógicos que uma transação pode manter no observador (64 MiB) |
| `options` | map | - | Aceito mas ignorado |
| `lifecycle` | object | - | Configuração de ciclo de vida |

`max_mutation_changes` e `max_mutation_bytes` limitam o observador de mutações commitadas em memória que alimenta uma origem [`db.cdc.sqlite`](system/cdc.md). Zero em qualquer um dos campos seleciona o padrão; valores negativos são rejeitados. Os limites são conservadores em vez de exatos: o SQLite entrega uma linha completa ao hook de pre-update, então uma linha pode materializar-se antes que o limite rejeite o candidato.

### Valores de Segredo e de Ambiente

Obtenha valores de conexão do [registro de ambiente](system/env.md) com placeholders `${env:NAME}`, resolvidos no momento da decodificação. `NAME` é o nome público de uma variável registrada ou o ID da sua entrada (ex. `app.secrets:db_password`); não é uma variável de ambiente bruta do SO.

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
Configurações mais antigas usam uma diretiva irmã <code>&lt;field&gt;_env</code> (<code>host_env</code>, <code>port_env</code>, <code>database_env</code>, <code>username_env</code>, <code>password_env</code>) que resolve da mesma forma. Essa forma está <b>deprecada</b> — migre-a para o placeholder <code>${env:NAME}</code> mostrado acima.
</note>

<warning>
Evite codificar senhas na configuração. Use entradas <code>env.variable</code> para credenciais. Veja <a href="system/env.md">Ambiente</a> para gerenciamento seguro de segredos.
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
  max_open: 25      # Limita conexões concorrentes
  max_idle: 5       # Mantém 5 conexões prontas
  max_lifetime: "30m"  # Recicla conexões a cada 30 minutos
```

<tip>
Defina <code>max_idle</code> menor ou igual a <code>max_open</code>. Conexões excedendo <code>max_lifetime</code> são fechadas e substituídas, ajudando a recuperar de conexões obsoletas.
</tip>

## Formatos DSN

Cada tipo de banco de dados constrói um DSN a partir da configuração. Quaisquer `options` são anexadas (ordenadas por chave); nenhuma é incluída por padrão.

### PostgreSQL {id="dsn-postgresql"}

```
host='host' port=port user='username' password='password' dbname='database' [option='value' ...]
```

Todos os valores exceto a porta são delimitados por aspas simples, e `'` e `\` embutidos são escapados com barra invertida, de modo que hosts, senhas e valores de opção contendo espaços ou aspas são passados intactos.

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

O SQLite não aplica o mapa `options` ao seu DSN. Bancos de dados em arquivo sempre abrem com `mode=rwc`, e o modo de journal é sempre definido como `WAL`. O campo `options` é aceito, mas ignorado.

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
  # Banco de dados principal
  - name: users_db
    kind: db.sql.postgres
    host: ${env:USERS_DB_HOST}
    port: 5432
    database: "users"
    username: ${env:USERS_DB_USER}
    password: ${env:app.secrets:users_db_password}
    lifecycle:
      auto_start: true

  # Banco de dados de analytics
  - name: analytics_db
    kind: db.sql.mysql
    host: ${env:ANALYTICS_DB_HOST}
    port: 3306
    database: "analytics"
    username: ${env:ANALYTICS_DB_USER}
    password: ${env:app.secrets:analytics_db_password}
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

## Veja Também

- [Módulo SQL](lua/storage/sql.md) - Referência da API Lua
- [Store](system/store.md) - Armazenamento chave-valor baseado em um banco de dados `db.sql.*`
- [Queue](system/queue.md) - Handler de fila baseado em SQL
- [Change Data Capture](system/cdc.md) - Streaming de mudanças em nível de linha a partir de um banco `db.sql.sqlite` ou Postgres
