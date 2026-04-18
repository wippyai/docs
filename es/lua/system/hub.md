# Hub

Acceso de solo lectura al catálogo de módulos de Wippy Hub: listar módulos, buscar, obtener metadatos, versiones, dependencias y READMEs.

## Carga

```lua
local hub = require("hub")
```

## Opciones por llamada

Cada llamada acepta una tabla opcional de opciones. Claves comunes a todas las llamadas:

| Clave | Tipo | Descripción |
|-----|------|-------------|
| `registry` | string | Sobrescribe la URL del registry |
| `token` | string | Sobrescribe el token de API |
| `timeout` | duration/number | Tiempo de espera de la solicitud (p. ej. `"3m"` o segundos) |

Las llamadas con soporte de paginación también aceptan `page` y `page_size`.

## Módulos

```lua
local result, err = hub.modules.list({
    org = "wippy",
    visibility = "public",
    type = "library",
    sort_order = "downloads_desc",
    page = 1,
    page_size = 20,
})
-- result = { items, total, page, page_size }
```

| Función | Descripción |
|----------|-------------|
| `hub.modules.list(opts?)` | Lista módulos con filtros |
| `hub.modules.search(query, opts?)` | Busca por cadena de consulta |
| `hub.modules.get(module, opts?)` | Obtiene módulo por `org/name` o por id de módulo |
| `hub.modules.readme(module, opts?)` | Obtiene el README; devuelve `{content, filename, version}` |

### Opciones de List/Search

| Opción | Valores |
|--------|--------|
| `organization_id` / `org` | string |
| `visibility` | `public`, `private`, `internal` |
| `type` | `library`, `application`, `agent`, `plugin` |
| `sort_order` | `name_asc`, `name_desc`, `created_desc`, `updated_desc`, `downloads_desc` |
| `keywords` (search) | arreglo de strings |
| `license` (search) | string |
| `include_deprecated` (search) | boolean |

### README

```lua
local readme, err = hub.modules.readme("wippy/terminal", {
    version = "1.2.3"
})
print(readme.content)
```

La opción `version` acepta una cadena de versión o una tabla como `{id, version, label}`.

## Versiones

```lua
local versions, err = hub.versions.list("wippy/http", {
    include_yanked = false,
    page_size = 50,
})

local v, err = hub.versions.get("wippy/http", "1.0.0")
```

| Función | Descripción |
|----------|-------------|
| `hub.versions.list(module, opts?)` | Lista las versiones de un módulo |
| `hub.versions.get(module, version, opts?)` | Obtiene una versión específica |

## Dependencias

```lua
local deps, err = hub.dependencies.get("wippy/http", "1.0.0")
local users, err = hub.dependents.get("wippy/http")
```

| Función | Descripción |
|----------|-------------|
| `hub.dependencies.get(module, version?, opts?)` | Dependencias de una versión de módulo |
| `hub.dependents.get(module, opts?)` | Módulos que dependen de este |

## Archivos

```lua
local files, err = hub.files.list("wippy/http", "1.0.0")
```

Devuelve el listado de archivos de una versión publicada.

## Véase también

- [CLI Reference](guides/cli.md) — `wippy readme`, `wippy search`, `wippy publish`
- [Publishing Guide](guides/publishing.md)
