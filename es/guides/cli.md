# Referencia de CLI

Interfaz de línea de comandos para el runtime de Wippy.

## Flags Globales

Disponibles en todos los comandos:

| Flag | Corto | Descripción |
|------|-------|-------------|
| `--config` | | Archivo de configuración (por defecto: .wippy.yaml) |
| `--verbose` | `-v` | Habilitar registro de depuración |
| `--very-verbose` | | Depuración con trazas de pila |
| `--console` | `-c` | Registro en consola con colores |
| `--silent` | `-s` | Deshabilitar registro en consola |
| `--event-streams` | `-e` | Transmitir registros al bus de eventos |
| `--profiler` | `-p` | Habilitar pprof en localhost:6060 |
| `--memory-limit` | `-m` | Límite de memoria (ej., 1G, 512M) |

Prioridad del límite de memoria: flag `--memory-limit` > variable de entorno `GOMEMLIMIT` > 1GB por defecto.

## wippy init

Crear un nuevo archivo de bloqueo.

```bash
wippy init
wippy init --src-dir ./src --modules-dir .wippy
```

| Flag | Corto | Por defecto | Descripción |
|------|-------|---------|-------------|
| `--src-dir` | `-d` | ./src | Directorio de código fuente |
| `--modules-dir` | | .wippy | Directorio de módulos |
| `--lock-file` | `-l` | wippy.lock | Ruta del archivo de bloqueo |

## wippy run

Iniciar el runtime o ejecutar un comando.

```bash
wippy run                                   # Iniciar el runtime
wippy run list                              # Listar comandos disponibles
wippy run test                              # Ejecutar pruebas
wippy run snapshot.wapp                     # Ejecutar desde archivo pack
wippy run acme/http                         # Ejecutar módulo desde el hub
wippy run acme/http@1.2.3                   # Ejecutar versión específica
wippy run --exec app:worker                 # Iniciar runtime y ejecutar un único proceso
```

| Flag | Corto | Descripción |
|------|-------|-------------|
| `--override` | `-o` | Sobrescribir valores de entrada (`namespace:entry:field=value`) |
| `--exec` | `-x` | Ejecutar proceso y salir (`namespace:entry`) |
| `--host` | | ID del host de terminal para `--exec` (auto-detectado si solo existe un `terminal.host`) |
| `--registry` | | URL del registro para módulos del hub |

## wippy lint

Verificar código Lua en busca de errores de tipo y advertencias.

```bash
wippy lint
wippy lint --level warning
wippy lint --json
wippy lint --rules
```

Valida todas las entradas Lua: `function.lua`, `library.lua`, `process.lua`, `workflow.lua` (incluyendo sus variantes `.bc`).

| Flag | Corto | Por defecto | Descripción |
|------|-------|-------------|-------------|
| `--lock-file` | `-l` | `wippy.lock` | Ruta del archivo de bloqueo |
| `--level` | | `warning` | Severidad mínima: `error`, `warning`, `hint` |
| `--ns` | | | Filtrar por patrones de namespace (ej. `app`, `lib.*`) |
| `--code` | | | Filtrar por códigos de error (ej. `E0001,E0004`) |
| `--rules` | | `false` | Habilitar reglas de estilo/calidad |
| `--summary` | | `false` | Agrupar salida por código de error |
| `--limit` | | `0` | Máximo de diagnósticos mostrados (0 = sin límite) |
| `--json` | | `false` | Salida en JSON |
| `--no-color` | | `false` | Deshabilitar salida con colores |
| `--cache-reset` | | `false` | Limpiar caché Lua antes de hacer lint |

## wippy add

Agregar una dependencia de módulo.

```bash
wippy add acme/http
wippy add acme/http@1.2.3
wippy add acme/http@latest
```

| Flag | Corto | Por defecto | Descripción |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | wippy.lock | Ruta del archivo de bloqueo |
| `--registry` | | | URL del registro |

## wippy install

Instalar dependencias desde el archivo de bloqueo.

```bash
wippy install                            # Instalar todo
wippy install acme/http                  # Instalar módulo específico
wippy install --refresh acme/http        # Re-descargar un módulo específico
```

