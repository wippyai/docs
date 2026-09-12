---
title: "Almacenamiento en la Nube"
description: "Acceder a almacenamiento de objetos compatible con S3. Cargar, descargar, listar y gestionar objetos, prefirmar URLs de descarga, carga y partes…"
---

# Almacenamiento en la nube
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

Acceder a almacenamiento de objetos compatible con S3. Cargar, descargar, listar y gestionar objetos, prefirmar URLs de descarga, carga y partes multiparte, y leer objetos con acceso aleatorio.

Esta página es una referencia de API. Sus fragmentos presuponen una entrada de almacenamiento configurada, acceso a cualquier volumen de sistema de archivos que nombren y los permisos indicados abajo. Los bloques de multipart y URL prefirmadas son recetas parciales de integración con clientes; la aplicación debe realizar las transferencias HTTP y proporcionar los ETags devueltos. Cuando una operación y la limpieza de recursos pueden fallar, la aplicación circundante proporciona `report_cleanup_error(err)` para registrar el fallo de limpieza conservando el error inicial.

Para configurar el almacenamiento, consulta [Almacenamiento en la nube](system/cloudstorage.md).

## Carga

```lua
local cloudstorage = require("cloudstorage")
```

## Adquisición del almacenamiento

Adquiere un recurso de almacenamiento en la nube por su ID de registro:

```lua
local storage, err = cloudstorage.get("app.infra:files")
if err then
    return nil, err
end

local uploaded, upload_err = storage:upload_object("data/file.txt", "content")
storage:release()
if upload_err then return nil, upload_err end
return uploaded
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID de recurso de almacenamiento |

**Devuelve:** `Storage, error`

## Carga de objetos

Carga contenido desde una cadena o un archivo:

```lua
local json = require("json")

local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

-- Upload string content
local body, encode_err = json.encode({
    date = "2024-01-15",
    total = 1234
})
if encode_err then
    storage:release()
    return nil, encode_err
end
local ok, err = storage:upload_object("reports/daily.json", body)
if err then
    storage:release()
    return nil, err
end

-- Upload from file
local fs = require("fs")
local vol, fs_err = fs.get("app:data")
if fs_err then
    storage:release()
    return nil, fs_err
end
local file, open_err = vol:open("/large-file.bin", "r")
if open_err then
    storage:release()
    return nil, open_err
end

local uploaded, file_upload_err = storage:upload_object("backups/large-file.bin", file)
local _, close_err = file:close()

storage:release()
if file_upload_err then
    if close_err then report_cleanup_error(close_err) end
    return nil, file_upload_err
end
if close_err then return nil, close_err end
return uploaded
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave/ruta del objeto |
| `content` | string or Reader | Contenido como cadena o reader de archivo |
| `options` | table | Metadatos opcionales y opciones de escritura condicional |

**Devuelve:** `boolean, error`

### Opciones de carga

Adjunta metadatos o protege la escritura con una tabla de opciones:

```lua
local uploaded, err = storage:upload_object("reports/daily.json", body, {
    content_type = "application/json",
    cache_control = "max-age=3600",
    metadata = { owner = "team-a", run_id = "1234" },  -- stored as x-amz-meta-*
    only_if_absent = true                              -- fail if the key already exists
})
if err then return nil, err end
return uploaded
```

| Opción | Tipo | Descripción |
|--------|------|-------------|
| `content_type` | string | Tipo MIME |
| `cache_control` | string | Cabecera Cache-Control |
| `content_disposition` | string | Cabecera Content-Disposition |
| `content_encoding` | string | Cabecera Content-Encoding |
| `metadata` | table | Metadatos de usuario (claves y valores de cadena), almacenados como `x-amz-meta-*` |
| `headers` | table | Cabeceras de solicitud adicionales (claves y valores de cadena) |
| `if_match` | string | Escribir solo si el ETag actual del objeto coincide |
| `if_none_match` | string | Escribir solo si ningún objeto coincide con el ETag (`"*"` significa cualquiera) |
| `only_if_absent` | boolean | Escribir solo si la clave no existe (alias de `if_none_match = "*"`) |

Una escritura condicional que falla su precondición devuelve un error `precondition_failed`.

## Descarga de objetos

Descarga un objeto en un writer de archivo:

