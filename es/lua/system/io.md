# E/S de Terminal
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Leer desde stdin y escribir a stdout/stderr para aplicaciones CLI.

<note>
Este modulo solo funciona dentro de contexto de terminal. No puede usarlo desde funciones regulares, solo desde procesos ejecutandose en un <a href="system-terminal.md">Terminal Host</a>.
</note>

## Carga

```lua
local io = require("io")
```

## Escribir a Stdout

Escribir strings a stdout sin nueva linea:

```lua
local ok, err = io.write("text", "more")
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `...` | string | Numero variable de strings a escribir |

**Devuelve:** `boolean, error`

## Print con Nueva Linea

Escribir valores a stdout con tabs entre ellos y nueva linea al final:

```lua
io.print("value1", "value2", 123)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `...` | any | Numero variable de valores a imprimir |

**Devuelve:** `boolean, error`

## Escribir a Stderr

Escribir valores a stderr con tabs entre ellos y nueva linea al final:

```lua
io.eprint("Error:", message)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `...` | any | Numero variable de valores a imprimir |

**Devuelve:** `boolean, error`

## Leer Bytes

Leer hasta n bytes desde stdin:

```lua
local data, err = io.read(1024)
```

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `n` | integer | Numero de bytes a leer (predeterminado: 1024, valores <= 0 se convierten en 1024) |

**Devuelve:** `string, error`

## Leer una Linea

Leer una linea desde stdin hasta nueva linea:

```lua
local line, err = io.readline()
```

**Devuelve:** `string, error`

## Vaciar Salida

Vaciar buffer de stdout:

```lua
local ok, err = io.flush()
```

**Devuelve:** `boolean, error`

## Argumentos de Linea de Comandos

Obtener argumentos de linea de comandos:

```lua
local args = io.args()
```

**Devuelve:** `string[]`

## Errores

| Condicion | Tipo | Reintentable |
|-----------|------|--------------|
| Sin contexto de terminal | `errors.UNAVAILABLE` | no |
| Operacion de escritura fallida | `errors.INTERNAL` | no |
| Operacion de lectura fallida | `errors.INTERNAL` | no |
| Operacion de flush fallida | `errors.INTERNAL` | no |

Consulte [Manejo de Errores](lua-errors.md) para trabajar con errores.
