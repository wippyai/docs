# Referencia CLI

Interfaz de linea de comandos para el runtime de Wippy.

## Flags Globales

Disponibles en todos los comandos:

| Flag | Corto | Descripcion |
|------|-------|-------------|
| `--config` | | Archivo de configuracion (por defecto: .wippy.yaml) |
| `--verbose` | `-v` | Habilitar logging de debug |
| `--very-verbose` | | Debug con stack traces |
| `--console` | `-c` | Logging de consola colorido |
| `--silent` | `-s` | Deshabilitar logging de consola |
| `--event-streams` | `-e` | Transmitir logs al bus de eventos |
| `--profiler` | `-p` | Habilitar pprof en localhost:6060 |
| `--memory-limit` | `-m` | Limite de memoria (ej., 1G, 512M) |

Prioridad de limite de memoria: flag `--memory-limit` > env `GOMEMLIMIT` > 1GB por defecto.

## wippy init

Crear un nuevo archivo lock.

```bash
wippy init
wippy init --src-dir ./src --modules-dir .wippy
```

| Flag | Corto | Por Defecto | Descripcion |
|------|-------|---------|-------------|
| `--src-dir` | `-d` | ./src | Directorio fuente |
| `--modules-dir` | | .wippy | Directorio de modulos |
| `--lock-file` | `-l` | wippy.lock | Ruta del archivo lock |

## wippy run

Iniciar el runtime o ejecutar un comando.

```bash
wippy run                                    # Iniciar runtime
wippy run list                               # Listar comandos disponibles
wippy run test                               # Ejecutar pruebas
wippy run snapshot.wapp                      # Ejecutar desde archivo pack
wippy run acme/http                          # Ejecutar modulo
wippy run --exec app:processes/app:worker   # Ejecutar proceso unico
```

| Flag | Corto | Descripcion |
|------|-------|-------------|
| `--override` | `-o` | Sobrescribir valores de entrada (namespace:entry:field=value) |
| `--exec` | `-x` | Ejecutar proceso y salir (host/namespace:entry) |
| `--host` | | Host para ejecucion |
| `--registry` | | URL del registro |

## wippy lint

Verificar codigo Lua por errores de tipo y advertencias.

```bash
wippy lint
wippy lint --level warning
```

Valida todas las entradas Lua: `function.lua.*`, `library.lua.*`, `process.lua.*`, `workflow.lua.*`.

| Flag | Descripcion |
|------|-------------|
| `--level` | Nivel minimo de severidad a reportar |

## wippy add

Agregar una dependencia de modulo.

```bash
wippy add acme/http
wippy add acme/http@1.2.3
wippy add acme/http@latest
```

| Flag | Corto | Por Defecto | Descripcion |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | wippy.lock | Ruta del archivo lock |
| `--registry` | | | URL del registro |

## wippy install

Instalar dependencias desde archivo lock.

```bash
wippy install
wippy install --force
wippy install --repair
```

| Flag | Corto | Descripcion |
|------|-------|-------------|
| `--lock-file` | `-l` | Ruta del archivo lock |
| `--force` | | Ignorar cache, siempre descargar |
| `--repair` | | Verificar hashes, re-descargar si no coinciden |
| `--registry` | | URL del registro |

## wippy update

Actualizar dependencias y regenerar archivo lock.

```bash
wippy update                      # Actualizar todo
wippy update acme/http            # Actualizar modulo especifico
wippy update acme/http demo/sql   # Actualizar multiples
```

| Flag | Corto | Por Defecto | Descripcion |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | wippy.lock | Ruta del archivo lock |
| `--src-dir` | `-d` | . | Directorio fuente |
| `--modules-dir` | | .wippy | Directorio de modulos |
| `--registry` | | | URL del registro |

## wippy pack

Crear un pack de snapshot (archivo .wapp).

```bash
wippy pack snapshot.wapp
wippy pack release.wapp --description "Release 1.0"
wippy pack app.wapp --embed app:assets --bytecode **
```

| Flag | Corto | Descripcion |
|------|-------|-------------|
| `--lock-file` | `-l` | Ruta del archivo lock |
| `--description` | `-d` | Descripcion del pack |
| `--tags` | `-t` | Tags del pack (separados por coma) |
| `--meta` | | Metadatos personalizados (key=value) |
| `--embed` | | Embeber entradas fs.directory (patrones) |
| `--list` | | Listar entradas fs.directory (dry-run) |
| `--exclude-ns` | | Excluir namespaces (patrones) |
| `--exclude` | | Excluir entradas (patrones) |
| `--bytecode` | | Compilar Lua a bytecode (** para todo) |

