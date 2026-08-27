---
title: "Sistema de archivos"
description: "Lee, escribe y administra archivos en un volumen de sistema de archivos configurado."
---

# Sistema de archivos
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

El módulo `fs` lee, escribe y administra archivos dentro de volúmenes de sistema de archivos configurados.

Esta página es una referencia de API. Sus fragmentos presuponen un volumen configurado y permiso para adquirirlo. Cada bloque es una operación aislada o una receta parcial; los valores y callbacks de la aplicación, como `config`, `message`, `process` y `report_cleanup_error`, deben existir. `report_cleanup_error(err)` registra un fallo de cierre sin sustituir un error de operación ya producido.

Para configurar el sistema de archivos, consulta [Sistema de archivos](../../system/filesystem.md).

## Carga

```lua
local fs = require("fs")
```

## Adquisición de un volumen

Adquiere un volumen de sistema de archivos por su ID de registro:

```lua
local vol, err = fs.get("app:storage")
if err then
    return nil, err
end

local content, read_err = vol:readfile("/config.json")
if read_err then return nil, read_err end
return content
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | ID de registro del volumen |

**Devuelve:** `FS, error`

<note>
Los volúmenes no requieren liberación explícita. El sistema los administra y un volumen deja de estar disponible cuando su sistema de archivos se desvincula del registro.
</note>

## Lectura de archivos

Lee un archivo completo:

```lua
local json = require("json")

local vol, get_err = fs.get("app:config")
if get_err then return nil, get_err end

local data, err = vol:readfile("/settings.json")
if err then
    return nil, err
end

local config, decode_err = json.decode(data)
if decode_err then return nil, decode_err end
return config
```

Usa `open()` para procesar un archivo grande por streaming:

```lua
local errors = require("errors")

local file, err = vol:open("/data/large.csv", "r")
if err then
    return nil, err
end

while true do
    local chunk, err = file:read(65536)
    if err then
        if err:kind() == errors.NOT_FOUND then
            break -- EOF
        end
        local _, close_err = file:close()
        if close_err then report_cleanup_error(close_err) end
        return nil, err
    end
    process(chunk)
end

local _, close_err = file:close()
if close_err then return nil, close_err end
```

## Escritura de archivos

Escribe una cadena o un stream respaldado por un reader en un archivo:

```lua
local json = require("json")

local vol, get_err = fs.get("app:data")
if get_err then return nil, get_err end

-- Overwrite (default)
local encoded, encode_err = json.encode(config)
if encode_err then return nil, encode_err end
local _, write_err = vol:writefile("/config.json", encoded)
if write_err then return nil, write_err end

-- Append
local _, append_err = vol:writefile("/logs/app.log", message .. "\n", "a")
if append_err then return nil, append_err end

-- Exclusive write (fails if exists)
local ok, err = vol:writefile("/lock.pid", tostring(pid), "wx")
if err then return nil, err end

-- Copy from an open file or another reader-backed value
local source, err = vol:open("/incoming/report.csv", "r")
if err then
    return nil, err
end
local copied, err = vol:writefile("/archive/report.csv", source)
local _, close_err = source:close()
if err then
    if close_err then report_cleanup_error(close_err) end
    return nil, err
end
if close_err then return nil, close_err end
return copied
```

| Modo | Descripción |
|------|-------------|
| `"w"` | Sobrescribir (predeterminado) |
| `"a"` | Agregar |
| `"wx"` | Escritura exclusiva (falla si el archivo existe) |

Usa un handle de archivo para escrituras por streaming:

```lua
local file, open_err = vol:open("/output/report.txt", "w")
if open_err then return nil, open_err end
local _, header_err = file:write("Header\n")
if header_err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, header_err
end
local _, data_err = file:write("Data: " .. value .. "\n")
if data_err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, data_err
end
local _, sync_err = file:sync()
if sync_err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, sync_err
end
local _, close_err = file:close()
if close_err then return nil, close_err end
```

## Comprobación de rutas

```lua
local vol, get_err = fs.get("app:data")
if get_err then return nil, get_err end

-- Check existence
local exists, exists_err = vol:exists("/cache/results.json")
if exists_err then return nil, exists_err end
if exists then
    return vol:readfile("/cache/results.json")
end

-- Check if directory
local is_dir, isdir_err = vol:isdir(path)
if isdir_err then return nil, isdir_err end
if is_dir then
    process_directory(path)
end

-- Get file info
local info, stat_err = vol:stat("/documents/report.pdf")
if stat_err then return nil, stat_err end
print(info.size, info.modified, info.type)
```

**Campos de stat:** `name`, `size`, `mode`, `modified`, `is_dir`, `type`

## Operaciones con directorios

```lua
local vol, get_err = fs.get("app:data")
if get_err then return nil, get_err end

