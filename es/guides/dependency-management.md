---
title: "Gestion de Dependencias"
description: "Wippy usa un sistema de dependencias basado en archivos de bloqueo. Los modulos se publican en el hub, se declaran como dependencias en tu codigo…"
---

# Gestion de Dependencias

Wippy usa un sistema de dependencias basado en archivos de bloqueo. Los modulos se publican en el hub, se declaran como dependencias en tu codigo fuente y se resuelven en un archivo `wippy.lock` que rastrea las versiones exactas.

## Archivos del Proyecto

### wippy.lock

El archivo de bloqueo rastrea la estructura de directorios de tu proyecto y las dependencias fijadas:

```yaml
directories:
  modules: .wippy
  src: ./src
modules:
  - name: acme/http
    version: v1.2.0
    hash: 4ea816fe84ca58a1f0869e5ca6afa93d6ddd72fa09e1162d9e600a7fbf39f0a2
  - name: acme/sql
    version: v2.0.1
    hash: b3f9c8e12a456d7890abcdef1234567890abcdef1234567890abcdef12345678
```

| Campo | Descripcion |
|-------|-------------|
| `directories.modules` | Donde se almacenan los modulos descargados (por defecto: `.wippy`) |
| `directories.src` | Donde reside tu codigo fuente (por defecto: `./src`) |
| `modules[].name` | Identificador del modulo en formato `org/module` |
| `modules[].version` | Version semantica fijada |
| `modules[].hash` | Digest del artefacto con el que debe coincidir el pack descargado; un valor hexadecimal sin prefijo se lee como `sha256` |
| `modules[].root` | Marca la raiz de despliegue seleccionada; a lo sumo un modulo puede llevarlo |
| `options.unpack_modules` | Extraer los packs en directorios en lugar de cargarlos como archivos `.wapp` (por defecto: `false`) |

### wippy.yaml

Metadatos del modulo para publicacion. Solo es necesario cuando publicas tu propio modulo:

```yaml
organization: acme
module: http
version: 1.2.0
description: HTTP utilities for Wippy
license: MIT
repository: https://github.com/acme/wippy-http
keywords:
  - http
  - web
```

| Campo | Requerido | Descripcion |
|-------|-----------|-------------|
| `organization` | Si | Minusculas, alfanumerico con guiones |
| `module` | Si | Minusculas, alfanumerico con guiones |
| `version` | No | Version semantica (se establece al publicar) |
| `description` | No | Descripcion del modulo |
| `license` | No | Identificador de licencia SPDX |
| `repository` | No | URL del repositorio fuente |
| `homepage` | No | Pagina principal del proyecto |
| `keywords` | No | Palabras clave para descubrimiento |
| `authors` | No | Lista de autores |

## Declaracion de Dependencias

Agrega entradas `ns.dependency` en tu `_index.yaml`:

```yaml
version: "1.0"
namespace: app
entries:
  - name: dependency.http
    kind: ns.dependency
    component: acme/http
    version: "^1.0.0"

  - name: dependency.sql
    kind: ns.dependency
    component: acme/sql
    version: ">=2.0.0"
```

### Restricciones de Version

| Restriccion | Ejemplo | Coincide con |
|-------------|---------|--------------|
| Exacta | `1.2.3` | Solo 1.2.3 |
| Caret | `^1.2.0` | >=1.2.0, <2.0.0 |
| Tilde | `~1.2.0` | >=1.2.0, <1.3.0 |
| Rango | `>=1.0.0` | 1.0.0 y superior |
| Comodin | `*` | Cualquier version (elige la mas alta) |
| Combinada | `>=1.0.0 <2.0.0` | Entre 1.0.0 y 2.0.0 |

### Reglas de Resolucion

- Cada modulo se resuelve contra la **interseccion de todos los rangos declarados** en el grafo de dependencias. Los rangos incompatibles (conflictos de diamante) hacen fallar la resolucion con un error explicito en lugar de elegir silenciosamente un lado.
- Un `wippy update` completo resuelve cada modulo a partir de sus rangos declarados; una actualizacion dirigida y la reparacion en el arranque conservan una version fijada que siga satisfaciendo todos los rangos vivos.
- **Los parametros raiz ganan sobre los transitivos**: cuando tu app y una dependencia enlazan el mismo requirement, los parametros de tu `ns.dependency` tienen prioridad. Los rangos de version nunca se sobrescriben; cada declaracion se suma a la interseccion.
- Un componente declarado por varias entradas `ns.dependency` raiz queda controlado por una de ellas — las declaraciones establecidas antes que las nuevas, las portadoras de parametros antes que las simples, y los empates por el ID de entrada mas bajo — y las demas se pliegan en referencias a ella. Un duplicado cuyos parametros no coinciden con la declaracion controladora se rechaza con un error de conflicto; actualiza la dependencia existente en su lugar.

