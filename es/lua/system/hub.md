---
title: "Hub"
description: "Explora metadatos y artefactos de Wippy Hub, administra credenciales e inspecciona la caché local de artefactos desde Lua."
---

# Hub

El módulo `hub` lee módulos, versiones, dependencias, archivos, artefactos y READMEs de Wippy Hub. También administra el override de credenciales de Hub del entorno de ejecución y puede eliminar de la caché local los artefactos que no están fijados.

Esta es una referencia de API. Las coordenadas del catálogo son ilustrativas; las operaciones de artefactos, autenticación y caché requieren el acceso de red, las credenciales, el estado del lock y las políticas de seguridad correspondientes.

## Carga

```lua
local hub = require("hub")
```

## Opciones por llamada

Las llamadas de catálogo y artefactos respaldadas por red aceptan una tabla opcional con estas claves comunes:

| Clave | Tipo | Descripción |
|-----|------|-------------|
| `registry` | string | Sobrescribe la URL del registry |
| `token` | string | Sobrescribe el token de API |
| `timeout` | duration/number | Tiempo de espera de la solicitud (p. ej. `"3m"` o segundos) |

Las llamadas con soporte de paginación también aceptan `page` y `page_size`.

Las llamadas de autenticación reciben directamente una URL de registro. Las llamadas de caché y los métodos del handle de paquete usan sus propias opciones, descritas más adelante.

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
if err then return nil, err end
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

`hub.versions.open` descarga un artefacto y devuelve un handle con los campos `version`, `digest` y `packed`:

```lua
local pkg, err = hub.versions.open("wippy/terminal", "1.2.3")
if err then return nil, err end

local entries, entries_err = pkg:entries({
    kind = "function.lua",       -- string or string[], omit for all kinds
    include_data = false,        -- default true
})
-- each entry: { id = "ns:name", kind = "...", meta = {...}, data = <any> }
local _, close_err = pkg:close()
if entries_err then return nil, entries_err end
if close_err then return nil, close_err end
return entries
```

| Método | Descripción |
|--------|-------------|
| `pkg:metadata()` | Mapa de metadatos del pack |
| `pkg:entries(opts?)` | Entradas del registro en el artefacto; `opts.kind` filtra, `opts.include_data` (por defecto true) controla el campo `data` |
| `pkg:resources()` | Lista de recursos embebidos |
| `pkg:fs(resource)` | Handle de sistema de archivos para un recurso embebido |
| `pkg:close()` | Libera el handle |

El campo `data` de las entradas se devuelve sin resolver las referencias `${env:...}`.

## Caché local de artefactos

```lua
local entries, err = hub.cache.list()

local removed, err = hub.cache.remove("wippy/terminal", "1.2.3", {
    force = false,
})

local candidates, err = hub.cache.prune({
    dry_run = true,
})
```

| Función | Descripción |
|----------|-------------|
| `hub.cache.list()` | Lista los artefactos en caché como registros `{module, version, size, pinned}` |
| `hub.cache.remove(module, version, opts?)` | Elimina un artefacto en caché; `opts.force = true` permite eliminarlo si el lock file lo fija |
| `hub.cache.prune(opts?)` | Elimina artefactos no referenciados por el lock file; `opts.dry_run = true` solo informa de los candidatos |

`hub.cache.remove` y `hub.cache.prune` eliminan archivos del directorio vendor resuelto por el lock, salvo cuando se aplican sus protecciones de dry-run o pin.

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

Instala un token de registry como override del entorno de ejecución. Los consumidores de Hub lo usan en llamadas posteriores sin necesidad de reiniciar:

```lua
local status, err = hub.auth.authenticate("wpy_xxx")          -- default registry
local status, err = hub.auth.authenticate("wpy_xxx", "https://hub.example.com")

local status, err = hub.auth.status()
local ok, err = hub.auth.logout()
```

Los tokens anteriores son placeholders. Cargue las credenciales reales desde una entrada de entorno respaldada por secretos u otra fuente protegida; no las confirme en Lua ni en YAML del registro.

| Función | Descripción |
|----------|-------------|
| `hub.auth.authenticate(token, registry?)` | Valida el token contra el registry y, si tiene éxito, lo instala como el override del runtime |
| `hub.auth.status(registry?)` | Valida en vivo la credencial actual |
| `hub.auth.logout(registry?)` | Limpia el override de token del runtime |

`status` contiene `authenticated`, `registry` y `orgs`. Los campos de identidad (`username`, `user_id`, `scope`, `expires_at`, `expired`) solo están presentes cuando hay autenticación. Un token que no supera la validación no se almacena; `authenticate` devuelve `authenticated = false`. El override del entorno de ejecución tiene prioridad sobre `WIPPY_TOKEN` y las credenciales almacenadas.

## Permisos

Cada operación de nivel superior `hub.*` comprueba el nombre de acción correspondiente, como `hub.modules.list`, `hub.versions.open`, `hub.dependencies.get`, `hub.files.list`, `hub.auth.status` o `hub.cache.prune`. Las acciones dirigidas a un módulo usan como recurso de seguridad la referencia de módulo proporcionada; las acciones de autenticación usan la URL del registro. Los métodos del handle de paquete no vuelven a comprobar permisos después de la llamada autorizada a `hub.versions.open`.

## Véase también

- [Referencia de la CLI](guides/cli.md) — `wippy readme`, `wippy search`, `wippy publish`
- [Guía de publicación](guides/publishing.md)
