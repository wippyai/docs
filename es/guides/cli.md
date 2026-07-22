---
title: "Referencia de CLI"
description: "Interfaz de línea de comandos para el runtime de Wippy."
---

# Referencia de CLI

Interfaz de línea de comandos para el runtime de Wippy.

## Flags Globales

Disponibles en todos los comandos:

| Flag | Corto | Descripción |
|------|-------|-------------|
| `--config` | | Archivo de configuración, repetible; los archivos posteriores sobrescriben a los anteriores (por defecto: .wippy.yaml) |
| `--verbose` | `-v` | Habilitar registro de depuración |
| `--very-verbose` | | Depuración con trazas de pila |
| `--console` | `-c` | Registro en consola con colores |
| `--silent` | `-s` | Deshabilitar registro en consola |
| `--event-streams` | `-e` | Transmitir registros al bus de eventos |
| `--profiler` | `-p` | Habilitar pprof en localhost:6060 |
| `--memory-limit` | `-m` | Límite de memoria (ej., 1G, 512M) |

Prioridad del límite de memoria: flag `--memory-limit` > variable de entorno `GOMEMLIMIT` > 1GB por defecto.

`--config` puede pasarse varias veces para componer archivos de configuración. Los archivos se fusionan de izquierda a derecha: los archivos posteriores sobrescriben los valores coincidentes y conservan todo lo demás. Cada archivo nombrado explícitamente debe existir; sin `--config`, el `.wippy.yaml` por defecto es opcional. El primer archivo ancla el directorio usado para resolver rutas relativas. La configuración se aplica en orden: composición de archivos, luego las selecciones de `--profile`, luego las sobrescrituras de `--set`. Ver [Configuración](guides/configuration.md#config-composition).

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
wippy run migrate                           # Ejecutar un comando personalizado con nombre
wippy run snapshot.wapp                     # Ejecutar desde archivo pack
wippy run acme/http                         # Ejecutar módulo desde el hub
wippy run acme/http@1.2.3                   # Ejecutar versión específica
wippy run --exec app:worker                 # Iniciar runtime y ejecutar un único proceso
```

| Flag | Corto | Descripción |
|------|-------|-------------|
| `--override` | `-o` | Sobrescribir valores de entrada (`namespace:entry:field=value`); `field` puede ser `kind` para cambiar el tipo de la entrada |
| `--set` | | Sobrescribir un valor de configuración (`section.path=value`, repetible, tiene prioridad sobre el archivo de configuración) |
| `--exec` | `-x` | Ejecutar proceso y salir (`namespace:entry`) |
| `--host` | | ID del host de terminal para `--exec` (auto-detectado si solo existe un `terminal.host`) |
| `--registry` | | URL del registro para módulos del hub |
| `--profile` | | Aplicar un perfil de runtime desde `.wippy.yaml` o los metadatos de runtime empaquetados (repetible, aplicado en orden) |

Ejecutar un módulo del hub (`wippy run org/module`) lo resuelve una vez, lo registra en `wippy.lock` y almacena localmente los packs verificados. Las ejecuciones posteriores de la misma referencia parten del archivo de bloqueo — sin necesidad de red. Un selector de versión que ya no coincide con el bloqueo se rechaza con una sugerencia de ejecutar `wippy update`.

`--set` escribe cualquier valor de configuración del runtime desde la línea de comandos, fusionado sobre `.wippy.yaml` por hoja:

```bash
wippy run --set cluster.enabled=true \
          --set cluster.membership.join_addrs=node-2:7946,node-3:7946 \
          --set cluster.raft.bootstrap_expect=3
```

Los valores se convierten según su forma: `true`/`false` a bool, enteros y flotantes a números, el resto permanece como string (las duraciones como `5s` se analizan donde la opción lo espera).

## wippy test

Ejecutar el punto de entrada de test: la entrada de proceso que declara el caso de uso `test`. El runtime arranca, ejecuta esa entrada y sale. `wippy run` no ejecuta automáticamente los puntos de entrada de test; el testing siempre pasa por `wippy test`.

```bash
wippy test                     # Ejecutar tests del proyecto local
wippy test snapshot.wapp       # Ejecutar tests desde un archivo pack
wippy test acme/module@1.2.3   # Ejecutar tests desde un módulo del hub
```

| Flag | Corto | Descripción |
|------|-------|-------------|
| `--override` | `-o` | Sobrescribir valores de entrada (`namespace:entry:field=value`) |
| `--host` | | ID del host de terminal (auto-detectado si solo existe un `terminal.host`) |
| `--registry` | | URL del registro para módulos del hub |
| `--set` | | Sobrescribir un valor de configuración (`section.path=value`, repetible) |
| `--profile` | | Aplicar un perfil de runtime (repetible, aplicado en orden) |

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
| `--profile` | | | Aplicar un perfil de workspace desde la configuración de runtime fusionada (repetible) |
| `--set` | | | Sobrescribir un valor de la configuración de runtime fusionada (`section.path=value`, repetible) |

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
| `--profile` | | | Aplicar un perfil de workspace desde la configuración de runtime fusionada (repetible) |
| `--set` | | | Sobrescribir un valor de la configuración de runtime fusionada (`section.path=value`, repetible) |

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
| `--profile` | | | Aplicar un perfil de workspace desde la configuración de runtime fusionada (repetible) |
| `--set` | | | Sobrescribir un valor de la configuración de runtime fusionada (`section.path=value`, repetible) |

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
| `--embed-all` | | Incrustar todas las entradas fs.directory (no combinable con `--embed`) |
| `--list` | | Listar entradas fs.directory (ejecución simulada) |
| `--exclude-ns` | | Excluir namespaces (patrones) |
| `--exclude` | | Excluir entradas (patrones) |
| `--bytecode` | | Compilar Lua a bytecode (** para todo) |
| `--profile` | | Aplicar un perfil de runtime desde `.wippy.yaml` antes de empaquetar (repetible, aplicado en orden) |

Sin `--embed` ni `--embed-all`, los patrones de incrustación recurren a la sección `embed:` del manifiesto de módulo `wippy.yaml`. Empaquetar una aplicación también arrastra los recursos incrustados de sus packs de dependencias, y solo los comandos del módulo principal quedan expuestos por el pack resultante.

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
| `--module-type` | Tipo de módulo: `library`, `application`, `agent` o `plugin` (sobrescribe `type:` en wippy.yaml) |
| `--module-display-name` | Nombre para mostrar de módulos recién creados (solo `--create`) |

El tipo de módulo se declara normalmente como `type:` en `wippy.yaml` (ver [Publicación](guides/publishing.md#wippy-yaml)); `--module-type` lo sobrescribe para una única publicación. Cuando ninguno está definido, los módulos recién creados usan `application` por defecto con una advertencia de deprecación.

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

Consultar e inspeccionar entradas del registro. Ambos subcomandos aceptan `--profile` y `--set` para dar forma a la configuración de runtime fusionada bajo la que se cargan las entradas.

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
  - name: migrate_runner
    kind: process.lua
    meta:
      command:
        name: migrate
        short: Run database migrations
    source: file://runner.lua
    method: main
    modules:
      - io
      - registry
      - funcs
```

Ejecutarlo con:

```bash
wippy run migrate
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
| `use_case` | No | Categoría de punto de entrada, por defecto `run`. La entrada que declara `use_case: test` es la que ejecuta `wippy test` |

Cualquier tipo de entrada de proceso funciona (`process.lua`, `process.wasm`). El nombre del comando debe ser único entre todas las entradas cargadas. Los argumentos después del nombre del comando se pasan al proceso como payloads de cadena de texto.

## Ejemplos

### Flujo de Trabajo de Desarrollo

```bash
# Inicializar proyecto
wippy init
wippy add wippy/test wippy/llm
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

## Variables de Entorno

| Variable | Efecto |
|----------|--------|
| `WIPPY_TOKEN` | Token de autenticación del registro; sobrescribe las credenciales almacenadas (un token enviado vía `hub.auth.authenticate` tiene prioridad aún mayor) |
| `WIPPY_REGISTRY` | URL del registro por defecto (sobrescrita por `--registry`) |
| `WIPPY_CACHE_DIR` | Directorio de caché para módulos del hub ejecutados vía `wippy run org/module` (por defecto: `~/.wippy/cache`) |
| `GOMEMLIMIT` | Alternativa para el límite de memoria cuando `--memory-limit` no está definido |

Los valores en `.wippy.yaml` pueden referenciar variables de entorno del sistema operativo con `${env:NAME}`, resueltas al cargar el archivo; una variable ausente hace fallar la carga de la configuración. Las referencias simples `${name}` se resuelven en cambio desde la sección `vars:` de la configuración.

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
