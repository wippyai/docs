# Migracoes

O modulo `wippy/migration` fornece um framework de migracoes de banco de dados com uma pequena DSL para definir alteracoes de schema, um executor que descobre e executa as migracoes, e um bootloader que roda migracoes pendentes para cada `target_db` registrado no projeto.

As migracoes suportam SQLite, PostgreSQL e MySQL, com implementacoes `up`/`down` por driver definidas lado a lado.

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
    path: ./data/app.db

  - name: dep.migration
    kind: ns.dependency
    component: wippy/migration
    version: "*"
```

O bootloader de migracoes se registra em `wippy/bootloader` na ordem `20`. Quando a aplicacao inicia, ele descobre cada entrada de migracao no registro, agrupa-as por `meta.target_db` e executa as migracoes pendentes em cada banco de dados.

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

### Metadados Obrigatorios

| Campo | Obrigatorio | Descricao |
|-------|----------|-------------|
| `meta.type` | sim | Deve ser `"migration"` para descoberta |
| `meta.target_db` | sim | ID no registro do banco de dados a ser executado |
| `meta.timestamp` | nao | Timestamp ISO-8601 usado para ordenacao quando varias migracoes alvejam o mesmo banco |
| `meta.tags` | nao | Array de tags; o executor pode filtrar migracoes por tag |

As migracoes de um banco rodam em ordem crescente de `meta.timestamp`.

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
local result = runner:rollback({ id = "app:01_create_users_table" })
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

Reverte uma unica migracao pelo id (obrigatorio):

```lua
runner:rollback({ id = "app:01_create_users_table" })
```

### `runner:status(options)`

Retorna `{ applied = {...}, pending = {...} }`, ordenados por `applied_at` e `meta.timestamp` respectivamente.

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

O executor cria uma tabela `wippy_migrations` em cada banco alvo na primeira execucao. Migracoes aplicadas sao registradas por id, para que execucoes subsequentes as pulem. A tabela de rastreamento e criada automaticamente; nao escreva sua propria migracao para cria-la.

## Boas Praticas

- **Uma mudanca logica por migracao** - crie uma tabela, adicione uma coluna, crie um indice.
- **Escreva um `down` de verdade** - se o rollback for impossivel (perda de dados), documente isso e lance um erro em vez de ter sucesso silenciosamente.
- **Prefira idempotencia** - `CREATE TABLE IF NOT EXISTS` e `DROP TABLE IF EXISTS` sobrevivem a reexecucoes sem tratamento especial.
- **Mantenha DDL e DML separados** - evite popular dados na mesma migracao que cria uma tabela, quando possivel.
- **Teste as duas direcoes** - aplique a migracao, reverta, e verifique que o schema corresponde ao estado inicial.

## Veja Tambem

- [Driver SQL](system/database.md) - Configuracao de recurso de banco de dados
- [Bootloader](framework/bootloader.md) - Ordenacao e hooks do bootloader
- [Visao Geral do Framework](framework/overview.md) - Uso dos modulos do framework