| Flag | Corto | Por defecto | Descripción |
|------|-------|-------------|-------------|
| `--lock-file` | `-l` | wippy.lock | Ruta del archivo de bloqueo |
| `--refresh` | | false | Re-descargar cada módulo, omitiendo el caché |
| `--force` | | false | Alias de `--refresh` |
| `--repair` | | false | Alias de `--refresh` |
| `--registry` | | | URL del registro |

## wippy update

Actualizar dependencias y regenerar el archivo de bloqueo.

```bash
wippy update                      # Actualizar todo
wippy update acme/http            # Actualizar un módulo específico
wippy update acme/http demo/sql   # Actualizar múltiples
```

| Flag | Corto | Por defecto | Descripción |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | wippy.lock | Ruta del archivo de bloqueo |
| `--src-dir` | `-d` | ./src | Directorio de código fuente |
| `--modules-dir` | | .wippy | Directorio de módulos |
| `--registry` | | | URL del registro |

## wippy pack

Crear un pack de instantánea (archivo .wapp).

```bash
wippy pack snapshot.wapp
wippy pack release.wapp --description "Release 1.0"
wippy pack app.wapp --embed app:assets --bytecode **
```

| Flag | Corto | Descripción |
|------|-------|-------------|
| `--lock-file` | `-l` | Ruta del archivo de bloqueo |
| `--description` | `-d` | Descripción del pack |
| `--tags` | `-t` | Etiquetas del pack (separadas por coma) |
| `--meta` | | Metadatos personalizados (key=value) |
| `--embed` | | Incrustar entradas fs.directory (patrones) |
| `--list` | | Listar entradas fs.directory (ejecución simulada) |
| `--exclude-ns` | | Excluir namespaces (patrones) |
| `--exclude` | | Excluir entradas (patrones) |
| `--bytecode` | | Compilar Lua a bytecode (** para todo) |

## wippy publish

Publicar módulo en el hub.

```bash
wippy publish
wippy publish --version 1.0.0
wippy publish --dry-run
```

Lee desde `wippy.yaml` en el directorio actual.

| Flag | Descripción |
|------|-------------|
| `--version` | Versión a publicar |
| `--dry-run` | Validar sin publicar |
| `--label` | Publicar como etiqueta mutable en lugar de versión |
| `--release-notes` | Notas de versión |
| `--protected` | Marcar versión como protegida |
| `--embed` | Incrustar entradas fs.directory por id o nombre |
| `--config` | Ruta al directorio que contiene wippy.yaml (por defecto: .) |
| `--registry` | URL del registro |
| `--create` | Crear el módulo en el registro si aún no existe |
| `--module-visibility` | Visibilidad para módulos recién creados (solo `--create`): `public` o `private` (por defecto: private) |
| `--module-type` | Tipo para módulos recién creados (solo `--create`): `library`, `application`, `agent` o `plugin` (por defecto: application) |
| `--module-display-name` | Nombre para mostrar de módulos recién creados (solo `--create`) |

## wippy search

Buscar módulos en el hub.

```bash
wippy search http
wippy search "sql driver" --limit 20
wippy search auth --json
```

| Flag | Por defecto | Descripción |
|------|-------------|-------------|
| `--json` | false | Salida en formato JSON |
| `--limit` | 20 | Máximo de resultados |
| `--registry` | | URL del registro |

## wippy auth

Gestionar autenticación del registro.

### wippy auth login

```bash
wippy auth login
wippy auth login --token YOUR_TOKEN
```

| Flag | Descripción |
|------|-------------|
| `--token` | Token de API |
| `--registry` | URL del registro |
| `--local` | Almacenar credenciales localmente |

### wippy auth logout

```bash
wippy auth logout
```

| Flag | Descripción |
|------|-------------|
| `--registry` | URL del registro |
| `--local` | Eliminar credenciales locales |

### wippy auth status

```bash
wippy auth status
wippy auth status --json
```

| Flag | Descripción |
|------|-------------|
| `--json` | Salida como JSON |

## wippy readme

Obtener el README de un módulo desde el hub.

```bash
wippy readme wippy/terminal
wippy readme wippy/terminal@1.2.3
wippy readme --json wippy/terminal@latest
```

| Flag | Descripción |
|------|-------------|
| `--json` | Salida en formato JSON |
| `--registry` | URL del registro (por defecto: desde credenciales) |

## wippy registry

Consultar e inspeccionar entradas del registro.

### wippy registry list

