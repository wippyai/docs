---
title: "Archivos comprimidos"
description: "Lea, recorra, extraiga y cree archivos ZIP, TAR, TAR comprimidos con gzip y TAR comprimidos con Zstandard."
---

# Archivos comprimidos
<secondary-label ref="function"/>
<secondary-label ref="io"/>
<secondary-label ref="encoding"/>

El módulo `archive` lee y escribe archivos ZIP y de la familia TAR mediante lectores de acceso aleatorio, flujos secuenciales y destinos de sistema de archivos.

Esta es una referencia de API con recetas parciales de E/S. Las operaciones de streaming limitan los búferes de copia de entradas, pero los metadatos, el estado del códec, las fuentes de bytes sin procesar y los resultados de `read()` siguen consumiendo memoria. Use archivos seekable o lectores por rangos para archivos grandes con acceso aleatorio, `scan()` para entradas solo hacia delante y límites explícitos adecuados para la aplicación.

## Carga

```lua
local archive = require("archive")
```

Añada `archive` a la lista `modules:` de la entrada ejecutable antes de importarlo. Las recetas que usan sistemas de archivos, lectores cloud o flujos HTTP también requieren esas capacidades y sus políticas de seguridad.

## Formatos

El módulo detecta los formatos integrados mediante bytes mágicos o usa el formato indicado en `opts.format`.

| Formato | Lectura aleatoria | Recorrido secuencial | Escritura |
|---------|:-----------------:|:--------------------:|:---------:|
| `zip` | sí | sí (cabeceras locales) | sí |
| `tar` | sí | sí | sí |
| `tar.gz` | no | sí | sí |
| `tar.zst` | no | sí | sí |

`archive.formats()` devuelve la lista de nombres de formatos registrados.

```lua
local names = archive.formats()  -- {"zip", "tar", "tar.gz", "tar.zst", ...}
```

## Opciones

Cada punto de entrada acepta una tabla `opts` opcional:

| Clave | Predeterminado | Significado |
|-------|----------------|-------------|
| `format` | auto | `"zip"`, `"tar"`, `"tar.gz"`, `"tar.zst"`; auto = detecta bytes mágicos y después la extensión |
| `max_entries` | 100000 | Rechaza archivos con más entradas (protección contra bombas de descompresión) |
| `max_total_bytes` | 2 GiB | Límite acumulado de salida sin comprimir para `extract_all()` |
| `max_file_bytes` | 1 GiB | Límite del tamaño sin comprimir de una entrada |
| `max_inline_bytes` | 16 MiB | Límite estricto de la llamada `read()` que materializa en RAM; por encima, use `stream()`/`extract()` |
| `buffer_bytes` | 64 KiB | Búfer de copia para las rutas de extracción/adición por streaming; no limita la asignación de `read()` |

`max_file_bytes` limita cada entrada, mientras que `max_total_bytes` solo se aplica en `extract_all()` del lector y walker. Las aplicaciones que usen `read()`, `stream()`, `extract()` para una entrada o recorridos manuales deben imponer su propio presupuesto acumulado. `max_inline_bytes` limita los datos de entrada materializados por `read()`; `buffer_bytes` no lo hace. Estos límites no incluyen todas las asignaciones de metadatos y códecs.

## Lectura: acceso aleatorio

`archive.open(source, ...)` abre una fuente **seekable** para acceso aleatorio completo (el directorio central ZIP se lee al principio y las entradas se descomprimen bajo demanda). La fuente puede ser un manejador `fs.FS` y una ruta, un `fs.File` abierto, un lector de almacenamiento cloud o bytes sin procesar (estos mantienen el archivo completo en RAM: solo para archivos pequeños).

```lua
local fs = require("fs")
local archive = require("archive")

-- Open by fs handle + path (the module opens the file and owns its lifecycle)
local uploads, fs_err = fs.get("app:uploads")
if fs_err then return nil, fs_err end
local r, err = archive.open(uploads, "incoming.zip")
if err then return nil, err end
-- Or from an already-open seekable fs.File
-- local r, err = archive.open(open_file)
-- Or from raw bytes (small archives only)
-- local r, err = archive.open(zip_bytes, { format = "zip" })
```

Para un archivo grande en almacenamiento cloud, pase el lector por rangos devuelto por `open_reader`:

```lua
local cloudstorage = require("cloudstorage")

local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end
local source, source_err = storage:open_reader("uploads/large.zip")
if source_err then
    storage:release()
    return nil, source_err
end
local r, archive_err = archive.open(source)
if archive_err then
    source:close()
    storage:release()
    return nil, archive_err
end

-- Read archive entries here.

local _, reader_close_err = r:close()
local _, source_close_err = source:close()
storage:release()
if reader_close_err then return nil, reader_close_err end
if source_close_err then return nil, source_close_err end
```

