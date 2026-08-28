---
title: "Migrações"
description: "Defina, aplique, inspecione e reverta migrações de banco de dados ordenadas para SQLite, PostgreSQL e MySQL."
---

# Migrações

O módulo `wippy/migration` fornece uma DSL para alterações de schema, um runner que descobre e executa migrações e um bootloader que aplica as migrações pendentes a cada `target_db` registrado.

As migrações oferecem suporte a SQLite, PostgreSQL e MySQL. Cada migração pode definir em conjunto implementações `up` e `down` específicas por driver.

Esta página é uma receita parcial de migração e uma referência do runner, não uma aplicação completa. A definição abaixo pode ser adaptada depois que o módulo e o banco de dados estiverem conectados; as chamadas posteriores do runner e as tabelas de resultado são snippets de referência. Crie backups antes de aplicar migrações a dados que precisa preservar e teste `up` e `down` em um banco descartável primeiro.

## Configuracao

Adicione o modulo ao seu projeto:

```bash
wippy add wippy/migration
wippy install
```

Declare a dependencia e o banco de dados da aplicacao que as migracoes devem alvejar:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    file: ./data/app.db

  - name: dep.migration
    kind: ns.dependency
    component: wippy/migration
    version: "*"
```

O bootloader de migracoes se registra em `wippy/bootloader` na ordem `20`. Quando a aplicacao inicia, ele descobre cada entrada de migracao no registro, agrupa-as por `meta.target_db` e executa as migracoes pendentes em cada banco de dados.

Se usar o caminho SQLite relativo acima, crie o diretório `data` antes de iniciar a aplicação. Verifique o resultado com `runner:status()`; use `runner:rollback()` somente quando a implementação `down` da migração for segura para os dados de teste.

## Definindo uma Migracao

Uma migracao e uma entrada `function.lua` com `meta.type: migration`. A entrada retorna uma funcao produzida por `migration.define(...)`.

```yaml
entries:
  - name: 01_create_users_table
    kind: function.lua
    meta:
      type: migration
      target_db: app:app_db
      timestamp: "2025-01-15T10:00:00Z"
    source: file://01_create_users_table.lua
    imports:
      migration: wippy.migration:migration
```

```lua
return require("migration").define(function()
    migration("Create users table", function()
        database("sqlite", function()
            up(function(db)
                local _, err = db:execute([[
                    CREATE TABLE users (
                        id    INTEGER PRIMARY KEY,
                        name  TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE
                    )
                ]])
                if err then error(err) end
            end)

            down(function(db)
                local _, err = db:execute("DROP TABLE IF EXISTS users")
                if err then error(err) end
            end)
        end)

        database("postgres", function()
            up(function(db)
                local _, err = db:execute([[
                    CREATE TABLE users (
                        id    SERIAL PRIMARY KEY,
                        name  TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE
                    )
                ]])
                if err then error(err) end
            end)

            down(function(db)
                local _, err = db:execute("DROP TABLE IF EXISTS users")
                if err then error(err) end
            end)
        end)
    end)
end)
```

### Metadados Obrigatorios

| Campo | Obrigatorio | Descricao |
|-------|----------|-------------|
| `meta.type` | sim | Deve ser `"migration"` para descoberta |
| `meta.target_db` | sim | ID no registro do banco de dados a ser executado |
| `meta.timestamp` | nao | Timestamp ISO-8601 usado para ordenacao quando varias migracoes alvejam o mesmo banco |
| `meta.tags` | nao | Array de tags; o executor pode filtrar migracoes por tag |

As migrações de um banco rodam em ordem crescente de `meta.timestamp`. O campo é opcional; o ID completo da entrada desempata, portanto timestamps iguais ou ausentes ainda produzem uma ordem estável e determinística.

## DSL

Dentro da funcao passada para `migration.define`, tres funcoes aninhadas estao disponiveis:

| Funcao | Descricao |
|----------|-------------|
| `migration(description, fn)` | Abre uma nova migracao com uma descricao legivel |
| `database(type, fn)` | Declara uma implementacao para `"sqlite"`, `"postgres"` ou `"mysql"` |
| `up(fn)` / `down(fn)` | Define funcoes de avanco e reversao |
| `after(fn)` | Hook opcional pos-migracao (mesma transacao) |

Cada funcao `up`/`down`/`after` recebe um objeto de transacao, nao uma conexao bruta. Todas as tres operacoes rodam em uma unica transacao que faz rollback em caso de erro.

### Metodos da Transacao

```lua
local rows, err  = db:query(sql, params)    -- SELECT, returns array of rows
local result, err = db:execute(sql, params) -- INSERT/UPDATE/DDL, returns { rows_affected, last_insert_id }
local stmt, err  = db:prepare(sql)          -- prepared statement
```

Sempre use consultas parametrizadas:

```lua
db:execute("INSERT INTO users (name, email) VALUES (?, ?)", { "Alice", "alice@example.com" })
```

### Tratamento de Erros

Chamar `error(...)` aborta a migracao e faz rollback da transacao. Envolva toda instrucao que possa falhar:

```lua
up(function(db)
    local _, err = db:execute("CREATE TABLE ...")
    if err then error(err) end
end)
```

## API do Executor

O executor e exposto como biblioteca para uso programatico:

```yaml
imports:
  runner: wippy.migration:runner
