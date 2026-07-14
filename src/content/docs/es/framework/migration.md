---
title: "Migraciones"
description: "El modulo wippy/migration proporciona un framework de migracion de bases de datos con un pequeno DSL para definir cambios de esquema, un runner que las…"
---

# Migraciones

El modulo `wippy/migration` proporciona un framework de migracion de bases de datos con un pequeno DSL para definir cambios de esquema, un runner que las descubre y ejecuta, y un bootloader que ejecuta las migraciones pendientes para cada `target_db` registrado en el proyecto.

Las migraciones soportan SQLite, PostgreSQL y MySQL, con implementaciones `up`/`down` por driver definidas lado a lado.

## Configuracion

Agrega el modulo a tu proyecto:

```bash
wippy add wippy/migration
wippy install
```

Declara la dependencia y la base de datos de la aplicacion a la que se dirigen las migraciones:

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

El bootloader de migracion se registra con `wippy/bootloader` en el orden `20`. Cuando la aplicacion inicia, descubre cada entrada de migracion en el registro, las agrupa por `meta.target_db` y ejecuta las migraciones pendientes contra cada base de datos.

## Definir una Migracion

Una migracion es una entrada `function.lua` con `meta.type: migration`. La entrada retorna una funcion producida por `migration.define(...)`.

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

### Metadatos Requeridos

| Campo | Requerido | Descripcion |
|-------|-----------|-------------|
| `meta.type` | si | Debe ser `"migration"` para el descubrimiento |
| `meta.target_db` | si | ID de registro de la base de datos contra la que ejecutar |
| `meta.timestamp` | no | Marca de tiempo ISO-8601 usada para ordenar cuando multiples migraciones apuntan a la misma base de datos |
| `meta.tags` | no | Array de etiquetas; el runner puede filtrar migraciones por etiqueta |

Las migraciones para una base de datos se ejecutan en orden ascendente de `meta.timestamp`.

## DSL

Dentro de la funcion pasada a `migration.define`, hay tres funciones anidadas disponibles:

| Funcion | Descripcion |
|---------|-------------|
| `migration(description, fn)` | Abrir una nueva migracion con una descripcion legible |
| `database(type, fn)` | Declarar una implementacion para `"sqlite"`, `"postgres"` o `"mysql"` |
| `up(fn)` / `down(fn)` | Definir funciones de avance y reversion |
| `after(fn)` | Hook opcional post-migracion (misma transaccion) |

Cada funcion `up`/`down`/`after` recibe un objeto de transaccion, no una conexion cruda. Las tres operaciones se ejecutan en una sola transaccion que se revierte en caso de error.

### Metodos de Transaccion

```lua
local rows, err  = db:query(sql, params)    -- SELECT, retorna array de filas
local result, err = db:execute(sql, params) -- INSERT/UPDATE/DDL, retorna { rows_affected, last_insert_id }
local stmt, err  = db:prepare(sql)          -- sentencia preparada
```

Usa siempre consultas parametrizadas:

```lua
db:execute("INSERT INTO users (name, email) VALUES (?, ?)", { "Alice", "alice@example.com" })
```

### Manejo de Errores

Llamar a `error(...)` aborta la migracion y revierte la transaccion. Envuelve cada sentencia que pueda fallar:

```lua
up(function(db)
    local _, err = db:execute("CREATE TABLE ...")
    if err then error(err) end
end)
```

## API del Runner

El runner se expone como una biblioteca para uso programatico:

```yaml
imports:
  runner: wippy.migration:runner
```

```lua
local runner = require("runner").setup("app:app_db")

local result = runner:run()      -- aplicar todas las migraciones pendientes
local result = runner:run_next() -- aplicar la siguiente migracion pendiente
local result = runner:rollback({ id = "app:01_create_users_table" })
local status = runner:status()   -- listar migraciones aplicadas + pendientes
```

### `runner:run(options)`

Aplica cada migracion pendiente para la base de datos configurada. Retorna un resumen:

```lua
{
    status = "complete",            -- "complete" o "error"
    migrations_found = 3,
    migrations_applied = 2,
    migrations_skipped = 1,
    migrations_failed = 0,
    duration = 0.123,
    migrations = { ... },           -- estado por migracion
    skipped_details = { ... },
}
```

Opciones:

| Opcion | Descripcion |
|--------|-------------|
| `tags` | Array de etiquetas; solo se consideran las migraciones cuyos `meta.tags` se intersecten |

### `runner:rollback(options)`

Revierte una sola migracion por id (requerido):

```lua
runner:rollback({ id = "app:01_create_users_table" })
```

### `runner:status(options)`

Retorna `{ applied = {...}, pending = {...} }`, ordenado por `applied_at` y `meta.timestamp` respectivamente.

## API de Registry

`wippy.migration:registry` ofrece consultas directas al registro:

| Funcion | Descripcion |
|---------|-------------|
| `registry.find({ target_db, tags })` | Retorna todas las entradas de migracion que coinciden con los criterios |
| `registry.get(id)` | Retorna una sola entrada de migracion por id |
| `registry.get_target_dbs()` | Retorna cada `meta.target_db` unico presente en las migraciones |
| `registry.get_tags()` | Retorna cada etiqueta unica presente en las migraciones |

El bootloader las usa para descubrir el conjunto completo de bases de datos destino al inicio.

## Seguimiento de Migraciones

El runner crea una tabla `wippy_migrations` en cada base de datos destino en la primera ejecucion. Las migraciones aplicadas se registran por id para que las ejecuciones posteriores las omitan. La tabla de seguimiento se crea automaticamente; no escribas tu propia migracion para crearla.

## Buenas Practicas

- **Un cambio logico por migracion** - crear una tabla, agregar una columna, crear un indice.
- **Escribe un `down` real** - si la reversion es imposible (perdida de datos), documentalo y lanza un error en lugar de tener exito silenciosamente.
- **Prefiere la idempotencia** - `CREATE TABLE IF NOT EXISTS` y `DROP TABLE IF EXISTS` sobreviven a re-ejecuciones sin manejo especial.
- **Mantener DDL y DML separados** - no siembres datos en la misma migracion que crea una tabla cuando puedas evitarlo.
- **Probar ambas direcciones** - aplica la migracion, revierte y verifica que el esquema coincida con el estado inicial.

## Ver Tambien

- [SQL Driver](system/database.md) - Configuracion del recurso de base de datos
- [Bootloader](framework/bootloader.md) - Ordenamiento y hooks del bootloader
- [Vision General del Framework](framework/overview.md) - Uso de modulos del framework
