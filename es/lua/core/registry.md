---
title: "Registro de entradas"
description: "Lee entradas y metadatos del registro, inspecciona versiones y snapshots, y aplica conjuntos de cambios."
---

# Registro de entradas
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

El módulo `registry` lee y modifica entradas y proporciona acceso a snapshots e
historial de versiones. Esta página es una referencia de API; los ejemplos de
mutación usan identificadores ilustrativos y requieren políticas que autoricen esos
recursos y tipos de entrada exactos.

## Carga

```lua
local registry = require("registry")
```

## Estructura de Entrada

```lua
{
    id = "app.lib:assert",     -- string: "namespace:name"
    kind = "function.lua",     -- string: entry type
    meta = {type = "test"},    -- table: searchable metadata
    data = {...}               -- any: entry payload
}
```

## Obtener Entrada

```lua
local entry, err = registry.get("app.lib:assert")
```

**Permiso:** `registry.get` en ID de entrada

## Buscar Entradas

```lua
local entries, err = registry.find({[".kind"] = "function.lua"})
local entries, err = registry.find({[".kind"] = "http.endpoint", [".ns"] = "app.api"})
```

Los selectores raíz son `.kind`, `.name`, `.ns` y `.id`; sus valores admiten glob.
Los filtros de metadatos usan el prefijo `meta.`, por ejemplo
`{["meta.type"] = "test"}`.

## Parsear ID

```lua
local id = registry.parse_id("app.lib:assert")
-- id.ns = "app.lib", id.name = "assert"
```

## Instantaneas

Vista punto en el tiempo del registro:

```lua
local snap, err = registry.snapshot()           -- current state
local snap, err = registry.snapshot_at(5)       -- at version 5
```

### Metodos de Instantanea

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `snap:entries()` | `Entry[], error` | Todas las entradas accesibles |
| `snap:get(id)` | `Entry, error` | Entrada unica por ID |
| `snap:find(filter)` | `Entry[]` | Filtrar entradas |
| `snap:namespace(ns)` | `Entry[]` | Entradas en namespace |
| `snap:version()` | `Version` | Versión del snapshot |
| `snap:changes()` | `Changes` | Crear conjunto de cambios |

## Overlays locales al proceso

`registry.overlay(owner_id)` abre un overlay local al proceso para un propietario
lógico. Devuelve un snapshot normal del registro efectivo; crea un conjunto de
cambios desde él y aplícalo del mismo modo que un cambio duradero:

```lua
local snap, err = registry.overlay("controllers:customer-db")
if err then
    return nil, err
end

local changes = snap:changes()
changes:create({
    id = "runtime.data_sources:customer-db",
    kind = "db.sql.postgres",
    data = {host = "db.example.com", database = "customer"}
})

local current_version, err = changes:apply()
```

Los cambios del overlay afectan a la topología del registro y a los recursos de este
proceso, pero no crean versiones duraderas del historial. Por ello,
`changes:apply()` devuelve la versión duradera actual sin cambios. Un overlay sobrevive
a commits normales del historial y a la selección de versión; se elimina con un
arranque en frío o una carga explícita del estado del registro y después lo reconcilia
su propietario.

Los snapshots de overlay usan concurrencia optimista basada en generaciones. Aplicar
cambios desde uno obsoleto falla atómicamente con `errors.CONFLICT` reintentable;
vuelve a abrir el overlay y reconstruye el conjunto. Solo puede haber una operación
por ID de entrada. Los IDs de propietario se recortan hasta su identidad canónica. El
propietario es estado del registro, no metadatos de entrada, y los tipos propiedad de
directivas de expansión no pueden cambiarse mediante un overlay.

Las llamadas normales a `registry.get`, `find` y `snapshot` ven el registro efectivo
compuesto y siguen necesitando `registry.get` para cada entrada; el permiso del
overlay del propietario no sustituye la autorización de lectura.

## Versiones

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- numeric ID
print(version:string())   -- display string
local prev = version:previous()  -- previous version or nil
local next = version:next()      -- next version or nil
```

## Historial

```lua
local hist, err = registry.history()
local versions, err = hist:versions()
local version, err = hist:get_version(5)
local snap, err = hist:snapshot_at(version)
```

## Conjuntos de Cambios

Construir y aplicar modificaciones:

```lua
local snap, err = registry.snapshot()
local changes = snap:changes()

changes:create({
    id = "test:new_entry",
    kind = "test.kind",
    meta = {type = "test"},
    data = {config = "value"}
})

changes:update({
    id = "test:existing",
    kind = "test.kind",
    meta = {updated = true},
    data = {new_value = true}
})

changes:delete("test:old_entry")

local new_version, err = changes:apply()
```

**Permiso:** `registry.apply` para `changes:apply()`

### Metodos de Changes

| Método | Descripción |
|--------|-------------|
| `changes:create(entry)` | Agregar operación de creacion |
| `changes:update(entry)` | Agregar operación de actualizacion |
| `changes:delete(id)` | Agregar operación de eliminacion (string o `{ns, name}`) |
| `changes:ops()` | Obtener operaciones pendientes |
| `changes:apply()` | Aplicar cambios, devuelve nueva Versión |

## Aplicar Versión

Retroceder o avanzar a una versión especifica:

```lua
local prev = current_version:previous()
local ok, err = registry.apply_version(prev)
```

**Permiso:** `registry.apply_version`

## Construir Delta

Calcular operaciones para transicionar entre estados:

```lua
local from = {{id = "test:a", kind = "test", meta = {}, data = {}}}
local to = {{id = "test:b", kind = "test", meta = {}, data = {}}}

local ops, err = registry.build_delta(from, to)
for _, op in ipairs(ops) do
    print(op.kind, op.entry.id)  -- "entry.create", "entry.update", "entry.delete"
end
```

## Permisos

| Permiso | Recurso | Descripción |
|---------|---------|-------------|
| `registry.get` | ID de entrada | Leer entrada (también filtra resultados de find/entries) |
| `registry.apply` | - | Aplicar conjunto de cambios |
| `registry.apply_version` | - | Aplicar/revertir versión |
| `registry.overlay.get` | ID de propietario | Abrir el overlay de un propietario |
| `registry.overlay.apply` | ID de propietario | Aplicar un conjunto de cambios de overlay |
| `registry.overlay.create.<kind>` | ID de entrada | Crear una entrada del tipo indicado en un overlay |
| `registry.overlay.update.<kind>` | ID de entrada | Actualizar una entrada del tipo indicado en un overlay |
| `registry.overlay.delete.<kind>` | ID de entrada | Eliminar una entrada del tipo indicado de un overlay |

## Errores

| Condición | Tipo |
|-----------|------|
| Entrada no encontrada | `errors.NOT_FOUND` |
| Versión no encontrada | `errors.NOT_FOUND` |
| Permiso denegado | `errors.PERMISSION_DENIED` |
| Parámetro invalido | `errors.INVALID` |
| Sin cambios para aplicar | `errors.INVALID` |
| Propietario de overlay vacío o tipo propiedad de una directiva | `errors.INVALID` |
| Snapshot de overlay obsoleto | `errors.CONFLICT` (reintentable) |
| Registro no disponible | `errors.INTERNAL` |

Consulta [Manejo de errores](./errors.md) para trabajar con errores.