```bash
wippy registry list
wippy registry list --kind "function.lua.*"
wippy registry list --ns "app.*" --json
wippy registry list --meta "type=api" --meta "enabled=true"
```

| Flag | Corto | Descripción |
|------|-------|-------------|
| `--kind` | `-k` | Filtrar por tipo (patrón glob) |
| `--ns` | `-n` | Filtrar por namespace (patrón glob) |
| `--name` | | Filtrar por nombre (patrón glob) |
| `--meta` | | Filtrar por metadatos (repetible) |
| `--json` | | Salida en formato JSON |
| `--yaml` | | Salida en formato YAML |
| `--lock-file` | `-l` | Ruta del archivo de bloqueo |

Operadores de metadatos para `--meta`:

| Operador | Significado |
|----------|-------------|
| `field=value` | Coincidencia exacta |
| `field~regex` | Coincidencia por regex |
| `field*substr` | Contiene subcadena |
| `field^prefix` | Comienza con prefijo |
| `field$suffix` | Termina con sufijo |

### wippy registry show

```bash
wippy registry show app:http:handler
wippy registry show app:config --yaml
```

| Flag | Corto | Descripción |
|------|-------|-------------|
| `--field` | `-f` | Mostrar campo específico |
| `--json` | | Salida en formato JSON |
| `--yaml` | | Salida en formato YAML |
| `--raw` | | Salida sin formato |
| `--lock-file` | `-l` | Ruta del archivo de bloqueo |

## wippy version

Imprimir información de versión.

```bash
wippy version
wippy version --short
```

## Comandos Personalizados

Cualquier entrada `process.lua` o `process.wasm` puede registrarse como un comando con nombre agregando metadatos `command`:

```yaml
entries:
  - name: test_runner
    kind: process.lua
    meta:
      command:
        name: test
        short: Run application tests
    source: file://runner.lua
    method: main
    modules:
      - io
      - registry
      - funcs
```

Ejecutarlo con:

```bash
wippy run test
```

Listar todos los comandos disponibles:

```bash
wippy run list
```

### Campos de Metadatos de Comando

| Campo | Requerido | Descripción |
|-------|----------|-------------|
| `name` | Sí | Nombre del comando usado con `wippy run <name>` |
| `short` | No | Descripción corta mostrada en `wippy run list` |
| `main` | No | Marcar esta entrada como comando por defecto (seleccionado automáticamente por packs y módulos del hub que entregan un único comando) |

Cualquier tipo de entrada de proceso funciona (`process.lua`, `process.wasm`). El nombre del comando debe ser único entre todas las entradas cargadas. Los argumentos después del nombre del comando se pasan al proceso como payloads de cadena de texto.

## Ejemplos

### Flujo de Trabajo de Desarrollo

```bash
# Inicializar proyecto
wippy init
wippy add wippy/http wippy/sql
wippy install

# Verificar errores
wippy lint

# Ejecutar con salida de depuración
wippy run -c -v

# Sobrescribir configuración para desarrollo local
wippy run -o app:db:host=localhost -o app:db:port=5432
```

### Despliegue en Producción

```bash
# Crear pack de lanzamiento con bytecode
wippy pack release.wapp --bytecode ** --exclude-ns test.**

# Ejecutar desde pack con límite de memoria
wippy run release.wapp -m 2G
```

### Depuración

```bash
# Ejecutar un solo proceso
wippy run --exec app:worker

# Con profiler habilitado
wippy run -p -v
# Luego: go tool pprof http://localhost:6060/debug/pprof/heap
```

### Gestión de Dependencias

```bash
# Agregar nueva dependencia
wippy add acme/http@latest

# Forzar re-descarga
wippy install --force

# Actualizar módulo específico
wippy update acme/http
```

### Publicación

```bash
# Iniciar sesión en el hub
wippy auth login

# Validar módulo
wippy publish --dry-run

# Publicar
wippy publish --version 1.0.0 --release-notes "Initial release"
```

## Archivo de Configuración

Crear `.wippy.yaml` para configuración persistente:

```yaml
logger:
  encoding: console

logmanager:
  min_level: -1  # depuración

profiler:
  enabled: true
  address: localhost:6060

override:
  app:gateway:addr: ":9090"
  app:db:host: "localhost"
```

## Ver También

- [Configuración](guides/configuration.md) - Referencia del archivo de configuración
- [Observabilidad](guides/observability.md) - Monitoreo y registro