Dos fallos de resolucion se reportan de forma distinta. Una expresion de restriccion que ninguna release podria satisfacer jamas — la interseccion de los rangos vivos esta vacia — es un conflicto, y el error nombra el modulo y cada solicitante que aporto un rango. Un conjunto de rangos valido para el que el hub no publica actualmente ninguna version coincidente es en cambio un fallo de disponibilidad: una release posterior puede volverlo resoluble sin cambiar ninguna declaracion.

El runtime persiste cada grafo resuelto en su historial del registro y lo reproduce en el arranque en lugar de volver a resolver, de modo que una aplicacion desplegada arranca exactamente con las versiones que se resolvieron cuando se aplico el cambio de dependencias. `wippy.lock` sigue siendo la instantanea portable para proyectos fuente.

### Procedencia de las entradas

La procedencia pertenece al registro, no a los metadatos de la entrada. Cuando se cargan las entradas, el registro estampa cada una con la fuente de despliegue que la suministro:

| Campo | Descripcion |
|-------|-------------|
| `registry.owner` | Nombre del modulo (`org/module`) que suministro la entrada; vacio para el codigo fuente de la aplicacion |
| `registry.root` | Se establece en las entradas `ns.dependency` suministradas por la raiz de despliegue, marcandolas como declaraciones raiz |

Los autores de entradas nunca escriben estos campos; se asignan durante la carga y no pueden falsificarse desde un `_index.yaml`. Inspeccionalos con `wippy registry list --registry-meta --json`.

## Flujo de Trabajo

### Iniciar un Nuevo Proyecto

```bash
wippy init
```

Crea un `wippy.lock` con los directorios por defecto.

### Agregar Dependencias

```bash
wippy add acme/http               # Latest version
wippy add acme/http@1.2.3         # Exact version
wippy add acme/http@latest         # Latest label
```

Esto actualiza el archivo de bloqueo. Luego instala:

```bash
wippy install
```

### Resolver desde el Codigo Fuente

Si tu codigo fuente ya declara entradas `ns.dependency`:

```bash
wippy update
```

Esto escanea tu directorio fuente, resuelve todas las restricciones de dependencias, actualiza el archivo de bloqueo e instala los modulos.

### Actualizar Dependencias

```bash
wippy update                       # Re-resolve all dependencies
wippy update acme/http             # Update only acme/http
wippy update acme/http acme/sql    # Update specific modules
```

Al actualizar modulos especificos, los demas modulos permanecen fijados en sus versiones actuales. Si la actualizacion requiere cambiar modulos que no son objetivo, se solicita confirmacion.

### Instalar desde el Archivo de Bloqueo

```bash
wippy install                      # Install all from lock
wippy install --refresh            # Volver a descargar cada módulo (--force y --repair son alias)
```

## Almacenamiento de Modulos

Los modulos descargados se almacenan en el directorio `.wippy/vendor/`:

```
project/
  wippy.lock
  src/
    _index.yaml
  .wippy/
    vendor/
      acme/
        http-v1.2.0.wapp
        sql-v2.0.1.wapp
```

Por defecto, los modulos se mantienen como archivos `.wapp`. Para extraerlos en directorios:

```yaml
# wippy.lock
options:
  unpack_modules: true
```

Con la extraccion habilitada:

```
.wippy/
  vendor/
    acme/
      http-v1.2.0.wapp
      http/
        wippy.yaml
        src/
          _index.yaml
          ...
```

La extraccion nunca descarta el pack. El `.wapp` canonico verificado permanece junto al directorio extraido porque es la unica evidencia direccionada por contenido del modulo, y la materializacion y reparacion de artefactos leen los recursos desde el. El `.wapp` es lo que comprueba la instalacion: un directorio cuyo pack falta cuenta como no instalado, y el modulo se descarga de nuevo. Cada instalacion extrae el directorio de nuevo desde el archivo verificado, asi que las ediciones manuales sobre un directorio vendorizado no sobreviven.

