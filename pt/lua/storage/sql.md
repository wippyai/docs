# Banco de Dados SQL
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Execute queries SQL em bancos de dados PostgreSQL, MySQL, SQLite, MSSQL e Oracle. Recursos incluem queries parametrizadas, transacoes, prepared statements e um query builder fluente.

Para configuração de banco de dados, veja [Database](system-database.md).

## Carregamento

```lua
local sql = require("sql")
```

## Obtendo uma Conexão

Obter uma conexão de banco de dados do registry de recursos:

```lua
local db, err = sql.get("app.db:main")
if err then
    return nil, err
end

local rows = db:query("SELECT * FROM users WHERE active = ?", {1})

db:release()
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string | ID do recurso (ex: "app.db:main") |

**Retorna:** `DB, error`

<note>
Conexoes sao automaticamente retornadas ao pool quando a função termina, mas chamar `db:release()` explicitamente e recomendado para operações de longa duração.
</note>

## Constantes

### Tipos de Banco de Dados

```lua
sql.type.POSTGRES    -- "postgres"
sql.type.MYSQL       -- "mysql"
sql.type.SQLITE      -- "sqlite"
sql.type.MSSQL       -- "mssql"
sql.type.ORACLE      -- "oracle"
sql.type.UNKNOWN     -- "unknown"
```

### Niveis de Isolamento

```lua
sql.isolation.DEFAULT           -- "default"
sql.isolation.READ_UNCOMMITTED  -- "read_uncommitted"
sql.isolation.READ_COMMITTED    -- "read_committed"
sql.isolation.WRITE_COMMITTED   -- "write_committed"
sql.isolation.REPEATABLE_READ   -- "repeatable_read"
sql.isolation.SERIALIZABLE      -- "serializable"
```

### Valor NULL

```lua
local insert = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", sql.NULL)
```

## Coercao de Tipos

### as.int

```lua
local value = sql.as.int(42)
```

**Retorna:** `userdata`

## as.float

Coerce valor para tipo SQL float.

```lua
local value = sql.as.float(19.99)
```

**Retorna:** `userdata`

## as.text

Coerce valor para tipo SQL text.

```lua
local value = sql.as.text("hello")
```

**Retorna:** `userdata`

## as.binary

Coerce valor para tipo SQL binary.

```lua
local value = sql.as.binary("binary data")
```

**Retorna:** `userdata`

## as.null

Retorna marcador SQL NULL.

```lua
local value = sql.as.null()
```

**Retorna:** `userdata`

## Query Builder

### Criando Queries

```lua
local query = sql.builder.select("id", "name")
    :from("users")
    :where({active = 1})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `columns` | ...string | Nomes das colunas (opcional) |

**Retorna:** `SelectBuilder`

## builder.insert

Cria query builder de INSERT.

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `table` | string | Nome da tabela (opcional) |

**Retorna:** `InsertBuilder`

## builder.update

Cria query builder de UPDATE.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `table` | string | Nome da tabela (opcional) |

**Retorna:** `UpdateBuilder`

## builder.delete

Cria query builder de DELETE.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `table` | string | Nome da tabela (opcional) |

**Retorna:** `DeleteBuilder`

## builder.expr

Cria expressao SQL raw para uso em clausulas where/having.

```lua
local expr = sql.builder.expr("score BETWEEN ? AND ?", 80, 90)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `sql` | string | Expressao SQL com placeholders ? |
| `args` | ...any | Argumentos de bind (opcional) |

**Retorna:** `Sqlizer`

## builder.eq

Cria condição de igualdade de tabela.

```lua
local cond = sql.builder.eq({active = 1, status = "open"})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `map` | table | Pares {coluna = valor} |

**Retorna:** `Sqlizer`

## builder.not_eq

Cria condição de desigualdade de tabela.