-- Create directory
local _, mkdir_err = vol:mkdir("/uploads/" .. user_id)
if mkdir_err then return nil, mkdir_err end

-- List directory contents
local iter, state = vol:readdir("/documents")
if not iter then return nil, state end
for entry in iter, state do
    print(entry.name, entry.type)
end

-- Remove file or empty directory
local removed, remove_err = vol:remove("/temp/file.txt")
if remove_err then return nil, remove_err end
return removed
```

Campos de entrada: `name`, `type` ("file" o "directory")

`mkdir` crea un único directorio y no crea los padres que falten. `remove` solo acepta archivos y directorios vacíos.

## Métodos de los handles de archivo

Cuando se usa `vol:open()` para streaming:

| Método | Descripción |
|--------|-------------|
| `read(size?)` | Leer bytes (predeterminado: 4096) |
| `write(data)` | Escribir datos string |
| `seek(whence, offset)` | Establecer la posición ("set", "cur", "end") |
| `stat()` | Obtener info del archivo (mismos campos que `vol:stat`) |
| `sync()` | Vaciar al almacenamiento |
| `close()` | Liberar handle de archivo |
| `scanner(split?)` | Crear un escáner de líneas o palabras |

Llama a `close()` cuando termines de usar un handle de archivo.

## Scanner

Usa un escáner para procesar línea por línea:

```lua
local file, err = vol:open("/data/users.csv", "r")
if err then
    return nil, err
end
local scanner, err = file:scanner("lines")
if err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, err
end

scanner:scan()  -- skip header

while scanner:scan() do
    local line = scanner:text()
    process(line)
end

local scan_err = scanner:err()
if scan_err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, scan_err
end

local _, close_err = file:close()
if close_err then return nil, close_err end
```

Modos de división: `"lines"` (predeterminado), `"words"`, `"bytes"`, `"runes"`

`scanner:scan()` solo devuelve un booleano. Cuando devuelve `false`, llama a `scanner:err()` para distinguir un EOF limpio de un fallo de tokenización o de lectura subyacente. `scanner:err()` devuelve un error estructurado `INTERNAL` o `nil`; a diferencia de un escáner de stream, el escáner de archivos no tiene un resultado de error separado para el dispatch de scan.

## Constantes

```lua
fs.type.FILE      -- "file"
fs.type.DIR       -- "directory"

fs.seek.SET       -- from start
fs.seek.CUR       -- from current
fs.seek.END       -- from end
```

## Métodos de FS

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `readfile(path)` / `read_file(path)` | `string, error` | Leer archivo completo |
| `writefile(path, data, mode?)` / `write_file(path, data, mode?)` | `boolean, error` | Escribir una cadena o un valor respaldado por un reader |
| `exists(path)` | `boolean, error` | Verificar si ruta existe |
| `stat(path)` | `table, error` | Obtener información de archivo |
| `isdir(path)` | `boolean, error` | Verificar si es directorio |
| `mkdir(path)` | `boolean, error` | Crear directorio |
| `remove(path)` | `boolean, error` | Eliminar un archivo o directorio vacío |
| `readdir(path)` | `iterator, state` | Listar un directorio (usar en un bucle `for` genérico) |
| `open(path, mode)` | `File, error` | Abrir handle de archivo |
| `chdir(path)` | `boolean, error` | Cambiar directorio de trabajo |
| `pwd()` | `string, error` | Obtener directorio de trabajo |

## Permisos

La evaluación de políticas de seguridad se aplica cuando se adquiere un volumen.

| Acción | Recurso | Descripción |
|--------|---------|-------------|
| `fs.get` | ID del volumen | Adquirir un volumen de sistema de archivos |

## Errores

| Condición | Clase | Reintentable |
|-----------|------|--------------|
| Ruta vacía | `errors.INVALID` | sin especificar |
| La ruta contiene un byte nulo | `errors.INVALID` | no |
| Modo no válido | `errors.INVALID` | sin especificar |
| `scanner()` llamado sobre un archivo cerrado | `errors.INVALID` | sin especificar |
| Lectura, escritura, seek, stat o sync sobre un archivo cerrado | `errors.INTERNAL` | no |
| `close()` llamado sobre un archivo ya cerrado | correcto | no aplicable |
| La lectura del handle alcanzó EOF | `errors.NOT_FOUND` | sin especificar |
| Ruta no encontrada | `errors.NOT_FOUND` | se conserva del error subyacente cuando está disponible |
| La ruta ya existe | `errors.ALREADY_EXISTS` | sin especificar |
| Permiso denegado | `errors.PERMISSION_DENIED` | no |
| Error de tokenización o lectura del escáner de archivos | `errors.INTERNAL` | se conserva del error subyacente cuando está disponible |

`unspecified` significa que `err:retryable()` devuelve `nil`; no equivale a `false`.

Consulta [Manejo de errores](../core/errors.md) para trabajar con errores.
