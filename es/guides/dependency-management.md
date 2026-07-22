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
| `modules[].hash` | Hash de contenido para verificacion de integridad |

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
- Las dependencias se resuelven a partir de sus rangos declarados, no de pins resueltos previamente.
- **Las declaraciones raiz ganan sobre las transitivas**: cuando tu app y una dependencia traen el mismo modulo o requirement, tu declaracion tiene prioridad. Una entrada de dependencia que lleva `meta.module` es transitiva salvo que se marque explicitamente como raiz — las aplicaciones publicadas conservan como raices las dependencias declaradas en su fuente.
- El mismo componente puede declararse como dependencia raiz solo una vez — una declaracion duplicada se rechaza con un error de conflicto. Actualiza la dependencia existente en su lugar.

El runtime persiste cada grafo resuelto en su historial del registro y lo reproduce en el arranque en lugar de volver a resolver, de modo que una aplicacion desplegada arranca exactamente con las versiones que se resolvieron cuando se aplico el cambio de dependencias. `wippy.lock` sigue siendo la instantanea portable para proyectos fuente.

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
      http/
        wippy.yaml
        src/
          _index.yaml
          ...
```

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

Las claves son `org/module`, los valores son directorios (las rutas relativas se resuelven contra el directorio del primer archivo `--config`; la ruta debe existir y ser un directorio). Establecer un reemplazo en `null` desactiva uno heredado de una capa de configuracion anterior o de un perfil. Los reemplazos tambien pueden vivir dentro de un [perfil](guides/configuration.md#profiles) para que se activen solo con `--profile workspace`.

Los reemplazos de workspace afectan el grafo de carga en el arranque y nunca se escriben en `wippy.lock`. Los cambios en el codigo fuente local se reconcilian directamente, sin contactar al hub. Los globs `exclude:` del `wippy.yaml` fuente del modulo tambien se aplican a los directorios de reemplazo, tanto al cargar entradas como al calcular el hash del contenido.

Una seccion `replacements:` en `wippy.lock` esta deprecada: aun se carga pero imprime una advertencia. Mueve esas entradas a `workspace.replacements` en un archivo de configuracion.

## Orden de Carga

Al iniciar, Wippy carga las entradas desde los directorios en este orden:

1. Directorio fuente (`src`)
2. Directorios de reemplazo
3. Directorios de modulos vendorizados

Los modulos con reemplazos activos omiten su ruta de vendor.

## Verificacion de Integridad

Cada modulo en el archivo de bloqueo tiene un hash de contenido. Durante la instalacion, los modulos descargados se verifican contra sus hashes esperados. Los modulos con discrepancias se rechazan y se vuelven a descargar desde el registro.

## Ver Tambien

- [Construccion de Componentes](guides/components.md) - El lado del autor: `ns.requirement` y el suministro de valores via `parameters`
- [CLI](guides/cli.md) - Referencia de comandos
- [Publicacion](guides/publishing.md) - Publicacion de modulos en el hub
- [Estructura del Proyecto](start/structure.md) - Estructura del proyecto