```lua
local cond = sql.builder.not_eq({status = "closed"})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `map` | table | Pares {coluna = valor} |

**Retorna:** `Sqlizer`

## builder.lt

Cria condição menor-que de tabela.

```lua
local cond = sql.builder.lt({age = 18})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `map` | table | Pares {coluna = valor} |

**Retorna:** `Sqlizer`

## builder.lte

Cria condição menor-ou-igual de tabela.

```lua
local cond = sql.builder.lte({price = 100})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `map` | table | Pares {coluna = valor} |

**Retorna:** `Sqlizer`

## builder.gt

Cria condição maior-que de tabela.

```lua
local cond = sql.builder.gt({score = 80})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `map` | table | Pares {coluna = valor} |

**Retorna:** `Sqlizer`

## builder.gte

Cria condição maior-ou-igual de tabela.

```lua
local cond = sql.builder.gte({age = 21})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `map` | table | Pares {coluna = valor} |

**Retorna:** `Sqlizer`

## builder.like

Cria condição LIKE de tabela.

```lua
local cond = sql.builder.like({name = "john%"})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `map` | table | Pares {coluna = valor} |

**Retorna:** `Sqlizer`

## builder.not_like

Cria condição NOT LIKE de tabela.

```lua
local cond = sql.builder.not_like({email = "%@spam.com"})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `map` | table | Pares {coluna = valor} |

**Retorna:** `Sqlizer`

## builder.and_

Combina multiplas condicoes com AND.

```lua
local cond = sql.builder.and_({
    sql.builder.eq({active = 1}),
    sql.builder.gt({score = 80})
})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `conditions` | table | Array de condicoes Sqlizer ou table |

**Retorna:** `Sqlizer`

## builder.or_

Combina multiplas condicoes com OR.

```lua
local cond = sql.builder.or_({
    sql.builder.eq({status = "pending"}),
    sql.builder.eq({status = "active"})
})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `conditions` | table | Array de condicoes Sqlizer ou table |

**Retorna:** `Sqlizer`

## builder.question

Formato de placeholder para placeholders ? (padrão).

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.question)
```

## builder.dollar

Formato de placeholder para placeholders $1, $2, ...

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

## builder.at

Formato de placeholder para placeholders @p1, @p2, ...

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.at)
```

## builder.colon

Formato de placeholder para placeholders :1, :2, ...

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.colon)
```

## Métodos de Conexão

Handle de conexão de banco de dados retornado por `sql.get()`.

### db:type

Retorna constante de tipo de banco de dados.

```lua
local dbtype, err = db:type()
```

**Retorna:** `string, error`

### db:query

Executa query SELECT e retorna linhas.

```lua
local rows, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `sql` | string | Query SQL com placeholders ? |
| `params` | table | Array de parametros de bind (opcional) |

**Retorna:** `table[], error`

### db:execute

Executa query INSERT/UPDATE/DELETE.

```lua
local result, err = db:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `sql` | string | Statement SQL com placeholders ? |
| `params` | table | Array de parametros de bind (opcional) |

**Retorna:** `table, error`

Retorna tabela com campos:
- `last_insert_id` - Ultimo ID inserido
- `rows_affected` - Numero de linhas afetadas

### db:prepare

Cria prepared statement para execução repetida.

```lua
local stmt, err = db:prepare("SELECT * FROM users WHERE id = ?")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `sql` | string | SQL com placeholders ? |

**Retorna:** `Statement, error`

### db:begin

Inicia transação de banco de dados.

```lua
local tx, err = db:begin({
    isolation = sql.isolation.SERIALIZABLE,
    read_only = false
})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `options` | table | Opções de transação (opcional) |

Campos da tabela de opções:
- `isolation` - Nivel de isolamento de sql.isolation.* (padrão: DEFAULT)
- `read_only` - Flag de transação somente leitura (padrão: false)

**Retorna:** `Transaction, error`

### db:release

Libera recurso de banco de dados de volta ao pool.

```lua
local ok, err = db:release()
```

**Retorna:** `boolean, error`

### db:stats

