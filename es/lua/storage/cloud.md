---
title: "Almacenamiento en la Nube"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='io'/ <secondary-label ref='external'/ <secondary-label…"
---

# Almacenamiento en la Nube
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

Acceder a almacenamiento de objetos compatible con S3. Cargar, descargar, listar y gestionar archivos con soporte de URL prefirmadas.

Para configuración de almacenamiento, consulte [Almacenamiento en la Nube](system/cloudstorage.md).

## Carga

```lua
local cloudstorage = require("cloudstorage")
```

## Adquirir Almacenamiento

Obtener un recurso de almacenamiento en la nube por ID de registro:

```lua
local storage, err = cloudstorage.get("app.infra:files")
if err then
    return nil, err
end

storage:upload_object("data/file.txt", "content")
storage:release()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID de recurso de almacenamiento |

**Devuelve:** `Storage, error`

## Cargar Objetos

Cargar contenido desde string o archivo:

```lua
local storage = cloudstorage.get("app.infra:files")

-- Cargar contenido string
local ok, err = storage:upload_object("reports/daily.json", json.encode({
    date = "2024-01-15",
    total = 1234
}))

-- Cargar desde archivo
local fs = require("fs")
local vol = fs.get("app:data")
local file = vol:open("/large-file.bin", "r")

storage:upload_object("backups/large-file.bin", file)
file:close()

storage:release()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave/ruta del objeto |
| `content` | string o Reader | Contenido como string o lector de archivo |
| `options` | table | Metadatos opcionales y opciones de escritura condicional |

**Devuelve:** `boolean, error`

### Opciones de Carga

Adjunta metadatos o protege la escritura con una tabla de opciones:

```lua
storage:upload_object("reports/daily.json", body, {
    content_type = "application/json",
    cache_control = "max-age=3600",
    metadata = { owner = "team-a", run_id = "1234" },  -- almacenado como x-amz-meta-*
    only_if_absent = true                              -- falla si la clave ya existe
})
```

| Opción | Tipo | Descripción |
|--------|------|-------------|
| `content_type` | string | Tipo MIME |
| `cache_control` | string | Cabecera Cache-Control |
| `content_disposition` | string | Cabecera Content-Disposition |
| `content_encoding` | string | Cabecera Content-Encoding |
| `metadata` | table | Metadatos de usuario (claves/valores string), almacenados como `x-amz-meta-*` |
| `headers` | table | Cabeceras de solicitud adicionales (claves/valores string) |
| `if_match` | string | Escribir solo si el ETag actual del objeto coincide |
| `if_none_match` | string | Escribir solo si ningún objeto coincide con el ETag (`"*"` significa cualquiera) |
| `only_if_absent` | boolean | Escribir solo si la clave no existe (alias de `if_none_match = "*"`) |

Una escritura condicional que falla su precondición devuelve un error `precondition_failed`.

## Descargar Objetos

Descargar un objeto a un escritor de archivo:

```lua
local storage = cloudstorage.get("app.infra:files")
local fs = require("fs")
local vol = fs.get("app:temp")

local file = vol:open("/downloaded.json", "w")
local ok, err = storage:download_object("reports/daily.json", file)
file:close()

-- Descargar contenido parcial (primeros 1KB)
local partial = vol:open("/partial.bin", "w")
storage:download_object("backups/large-file.bin", partial, {
    range = "bytes=0-1023"
})
partial:close()

storage:release()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave del objeto a descargar |
| `writer` | Writer | Escritor de archivo destino |
| `options.range` | string | Rango de bytes (ej., "bytes=0-1023") |
| `options.if_match` | string | Descargar solo si el ETag del objeto coincide |
| `options.if_none_match` | string | Descargar solo si el ETag no coincide |

**Devuelve:** `boolean, error`

Una precondición fallida (`if_match`/`if_none_match`) devuelve un error `precondition_failed`.

## Listar Objetos

Listar objetos con filtro de prefijo opcional:

```lua
local storage = cloudstorage.get("app.infra:files")

local result, err = storage:list_objects({
    prefix = "reports/2024/",
    max_keys = 100
})

for _, obj in ipairs(result.objects) do
    print(obj.key, obj.size, obj.etag)
end

-- Paginar a traves de resultados grandes
local token = nil
repeat
    local result = storage:list_objects({
        prefix = "logs/",
        max_keys = 1000,
        continuation_token = token
    })
    for _, obj in ipairs(result.objects) do
        process(obj)
    end
    token = result.next_continuation_token
until not result.is_truncated

storage:release()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `options.prefix` | string | Filtrar por prefijo de clave |
| `options.max_keys` | integer | Objetos maximos a devolver |
| `options.continuation_token` | string | Token de paginacion |
| `options.include_owner` | boolean | Incluir el `owner` de cada objeto (`id`, `display_name`) |
| `options.include_versions` | boolean | Listar versiones de objetos; cada elemento incluye `version_id` |

**Devuelve:** `table, error`

El resultado contiene `objects`, `is_truncated`, `next_continuation_token`. Cada objeto tiene `key`, `size`, `etag`, `storage_class`, y opcionalmente `last_modified`, `version_id` y `owner`.

