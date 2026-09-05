---
title: "Registro de Entradas"
description: "Consultar y modificar entradas registradas. Acceder a metadatos, instantaneas e historial de versiones."
---

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

Las entradas devueltas por `registry.get`, `registry.find`, `snap:entries()`, `snap:get()`, `snap:namespace()` y `snap:find()` llevan solo estos cuatro campos orientados al autor.

`dependency_root` es un campo del lado de escritura aceptado por `changes:create()` y `changes:update()`. Es un booleano que marca una entrada `ns.dependency` como raíz de despliegue. Nunca lo devuelven las APIs de entradas; el estado propiedad del registro se lee mediante [`snap:state()`](lua/core/registry.md#snapshot-state).

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
local snap, err = registry.snapshot_at(5)       -- en versión 5
```

### Metodos de Instantanea

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `snap:entries()` | `Entry[], error` | Todas las entradas accesibles |
| `snap:state()` | `State, error` | Entradas con metadatos propiedad del registro, más el grafo de módulos resuelto |
| `snap:get(id)` | `Entry, error` | Entrada unica por ID |
| `snap:find(filter)` | `Entry[]` | Filtrar entradas |
| `snap:namespace(ns)` | `Entry[]` | Entradas en namespace |
| `snap:version()` | `Version` | Versión de instantanea |
| `snap:changes()` | `Changes` | Crear conjunto de cambios |

### Estado de la Instantanea

`snap:state()` devuelve el estado de entradas junto con el grafo de módulos seleccionado para la versión de la instantánea. La procedencia propiedad del registro va en cada entrada en lugar de fusionarse en `meta`, de modo que no puede confundirse con los metadatos escritos por el autor.

```lua
local snap, err = registry.snapshot()
local state, err = snap:state()

for _, entry in ipairs(state.entries) do
    print(entry.id, entry.registry.owner, entry.registry.root)
end

if state.resolution then
    print(state.resolution.digest, state.resolution.input_digest)
    for _, module in ipairs(state.resolution.modules) do
        print(module.name, module.version)
    end
end
```

Cada entrada de `state.entries` tiene los cuatro campos orientados al autor más:

- `registry.owner` - fuente de despliegue que suministró la entrada
- `registry.root` - `true` cuando la entrada es una declaración de dependencia seleccionada por el despliegue

`state.resolution` describe el grafo de módulos de una vista `registry.snapshot()`. Está ausente en instantáneas que no llevan un grafo propio, incluidas `registry.snapshot_at()` y las instantáneas de overlay:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `digest` | string | Digest de contenido de la selección inmutable completa |
| `input_digest` | string | Digest del conjunto raíz declarado |
| `baseline_digest` | string | Digest de la línea base de despliegue contra la que se resolvió el grafo; se omite cuando no está vinculado |
| `roots` | array | Declaraciones de dependencia escritas por el autor usadas como entradas del solver |
| `references` | array | Declaraciones con forma de raíz plegadas en una raíz existente para el mismo componente; se omite cuando está vacío |
| `modules` | array | Módulos seleccionados |

Las entradas de `roots` y `references` tienen `id`, `component` y `version`. Las de `modules` tienen `name` y `version`, más `version_id`, `source`, `digest`, `size_bytes` y `protected` cuando están definidos.

## Versiones

```lua
local version, err = registry.current_version()
local versions, err = registry.versions()

print(version:id())       -- ID numerico
print(version:string())   -- cadena de visualizacion
local prev = version:previous()  -- versión anterior o nil
local next = version:next()      -- versión siguiente o nil
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

### Eliminar Entradas

`changes:delete()` acepta una cadena de ID, una tabla con una cadena `id`, una tabla con cadenas `ns` y `name`, o un arreglo de cualquiera de ellos. Los arreglos pueden anidarse, y los IDs duplicados se colapsan en una sola operación de eliminación.

```lua
changes:delete("test:old_entry")
changes:delete({id = "test:old_entry"})
changes:delete({ns = "test", name = "old_entry"})
changes:delete({"test:a", {ns = "test", name = "b"}, {"test:c"}})
```

Una lista vacía, una tabla que se referencia a sí misma, y un valor que no sea ni cadena ni tabla se rechazan con `errors.INVALID`.

### Metodos de Changes

| Método | Descripción |
|--------|-------------|
| `changes:create(entry)` | Agregar operación de creacion |
| `changes:update(entry)` | Agregar operación de actualizacion |
| `changes:delete(id)` | Agregar operación de eliminacion |
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

## Overlays

Un overlay es un conjunto de entradas del registro local al proceso y propiedad de una identidad lógica. Las entradas de overlay participan en la topología y en las transiciones de handlers habituales, de modo que los servicios arrancan y se detienen por ellas exactamente igual que por las entradas durables, pero nunca hacen avanzar el historial del registro ni aparecen en una versión. Existen solo en el proceso en ejecución y están vacías tras un arranque en frío, por lo que el servicio de control propietario las reconcilia al iniciar.

```lua
local snap, err = registry.overlay("data-sources:crm")
```

**Devuelve:** `Snapshot, error`

La instantánea expone las entradas de overlay del propietario mediante los métodos habituales e informa la versión actual del registro con `snap:version()`. También captura la generación del overlay en el momento en que se abre, que es lo que hace seguras las escrituras.

```lua
local snap, err = registry.overlay("data-sources:crm")
if err then return nil, err end

local changes = snap:changes()
changes:create({
    id = "data.crm:connection",
    kind = "registry.entry",
    meta = {},
    data = {endpoint = "https://crm.internal"}
})

local version, err = changes:apply()
```

`changes:apply()` sobre una instantánea de overlay escribe el overlay y devuelve la versión actual del registro. No se crea ninguna versión de historial, así que la versión devuelta no cambia salvo que ocurra un cambio durable de forma concurrente.

### Concurrencia

Cada overlay lleva un contador de generación que aumenta en cada aplicación exitosa. `changes:apply()` tiene éxito solo si la generación sigue coincidiendo con la capturada al abrir la instantánea. Una aplicación concurrente sobre el mismo overlay falla con `errors.CONFLICT` marcado como reintentable: reabra el overlay y reconstruya el conjunto de cambios.

```lua
local last_err
for _ = 1, 3 do
    local snap, err = registry.overlay("data-sources:crm")
    if err then return nil, err end

    local _, apply_err = snap:changes():delete("data.crm:connection"):apply()
    if not apply_err then return true end
    if not apply_err:retryable() then return nil, apply_err end
    last_err = apply_err
end
return nil, last_err
```

### Restricciones

- La cadena de propietario es obligatoria y no puede estar en blanco.
- Un conjunto de cambios debe ser no vacío y no puede nombrar la misma entrada dos veces.
- `create` falla cuando el ID ya existe en el estado durable o en cualquier overlay.
- `update` y `delete` solo funcionan sobre entradas creadas por este propietario; cualquier otro ID falla con `errors.NOT_FOUND`.
- Las entradas de overlay no pueden establecer `dependency_root` ni ningún otro metadato propiedad del registro.
- Las entradas de overlay no pueden usar kinds propiedad de una directiva del registro, como `ns.dependency`.
- Una eliminación que quite una entrada de la que dependa una entrada superviviente se rechaza.
- Las dependencias no pueden cruzar fronteras de propietario de overlay, y las entradas durables no pueden depender de entradas de overlay.

El resto se manifiesta como `errors.CONFLICT` o `errors.INVALID`, y ninguna es reintentable: solo lo es la discrepancia de generación anterior.

**Permisos:** `registry.overlay.get` sobre el propietario para abrir y leer, `registry.overlay.apply` sobre el propietario para escribir, y `registry.overlay.<create|update|delete>.<kind>` sobre cada ID de entrada del conjunto de cambios.

## Permisos

| Permiso | Recurso | Descripción |
|---------|---------|-------------|
| `registry.get` | ID de entrada | Leer entrada (también filtra resultados de find/entries) |
| `registry.apply` | - | Aplicar conjunto de cambios |
| `registry.apply_version` | - | Aplicar/revertir versión |
| `registry.overlay.get` | ID de propietario | Abrir y leer una instantánea de overlay |
| `registry.overlay.apply` | ID de propietario | Aplicar un conjunto de cambios de overlay |
| `registry.overlay.create.<kind>` | ID de entrada | Crear una entrada de overlay de ese kind |
| `registry.overlay.update.<kind>` | ID de entrada | Actualizar una entrada de overlay de ese kind |
| `registry.overlay.delete.<kind>` | ID de entrada | Eliminar una entrada de overlay de ese kind |

## Errores

| Condición | Tipo |
|-----------|------|
| Entrada no encontrada | `errors.NOT_FOUND` |
| Versión no encontrada | `errors.NOT_FOUND` |
| Permiso denegado | `errors.PERMISSION_DENIED` |
| Parámetro invalido | `errors.INVALID` |
| Sin cambios para aplicar | `errors.INVALID` |
| El overlay cambió durante la aplicación | `errors.CONFLICT` (reintentable) |
| Entrada de overlay de otro propietario o en conflicto con el estado durable | `errors.CONFLICT` |
| Registro no disponible | `errors.INTERNAL` |

Consulte [Manejo de Errores](lua/core/errors.md) para trabajar con errores.
