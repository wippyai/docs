# Linter

Wippy incluye un linter integrado que realiza verificacion de tipos y analisis estatico en codigo Lua. Ejecutalo con `wippy lint`.

## Uso

```bash
wippy lint                        # Check all Lua entries
wippy lint --level hint           # Show all diagnostics including hints
wippy lint --json                 # Output in JSON format
wippy lint --ns app               # Check only the app namespace
wippy lint --summary              # Group results by error code
```

## Que se Verifica

El linter valida todos los tipos de entradas Lua:

- `function.lua.*` - Funciones
- `library.lua.*` - Bibliotecas
- `process.lua.*` - Procesos
- `workflow.lua.*` - Workflows

Cada entrada es analizada, verificada en tipos y examinada en busca de problemas de correccion.

## Niveles de Severidad

Los diagnosticos tienen tres niveles de severidad:

| Nivel | Descripcion |
|-------|-------------|
| `error` | Errores de tipo y problemas de correccion que deben corregirse |
| `warning` | Posibles bugs o patrones problematicos |
| `hint` | Sugerencias de estilo y notas informativas |

Controla que niveles aparecen con `--level`:

```bash
wippy lint --level error          # Errors only
wippy lint --level warning        # Warnings and errors (default)
wippy lint --level hint           # Everything
```

## Codigos de Error

### Errores de Analisis

| Codigo | Descripcion |
|--------|-------------|
| `P0001` | Error de sintaxis Lua - el codigo fuente no puede ser analizado |

### Errores de Verificacion de Tipos (serie E)

Los errores del verificador de tipos (`E0001`+) reportan problemas encontrados por el sistema de tipos: incompatibilidades de tipos, variables no definidas, operaciones invalidas y problemas de correccion similares. Siempre se reportan como errores.

```lua
local x: number = "hello"         -- E: string not assignable to number

local function add(a: number, b: number): number
    return a + b
end

add("one", "two")                  -- E: string not assignable to number
```

### Advertencias de Reglas de Lint (Serie W)

Las reglas de lint proporcionan verificaciones de estilo y calidad. Activalas con `--rules`:

```bash
wippy lint --rules
```

| Codigo | Regla | Descripcion |
|--------|-------|-------------|
| `W0001` | no-empty-blocks | Bloques de sentencias vacios |
| `W0002` | no-global-assign | Asignacion a variables globales |
| `W0003` | no-self-compare | Comparacion de un valor consigo mismo |
| `W0004` | no-unused-vars | Variables locales sin usar |
| `W0005` | no-unused-params | Parametros de funcion sin usar |
| `W0006` | no-unused-imports | Importaciones sin usar |
| `W0007` | no-shadowed-vars | Variable oculta el ambito externo |

Sin `--rules`, solo se realiza la verificacion de tipos (codigos P y E).

## Filtrado

### Por Namespace

Verifica namespaces especificos usando `--ns`:

```bash
wippy lint --ns app               # Exact namespace match
wippy lint --ns "app.*"           # All under app
wippy lint --ns app --ns lib      # Multiple namespaces
```

Las dependencias de las entradas seleccionadas se cargan para la verificacion de tipos pero sus diagnosticos no se reportan.

### Por Codigo de Error

Filtra diagnosticos por codigo:

```bash
wippy lint --code E0001
wippy lint --code E0001 --code E0004
```

### Por Cantidad

Limita la cantidad de diagnosticos mostrados:

```bash
wippy lint --limit 10             # Show first 10 issues
```

## Formatos de Salida

### Formato Tabla (Por Defecto)

Cada diagnostico se muestra con contexto del codigo fuente, ubicacion del archivo y el mensaje de error. Los resultados se ordenan por entrada, severidad y numero de linea.

Una linea de resumen muestra los totales:

```
Checked 42 entries: 5 errors, 12 warnings
```

### Formato Resumen

Agrupa diagnosticos por namespace y codigo de error:

```bash
wippy lint --summary
```

```
By namespace:

  app                              15 issues (5 errors, 10 warnings)
  lib                               2 issues (2 warnings)

By error code:

  E0001      [error  ]    5 occurrences
  E0004      [error  ]    3 occurrences

Checked 42 entries: 5 errors, 12 warnings
```

### Formato JSON

Salida legible por maquinas para integracion CI/CD:

```bash
wippy lint --json
```

```json
{
  "diagnostics": [
    {
      "entry_id": "app:handler",
      "code": "E0001",
      "severity": "error",
      "message": "string not assignable to number",
      "line": 10,
      "column": 5
    }
  ],
  "total_entries": 42,
  "error_count": 5,
  "warning_count": 12,
  "hint_count": 0
}
```

## Cache

El linter almacena resultados en cache para acelerar ejecuciones repetidas. Las claves de cache se basan en el hash del codigo fuente, nombre del metodo, dependencias y configuracion del sistema de tipos.

Limpia el cache si los resultados parecen desactualizados:

```bash
wippy lint --cache-reset
```

## Integracion CI/CD

Usa la salida JSON y codigos de salida para verificaciones automatizadas:

```bash
wippy lint --json --level error > lint-results.json
```

El linter termina con codigo 0 cuando no se encuentran errores, y con un valor distinto de cero cuando hay errores.

Ejemplo de paso en GitHub Actions:

```yaml
- name: Lint
  run: wippy lint --level warning
```

## Referencia de Flags

| Flag | Corto | Por Defecto | Descripcion |
|------|-------|-------------|-------------|
| `--level` | | warning | Nivel minimo de severidad (error, warning, hint) |
| `--json` | | false | Salida en formato JSON |
| `--ns` | | | Filtrar por patrones de namespace |
| `--code` | | | Filtrar por codigos de error |
| `--limit` | | 0 | Maximo de diagnosticos a mostrar (0 = ilimitado) |
| `--summary` | | false | Agrupar por codigo de error |
| `--no-color` | | false | Desactivar salida con colores |
| `--rules` | | false | Activar reglas de lint (verificaciones de estilo/calidad serie W) |
| `--cache-reset` | | false | Limpiar cache antes del analisis |
| `--lock-file` | `-l` | wippy.lock | Ruta al archivo de bloqueo |

## Ver Tambien

- [CLI](guides/cli.md) - Referencia completa del CLI
- [Tipos](lua/types.md) - Documentacion del sistema de tipos
- [LSP](guides/lsp.md) - Integracion con editores con diagnosticos en vivo
