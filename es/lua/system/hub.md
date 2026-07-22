---
title: "Hub"
description: "Acceso de solo lectura al catálogo de módulos de Wippy Hub: listar módulos, buscar, obtener metadatos, versiones, dependencias y READMEs."
---

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
local versions, err = hub.versions.list("wippy/terminal", {
    include_yanked = false,
    page_size = 50,
})

local v, err = hub.versions.get("wippy/terminal", "1.0.0")
```

| Función | Descripción |
|----------|-------------|
| `hub.versions.list(module, opts?)` | Lista las versiones de un módulo |
| `hub.versions.get(module, version, opts?)` | Obtiene una versión específica |
| `hub.versions.inspect(module, version, opts?)` | Inspecciona el artefacto de una versión (descarga y lee el bundle) |
| `hub.versions.open(module, version, opts?)` | Abre el artefacto de una versión como un handle de paquete |

### Handle de Paquete

`hub.versions.open` descarga el artefacto y devuelve un handle con los campos `version`, `digest`, `packed`:

```lua
local pkg, err = hub.versions.open("wippy/terminal", "1.2.3")

local entries, err = pkg:entries({
    kind = "function.lua",       -- string o string[], omitir para todos los tipos
    include_data = false,        -- por defecto true
})
-- cada entrada: { id = "ns:name", kind = "...", meta = {...}, data = <any> }

pkg:close()
```

| Método | Descripción |
|--------|-------------|
| `pkg:metadata()` | Mapa de metadatos del pack |
| `pkg:entries(opts?)` | Entradas del registro en el artefacto; `opts.kind` filtra, `opts.include_data` (por defecto true) controla el campo `data` |
| `pkg:resources()` | Lista de recursos embebidos |
| `pkg:fs(resource)` | Handle de sistema de archivos para un recurso embebido |
| `pkg:close()` | Libera el handle |

El campo `data` de las entradas se devuelve sin procesar — las referencias `${env:...}` no se resuelven.

## Dependencias

```lua
local deps, err = hub.dependencies.get("wippy/terminal", "1.0.0")
local users, err = hub.dependents.get("wippy/terminal")
```

| Función | Descripción |
|----------|-------------|
| `hub.dependencies.get(module, version?, opts?)` | Dependencias de una versión de módulo |
| `hub.dependents.get(module, opts?)` | Módulos que dependen de este |

## Archivos

```lua
local files, err = hub.files.list("wippy/terminal", "1.0.0")
```

| Función | Descripción |
|----------|-------------|
| `hub.files.list(module, version, opts?)` | Lista los archivos de una versión (`version` requerido); devuelve `{items, total, page, page_size}` |

## Autenticación

Inyecta un token de registry en el proceso en ejecución — cada consumidor del hub lo toma en su próxima llamada, sin reiniciar:

```lua
local status, err = hub.auth.authenticate("wpy_xxx")          -- registry por defecto
local status, err = hub.auth.authenticate("wpy_xxx", "https://hub.example.com")

local status, err = hub.auth.status()
local ok, err = hub.auth.logout()
```

| Función | Descripción |
|----------|-------------|
| `hub.auth.authenticate(token, registry?)` | Valida el token contra el registry y, si tiene éxito, lo instala como el override del runtime |
| `hub.auth.status(registry?)` | Valida en vivo la credencial actual |
| `hub.auth.logout(registry?)` | Limpia el override de token del runtime |

`status` contiene `authenticated`, `registry` y `orgs`; los campos de identidad (`username`, `user_id`, `scope`, `expires_at`, `expired`) están presentes solo cuando hay autenticación. Un token que falla la validación no se almacena — `authenticate` devuelve `authenticated = false`. El override tiene prioridad sobre `WIPPY_TOKEN` y las credenciales almacenadas.

**Permisos:** `hub.auth.authenticate`, `hub.auth.status`, `hub.auth.logout`

## Véase también

- [CLI Reference](guides/cli.md) — `wippy readme`, `wippy search`, `wippy publish`
- [Publishing Guide](guides/publishing.md)