Retorna estatisticas do pool de conexoes.

```lua
local stats, err = db:stats()
```

**Retorna:** `table, error`

Retorna tabela com campos:
- `max_open_connections` - Max conexoes abertas permitidas
- `open_connections` - Conexoes abertas atuais
- `in_use` - Conexoes em uso atualmente
- `idle` - Conexoes ociosas no pool
- `wait_count` - Contagem total de espera por conexão
- `wait_duration` - Duração total de espera
- `max_idle_closed` - Conexoes fechadas por max idle
- `max_idle_time_closed` - Conexoes fechadas por timeout de idle
- `max_lifetime_closed` - Conexoes fechadas por max lifetime

## Prepared Statements

Prepared statement retornado por `db:prepare()`.

### stmt:query

Executa prepared statement como SELECT.

```lua
local rows, err = stmt:query({123})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `params` | table | Array de parametros de bind (opcional) |

**Retorna:** `table[], error`

### stmt:execute

Executa prepared statement como INSERT/UPDATE/DELETE.

```lua
local result, err = stmt:execute({"alice"})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `params` | table | Array de parametros de bind (opcional) |

**Retorna:** `table, error`

Retorna tabela com campos:
- `last_insert_id` - Ultimo ID inserido
- `rows_affected` - Numero de linhas afetadas

### stmt:close

Fecha prepared statement.

```lua
local ok, err = stmt:close()
```

**Retorna:** `boolean, error`

## Transacoes

Transação de banco de dados retornada por `db:begin()`.

### tx:db_type

Retorna constante de tipo de banco de dados.

```lua
local dbtype, err = tx:db_type()
```

**Retorna:** `string, error`

### tx:query

Executa query SELECT dentro da transação.

```lua
local rows, err = tx:query("SELECT id, name FROM users WHERE active = ?", {1})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `sql` | string | Query SQL com placeholders ? |
| `params` | table | Array de parametros de bind (opcional) |

**Retorna:** `table[], error`

### tx:execute

Executa INSERT/UPDATE/DELETE dentro da transação.

```lua
local result, err = tx:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `sql` | string | Statement SQL com placeholders ? |
| `params` | table | Array de parametros de bind (opcional) |

**Retorna:** `table, error`

Retorna tabela com campos:
- `last_insert_id` - Ultimo ID inserido
- `rows_affected` - Numero de linhas afetadas

### tx:prepare

Cria prepared statement dentro da transação.

```lua
local stmt, err = tx:prepare("SELECT * FROM users WHERE id = ?")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `sql` | string | SQL com placeholders ? |

**Retorna:** `Statement, error`

### tx:commit

Commita transação.

```lua
local ok, err = tx:commit()
```

**Retorna:** `boolean, error`

### tx:rollback

Faz rollback da transação.

```lua
local ok, err = tx:rollback()
```

**Retorna:** `boolean, error`

### tx:savepoint

Cria savepoint nomeado dentro da transação.

```lua
local ok, err = tx:savepoint("sp1")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome do savepoint (apenas alfanumerico e underscore) |

**Retorna:** `boolean, error`

### tx:rollback_to

Faz rollback para savepoint nomeado.

```lua
local ok, err = tx:rollback_to("sp1")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome do savepoint |

**Retorna:** `boolean, error`

### tx:release

Libera savepoint.

```lua
local ok, err = tx:release("sp1")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome do savepoint |

**Retorna:** `boolean, error`

## SELECT Builder

Interface fluente para construir queries SELECT.

### select:from

Define clausula FROM.

```lua
local query = sql.builder.select("id", "name"):from("users")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `table` | string | Nome da tabela |

**Retorna:** `SelectBuilder`

### select:join

Adiciona clausula JOIN.

```lua
local query = sql.builder.select("*")
    :from("users")
    :join("orders ON orders.user_id = users.id")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `join` | string | Clausula JOIN com placeholders ? |
| `args` | ...any | Argumentos de bind (opcional) |

