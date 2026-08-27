---
title: "Almacenamiento en la nube"
description: "Carga, descarga, lista y administra objetos en almacenamiento compatible con S3."
---

# Almacenamiento en la nube
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

El módulo `cloudstorage` carga, descarga, lista y administra objetos en almacenamiento compatible con S3. También crea URL prefirmadas para acceso directo.

Esta página es una referencia de API. Sus fragmentos presuponen una entrada de almacenamiento configurada, acceso a cualquier volumen de sistema de archivos que nombren y los permisos indicados abajo. Los bloques de multipart y URL prefirmadas son recetas parciales de integración con clientes; la aplicación debe realizar las transferencias HTTP y proporcionar los ETags devueltos. Cuando una operación y la limpieza de recursos pueden fallar, la aplicación circundante proporciona `report_cleanup_error(err)` para registrar el fallo de limpieza conservando el error inicial.

Para configurar el almacenamiento, consulta [Almacenamiento en la nube](../../system/cloudstorage.md).

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

## URL de descarga

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
| `options.content_length` | integer | Longitud exacta esperada de la carga en bytes |

**Devuelve:** `string, error`

## URL de carga multipart

Para cargas grandes desde clientes, crea una carga multipart, emite URL prefirmadas para sus partes y completa la carga con los ETags devueltos por las solicitudes de cada parte. La aplicación circundante proporciona `report_cleanup_error(err)` para que un fallo al abortar sea observable sin sustituir el error que inició la limpieza:

```lua
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

local key = "uploads/user-123/video.mp4"
local upload, err = storage:create_multipart_upload(key, {
    content_type = "video/mp4"
})
if err then
    storage:release()
    return nil, err
end

local urls, err = storage:presigned_part_urls(key, upload.upload_id, {
    count = 3,
    expiration = 900
})
if err then
    local _, abort_err = storage:abort_multipart_upload(key, upload.upload_id)
    storage:release()
    if abort_err then
        report_cleanup_error(abort_err)
    end
    return nil, err
end

-- Upload each part to its URL and retain the ETag response header.
local completed, err = storage:complete_multipart_upload(key, upload.upload_id, {
    {part_number = 1, etag = part_1_etag},
    {part_number = 2, etag = part_2_etag},
    {part_number = 3, etag = part_3_etag}
})
if err then
    local _, abort_err = storage:abort_multipart_upload(key, upload.upload_id)
    storage:release()
    if abort_err then
        report_cleanup_error(abort_err)
    end
    return nil, err
end

storage:release()
return completed
```

`presigned_part_urls` acepta exactamente una de las opciones `count` o `parts`. Una llamada puede devolver como máximo 1000 URL y los números de parte van del 1 al 10 000. El valor predeterminado de `expiration` es 3600 segundos y los `headers` opcionales se incluyen en la firma. `create_multipart_upload` acepta `content_type`, `cache_control`, `content_disposition`, `content_encoding`, `metadata` y `headers`. Las solicitudes de finalización pueden enumerar las partes en cualquier orden.

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `create_multipart_upload(key, opts?)` | `table, error` | Iniciar una carga y devolver `{upload_id}` |
| `presigned_part_urls(key, upload_id, opts)` | `table[], error` | Devolver registros `{part_number, url}` |
| `complete_multipart_upload(key, upload_id, parts)` | `table, error` | Completar la carga y devolver su ETag y, opcionalmente, versión/ubicación |
| `abort_multipart_upload(key, upload_id)` | `boolean, error` | Abortar una carga incompleta |

Aborta las cargas que no vayan a completarse. Las reglas de ciclo de vida del bucket son un respaldo para cargas abandonadas, no sustituyen la limpieza explícita. Los métodos multipart devuelven `errors.UNAVAILABLE` cuando el proveedor configurado no admite la capacidad necesaria.

## Reader de acceso aleatorio

`open_reader` expone un objeto de solo lectura con seek sin descargarlo por completo. Obtiene rangos cuando faltan en la caché y envía el ETag que tenía el objeto al abrirse como condición `If-Match`. Los proveedores que aplican la condición devuelven `errors.CONFLICT` si el objeto cambia, en lugar de mezclar versiones.

```lua
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

local reader, err = storage:open_reader("archives/large.zip", {
    block_size = 8 * 1024 * 1024,
    cache_blocks = 4
})
if err then
    storage:release()
    return nil, err
end

print(reader:key(), reader:size())

local _, close_err = reader:close()
storage:release()
if close_err then return nil, close_err end
```

| Opción | Valor predeterminado | Rango válido |
|--------|----------------------|--------------|
| `block_size` | 8 MiB | De 64 KiB a 128 MiB |
| `cache_blocks` | 4 | De 1 a 64 |

La caché (`block_size * cache_blocks`) no puede superar 256 MiB. Los fallos de caché realizan E/S de red bloqueante y se serializan, por lo que el reader está pensado para consumidores secuenciales de acceso aleatorio, como lectores de archivos. El proveedor debe suministrar un ETag; de lo contrario, abrir el reader devuelve `errors.UNAVAILABLE`. Un proveedor que suministra un ETag pero ignora las precondiciones de lectura por rangos no puede garantizar la detección de sobrescrituras.

| Método del reader | Devuelve | Descripción |
|--------------------|----------|-------------|
| `size()` | `number` | Tamaño del objeto en bytes |
| `key()` | `string` | Clave del objeto |
| `close()` | `boolean, error` | Cerrar el reader; es idempotente |

Los readers se cierran automáticamente al terminar la tarea, pero ciérralos explícitamente cuando finalice el trabajo.

## Métodos de Storage

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `upload_object(key, content, opts?)` | `boolean, error` | Cargar contenido string o archivo |
| `download_object(key, writer, opts?)` | `boolean, error` | Descargar a escritor de archivo |
| `head_object(key)` | `table, error` | Obtener metadatos del objeto |
| `list_objects(opts?)` | `table, error` | Listar objetos con filtro de prefijo |
| `delete_objects(keys)` | `boolean, error` | Eliminar multiples objetos |
| `presigned_get_url(key, opts?)` | `string, error` | Generar URL de descarga temporal |
| `presigned_put_url(key, opts?)` | `string, error` | Generar URL de carga temporal |
| `create_multipart_upload(key, opts?)` | `table, error` | Iniciar una carga multipart |
| `presigned_part_urls(key, upload_id, opts)` | `table[], error` | Generar URL de carga multipart |
| `complete_multipart_upload(key, upload_id, parts)` | `table, error` | Completar una carga multipart |
| `abort_multipart_upload(key, upload_id)` | `boolean, error` | Abortar una carga multipart |
| `open_reader(key, opts?)` | `Reader, error` | Abrir un reader por rangos con seek |
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
| Precondición condicional fallida | `errors.CONFLICT` | no |
| El objeto cambió mientras estaba abierto un reader por rangos | `errors.CONFLICT` | no |
| No se encontró la carga multipart | `errors.NOT_FOUND` | no |
| El proveedor no admite multipart o readers por rangos | `errors.UNAVAILABLE` | no |
| Permiso denegado por `cloudstorage.get` | error Lua generado | no aplicable |
| Fallo de operación del proveedor | se conserva del proveedor cuando está disponible; de lo contrario, sin especificar | varía |

Consulta [Manejo de errores](../core/errors.md) para trabajar con errores.