<note>
En los resultados de listado <code>content_type</code> siempre está vacío — las operaciones de listado de S3 no lo devuelven. Usa <code>head_object</code> para leer el tipo de contenido y los metadatos de un objeto.
</note>

## Metadatos de Objeto

Obtén los metadatos de un solo objeto sin descargar su cuerpo:

```lua
local storage = cloudstorage.get("app.infra:files")

local meta, err = storage:head_object("reports/daily.json")
if err then
    return nil, err
end

print(meta.size, meta.etag, meta.content_type)
for k, v in pairs(meta.metadata) do
    print("meta", k, v)
end

storage:release()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave del objeto |

**Devuelve:** `table, error`

Campos del resultado:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `size` | integer | Tamaño del objeto en bytes |
| `etag` | string | Entity tag |
| `content_type` | string | Tipo MIME |
| `cache_control` | string | Cabecera Cache-Control |
| `content_disposition` | string | Cabecera Content-Disposition |
| `content_encoding` | string | Cabecera Content-Encoding |
| `storage_class` | string | Clase de almacenamiento |
| `version_id` | string | ID de versión (presente cuando el versionado está habilitado) |
| `last_modified` | integer | Hora de última modificación (segundos Unix) |
| `metadata` | table | Metadatos de usuario (`x-amz-meta-*`) |
| `headers` | table | Cabeceras de respuesta crudas (claves en minúsculas) |

Un objeto inexistente devuelve un error `not_found`.

## Eliminar Objetos

Eliminar multiples objetos:

```lua
local storage = cloudstorage.get("app.infra:files")

storage:delete_objects({
    "temp/file1.txt",
    "temp/file2.txt",
    "temp/file3.txt"
})

storage:release()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `keys` | string[] | Array de claves de objeto a eliminar |

**Devuelve:** `boolean, error`

## URLs de Descarga

Crear una URL temporal que permite descargar un objeto sin credenciales. Util para compartir archivos con usuarios externos o servir contenido a traves de su aplicación.

```lua
local storage, err = cloudstorage.get("app.infra:files")
if err then
    return nil, err
end

local url, err = storage:presigned_get_url("reports/quarterly.pdf", {
    expiration = 3600
})

storage:release()

if err then
    return nil, err
end

-- Devolver URL al cliente para descarga directa
return {download_url = url}
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave del objeto |
| `options.expiration` | integer | Segundos hasta que expire la URL (predeterminado: 3600) |

**Devuelve:** `string, error`

## URLs de Carga

Crear una URL temporal que permite cargar un objeto sin credenciales. Permite a los clientes cargar archivos directamente al almacenamiento sin pasar por su servidor.

```lua
local storage, err = cloudstorage.get("app.infra:files")
if err then
    return nil, err
end

local url, err = storage:presigned_put_url("uploads/user-123/avatar.jpg", {
    expiration = 600,
    content_type = "image/jpeg",
    content_length = 1024 * 1024
})

storage:release()

if err then
    return nil, err
end

-- Devolver URL al cliente para carga directa
return {upload_url = url}
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave del objeto |
| `options.expiration` | integer | Segundos hasta que expire la URL (predeterminado: 3600) |
| `options.content_type` | string | Tipo de contenido requerido para carga |
| `options.content_length` | integer | Tamano maximo de carga en bytes |

**Devuelve:** `string, error`

## Metodos de Storage

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `upload_object(key, content, opts?)` | `boolean, error` | Cargar contenido string o archivo |
| `download_object(key, writer, opts?)` | `boolean, error` | Descargar a escritor de archivo |
| `head_object(key)` | `table, error` | Obtener metadatos del objeto |
| `list_objects(opts?)` | `table, error` | Listar objetos con filtro de prefijo |
| `delete_objects(keys)` | `boolean, error` | Eliminar multiples objetos |
| `presigned_get_url(key, opts?)` | `string, error` | Generar URL de descarga temporal |
| `presigned_put_url(key, opts?)` | `string, error` | Generar URL de carga temporal |
| `release()` | `boolean` | Liberar recurso de almacenamiento |

## Permisos

Las operaciones de almacenamiento en la nube estan sujetas a evaluacion de politica de seguridad.

| Accion | Recurso | Descripción |
|--------|---------|-------------|
| `cloudstorage.get` | ID de Storage | Adquirir un recurso de almacenamiento |

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| ID de recurso vacio | `errors.INVALID` | no |
| Recurso no encontrado | `errors.NOT_FOUND` | no |
| No es recurso de almacenamiento en la nube | `errors.INVALID` | no |
| Almacenamiento liberado | `errors.INVALID` | no |
| Clave vacia | `errors.INVALID` | no |
| Contenido nil | `errors.INVALID` | no |
| Writer no valido | `errors.INVALID` | no |
| Objeto no encontrado | `errors.NOT_FOUND` | no |
| Precondición condicional fallida | `errors.CONFLICT` | no |
| Permiso denegado | `errors.PERMISSION_DENIED` | no |
| Operación fallida | `errors.INTERNAL` | no |

Consulte [Manejo de Errores](lua/core/errors.md) para trabajar con errores.
