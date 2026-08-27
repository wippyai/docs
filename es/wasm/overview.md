---
title: "Runtime de WebAssembly"
description: "Ejecuta funciones WAT y WASM o procesos WASM junto a Lua mediante entradas del registro."
---

# Runtime de WebAssembly

> El entorno de ejecución WASM es una extensión experimental. La configuración es estable, pero sus componentes internos pueden cambiar entre versiones.

Wippy registra módulos WebAssembly junto al código Lua. Las entradas de función se incorporan al registro de funciones y se ejecutan mediante pools de funciones; las entradas de proceso registran fábricas de procesos y se ejecutan bajo hosts de procesos. Ambos utilizan el planificador y el modelo de seguridad del entorno de ejecución.

**Clasificación: descripción conceptual.** El bloque Lua contiene patrones de llamada independientes y presupone que las entradas WASM nombradas y sus contratos WIT ya están registrados. Consulta el tutorial de Rust/WASM para ver un proyecto con un componente compilado.

## Tipos de entrada

| Tipo | Descripción |
|------|-------------|
| `function.wat` | Función en formato WebAssembly Text definida en línea en YAML |
| `function.wasm` | Binario WASM precompilado cargado desde una entrada del sistema de archivos |
| `process.wasm` | Binario WASM ejecutado como proceso (comandos CLI o de larga duracion) |

## Cómo funciona

1. Los módulos WASM se declaran como entradas del registro en `_index.yaml`
2. Durante el arranque, las entradas `function.wat` y `function.wasm` se compilan, se registran como funciones y se colocan en los pools de funciones configurados
3. Lua llama a esas entradas de función mediante `funcs.call()`
4. Las entradas `process.wasm`, en cambio, registran fábricas de procesos y se generan bajo un host de procesos
5. Los argumentos y valores de retorno de las funciones se mapean entre tablas Lua y tipos WIT
6. Las operaciones compatibles enlazadas al dispatcher, incluidos el sondeo de relojes y HTTP saliente, ceden el control para que el planificador pueda ejecutar otro trabajo

## Modelo de Componentes

Wippy admite el modelo de componentes de WebAssembly con WIT (WebAssembly Interface Types). Los módulos de componentes mapean estos tipos entre el host y el invitado:

- Los records se mapean a tablas Lua con campos nombrados
- Las listas se mapean a arrays Lua
- Los results se mapean a tuplas de retorno `(value, error)`
- Los primitivos (`s32`, `f64`, `string`, etc.) se mapean directamente

Los módulos WASM raw/core también son compatibles mediante firmas WIT explícitas.

## Llamar a WASM desde Lua

Llama a una función WASM mediante su ID de registro con `funcs.call()`:

```lua
local funcs = require("funcs")

-- No arguments
local result, err = funcs.call("myns:answer_wat")
if err then return nil, err end

-- With arguments
local computed, compute_err = funcs.call("myns:compute", 6, 7)
if compute_err then return nil, compute_err end

-- With complex data
local users = {
    {id = 1, name = "Alice", tags = {"admin"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
}
local transformed, err = funcs.call("myns:transform_users", users)
if err then return nil, err end
```

## Seguridad

Las ejecuciones WASM heredan el contexto de seguridad del llamador por defecto:

- La identidad del actor se hereda
- El alcance se hereda
- El contexto de la solicitud se hereda

Las capacidades del host se habilitan mediante imports explícitos. Cada entrada declara los perfiles de host que necesita, como `funcs`, `wasi1`, `wasi:cli` o `wasi:filesystem`, lo que limita la superficie de acceso del módulo. Habilitar un perfil no elude las comprobaciones de seguridad del entorno de ejecución para operaciones como llamadas a funciones, sockets o HTTP saliente.

## Véase también

- [Funciones](./functions.md) - Configuración de entradas de funciones WASM
- [Funciones del host](./hosts.md) - Interfaces WASI y Wippy disponibles en el host
- [Procesos](./processes.md) - Ejecución de WASM como procesos de larga duración
- [Tutorial de Rust/WASM](../tutorials/rust-wasm.md) - Compilación y registro de un componente
