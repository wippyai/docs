---
title: "Referencia de CLI"
description: "Comandos, flags, sobrescrituras de configuración y flujos habituales de la CLI de Wippy."
---

# Referencia de CLI

Usa la CLI de Wippy para inicializar proyectos, ejecutar el runtime, gestionar dependencias, inspeccionar entradas del registro y publicar módulos.

Esta es una referencia de comandos. Los ejemplos presuponen un proyecto o módulo existente cuando el comando opera sobre código fuente, un archivo de bloqueo, entradas del registro o metadatos de publicación; no forman un único proyecto integral.

## Flags Globales

Disponibles en todos los comandos:

| Flag | Corto | Descripción |
|------|-------|-------------|
| `--config` | | Archivo de configuración, repetible; los posteriores sobrescriben a los anteriores (predeterminado: .wippy.yaml). `wippy publish` define una opción local diferente. |
| `--verbose` | `-v` | Habilitar registro de depuración |
| `--very-verbose` | | Depuración con trazas de pila |
| `--console` | `-c` | Registro en consola con colores |
| `--silent` | `-s` | Deshabilitar registro en consola |
| `--event-streams` | `-e` | Transmitir registros al bus de eventos |
| `--profiler` | `-p` | Habilitar pprof en localhost:6060 |
| `--memory-limit` | `-m` | Límite de memoria (ej., 1G, 512M) |

La prioridad del límite de memoria es `--memory-limit`, después `GOMEMLIMIT` y, finalmente, el valor predeterminado de 1 GB.

