---
title: "Archive"
description: "Lea y escriba archivos zip/tar con memoria acotada. Los archivos nunca se cargan en RAM ni se extraen a disco — el pico de memoria es independiente…"
---

# Archive
<secondary-label ref="function"/>
<secondary-label ref="io"/>
<secondary-label ref="encoding"/>

Lea y escriba archivos zip/tar con memoria acotada. Los archivos nunca se cargan en RAM ni se extraen a disco — el pico de memoria es independiente del tamaño del archivo y de sus entradas, de modo que archivos de varios GB funcionan en un servidor con poca RAM.

## Carga

```lua
local archive = require("archive")
```

## Formatos

Los formatos integrados se detectan por magic bytes, o se fuerzan con `opts.format`:

| Formato | Lectura aleatoria | Escaneo secuencial | Escritura |
|--------|:-----------:|:---------------:|:-----:|
| `zip` | sí | sí (cabeceras locales) | sí |
| `tar` | sí | sí | sí |
| `tar.gz` | no | sí | sí |
| `tar.zst` | no | sí | sí |

`archive.formats()` retorna la lista de nombres de formato registrados.

```lua
local names = archive.formats()  -- {"zip", "tar", "tar.gz", "tar.zst", ...}
```

## Opciones

Todos los puntos de entrada aceptan una tabla `opts` opcional:

| Clave | Por defecto | Significado |
|-----|---------|---------|
| `format` | auto | `"zip"`, `"tar"`, `"tar.gz"`, `"tar.zst"`; auto = detecta magic, si no, la extensión |
| `max_entries` | 100000 | Rechaza archivos con más entradas (defensa contra bombas de descompresión) |
| `max_total_bytes` | 2 GiB | Tope de la salida descomprimida acumulada durante la lectura/extracción |
| `max_file_bytes` | 1 GiB | Tope del tamaño descomprimido de una sola entrada |
| `max_inline_bytes` | 16 MiB | Tope duro para la llamada `read()`, que materializa en RAM; por encima, use `stream()`/`extract()` |
| `buffer_bytes` | 64 KiB | Búfer de copia en streaming para lectura/extracción/adición |

`max_total_bytes`/`max_file_bytes` son topes de trabajo, no topes de RAM — hacer streaming de una entrada nunca retiene más que `buffer_bytes` más la ventana de descompresión del códec. El único ajuste que dimensiona la RAM es `max_inline_bytes`.

## Lectura — Acceso Aleatorio

`archive.open(source, ...)` abre una fuente **con búsqueda** para acceso aleatorio completo (el directorio central del zip se lee por adelantado; las entradas se descomprimen bajo demanda). La fuente puede ser un handle `fs.FS` más una ruta, un `fs.File` abierto, bytes en bruto (los bytes mantienen todo el archivo en RAM — solo archivos pequeños), o cualquier lector de acceso aleatorio entregado por otro módulo.

Un lector de otro módulo califica cuando implementa `io.ReaderAt` e informa de su `Size`; un `Name` opcional se usa para detectar la extensión cuando se omite `opts.format`. El `open_reader` de [`cloudstorage`](lua/storage/cloud.md) es uno de ellos, y lee un archivo de varios GB directamente desde el almacenamiento de objetos. En ese caso el archive no abre nada y nunca cierra el lector — lo hace su propietario.

```lua
local fs = require("fs")
local archive = require("archive")

-- Abrir por handle de fs + ruta (el módulo abre el archivo y posee su ciclo de vida)
local r, err = archive.open(fs.get("app:uploads"), "incoming.zip")
-- O desde un fs.File ya abierto con búsqueda
-- local r = archive.open(fs:get("app:uploads"):open("x.zip"))
-- O desde bytes en bruto (solo archivos pequeños)
-- local r = archive.open(zip_bytes, { format = "zip" })
-- O desde un lector de acceso aleatorio propiedad de otro módulo
-- local reader = cloudstorage.get("app:files"):open_reader("incoming.zip")
-- local r = archive.open(reader)
```

**Retorna:** `Reader, error`

**Permiso:** `archive.read`

### entries

Itere el directorio (solo metadatos — sin descompresión):

```lua
for e in r:entries() do
    -- e: name, size, compressed_size, is_dir, mode, modified, method, crc32, type
    print(e.name, e.size, e.is_dir)
end
```

### stat

Obtenga los metadatos de una entrada por nombre (sin descompresión):

```lua
local info, err = r:stat("docs/readme.md")
```

### read

Materialice una sola entrada como cadena Lua. Da error (`kind = Invalid`) por encima de `max_inline_bytes` — para cualquier cosa grande, use `stream()` o `extract()`:

```lua
local data, err = r:read("docs/readme.md")  -- solo entradas pequeñas
```

### stream

Retorna la entrada como un `stream.Stream` que descomprime bajo demanda. Se compone en todas partes donde lo hace un stream — `:scanner()`, `fs:writefile()`, o entregado a otro módulo:

```lua
local es, err = r:stream("big.csv")
while true do
    local chunk = es:read(65536)
    if not chunk then break end
    process(chunk)
end
es:close()
```

### extract

Haga streaming de una entrada hacia un sistema de archivos de destino:

```lua
local ok, err = r:extract("docs/readme.md", fs.get("app:out"))
-- ruta de destino opcional:
-- r:extract("docs/readme.md", fs.get("app:out"), "readme.md")
```

