---
title: "Migrações"
description: "O módulo wippy/migration fornece um framework de migrações de banco de dados com uma pequena DSL para definir alterações de schema, um executor que descobre e executa…"
---

# Migrações

O módulo `wippy/migration` fornece um framework de migrações de banco de dados com uma pequena DSL para definir alterações de schema, um executor que descobre e executa as migrações, e um bootloader que roda migrações pendentes para cada `target_db` registrado no projeto.

As migrações suportam SQLite, PostgreSQL e MySQL, com implementações `up`/`down` por driver definidas lado a lado.

## Configuração

Adicione o módulo ao seu projeto:

```bash
wippy add wippy/migration
wippy install
```

Declare a dependência e o banco de dados da aplicação que as migrações devem alvejar:

```yaml
version: "1.0"
namespace: app

entries:
  - name: app_db
    kind: db.sql.sqlite
    path: ./data/app.db

  - name: dep.migration
    kind: ns.dependency
    component: wippy/migration
    version: "*"
```

O bootloader de migrações se registra em `wippy/bootloader` na ordem `20`. Quando a aplicação inicia, ele descobre cada entrada de migração no registro, agrupa-as por `meta.target_db` e executa as migrações pendentes em cada banco de dados.

## Definindo uma Migração

Uma migração é uma entrada `function.lua` com `meta.type: migration`. A entrada retorna uma função produzida por `migration.define(...)`.

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
                local ok, err = db:execute([[
                    CREATE TABLE users (
                        id    INTEGER PRIMARY KEY,
                        name  TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE
                    )
                ]])
                if err then error(err) end
            end)

            down(function(db)
                db:execute("DROP TABLE IF EXISTS users")
            end)
        end)

        database("postgres", function()
            up(function(db)
                db:execute([[
                    CREATE TABLE users (
                        id    SERIAL PRIMARY KEY,
                        name  TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE
                    )
                ]])
            end)

            down(function(db)
                db:execute("DROP TABLE IF EXISTS users")
            end)
        end)
    end)
end)
```

### Metadados Obrigatórios

| Campo | Obrigatório | Descrição |
|-------|----------|-------------|
| `meta.type` | sim | Deve ser `"migration"` para descoberta |
| `meta.target_db` | sim | ID no registro do banco de dados a ser executado |
| `meta.timestamp` | não | Timestamp ISO-8601 usado para ordenação quando várias migrações alvejam o mesmo banco |
| `meta.tags` | não | Array de tags; o executor pode filtrar migrações por tag |

As migrações de um banco rodam em ordem crescente de `meta.timestamp`. `meta.timestamp` é opcional; o id completo da entrada é o critério de desempate, então migrações com timestamps iguais ou ausentes ainda rodam em uma ordem estável e determinística.

## DSL

Dentro da função passada para `migration.define`, as seguintes funções aninhadas estão disponíveis:

| Função | Descrição |
|----------|-------------|
| `migration(description, fn)` | Abre uma nova migração com uma descrição legível |
| `database(type, fn)` | Declara uma implementação para `"sqlite"`, `"postgres"` ou `"mysql"` |
| `up(fn)` / `down(fn)` | Define funções de avanço e reversão |
| `after(fn)` | Hook opcional pós-migração (mesma transação) |

Cada função `up`/`down`/`after` recebe um objeto de transação, não uma conexão bruta. Todas as três operações rodam em uma única transação que faz rollback em caso de erro.

### Métodos da Transação

```lua
local rows, err  = db:query(sql, params)    -- SELECT, retorna array de linhas
local result, err = db:execute(sql, params) -- INSERT/UPDATE/DDL, retorna { rows_affected, last_insert_id }
local stmt, err  = db:prepare(sql)          -- prepared statement
```

Sempre use consultas parametrizadas:

```lua
db:execute("INSERT INTO users (name, email) VALUES (?, ?)", { "Alice", "alice@example.com" })
```

### Tratamento de Erros

Chamar `error(...)` aborta a migração e faz rollback da transação. Envolva toda instrução que possa falhar:

```lua
up(function(db)
    local _, err = db:execute("CREATE TABLE ...")
    if err then error(err) end
end)
```

## API do Executor

O executor é exposto como biblioteca para uso programático:

```yaml
imports:
  runner: wippy.migration:runner