La opción global `--config` puede repetirse para combinar archivos de configuración. Los archivos se fusionan de izquierda a derecha: los posteriores sobrescriben valores coincidentes y conservan el resto. Cada archivo indicado explícitamente debe existir; sin `--config`, el archivo predeterminado `.wippy.yaml` es opcional. El primer archivo fija el directorio usado para resolver rutas relativas. La configuración se aplica en este orden: composición de archivos, selecciones `--profile` y sobrescrituras `--set`. Consulta [Configuración](guides/configuration.md#config-composition).

`wippy publish` oculta la opción global con una opción local `--config <dir>`. Para ese comando, el valor es el directorio que contiene `wippy.yaml`, no un archivo repetible de configuración del runtime.

## wippy init

Crea `wippy.lock`, o actualiza sus ajustes de directorios de código fuente y módulos si ya existe. Este comando no genera archivos de código fuente de la aplicación ni entradas del registro.

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
wippy run                                   # Start runtime
wippy run list                              # List available commands
wippy run migrate                           # Run a named custom command
wippy run snapshot.wapp                     # Run from pack file
wippy run acme/http                         # Run module from hub
wippy run acme/http@1.2.3                   # Run specific version
wippy run --exec app:worker                 # Start runtime and execute a single process
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

Para una aplicación local, `wippy run` repara un archivo de bloqueo obsoleto antes de que arranque cualquier servicio del runtime. Carga las declaraciones de dependencias del código fuente y, cuando el bloqueo ya las satisface, vuelve a resolver el grafo solo con evidencia local e instalada (acceso verified-offline, sin red). Si esa resolución offline coincide con el bloqueo, el arranque continúa sin cambios. Si tiene éxito pero difiere, se convierte en el grafo candidato; solo se pide al hub que resuelva cuando la pasada offline falla o el bloqueo ya no satisface las declaraciones del código fuente. Los packs que faltan en el grafo candidato se descargan y verifican, y solo entonces se reescribe `wippy.lock`. Un bloqueo que selecciona una raíz de despliegue es autoritativo y nunca se vuelve a resolver.

`--exec` bloquea hasta que el proceso lanzado produce su resultado, y luego propaga el código de salida del proceso como código de salida de la CLI. Ctrl-C durante `--exec` cancela el proceso en ejecución y el runtime aun así se apaga de forma graceful; una segunda señal fuerza la salida.

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
wippy test                     # Run tests from the local project
wippy test snapshot.wapp       # Run tests from a pack file
wippy test acme/module@1.2.3   # Run tests from a hub module
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

Valida las entradas con código fuente `function.lua`, `library.lua`, `process.lua` y `workflow.lua`. Las entradas precompiladas `.bc` no contienen código fuente analizable y se omiten.

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
wippy install                            # Install all
wippy install acme/http                  # Install specific module
wippy install --refresh acme/http        # Re-fetch a specific module
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
wippy update                      # Update all
wippy update acme/http            # Update specific module
wippy update acme/http demo/sql   # Update multiple
```

| Flag | Corto | Por defecto | Descripción |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | wippy.lock | Ruta del archivo de bloqueo |
| `--src-dir` | `-d` | ./src | Directorio de código fuente |
| `--modules-dir` | | .wippy | Directorio de módulos |
| `--registry` | | | URL del registro |
| `--profile` | | | Aplicar un perfil de workspace desde la configuración de runtime fusionada (repetible) |
| `--set` | | | Sobrescribir un valor de la configuración de runtime fusionada (`section.path=value`, repetible) |

## wippy artifacts

Trabajar con artefactos de sistema de archivos de tiempo de construcción.

### wippy artifacts materialize

Validar y materializar un sistema de archivos de artefacto a partir de un pack existente.

```bash
wippy artifacts materialize snapshot.wapp app:package_fs
wippy artifacts materialize snapshot.wapp app:package_fs --root build
```

| Flag | Por defecto | Descripción |
|------|-------------|-------------|
| `--root` | `.wippy` | Raíz de materialización |

El recurso se direcciona por su `namespace:name` completo, debe declarar `meta.artifact.format`, y ese formato debe estar registrado en la CLI. El comando no resuelve dependencias de módulos, no modifica `wippy.lock`, no invoca gestores de paquetes y no participa en la composición del runtime. Ver [Artefactos de tiempo de construcción](guides/artifacts.md#materializing-explicitly).

## wippy pack

Crear un pack de instantánea (archivo .wapp).

```bash
wippy pack snapshot.wapp
wippy pack release.wapp --description "Release 1.0"
wippy pack app.wapp --embed app:assets --bytecode "**"
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

El archivo de salida se escribe de forma atómica: el pack se construye en un archivo temporal del directorio de destino, se sincroniza, se verifica y solo entonces se renombra sobre el objetivo, heredando los permisos del archivo existente cuando lo hay. Un empaquetado fallido deja intacto el archivo anterior. Nombrar como salida algo que también es una de las entradas del pack — la misma ruta, o un enlace duro o simbólico que resuelve al mismo archivo — se rechaza en lugar de truncar la entrada a mitad de lectura.

`--meta` no puede escribir metadatos reservados. La clave `registry`, y cualquier cosa bajo los prefijos `wippy.` o `system.`, es propiedad del formato de pack y se rechaza.

Los recursos que declaran `meta.artifact.format` se validan durante el empaquetado, de modo que un artefacto mal formado falla aquí en lugar de en un consumidor. Ver [Artefactos de tiempo de construcción](guides/artifacts.md).

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

El tipo de módulo se declara normalmente como `type:` en `wippy.yaml` (ver [Publicación](./publishing.md#wippyyaml)); `--module-type` lo sobrescribe para una única publicación. Cuando ninguno está definido, los módulos recién creados usan `application` por defecto con una advertencia de deprecación.

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
| `--registry-meta` | | Incluir metadatos propiedad del registro (`owner`, `root`) en la salida JSON o YAML; requiere `--json` o `--yaml` |
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
        security:
          actor:
            id: app:migrations
          policies:
            - app.security:migrations
          groups:
            - app.security:operators
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

`wippy run list` acepta `--profile` y `--set`, de modo que el listado refleja la misma configuración de runtime combinada que usaría `wippy run`.

### Campos de Metadatos de Comando

| Campo | Requerido | Descripción |
|-------|----------|-------------|
| `name` | Sí | Nombre del comando usado con `wippy run <name>` |
| `short` | No | Descripción corta mostrada en `wippy run list` |
| `main` | No | Marcar esta entrada como punto de entrada por defecto. Cuando un pack o módulo del hub se ejecuta sin nombre de comando, se ejecuta la única entrada `main` de ese caso de uso; un punto de entrada solitario se selecciona incluso sin `main`, y varios puntos de entrada sin `main` son un error |
| `use_case` | No | Categoría de punto de entrada, por defecto `run`. La entrada que declara `use_case: test` es la que ejecuta `wippy test` |
| `security` | No | Contexto de seguridad bajo el que se ejecuta el comando cuando se lanza desde la CLI |

Cualquier tipo de entrada de proceso funciona (`process.lua`, `process.wasm`). Los nombres de comando no se comprueban por unicidad; cuando varias entradas cargadas declaran el mismo nombre, se ejecuta la primera coincidencia en el orden del registro. Los argumentos después del nombre del comando se pasan al proceso como payloads de cadena de texto.

### Seguridad de comandos

Una entrada de comando declara el actor y el ámbito de políticas bajo los que se ejecuta su lanzamiento desde la CLI:

```yaml
entries:
  - name: migrate_runner
    kind: process.lua
    meta:
      command:
        name: migrate
        short: Run database migrations
        security:
          actor:
            id: system.migrations
            meta:
              role: operator
          policies:
            - app.security:migrations_policy
          groups:
            - app.security:operators
    source: file://runner.lua
    method: main
```

| Campo | Descripción |
|-------|-------------|
| `actor.id` | Identidad del actor para el proceso lanzado |
| `actor.meta` | Atributos del actor evaluados por las políticas |
| `policies` | Registry IDs (`namespace:name`) de políticas individuales agregadas al ámbito |
| `groups` | Registry IDs de grupos de políticas cuyas políticas se agregan al ámbito |

El bloque vive dentro de `meta.command` porque se aplica solo a la ruta de lanzamiento desde la CLI — el operador inició el comando en su propio despliegue, que es el ancla de confianza. No tiene efecto sobre spawns ordinarios de la misma entrada de proceso; esos siguen el [bloque `security:`](guides/entry-kinds.md#process-security) de la propia entrada.

La declaración es fail-closed y se valida antes de que el proceso arranque:

- Los campos desconocidos dentro de `security` se rechazan.
- Un bloque `security` vacío (sin actor, sin políticas, sin grupos) se rechaza.
- `security` sin un `name` se rechaza — un comando debe poder nombrarse para poder lanzarse.
- Una política o grupo que no puede resolverse impide el lanzamiento; la resolución es atómica, así que nunca se instala un ámbito parcial.

Cuando el bloque omite `actor`, se hereda el actor del llamante. Cuando omite tanto `policies` como `groups`, se hereda el ámbito del llamante.

## Ejemplos

### Flujo de Trabajo de Desarrollo

```bash
# Initialize dependency lock metadata
wippy init
wippy add wippy/test
wippy add wippy/llm
wippy install

# Check for errors
wippy lint

# Run with debug output
wippy run -c -v

# Override config for local dev
wippy run -o app:db:host=localhost -o app:db:port=5432
```

### Despliegue en Producción

```bash
# Create release pack with bytecode
wippy pack release.wapp --bytecode "**" --exclude-ns "test.**"

# Run from pack with memory limit
wippy run release.wapp -m 2G
```

### Depuración

```bash
# Execute single process
wippy run --exec app:worker

# With profiler enabled
wippy run -p -v
# Then: go tool pprof http://localhost:6060/debug/pprof/heap
```

### Gestión de Dependencias

```bash
# Add new dependency
wippy add acme/http@latest

# Force re-download
wippy install --force

# Update specific module
wippy update acme/http
```

### Publicación

```bash
# Login to hub
wippy auth login

# Validate module
wippy publish --dry-run

# Publish
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
  stream_to_events: true

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