## wippy publish

Publicar modulo al hub.

```bash
wippy publish
wippy publish --version 1.0.0
wippy publish --dry-run
```

Lee desde `wippy.yaml` en el directorio actual.

| Flag | Descripcion |
|------|-------------|
| `--version` | Version a publicar |
| `--dry-run` | Validar sin publicar |
| `--label` | Etiqueta de version |
| `--release-notes` | Notas de release |
| `--protected` | Marcar como protegido |
| `--registry` | URL del registro |

## wippy search

Buscar modulos en el hub.

```bash
wippy search http
wippy search "sql driver" --limit 20
wippy search auth --json
```

| Flag | Descripcion |
|------|-------------|
| `--json` | Salida como JSON |
| `--limit` | Maximo de resultados |
| `--registry` | URL del registro |

## wippy auth

Gestionar autenticacion del registro.

### wippy auth login

```bash
wippy auth login
wippy auth login --token YOUR_TOKEN
```

| Flag | Descripcion |
|------|-------------|
| `--token` | Token de API |
| `--registry` | URL del registro |
| `--local` | Almacenar credenciales localmente |

### wippy auth logout

```bash
wippy auth logout
```

| Flag | Descripcion |
|------|-------------|
| `--registry` | URL del registro |
| `--local` | Eliminar credenciales locales |

### wippy auth status

```bash
wippy auth status
wippy auth status --json
```

## wippy registry

Consultar e inspeccionar entradas del registro.

### wippy registry list

```bash
wippy registry list
wippy registry list --kind function.lua
wippy registry list --ns app --json
```

| Flag | Corto | Descripcion |
|------|-------|-------------|
| `--kind` | `-k` | Filtrar por kind |
| `--ns` | `-n` | Filtrar por namespace |
| `--name` | | Filtrar por nombre |
| `--meta` | | Filtrar por metadatos |
| `--json` | | Salida como JSON |
| `--yaml` | | Salida como YAML |
| `--lock-file` | `-l` | Ruta del archivo lock |

### wippy registry show

```bash
wippy registry show app:http:handler
wippy registry show app:config --yaml
```

| Flag | Corto | Descripcion |
|------|-------|-------------|
| `--field` | `-f` | Mostrar campo especifico |
| `--json` | | Salida como JSON |
| `--yaml` | | Salida como YAML |
| `--raw` | | Salida sin formato |
| `--lock-file` | `-l` | Ruta del archivo lock |

## wippy version

Imprimir informacion de version.

```bash
wippy version
wippy version --short
```

## Ejemplos

### Flujo de Trabajo de Desarrollo

```bash
# Inicializar proyecto
wippy init
wippy add wippy/http wippy/sql
wippy install

# Verificar errores
wippy lint

# Ejecutar con salida de debug
wippy run -c -v

# Sobrescribir config para desarrollo local
wippy run -o app:db:host=localhost -o app:db:port=5432
```

### Despliegue en Produccion

```bash
# Crear pack de release con bytecode
wippy pack release.wapp --bytecode ** --exclude-ns test.**

# Ejecutar desde pack con limite de memoria
wippy run release.wapp -m 2G
```

### Depuracion

```bash
# Ejecutar proceso unico
wippy run --exec app:processes/app:worker

# Con profiler habilitado
wippy run -p -v
# Luego: go tool pprof http://localhost:6060/debug/pprof/heap
```

### Gestion de Dependencias

```bash
# Agregar nueva dependencia
wippy add acme/http@latest

# Reparar modulos corruptos
wippy install --repair

# Forzar re-descarga
wippy install --force

# Actualizar modulo especifico
wippy update acme/http
```

### Publicacion

```bash
# Login al hub
wippy auth login

# Validar modulo
wippy publish --dry-run

# Publicar
wippy publish --version 1.0.0 --release-notes "Release inicial"
```

## Archivo de Configuracion

Cree `.wippy.yaml` para configuraciones persistentes:

```yaml
logger:
  mode: development
  level: debug
  encoding: console

logmanager:
  min_level: -1  # debug

profiler:
  enabled: true
  address: localhost:6060

override:
  app:gateway:addr: ":9090"
  app:db:host: "localhost"
```

## Ver Tambien

- [Configuracion](guide-configuration.md) - Referencia del archivo de configuracion
- [Observabilidad](guide-observability.md) - Monitoreo y logging
