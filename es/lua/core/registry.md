# Registro de Entradas
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Consultar y modificar entradas registradas. Acceder a metadatos, instantaneas e historial de versiones.

## Carga

```lua
local registry = require("registry")
```

## Estructura de Entrada

```lua
{
    id = "app.lib:assert",     -- string: "namespace:name"
    kind = "function.lua",     -- string: tipo de entrada
    meta = {type = "test"},    -- table: metadatos buscables
    data = {...}               -- any: carga de entrada
}
```

## Obtener Entrada

```lua
local entry, err = registry.get("app.lib:assert")
```

**Permiso:** `registry.get` en ID de entrada

## Buscar Entradas

```lua
local entries, err = registry.find({kind = "function.lua"})
local entries, err = registry.find({kind = "http.endpoint", namespace = "app.api"})
```

Los campos de filtro coinciden con los metadatos de entrada.

## Parsear ID

```lua
local id = registry.parse_id("app.lib:assert")
-- id.ns = "app.lib", id.name = "assert"
```

## Instantaneas

Vista punto en el tiempo del registro:

```lua
local snap, err = registry.snapshot()           -- estado actual
local snap, err = registry.snapshot_at(5)       -- en version 5
```

### Metodos de Instantanea

| Metodo | Devuelve | Descripcion |
|--------|----------|-------------|
| `snap:entries()` | `Entry[], error` | Todas las entradas accesibles |
| `snap:get(id)` | `Entry, error` | Entrada unica por ID |
| `snap:find(filter)` | `Entry[]` | Filtrar entradas |
| `snap:namespace(ns)` | `Entry[]` | Entradas en namespace |
| `snap:version()` | `Version` | Version de instantanea |
| `snap:changes()` | `Changes` | Crear conjunto de cambios |

## Versiones

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- ID numerico
print(version:string())   -- cadena de visualizacion
local prev = version:previous()  -- version anterior o nil
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

| Metodo | Descripcion |
|--------|-------------|
| `changes:create(entry)` | Agregar operacion de creacion |
| `changes:update(entry)` | Agregar operacion de actualizacion |
| `changes:delete(id)` | Agregar operacion de eliminacion (string o `{ns, name}`) |
| `changes:ops()` | Obtener operaciones pendientes |
| `changes:apply()` | Aplicar cambios, devuelve nueva Version |

## Aplicar Version

Retroceder o avanzar a una version especifica:

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

| Permiso | Recurso | Descripcion |
|---------|---------|-------------|
| `registry.get` | ID de entrada | Leer entrada (tambien filtra resultados de find/entries) |
| `registry.apply` | - | Aplicar conjunto de cambios |
| `registry.apply_version` | - | Aplicar/revertir version |

## Errores

| Condicion | Tipo |
|-----------|------|
| Entrada no encontrada | `errors.NOT_FOUND` |
| Version no encontrada | `errors.NOT_FOUND` |
| Permiso denegado | `errors.PERMISSION_DENIED` |
| Parametro invalido | `errors.INVALID` |
| Sin cambios para aplicar | `errors.INVALID` |
| Registro no disponible | `errors.INTERNAL` |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