**Retorna:** `SelectBuilder`

### select:left_join

Adiciona clausula LEFT JOIN.

```lua
local query = sql.builder.select("*")
    :from("users")
    :left_join("orders ON orders.user_id = users.id")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `join` | string | Clausula JOIN com placeholders ? |
| `args` | ...any | Argumentos de bind (opcional) |

**Retorna:** `SelectBuilder`

### select:right_join

Adiciona clausula RIGHT JOIN.

```lua
local query = sql.builder.select("*")
    :from("users")
    :right_join("orders ON orders.user_id = users.id")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `join` | string | Clausula JOIN com placeholders ? |
| `args` | ...any | Argumentos de bind (opcional) |

**Retorna:** `SelectBuilder`

### select:inner_join

Adiciona clausula INNER JOIN.

```lua
local query = sql.builder.select("*")
    :from("users")
    :inner_join("orders ON orders.user_id = users.id")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `join` | string | Clausula JOIN com placeholders ? |
| `args` | ...any | Argumentos de bind (opcional) |

**Retorna:** `SelectBuilder`

### select:where

Adiciona condição WHERE.

```lua
local query = sql.builder.select("*")
    :from("users")
    :where({active = 1})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `condition` | string\|table\|Sqlizer | Condição WHERE |
| `args` | ...any | Argumentos de bind (opcional, quando usando string) |

Suporta tres formatos:
- String: `where("status = ?", "active")`
- Table: `where({status = "active"})`
- Sqlizer: `where(sql.builder.gt({score = 80}))`

**Retorna:** `SelectBuilder`

### select:order_by

Adiciona clausula ORDER BY.

```lua
local query = sql.builder.select("*")
    :from("users")
    :order_by("name ASC", "created_at DESC")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `columns` | ...string | Nomes de colunas com ASC/DESC opcional |

**Retorna:** `SelectBuilder`

### select:group_by

Adiciona clausula GROUP BY.

```lua
local query = sql.builder.select("status", "COUNT(*)")
    :from("users")
    :group_by("status")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `columns` | ...string | Nomes das colunas |

**Retorna:** `SelectBuilder`

### select:having

Adiciona condição HAVING.

```lua
local query = sql.builder.select("status", "COUNT(*) as cnt")
    :from("users")
    :group_by("status")
    :having(sql.builder.gt({cnt = 10}))
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `condition` | string\|table\|Sqlizer | Condição HAVING |
| `args` | ...any | Argumentos de bind (opcional, quando usando string) |

**Retorna:** `SelectBuilder`

### select:limit

Define LIMIT.

```lua
local query = sql.builder.select("*")
    :from("users")
    :limit(10)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `n` | integer | Valor de limit |

**Retorna:** `SelectBuilder`

### select:offset

Define OFFSET.

```lua
local query = sql.builder.select("*")
    :from("users")
    :offset(20)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `n` | integer | Valor de offset |

**Retorna:** `SelectBuilder`

### select:columns

Adiciona colunas ao SELECT.

```lua
local query = sql.builder.select():columns("id", "name", "email")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `columns` | ...string | Nomes das colunas |

**Retorna:** `SelectBuilder`

### select:distinct

Adiciona modificador DISTINCT.

```lua
local query = sql.builder.select("status")
    :from("users")
    :distinct()
```

**Retorna:** `SelectBuilder`

### select:suffix

Adiciona sufixo SQL.

```lua
local query = sql.builder.select("*")
    :from("users")
    :suffix("FOR UPDATE")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `sql` | string | Sufixo SQL com placeholders ? |
| `args` | ...any | Argumentos de bind (opcional) |

**Retorna:** `SelectBuilder`

### select:placeholder_format

Define formato de placeholder.

```lua
local query = sql.builder.select("*")
    :from("users")
    :placeholder_format(sql.builder.dollar)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `format` | userdata | Formato de placeholder (sql.builder.*) |

**Retorna:** `SelectBuilder`