### extract_all

Haga streaming de cada entrada hacia un sistema de archivos de destino:

```lua
local count, err = r:extract_all(fs.get("app:out"), {
    prefix = "job123/",          -- se antepone a cada ruta de destino
    strip  = 1,                  -- descarta N componentes iniciales de la ruta
    filter = function(e) return not e.is_dir end,
})
```

Los nombres de entrada se sanean al extraer — se rechazan los segmentos `..`, las rutas absolutas y los prefijos de unidad/UNC de Windows (defensa contra zip-slip).

### close

Cierra el lector. Idempotente; también se cierra automáticamente al alcance de la tarea.

```lua
r:close()
```

## Lectura — Escaneo Secuencial

`archive.scan(source, opts?)` abre un stream **solo hacia adelante** (el cuerpo de una subida HTTP, un stream de archivo multipart). Las entradas se visitan en el orden del archivo; el lector de cada entrada es válido solo hasta que usted avanza. Sin `read(name)` aleatorio.

```lua
local up = form.files.upload[1]:stream()        -- stream.Stream
local s, err = archive.scan(up, { format = "zip" })

for e, entry in s:walk() do                      -- entry es un stream.Stream
    if not e.is_dir then
        fs.get("app:uploads"):writefile("job123/" .. e.name, entry)
    end
end
s:close()
```

**Retorna:** `Walker, error`

**Permiso:** `archive.read`

Un walker también admite `extract_all` con las mismas opciones que el lector de acceso aleatorio, transmitiendo cada entrada hacia un sistema de archivos de destino en una sola llamada:

```lua
local count, err = s:extract_all(fs.get("app:uploads"), { prefix = "job123/" })
```

`tar`, `tar.gz` y `tar.zst` hacen streaming de forma nativa. `zip` se analiza mediante cabeceras locales por entrada; las entradas escritas con un descriptor de datos en streaming (tamaño/CRC tras los datos) se leen descomprimiendo hasta el límite de la entrada. Para un manejo robusto de zip en subidas grandes, aterrice primero la subida como archivo (una copia secuencial acotada) y luego use `archive.open`:

```lua
local dst = fs.get("app:tmp")
dst:writefile("u.zip", req:stream())   -- copia en streaming de la subida → archivo en fs
local r = archive.open(dst, "u.zip")   -- acceso aleatorio robusto
-- ... entries / extract_all ...
r:close()
dst:remove("u.zip")
```

## Escritura

`archive.create(dest, ...)` construye un archivo haciendo streaming de entradas hacia un destino — un archivo en un fs (con una ruta) o un `stream.Stream` escribible (por ejemplo, una respuesta HTTP), de modo que un `.zip` de descarga se genera directamente hacia el cable con memoria acotada.

```lua
local w, err = archive.create(fs.get("app:tmp"), "out.zip", { format = "zip" })
-- o haga streaming hacia una respuesta:
-- local w = archive.create(res:stream(), { format = "zip" })
```

**Retorna:** `Writer, error`

**Permiso:** `archive.write`

### add

Añada una entrada desde una cadena, bytes, un lector o un `stream.Stream`:

```lua
w:add("notes.txt", "hello")
w:add("from_upload", some_stream, { method = "deflate", mode = tonumber("644", 8) })
```

### add_file

Haga streaming de una entrada desde un archivo en un sistema de archivos:

```lua
w:add_file("data/big.bin", fs.get("app:data"), "big.bin")
```

### add_dir

Añada una entrada de directorio:

```lua
w:add_dir("empty/")
```

### close

Finalice el archivo (escribe el directorio central para zip). Idempotente; también se cierra automáticamente al alcance de la tarea.

```lua
w:close()
```

Opciones de `add*`: `{ method = "store"|"deflate", mode, size }`. Los formatos tar necesitan el tamaño de la entrada por adelantado, así que `add()` desde un stream o lector hacia un archivo `tar*` requiere `size` (las cadenas y `add_file` lo proporcionan). El escritor de zip hace streaming hacia escritores sin búsqueda usando descriptores de datos, así que escribir hacia un stream de respuesta funciona.

## Errores

| Condición | Kind |
|-----------|------|
| La fuente no es un handle de fs, un archivo de fs, bytes ni un lector de acceso aleatorio | `errors.INVALID` |
| Formato desconocido o no coincidente | `errors.INVALID` |
| Archivo corrupto o truncado | `errors.INVALID` |
| Límite excedido (entradas / total / archivo / inline) | `errors.INVALID` |
| Acceso aleatorio en un formato solo de stream (use `scan`) | `errors.UNAVAILABLE` |
| Nombre de entrada no encontrado | `errors.NOT_FOUND` |
| Fuente no legible / destino no escribible | `errors.PERMISSION_DENIED` |
| Lectura de una entrada en streaming obsoleta después de que el recorrido avanzara | `errors.INTERNAL` |

Consulte [Manejo de Errores](lua/core/errors.md) para trabajar con errores.

## Vea También

- [Sistema de Archivos](lua/storage/filesystem.md) - Sistemas de archivos de origen y destino
- [Stream](lua/core/stream.md) - Objetos stream entregados a y desde los archives
- [Compresión](lua/data/compress.md) - gzip/deflate/zstd en memoria
- [Almacenamiento en la Nube](lua/storage/cloud.md) - `open_reader` como fuente de archive con acceso aleatorio