```lua
local fs = require("fs")
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end
local vol, fs_err = fs.get("app:temp")
if fs_err then
    storage:release()
    return nil, fs_err
end

local file, open_err = vol:open("/downloaded.json", "w")
if open_err then
    storage:release()
    return nil, open_err
end
local ok, err = storage:download_object("reports/daily.json", file)
local _, close_err = file:close()
if err then
    if close_err then report_cleanup_error(close_err) end
    storage:release()
    return nil, err
end
if close_err then
    storage:release()
    return nil, close_err
end

-- Download partial content (first 1KB)
local partial, partial_open_err = vol:open("/partial.bin", "w")
if partial_open_err then
    storage:release()
    return nil, partial_open_err
end
local partial_ok, partial_err = storage:download_object("backups/large-file.bin", partial, {
    range = "bytes=0-1023"
})
local _, partial_close_err = partial:close()

storage:release()
if partial_err then
    if partial_close_err then report_cleanup_error(partial_close_err) end
    return nil, partial_err
end
if partial_close_err then return nil, partial_close_err end
return partial_ok
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave del objeto a descargar |
| `writer` | Writer | Escritor de archivo destino |
| `options.range` | string | Rango de bytes (por ejemplo, "bytes=0-1023") |
| `options.if_match` | string | Descargar solo si el ETag del objeto coincide |
| `options.if_none_match` | string | Descargar solo si el ETag no coincide |

**Devuelve:** `boolean, error`

Una precondición fallida (`if_match`/`if_none_match`) devuelve un error `precondition_failed`.

## Listado de objetos

Listar objetos con filtro de prefijo opcional:

```lua
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

local result, err = storage:list_objects({
    prefix = "reports/2024/",
    max_keys = 100
})
if err then
    storage:release()
    return nil, err
end

for _, obj in ipairs(result.objects) do
    print(obj.key, obj.size, obj.etag)
end

-- Paginate through large results
local token = nil
repeat
    local page, page_err = storage:list_objects({
        prefix = "logs/",
        max_keys = 1000,
        continuation_token = token
    })
    if page_err then
        storage:release()
        return nil, page_err
    end
    for _, obj in ipairs(page.objects) do
        process(obj)
    end
    token = page.next_continuation_token
    if not page.is_truncated then break end
until false

storage:release()
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `options.prefix` | string | Filtrar por prefijo de clave |
| `options.max_keys` | integer | Número máximo de objetos que se devolverán |
| `options.continuation_token` | string | Token de paginación |
| `options.include_owner` | boolean | Incluir el `owner` de cada objeto (`id`, `display_name`) |
| `options.include_versions` | boolean | Listar versiones de objetos; cada elemento incluye `version_id` |

**Devuelve:** `table, error`

El resultado contiene `objects`, `is_truncated`, `next_continuation_token`. Cada objeto tiene `key`, `size`, `etag`, `storage_class`, y opcionalmente `last_modified`, `version_id` y `owner`.

<note>
En los resultados de listado <code>content_type</code> siempre está vacío — las operaciones de listado de S3 no lo devuelven. Usa <code>head_object</code> para leer el tipo de contenido y los metadatos de un objeto.
</note>

## Metadatos de objetos

Obtén los metadatos de un solo objeto sin descargar su cuerpo:

```lua
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

local meta, err = storage:head_object("reports/daily.json")
if err then
    storage:release()
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

## Eliminación de objetos

Elimina varios objetos:

```lua
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

local deleted, err = storage:delete_objects({
    "temp/file1.txt",
    "temp/file2.txt",
    "temp/file3.txt"
})

storage:release()
if err then return nil, err end
return deleted
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `keys` | string[] | Array de claves de objeto a eliminar |

**Devuelve:** `boolean, error`

Se intenta cada clave. Eliminar una clave que no existe no es un error. Cuando el proveedor informa fallos por clave, la llamada devuelve un único error que nombra cada clave fallida y su código de error del proveedor.

## URLs de Descarga

Crea una URL temporal que permite descargar un objeto sin credenciales de almacenamiento. Un cliente puede usarla hasta que expire.

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

-- Return URL to client for direct download
return {download_url = url}
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave del objeto |
| `options.expiration` | integer | Segundos hasta que expire la URL (predeterminado: 3600) |

**Devuelve:** `string, error`

## URL de carga

Crea una URL temporal que permite cargar un objeto sin credenciales de almacenamiento. Un cliente puede cargar directamente al almacenamiento hasta que la URL expire.

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