### select:to_sql

Gera string SQL e argumentos de bind.

```lua
local sql_str, args = query:to_sql()
```

**Retorna:** `string, table`

### select:run_with

Cria executor para query.

```lua
local executor = query:run_with(db)
local rows, err = executor:query()
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `db` | DB\|Transaction | Handle de banco de dados ou transação |

**Retorna:** `QueryExecutor`

## INSERT Builder

Interface fluente para construir queries INSERT.

### insert:into

Define nome da tabela.

```lua
local query = sql.builder.insert():into("users")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `table` | string | Nome da tabela |

**Retorna:** `InsertBuilder`

### insert:columns

Define nomes das colunas.

```lua
local query = sql.builder.insert("users"):columns("name", "email")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `columns` | ...string | Nomes das colunas |

**Retorna:** `InsertBuilder`

### insert:values

Adiciona valores de linha.

```lua
local query = sql.builder.insert("users")
    :columns("name", "email")
    :values("alice", "alice@example.com")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `values` | ...any | Valores da linha |

**Retorna:** `InsertBuilder`

### insert:set_map

Define colunas e valores de tabela.

```lua
local query = sql.builder.insert("users")
    :set_map({name = "alice", email = "alice@example.com"})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `map` | table | Pares {coluna = valor} |

**Retorna:** `InsertBuilder`

### insert:select

Insere de query SELECT.

```lua
local select_query = sql.builder.select("name", "email"):from("temp_users")
local query = sql.builder.insert("users")
    :columns("name", "email")
    :select(select_query)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `query` | SelectBuilder | Query SELECT |

**Retorna:** `InsertBuilder`

### insert:prefix

Adiciona prefixo SQL.

```lua
local query = sql.builder.insert("users")
    :prefix("INSERT IGNORE INTO")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `sql` | string | Prefixo SQL com placeholders ? |
| `args` | ...any | Argumentos de bind (opcional) |

**Retorna:** `InsertBuilder`

### insert:suffix

Adiciona sufixo SQL.

```lua
local query = sql.builder.insert("users")
    :columns("name")
    :values("alice")
    :suffix("RETURNING id")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `sql` | string | Sufixo SQL com placeholders ? |
| `args` | ...any | Argumentos de bind (opcional) |

**Retorna:** `InsertBuilder`

### insert:options

Adiciona opções de INSERT.

```lua
local query = sql.builder.insert("users")
    :options("DELAYED", "IGNORE")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `options` | ...string | Opções de INSERT |

**Retorna:** `InsertBuilder`

### insert:placeholder_format

Define formato de placeholder.

```lua
local query = sql.builder.insert("users")
    :placeholder_format(sql.builder.dollar)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `format` | userdata | Formato de placeholder (sql.builder.*) |

**Retorna:** `InsertBuilder`

### insert:to_sql

Gera string SQL e argumentos de bind.

```lua
local sql_str, args = query:to_sql()
```

**Retorna:** `string, table`

### insert:run_with

Cria executor para query.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `db` | DB\|Transaction | Handle de banco de dados ou transação |

**Retorna:** `QueryExecutor`

## UPDATE Builder

Interface fluente para construir queries UPDATE.

### update:table

Define nome da tabela.

```lua
local query = sql.builder.update():table("users")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `table` | string | Nome da tabela |

**Retorna:** `UpdateBuilder`

### update:set

Define valor de coluna.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :set("updated_at", sql.builder.expr("NOW()"))
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `column` | string | Nome da coluna |
| `value` | any | Valor da coluna |

**Retorna:** `UpdateBuilder`

### update:set_map

Define multiplas colunas de tabela.

```lua
local query = sql.builder.update("users")
    :set_map({status = "active", updated_at = sql.builder.expr("NOW()")})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `map` | table | Pares {coluna = valor} |

**Retorna:** `UpdateBuilder`

### update:where

