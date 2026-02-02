# Sistema de Archivos
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Leer, escribir y gestionar archivos dentro de volumenes de sistema de archivos aislados.

Para configuración del sistema de archivos, consulte [Sistema de Archivos](system-filesystem.md).

## Carga

```lua
local fs = require("fs")
```

## Adquirir un Volumen

Obtener un volumen de sistema de archivos por ID de registro:

```lua
local vol, err = fs.get("app:storage")
if err then
    return nil, err
end

local content = vol:readfile("/config.json")
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | ID de registro del volumen |

**Devuelve:** `FS, error`

<note>
Los volumenes no requieren liberacion explicita. Se gestionan a nivel de sistema y quedan no disponibles si el sistema de archivos se desconecta del registro.
</note>

## Leer Archivos

Leer contenido completo del archivo:

```lua
local vol = fs.get("app:config")

local data, err = vol:readfile("/settings.json")
if err then
    return nil, err
end

local config = json.decode(data)
```

Para archivos grandes, use streaming con `open()`:

```lua
local file = vol:open("/data/large.csv", "r")

while true do
    local chunk = file:read(65536)
    if not chunk or #chunk == 0 then break end
    process(chunk)
end

file:close()
```

## Escribir Archivos

Escribir datos a un archivo:

```lua
local vol = fs.get("app:data")

-- Sobrescribir (predeterminado)
vol:writefile("/config.json", json.encode(config))

-- Agregar
vol:writefile("/logs/app.log", message .. "\n", "a")

-- Escritura exclusiva (falla si existe)
local ok, err = vol:writefile("/lock.pid", tostring(pid), "wx")
```

| Modo | Descripción |
|------|-------------|
| `"w"` | Sobrescribir (predeterminado) |
| `"a"` | Agregar |
| `"wx"` | Escritura exclusiva (falla si el archivo existe) |

Para escrituras en streaming:

```lua
local file = vol:open("/output/report.txt", "w")
file:write("Header\n")
file:write("Data: " .. value .. "\n")
file:sync()
file:close()
```

## Verificar Rutas

```lua
local vol = fs.get("app:data")

-- Verificar existencia
if vol:exists("/cache/results.json") then
    return vol:readfile("/cache/results.json")
end

-- Verificar si es directorio
if vol:isdir(path) then
    process_directory(path)
end

-- Obtener información de archivo
local info = vol:stat("/documents/report.pdf")
print(info.size, info.modified, info.type)
```

**Campos de stat:** `name`, `size`, `mode`, `modified`, `is_dir`, `type`

## Operaciones de Directorio

```lua
local vol = fs.get("app:data")

-- Crear directorio
vol:mkdir("/uploads/" .. user_id)

-- Listar contenido del directorio
for entry in vol:readdir("/documents") do
    print(entry.name, entry.type)
end

-- Eliminar archivo o directorio vacio
vol:remove("/temp/file.txt")
```

Campos de entrada: `name`, `type` ("file" o "directory")

## Metodos de Handle de Archivo

Cuando se usa `vol:open()` para streaming:

| Método | Descripción |
|--------|-------------|
| `read(size?)` | Leer bytes (predeterminado: 4096) |
| `write(data)` | Escribir datos string |
| `seek(whence, offset)` | Establecer posicion ("set", "cur", "end") |
| `sync()` | Vaciar al almacenamiento |
| `close()` | Liberar handle de archivo |
| `scanner(split?)` | Crear escaner de linea/palabra |

Siempre llame `close()` cuando termine con un handle de archivo.

## Scanner

Para procesamiento linea por linea:

```lua
local file = vol:open("/data/users.csv", "r")
local scanner = file:scanner("lines")

scanner:scan()  -- saltar cabecera

while scanner:scan() do
    local line = scanner:text()
    process(line)
end

file:close()
```

Modos de division: `"lines"` (predeterminado), `"words"`, `"bytes"`, `"runes"`

## Constantes

```lua
fs.type.FILE      -- "file"
fs.type.DIR       -- "directory"

fs.seek.SET       -- desde inicio
fs.seek.CUR       -- desde actual
fs.seek.END       -- desde final
```

## Metodos de FS

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `readfile(path)` | `string, error` | Leer archivo completo |
| `writefile(path, data, mode?)` | `boolean, error` | Escribir archivo |
| `exists(path)` | `boolean, error` | Verificar si ruta existe |
| `stat(path)` | `table, error` | Obtener información de archivo |
| `isdir(path)` | `boolean, error` | Verificar si es directorio |
| `mkdir(path)` | `boolean, error` | Crear directorio |
| `remove(path)` | `boolean, error` | Eliminar archivo/directorio vacio |
| `readdir(path)` | `iterator` | Listar directorio |
| `open(path, mode)` | `File, error` | Abrir handle de archivo |
| `chdir(path)` | `boolean, error` | Cambiar directorio de trabajo |
| `pwd()` | `string` | Obtener directorio de trabajo |

## Permisos

El acceso al sistema de archivos esta sujeto a evaluacion de politica de seguridad.

| Accion | Recurso | Descripción |
|--------|---------|-------------|
| `fs.get` | ID de Volumen | Adquirir volumen de sistema de archivos |

## Errores

| Condición | Tipo | Reintentable |
|-----------|------|--------------|
| Ruta vacia | `errors.INVALID` | no |
| Modo invalido | `errors.INVALID` | no |
| Archivo cerrado | `errors.INVALID` | no |
| Ruta no encontrada | `errors.NOT_FOUND` | no |
| Ruta ya existe | `errors.ALREADY_EXISTS` | no |
| Permiso denegado | `errors.PERMISSION_DENIED` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
