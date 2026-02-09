# Runtime de WebAssembly

> El runtime de WASM es una extension experimental. La configuracion es estable, pero los componentes internos del runtime pueden cambiar entre versiones.

Wippy ejecuta modulos WebAssembly como entradas de registro de primera clase junto al codigo Lua. Las funciones y procesos WASM se ejecutan dentro del mismo planificador, comparten el mismo modelo de seguridad e interoperan con Lua a traves del registro de funciones.

## Tipos de Entrada

| Kind | Description |
|------|-------------|
| `function.wat` | Funcion en formato WebAssembly Text definida en linea en YAML |
| `function.wasm` | Binario WASM precompilado cargado desde una entrada del sistema de archivos |
| `process.wasm` | Binario WASM ejecutado como proceso (comandos CLI o de larga duracion) |

## Como Funciona

1. Los modulos WASM se declaran como entradas del registro en `_index.yaml`
2. Al iniciar, los modulos se compilan y se colocan en pools de workers
3. El codigo Lua (u otro WASM) los invoca mediante `funcs.call()`
4. Los argumentos y valores de retorno se mapean automaticamente entre tablas Lua y tipos WIT
5. Las operaciones asincronas (E/S, sleep, HTTP) ceden el control a traves del dispatcher, igual que Lua

## Modelo de Componentes

Wippy soporta el Modelo de Componentes de WebAssembly con WIT (WebAssembly Interface Types). Los modulos de componentes obtienen mapeo completo de tipos entre el host y el guest:

- Los records se mapean a tablas Lua con campos nombrados
- Las listas se mapean a arrays Lua
- Los results se mapean a tuplas de retorno `(value, error)`
- Los primitivos (`s32`, `f64`, `string`, etc.) se mapean directamente

Los modulos WASM raw/core tambien son soportados con firmas WIT explicitas.

## Llamando WASM desde Lua

Las funciones WASM se invocan de la misma manera que cualquier otra funcion en el registro:

```lua
local funcs = require("funcs")

-- No arguments
local result, err = funcs.call("myns:answer_wat")

-- With arguments
local result, err = funcs.call("myns:compute", 6, 7)

-- With complex data
local users = {
    {id = 1, name = "Alice", tags = {"admin"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
}
local transformed, err = funcs.call("myns:transform_users", users)
```

## Seguridad

Las ejecuciones WASM heredan el contexto de seguridad del llamador por defecto:

- La identidad del actor se hereda
- El alcance se hereda
- El contexto de la solicitud se hereda

Las capacidades del host son opt-in a traves de imports explicitos. Cada entrada declara exactamente que interfaces WASI necesita (`wasi:cli`, `wasi:filesystem`, etc.), limitando la superficie de acceso del modulo.

## Ver Tambien

- [Funciones](wasm/functions.md) - Configuracion de entradas de funciones WASM
- [Funciones Host](wasm/hosts.md) - Interfaces WASI y Wippy host disponibles
- [Procesos](wasm/processes.md) - Ejecucion de WASM como procesos de larga duracion