Adiciona condição WHERE.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :where({id = 123})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `condition` | string\|table\|Sqlizer | Condição WHERE |
| `args` | ...any | Argumentos de bind (opcional, quando usando string) |

**Retorna:** `UpdateBuilder`

### update:order_by

Adiciona clausula ORDER BY.

```lua
local query = sql.builder.update("users")
    :set("rank", 1)
    :order_by("score DESC")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `columns` | ...string | Nomes de colunas com ASC/DESC opcional |

**Retorna:** `UpdateBuilder`

### update:limit

Define LIMIT.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :limit(10)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `n` | integer | Valor de limit |

**Retorna:** `UpdateBuilder`

### update:offset

Define OFFSET.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :offset(5)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `n` | integer | Valor de offset |

**Retorna:** `UpdateBuilder`

### update:suffix

Adiciona sufixo SQL.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :suffix("RETURNING id")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `sql` | string | Sufixo SQL com placeholders ? |
| `args` | ...any | Argumentos de bind (opcional) |

**Retorna:** `UpdateBuilder`

### update:from

Adiciona clausula FROM.

```lua
local query = sql.builder.update("users")
    :set("status", "active")
    :from("other_table")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `table` | string | Nome da tabela |

**Retorna:** `UpdateBuilder`

### update:from_select

Update de query SELECT.

```lua
local select_query = sql.builder.select("*"):from("temp_users")
local query = sql.builder.update("users")
    :set("status", "active")
    :from_select(select_query, "t")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `query` | SelectBuilder | Query SELECT |
| `alias` | string | Alias da tabela |

**Retorna:** `UpdateBuilder`

### update:placeholder_format

Define formato de placeholder.

```lua
local query = sql.builder.update("users")
    :placeholder_format(sql.builder.dollar)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `format` | userdata | Formato de placeholder (sql.builder.*) |

**Retorna:** `UpdateBuilder`

### update:to_sql

Gera string SQL e argumentos de bind.

```lua
local sql_str, args = query:to_sql()
```

**Retorna:** `string, table`

### update:run_with

Cria executor para query.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `db` | DB\|Transaction | Handle de banco de dados ou transação |

**Retorna:** `QueryExecutor`

## DELETE Builder

Interface fluente para construir queries DELETE.

### delete:from

Define nome da tabela.

```lua
local query = sql.builder.delete():from("users")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `table` | string | Nome da tabela |

**Retorna:** `DeleteBuilder`

### delete:where

Adiciona condição WHERE.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `condition` | string\|table\|Sqlizer | Condição WHERE |
| `args` | ...any | Argumentos de bind (opcional, quando usando string) |

**Retorna:** `DeleteBuilder`

### delete:order_by

Adiciona clausula ORDER BY.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :order_by("created_at ASC")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `columns` | ...string | Nomes de colunas com ASC/DESC opcional |

**Retorna:** `DeleteBuilder`

### delete:limit

Define LIMIT.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :limit(100)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `n` | integer | Valor de limit |

**Retorna:** `DeleteBuilder`

### delete:offset

Define OFFSET.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :offset(10)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `n` | integer | Valor de offset |

**Retorna:** `DeleteBuilder`

### delete:suffix

Adiciona sufixo SQL.

```lua
local query = sql.builder.delete("users")
    :where({active = 0})
    :suffix("RETURNING id")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `sql` | string | Sufixo SQL com placeholders ? |
| `args` | ...any | Argumentos de bind (opcional) |

**Retorna:** `DeleteBuilder`

### delete:placeholder_format

Define formato de placeholder.

```lua
local query = sql.builder.delete("users")
    :placeholder_format(sql.builder.dollar)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `format` | userdata | Formato de placeholder (sql.builder.*) |

**Retorna:** `DeleteBuilder`

### delete:to_sql

Gera string SQL e argumentos de bind.

```lua
local sql_str, args = query:to_sql()
```

**Retorna:** `string, table`

### delete:run_with

Cria executor para query.

```lua
local executor = query:run_with(db)
local result, err = executor:exec()
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `db` | DB\|Transaction | Handle de banco de dados ou transação |