-- Return URL to client for direct upload
return {upload_url = url}
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave del objeto |
| `options.expiration` | integer | Segundos hasta que expire la URL (predeterminado: 3600) |
| `options.content_type` | string | Tipo de contenido requerido para carga |
| `options.content_length` | integer | Tamano esperado de carga en bytes |

**Devuelve:** `string, error`

## Cargas Multiparte

Un único PUT prefirmado limita un objeto a 5 GiB. Una carga multiparte prefirmada divide un objeto mayor en partes que un cliente carga directamente, y luego las ensambla en el servidor. Multiparte es una capacidad del proveedor: S3 la implementa, y los proveedores que no la tienen devuelven `errors.UNAVAILABLE`.

```lua
local storage = cloudstorage.get("app.infra:files")

local mp, err = storage:create_multipart_upload("backups/huge.zip", {
    content_type = "application/zip",
    metadata = { source = "uploader" },
})
if err then return nil, err end

local urls, err = storage:presigned_part_urls("backups/huge.zip", mp.upload_id, {
    count = 3,
    expiration = 900,
})
if err then
    storage:abort_multipart_upload("backups/huge.zip", mp.upload_id)
    return nil, err
end

-- El cliente hace PUT en cada url y devuelve el ETag de las cabeceras de respuesta.
local done, err = storage:complete_multipart_upload("backups/huge.zip", mp.upload_id, {
    { part_number = 1, etag = etag1 },
    { part_number = 2, etag = etag2 },
    { part_number = 3, etag = etag3 },
})

storage:release()
```

### create_multipart_upload

Inicia una carga multiparte para una clave.

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave del objeto final |
| `options` | table | `content_type`, `cache_control`, `content_disposition`, `content_encoding`, `metadata`, `headers` - misma semántica que `upload_object` |

**Devuelve:** `table, error` - la tabla lleva `upload_id`, que identifica la carga en cada llamada posterior de parte, completado y aborto.

Las escrituras condicionales (`if_match`, `if_none_match`, `only_if_absent`) no forman parte del protocolo multiparte y no se aceptan aquí.

### presigned_part_urls

Genera URLs PUT prefirmadas para las partes de una carga en curso. Cada URL se carga con un PUT HTTP simple; el cargador debe conservar la cabecera de respuesta `ETag` de cada parte para `complete_multipart_upload`.

| Parámetro | Tipo | Por defecto | Descripción |
|-----------|------|-------------|-------------|
| `key` | string | requerido | Clave del objeto |
| `upload_id` | string | requerido | De `create_multipart_upload` |
| `options.parts` | int[] | - | Números de parte explícitos (1-10000, sin duplicados) |
| `options.count` | int | - | Prefirmar las partes `1..count` |
| `options.headers` | table | - | Cabeceras requeridas en cada solicitud de parte; se firman y el cargador también debe enviarlas |
| `options.expiration` | int | 3600 | Segundos hasta que expiren las URLs |

Se requiere exactamente uno de `parts` o `count`, y una sola llamada prefirma como máximo 1000 URLs - prefirme por páginas para objetos muy grandes.

**Devuelve:** `table, error` - un array de `{ part_number, url }`.

Cada parte excepto la última debe tener al menos 5 MiB; el proveedor lo verifica al completar.

### complete_multipart_upload

Ensambla el objeto final a partir de sus partes cargadas. Las partes pueden reportarse en cualquier orden y se ordenan por número de parte antes de completar.

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave del objeto |
| `upload_id` | string | De `create_multipart_upload` |
| `parts` | table | Array de `{ part_number = int, etag = string }` |

**Devuelve:** `table, error` - `etag`, más `version_id` y `location` cuando el proveedor los reporta. Un ID de carga desconocido devuelve `errors.NOT_FOUND`.

### abort_multipart_upload

Descarta una carga en curso y libera sus partes almacenadas.

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `key` | string | Clave del objeto |
| `upload_id` | string | De `create_multipart_upload` |

**Devuelve:** `boolean, error`