```

```lua
local runner = require("runner").setup("app:app_db")

local result = runner:run()      -- aplica todas as migrações pendentes
local result = runner:run_next() -- aplica a próxima migração pendente
local result = runner:rollback() -- reverte a migração aplicada mais recentemente
local status = runner:status()   -- lista migrações aplicadas + pendentes
```

### `runner:run(options)`

Aplica toda migração pendente para o banco de dados configurado. Retorna um resumo:

```lua
{
    status = "complete",            -- "complete" ou "error"
    migrations_found = 3,
    migrations_applied = 2,
    migrations_skipped = 1,
    migrations_failed = 0,
    duration = 0.123,
    migrations = { ... },           -- status por migração
    skipped_details = { ... },
}
```

Opções:

| Opção | Descrição |
|--------|-------------|
| `tags` | Array de tags; apenas migrações cujo `meta.tags` possui interseção são consideradas |

### `runner:rollback(options)`

Reverte migrações aplicadas na ordem inversa da aplicação. Sem opções, reverte apenas a migração aplicada mais recentemente:

```lua
runner:rollback()                                            -- reverte a última migração
runner:rollback({ count = 3 })                               -- reverte as últimas 3
runner:rollback({ allowed_ids = { "app:01_create_users_table" } }) -- restringe a ids específicos
```

Opções:

| Opção | Descrição |
|--------|-------------|
| `count` | Número de migrações a reverter; padrão `1` |
| `allowed_ids` | Array de ids de migração; apenas estes são elegíveis para rollback |

### `runner:status(options)`

Retorna um relatório de status descrevendo cada migração do banco de dados:

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

As migrações aplicadas são listadas primeiro (ordenadas por `applied_at`), seguidas pelas pendentes (ordenadas por `meta.timestamp` e depois por id).

## API do Registro

`wippy.migration:registry` oferece consultas diretas ao registro:

| Função | Descrição |
|----------|-------------|
| `registry.find({ target_db, tags })` | Retorna todas as entradas de migração que atendem aos critérios |
| `registry.get(id)` | Retorna uma única entrada de migração pelo id |
| `registry.get_target_dbs()` | Retorna cada `meta.target_db` único presente nas migrações |
| `registry.get_tags()` | Retorna cada tag única presente nas migrações |

O bootloader usa essas funções para descobrir o conjunto completo de bancos alvo na inicialização.

## Rastreamento de Migrações

O executor cria uma tabela `_migrations` em cada banco alvo na primeira execução. Migrações aplicadas são registradas por id, para que execuções subsequentes as pulem. A tabela de rastreamento é criada automaticamente; não escreva sua própria migração para criá-la.

## Boas Práticas

- **Uma mudança lógica por migração** - crie uma tabela, adicione uma coluna, crie um índice.
- **Escreva um `down` de verdade** - se o rollback for impossível (perda de dados), documente isso e lance um erro em vez de ter sucesso silenciosamente.
- **Prefira idempotência** - `CREATE TABLE IF NOT EXISTS` e `DROP TABLE IF EXISTS` sobrevivem a reexecuções sem tratamento especial.
- **Mantenha DDL e DML separados** - evite popular dados na mesma migração que cria uma tabela, quando possível.
- **Teste as duas direções** - aplique a migração, reverta, e verifique que o schema corresponde ao estado inicial.

## Veja Também

- [Driver SQL](system/database.md) - Configuração de recurso de banco de dados
- [Bootloader](framework/bootloader.md) - Ordenação e hooks do bootloader
- [Visão Geral do Framework](framework/overview.md) - Uso dos módulos do framework