El lector del archivo es propietario del archivo que abre mediante un manejador `fs.FS` y una ruta. No es propietario de un `fs.File` o lector por rangos proporcionado externamente; cierre primero el lector del archivo y después las entradas y manejadores propiedad del llamador.

**Devuelve:** `Reader, error`

**Permiso:** `archive.read`

### `entries`

Itera por los metadatos de las entradas sin descomprimir su contenido:

```lua
for e in r:entries() do
    -- e: name, size, compressed_size, is_dir, mode, modified, method, crc32, type
    print(e.name, e.size, e.is_dir)
end
```

### `stat`

Lee los metadatos de una entrada por nombre sin descomprimir su contenido:

```lua
local info, err = r:stat("docs/readme.md")
if err then return nil, err end
```

### `read`

Materializa una entrada como string Lua. Por encima de `max_inline_bytes` produce un error (`kind = Invalid`); para contenido grande, use `stream()` o `extract()`:

```lua
local data, err = r:read("docs/readme.md")  -- small entries only
if err then return nil, err end
```

### `stream`

Devuelve una entrada como `stream.Stream` que se descomprime bajo demanda. El resultado se puede recorrer, pasar a `fs:writefile()` o entregar a otro consumidor de flujos:

```lua
local es, err = r:stream("big.csv")
if err then return nil, err end
while true do
    local chunk, read_err = es:read(65536)
    if read_err then
        es:close()
        return nil, read_err
    end
    if not chunk then break end
    process(chunk)
end
local _, close_err = es:close()
if close_err then return nil, close_err end
```

### `extract`

Transmite una entrada a un sistema de archivos de destino:

```lua
local out, fs_err = fs.get("app:out")
if fs_err then return nil, fs_err end
local ok, err = r:extract("docs/readme.md", out)
if err then return nil, err end
-- optional destination path:
-- r:extract("docs/readme.md", out, "readme.md")
```

### `extract_all`

Transmite todas las entradas a un sistema de archivos de destino:

```lua
local out, fs_err = fs.get("app:out")
if fs_err then return nil, fs_err end
local count, err = r:extract_all(out, {
    prefix = "job123/",          -- prepend to each destination path
    strip  = 1,                  -- drop N leading path components
    filter = function(e) return not e.is_dir end,
})
if err then return nil, err end
```

Resuelva el sistema de archivos de destino por separado en el código de aplicación para poder gestionar los errores de `fs.get`. En `extract` de una entrada, los nombres de destino inseguros devuelven un error. `extract_all` omite las entradas cuya ruta resultante contiene `..`, es absoluta o tiene un prefijo de unidad Windows o UNC.

### `close`

Cierra el lector. La operación es idempotente y el lector también se cierra automáticamente al terminar el ámbito de la tarea.

```lua
local ok, err = r:close()
if err then return nil, err end
```

## Lectura: recorrido secuencial

`archive.scan(source, opts?)` abre una fuente **solo hacia delante**, como el cuerpo de una carga HTTP o un flujo de archivo multipart. Las entradas se visitan en el orden del archivo y cada lector de entrada solo es válido hasta que el recorrido avanza. No existe acceso aleatorio `read(name)`.

```lua
local up, stream_err = form.files.upload[1]:stream()        -- stream.Stream
if stream_err then return nil, stream_err end
local s, err = archive.scan(up, { format = "zip" })
if err then
    up:close()
    return nil, err
end

local uploads, fs_err = fs.get("app:uploads")
if fs_err then
    s:close()
    up:close()
    return nil, fs_err
end

local count, extract_err = s:extract_all(uploads, {prefix = "job123/"})
if extract_err then
    s:close()
    up:close()
    return nil, extract_err
end
local _, close_err = s:close()
local _, upload_close_err = up:close()
if close_err then return nil, close_err end
if upload_close_err then return nil, upload_close_err end
```

**Devuelve:** `Walker, error`

**Permiso:** `archive.read`

`extract_all` aplica el mismo saneamiento de rutas de destino y límite de tamaño total descritos anteriormente. Cuando una aplicación avanza directamente por `s:walk()`, los errores del iterador se lanzan como errores Lua y cada flujo de entrada solo es válido hasta la siguiente iteración. La limpieza del ámbito de tarea libera de todos modos el walker y su flujo actual; cierre explícitamente los flujos de entrada propiedad del llamador cuando el control permanezca en la aplicación.

`tar`, `tar.gz` y `tar.zst` transmiten de forma nativa. `zip` se analiza mediante cabeceras locales por entrada; las entradas escritas con un descriptor de datos de streaming (tamaño/CRC después de los datos) se leen descomprimiendo hasta el límite de la entrada. Para manejar de forma robusta cargas ZIP grandes, guarde primero la carga como archivo (una copia secuencial limitada) y use después `archive.open`:

```lua
local uuid = require("uuid")

local dst, fs_err = fs.get("app:tmp")
if fs_err then return nil, fs_err end
local upload, stream_err = req:stream()
if stream_err then return nil, stream_err end
local stage_id, id_err = uuid.v7()
if id_err then
    upload:close()
    return nil, id_err
end
local stage_path = stage_id .. ".zip"
local copied, copy_err = dst:writefile(stage_path, upload, "wx")
local _, upload_close_err = upload:close()
if copy_err or upload_close_err then
    dst:remove(stage_path)
    return nil, copy_err or upload_close_err
end
local r, open_err = archive.open(dst, stage_path)   -- robust random access
if open_err then
    dst:remove(stage_path)
    return nil, open_err
end

-- Replace this operation with the random-access work the handler needs.
local info, operation_err = r:stat("manifest.json")
local _, close_err = r:close()
local removed, remove_err = dst:remove(stage_path)
if operation_err then return nil, operation_err end
if close_err then return nil, close_err end
if remove_err then return nil, remove_err end
return info
```

Cada solicitud genera un nombre de staging impredecible y lo crea en exclusiva, por lo que los handlers concurrentes no pueden truncar sus archivos mutuamente. El error principal de copia, cierre de carga, apertura u operación del archivo se devuelve después de intentar eliminar el archivo de staging. Los handlers de producción pueden registrar por separado un fallo de limpieza cuando ya existe un error principal. Añada `uuid` a la lista de módulos permitidos de la entrada ejecutable para esta receta.

## Escritura

`archive.create(dest, ...)` transmite entradas a una ruta del sistema de archivos, un archivo abierto para escritura o un `stream.Stream` escribible.

```lua
local tmp, fs_err = fs.get("app:tmp")
if fs_err then return nil, fs_err end
local w, err = archive.create(tmp, "out.zip", { format = "zip" })
if err then return nil, err end
```

**Devuelve:** `Writer, error`

**Permiso:** `archive.write`

### `add`

Añade una entrada desde un string Lua con texto o bytes, un `fs.File` abierto o un `stream.Stream`:

```lua
local ok, err = w:add("notes.txt", "hello")
if err then return nil, err end
local added, add_err = w:add("from_upload", some_stream, { method = "deflate", mode = 420 }) -- 0644
if add_err then return nil, add_err end
```

### `add_file`

Transmite una entrada desde un archivo de un sistema de archivos:

```lua
local data_fs, fs_err = fs.get("app:data")
if fs_err then return nil, fs_err end
local ok, err = w:add_file("data/big.bin", data_fs, "big.bin")
if err then return nil, err end
```

### `add_dir`

Añade una entrada de directorio:

```lua
local ok, err = w:add_dir("empty/")
if err then return nil, err end
```

### `close`

Finaliza el archivo, incluido el directorio central ZIP. La operación es idempotente y el writer también se cierra automáticamente al terminar el ámbito de la tarea.

```lua
local ok, err = w:close()
if err then return nil, err end
```

Las opciones de `add` son `{method = "store"|"deflate", mode, size}`. `size` es obligatorio al añadir un flujo a un archivo de la familia TAR; los strings y `add_file` proporcionan su tamaño automáticamente. `add_file` acepta `method` y `mode`, y `add_dir` no tiene opciones. El writer ZIP usa descriptores de datos cuando su destino es un flujo escribible no seekable.

Los literales numéricos de Lua son decimales; use `420` para los bits de permisos Unix que suelen escribirse en octal como `0644`.

El writer no cierra un archivo o flujo externo usado como fuente de entrada o destino del archivo. Cierre los recursos propiedad del llamador después de `w:close()`.

## Errores

| Condición | Tipo |
|-----------|------|
| Formato desconocido o no coincidente | `errors.INVALID` |
| Archivo corrupto o truncado informado por el wrapper Lua actual | `errors.INTERNAL` |
| Se supera el límite inline de `read()` o el límite total de `extract_all` | `errors.INVALID` |
| Límite de entrada/archivo detectado al abrir o leer mediante el wrapper Lua actual | `errors.INTERNAL` |
| Acceso aleatorio en un formato solo de streaming (use `scan`) | `errors.UNAVAILABLE` |
| No se encuentra el nombre de la entrada | `errors.NOT_FOUND` |
| La política del archivo deniega la operación | `errors.PERMISSION_DENIED` |
| Fallo de E/S de la fuente o destino | `errors.INTERNAL` |
| Lectura de una entrada de streaming obsoleta después de avanzar el recorrido | `errors.INTERNAL` |

Consulte [Gestión de errores](../core/errors.md) para trabajar con errores.

## Véase también

- [Sistema de archivos](../storage/filesystem.md) - Sistemas de archivos de origen y destino
- [Almacenamiento cloud](../storage/cloud.md) - Lectores por rangos para archivos alojados en cloud
- [Stream](../core/stream.md) - Objetos de flujo entregados a los archivos y devueltos por ellos
- [Compresión](./compress.md) - gzip/deflate/zstd en memoria