Los modulos resueltos desde un [reemplazo de workspace](#local-development-with-replacements) nunca se descargan ni se vendorizan; se cargan desde la ruta local.

## Desarrollo Local con Reemplazos

Sustituye modulos del hub con directorios locales para desarrollo. Los reemplazos se declaran en la seccion `workspace` de un archivo de configuracion de runtime — tipicamente uno privado, ignorado por git y compuesto sobre `.wippy.yaml`:

```yaml
# .wippy.workspace.yaml
version: "1.0"
workspace:
  replacements:
    acme/http: ../local-http
    acme/sql: ../local-sql
```

```bash
wippy run --config .wippy.yaml --config .wippy.workspace.yaml
```

Las claves son `org/module`, los valores son directorios (las rutas relativas se resuelven contra el directorio del primer archivo `--config`). Establecer un reemplazo en `null` desactiva uno heredado de una capa de configuracion anterior o de un perfil. Los reemplazos tambien pueden vivir dentro de un [perfil](guides/configuration.md#profiles) para que se activen solo con `--profile workspace`.

Se exige que la ruta exista, y que sea un directorio, solo para un modulo que el grafo del lock realmente selecciona. Un reemplazo declarado para un modulo del que nada depende es una entrada de resolucion, no de arranque: puede apuntar a un directorio que no esta descargado en esta maquina sin hacer fallar la validacion.

Un reemplazo cambia de donde proviene el codigo fuente de un modulo, no que release se eligio. La ruta de carga conserva la version y el digest que el lock selecciono para ese modulo y se marca como reemplazo; las entradas cargadas desde ella eclipsan a las vendorizadas con el mismo ID. Cuando se declara un reemplazo para un modulo del que el lock no fija version, la resolucion le pide al hub una version de release, y hasta que una evidencia mas fuerte seleccione una, mantiene una version cero solo local.

Los reemplazos de workspace afectan el grafo de carga en el arranque y nunca se escriben en `wippy.lock`. Los cambios en el codigo fuente local se reconcilian directamente, sin contactar al hub. Los globs `exclude:` del `wippy.yaml` fuente del modulo tambien se aplican a los directorios de reemplazo, tanto al cargar entradas como al calcular el hash del contenido.

Una seccion `replacements:` en `wippy.lock` esta deprecada: aun se carga pero imprime una advertencia. Mueve esas entradas a `workspace.replacements` en un archivo de configuracion.

## Orden de Carga

Al iniciar, Wippy carga las entradas desde los directorios en este orden:

1. Directorio fuente (`src`)
2. Directorios de reemplazo
3. Directorios de modulos vendorizados

Los modulos con reemplazos activos omiten su ruta de vendor.

## Verificacion de Integridad

Cada modulo del archivo de bloqueo lleva un digest de artefacto. El arranque se niega a cargar un modulo cuya entrada del lock no tiene ninguno; `wippy install` acepta esa entrada y registra el digest que el hub sirve con la descarga.

En el arranque, las descargas se hacen por etapas: el pack se escribe en un archivo temporal junto a su ubicacion final, se verifica contra el digest fijado en `wippy.lock` y contra el digest que el hub sirvio con la URL de descarga (mas el tamano servido), y solo entonces se renombra a su lugar. Un archivo en etapas que falla la verificacion se elimina. `wippy install` renombra la descarga a su ruta de vendor antes de verificarla, la comprueba solo contra el digest y el tamano servidos, la elimina si falla, y reemplaza un digest del lock que difiera del servido en lugar de exigirlo.

Una discrepancia de digest es un fallo duro y no reintentable. En el arranque es `PermissionDenied`, "module integrity verification failed", lanzado tanto para una descarga nueva como para un pack ya vendorizado, que se reverifica contra el digest del lock antes de cargar las entradas. `wippy install` lo reporta como `Internal`: "failed to store module" envolviendo "verify cached WAPP: digest mismatch" para un pack que ya esta en el directorio de vendor, y "failed to download module" envolviendo "verify downloaded WAPP: digest mismatch" para una descarga nueva. Nada reintenta, vuelve a descargar sobre la discrepancia, ni recurre al contenido servido.

La misma comprobacion protege la resolucion. Cuando el hub sirve un manifiesto cuyo digest difiere del que fija el lock, la cache de manifiestos se refresca una vez y se vuelve a comparar; si sigue en desacuerdo, la resolucion falla nombrando ambos digests.

Los directorios extraidos llevan su propio digest, tamano y digest de arbol registrados, y se reverifican contra los valores registrados, de modo que un arbol vendorizado modificado se detecta en lugar de cargarse.

Las fuentes de reemplazo tambien estan direccionadas por contenido. El runtime calcula el digest del arbol de reemplazo y lo rechaza cuando el grafo resuelto ya fija un digest o un tamano distinto para ese modulo, de modo que un reemplazo no puede sustituir silenciosamente contenido con el que no coincide.

## Artefactos de Tiempo de Construccion

Un modulo puede incluir un recurso de sistema de archivos marcado con `meta.artifact.format` que los consumidores materializan en disco en lugar de leerlo en tiempo de ejecucion. Las variantes completas y dirigidas de `wippy install` y `wippy update`, el arranque en frio y las operaciones de dependencias en runtime reconcilian esas salidas como parte de la misma transaccion que cambia el grafo de modulos; `artifact.materialization_root` establece la raiz de salida. Ver [Artefactos de tiempo de construccion](guides/artifacts.md).

## Ver Tambien

- [Artefactos de tiempo de construccion](guides/artifacts.md) - Declaracion, materializacion y reconciliacion de recursos de artefactos
- [Construccion de Componentes](guides/components.md) - El lado del autor: `ns.requirement` y el suministro de valores via `parameters`
- [CLI](guides/cli.md) - Referencia de comandos
- [Publicacion](guides/publishing.md) - Publicacion de modulos en el hub
- [Estructura del Proyecto](start/structure.md) - Estructura del proyecto