Una carga que nunca se completa mantiene sus partes almacenadas, y facturadas, hasta que se aborta. Aborte en cada ruta de fallo, y configure una regla de ciclo de vida del bucket como respaldo - ver [Almacenamiento en la Nube](system/cloudstorage.md#multipart-uploads).

## Lectores por Rango

`open_reader` abre acceso aleatorio sobre un objeto usando GETs por rango - sin staging local y sin descarga completa. Su consumidor principal es [`archive.open`](lua/data/archive.md), que lee archivos comprimidos de varios GB directamente desde el almacenamiento de objetos con memoria acotada.

```lua
local archive = require("archive")
local storage = cloudstorage.get("app.infra:files")

local reader, err = storage:open_reader("uploads/huge.zip", {
    block_size = 8 * 1024 * 1024,
    cache_blocks = 4,
})
if err then return nil, err end

local r = assert(archive.open(reader))
for e in r:entries() do
    print(e.name, e.size)
end
r:close()
reader:close()

storage:release()
```

| Parámetro | Tipo | Por defecto | Descripción |
|-----------|------|-------------|-------------|
| `key` | string | requerido | Clave del objeto |
| `options.block_size` | int | 8388608 | Unidad de GET por rango en bytes (64 KiB a 128 MiB) |
| `options.cache_blocks` | int | 4 | Bloques LRU residentes (1 a 64) |

`block_size * cache_blocks` no puede exceder 256 MiB. Un objeto inexistente devuelve `errors.NOT_FOUND`.

**Devuelve:** `Reader, error`

El ETag del objeto se fija cuando el reader se abre y se envía como `If-Match` en cada lectura por rango, de modo que un objeto sobrescrito a mitad de lectura hace fallar la lectura con el error de precondición del proveedor en lugar de servir una mezcla de dos generaciones del objeto; `archive` lo expone como `errors.INTERNAL`. Un proveedor que no puede suministrar un ETag devuelve `errors.UNAVAILABLE`; el reader nunca sirve un objeto sin fijar.

Las lecturas con fallo de caché realizan IO de red bloqueante en la tarea llamante y serializan a los lectores concurrentes, por lo que el acceso secuencial por entrada - el patrón de archive - es la forma prevista.

### Métodos del Reader

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `size()` | `integer` | Tamaño del objeto en bytes, del stat al abrir |
| `key()` | `string` | Clave del objeto desde la que lee el reader |
| `close()` | `boolean, error` | Libera la caché de bloques; idempotente |

El reader se cierra automáticamente al terminar el ámbito de la tarea si no se cierra explícitamente.

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
| `create_multipart_upload(key, opts?)` | `table, error` | Iniciar una carga multiparte prefirmada |
| `presigned_part_urls(key, upload_id, opts)` | `table, error` | Prefirmar URLs PUT para las partes de la carga |
| `complete_multipart_upload(key, upload_id, parts)` | `table, error` | Ensamblar el objeto a partir de las partes cargadas |
| `abort_multipart_upload(key, upload_id)` | `boolean, error` | Descartar una carga multiparte en curso |
| `open_reader(key, opts?)` | `Reader, error` | Abrir un lector de acceso aleatorio por rango |
| `release()` | `boolean` | Liberar recurso de almacenamiento |

## Permisos

La evaluación de políticas de seguridad se aplica a las operaciones de almacenamiento en la nube.

| Acción | Recurso | Descripción |
|--------|---------|-------------|
| `cloudstorage.get` | ID de Storage | Adquirir un recurso de almacenamiento |

## Errores

| Condición | Clase | Reintentable |
|-----------|------|--------------|
| ID de recurso vacío | `errors.INVALID` | no |
| Recurso no encontrado | `errors.NOT_FOUND` | no |
| No es recurso de almacenamiento en la nube | `errors.INVALID` | no |
| Almacenamiento liberado | `errors.INVALID` | no |
| Clave vacía | `errors.INVALID` | no |
| Contenido nil | `errors.INVALID` | no |
| Writer no válido | `errors.INVALID` | no |
| Objeto no encontrado | `errors.NOT_FOUND` | no |
| ID de carga desconocido | `errors.NOT_FOUND` | no |
| Precondición condicional fallida | `errors.CONFLICT` | no |
| Objeto sobrescrito durante una lectura por rango (expuesto por `archive`) | `errors.INTERNAL` | no |
| El proveedor no soporta cargas multiparte | `errors.UNAVAILABLE` | no |
| El proveedor no suministra ETag para `open_reader` | `errors.UNAVAILABLE` | no |
| Permiso denegado | lanzado como error de Lua, no retornado | - |
| Operación del proveedor fallida | `errors.UNKNOWN` | sin definir |

Consulta [Manejo de errores](lua/core/errors.md) para trabajar con errores.