```

```lua
local runner = require("runner").setup("app:app_db")

local result = runner:run()      -- apply all pending migrations
local result = runner:run_next() -- apply the next pending migration
local result = runner:rollback() -- roll back the most recently applied migration
local status = runner:status()   -- list applied + pending migrations
```

### `runner:run(options)`

Aplica toda migracao pendente para o banco de dados configurado. Retorna um resumo:

```lua
{
    status = "complete",            -- "complete" or "error"
    migrations_found = 3,
    migrations_applied = 2,
    migrations_skipped = 1,
    migrations_failed = 0,
    duration = 0.123,
    migrations = { ... },           -- per-migration status
    skipped_details = { ... },
}
```

Opcoes:

| Opcao | Descricao |
|--------|-------------|
| `tags` | Array de tags; apenas migracoes cujo `meta.tags` possui intersecao sao consideradas |

### `runner:rollback(options)`

Reverte migrações aplicadas na ordem inversa de aplicação. Sem opções, reverte apenas a migração aplicada mais recentemente:

```lua
runner:rollback()                                            -- roll back the last migration
runner:rollback({ count = 3 })                               -- roll back the last 3
runner:rollback({ allowed_ids = { "app:01_create_users_table" } }) -- restrict to specific ids
```

Opções:

| Opção | Descrição |
|-------|-----------|
| `count` | Número de migrações a reverter; padrão `1` |
| `allowed_ids` | Array de IDs; apenas essas migrações podem ser revertidas |

### `runner:status(options)`

Retorna um relatório de status de todas as migrações do banco:

```lua
{
    database_id        = "app:app_db",
    db_type            = "sqlite",
    total_migrations   = 3,
    applied_migrations = 2,
    pending_migrations = 1,
    migrations = {
        { id = "app:01_...", description = "...", timestamp = "...",
          tags = {}, status = "applied", applied_at = ... },
        -- ...
    },
}
```

As migrações aplicadas são listadas primeiro, ordenadas por `applied_at`, seguidas das pendentes, ordenadas por `meta.timestamp` e depois por ID.

## API do Registro

`wippy.migration:registry` oferece consultas diretas ao registro:

| Funcao | Descricao |
|----------|-------------|
| `registry.find({ target_db, tags })` | Retorna todas as entradas de migracao que atendem aos criterios |
| `registry.get(id)` | Retorna uma unica entrada de migracao pelo id |
| `registry.get_target_dbs()` | Retorna cada `meta.target_db` unico presente nas migracoes |
| `registry.get_tags()` | Retorna cada tag unica presente nas migracoes |

O bootloader usa essas funcoes para descobrir o conjunto completo de bancos alvo na inicializacao.

## Rastreamento de Migracoes

O runner cria uma tabela `_migrations` em cada banco de destino na primeira execução. As migrações aplicadas são registradas por ID para que execuções posteriores as ignorem. A tabela de rastreamento é criada automaticamente; não escreva uma migração própria para criá-la.

## Boas Praticas

- **Uma alteração lógica por migração** — crie uma tabela, adicione uma coluna ou crie um índice.
- **Escreva um `down` real** — se o rollback causar perda de dados ou for impossível por outro motivo, documente essa limitação e gere um erro em vez de informar sucesso.
- **Prefira idempotência** — `CREATE TABLE IF NOT EXISTS` e `DROP TABLE IF EXISTS` toleram novas execuções sem tratamento especial.
- **Mantenha DDL e DML separados** — evite semear dados na mesma migração que cria uma tabela.
- **Teste ambas as direções** — aplique a migração, reverta-a e verifique se o schema corresponde ao estado inicial.

## Veja Tambem

- [Driver SQL](system/database.md) — Configuração de recursos de banco de dados
- [Bootloader](framework/bootloader.md) — Ordenação e hooks do bootloader
- [Visão Geral do Framework](framework/overview.md) — Uso dos módulos do framework