**Retorna:** `QueryExecutor`

## Executando Queries

O query executor executa queries geradas pelo builder.

### executor:query

Executa query e retorna linhas (para SELECT).

```lua
local rows, err = executor:query()
```

**Retorna:** `table[], error`

### executor:exec

Executa query e retorna resultado (para INSERT/UPDATE/DELETE).

```lua
local result, err = executor:exec()
```

**Retorna:** `table, error`

Retorna tabela com campos:
- `last_insert_id` - Ultimo ID inserido
- `rows_affected` - Numero de linhas afetadas

### executor:to_sql

Retorna SQL gerado e argumentos sem executar.

```lua
local sql_str, args = executor:to_sql()
```

**Retorna:** `string, table`

## Permissões

Acesso a banco de dados está sujeito a avaliação de política de segurança.

| Ação | Recurso | Descrição |
|------|---------|-----------|
| `db.get` | ID do Database | Obter conexão de banco de dados |

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| ID de recurso vazio | `errors.INVALID` | não |
| Permissão negada | `errors.PERMISSION_DENIED` | não |
| Recurso não encontrado | `errors.NOT_FOUND` | não |
| Recurso não e database | `errors.INVALID` | não |
| Parametros inválidos | `errors.INVALID` | não |
| Erro de sintaxe SQL | `errors.INVALID` | não |
| Statement fechado | `errors.INVALID` | não |
| Transação não ativa | `errors.INVALID` | não |
| Nome de savepoint inválido | `errors.INVALID` | não |
| Erro de execução de query | varia | varia |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.

## Exemplo

```lua
local sql = require("sql")

-- Obter conexão de banco de dados
local db, err = sql.get("app.db:main")
if err then error(err) end

-- Verificar tipo de banco de dados
local dbtype, _ = db:type()
print("Tipo de banco de dados:", dbtype)

-- Query direta
local users, err = db:query("SELECT id, name FROM users WHERE active = ?", {1})
if err then error(err) end

for _, user in ipairs(users) do
    print(user.id, user.name)
end

-- Padrão builder
local query = sql.builder.select("u.id", "u.name", "COUNT(o.id) as order_count")
    :from("users u")
    :left_join("orders o ON o.user_id = u.id")
    :where(sql.builder.and_({
        sql.builder.eq({["u.active"] = 1}),
        sql.builder.gte({["u.score"] = 80})
    }))
    :group_by("u.id", "u.name")
    :having(sql.builder.gt({["COUNT(o.id)"] = 0}))
    :order_by("order_count DESC")
    :limit(10)

local executor = query:run_with(db)
local results, err = executor:query()
if err then error(err) end

-- Transação com savepoints
local tx, err = db:begin({isolation = sql.isolation.SERIALIZABLE})
if err then error(err) end

local _, err = tx:execute("INSERT INTO users (name) VALUES (?)", {"alice"})
if err then
    tx:rollback()
    error(err)
end

tx:savepoint("sp1")

local _, err = tx:execute("UPDATE users SET status = ? WHERE id = ?", {"active", 1})
if err then
    tx:rollback_to("sp1")
else
    tx:release("sp1")
end

local ok, err = tx:commit()
if err then error(err) end

-- Prepared statements
local stmt, err = db:prepare("INSERT INTO logs (message, level) VALUES (?, ?)")
if err then error(err) end

for i = 1, 100 do
    local _, err = stmt:execute({"log message " .. i, "info"})
    if err then
        stmt:close()
        error(err)
    end
end

stmt:close()

-- NULL e valores tipados
local insert = sql.builder.insert("products")
    :columns("name", "price", "description")
    :values("Widget", sql.as.float(19.99), sql.NULL)

local executor = insert:run_with(db)
local result, err = executor:exec()
if err then error(err) end

print("ID inserido:", result.last_insert_id)

db:release()
```
