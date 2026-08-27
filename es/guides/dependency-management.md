---
title: "Gestión de dependencias"
description: "Declara, resuelve, instala, actualiza, reemplaza y verifica dependencias de módulos Wippy mediante un lock file."
---

# Gestión de dependencias

Wippy resuelve las dependencias de módulos a partir de declaraciones de source y registra versiones exactas en `wippy.lock`. Los módulos publicados se descargan del Hub al directorio de módulos del proyecto.

Los nombres de módulos `acme/*`, versiones, hashes y paths locales siguientes son ilustrativos. Sustitúyelos por módulos y digests verificados de tu proyecto o del Hub.

## Archivos del proyecto

### wippy.lock

El lock file registra la estructura de directorios del proyecto y sus dependencias fijadas:

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

| Campo | Descripción |
|-------|-------------|
| `directories.modules` | Dónde se guardan los módulos descargados (default: `.wippy`) |
| `directories.src` | Dónde vive el código fuente (default: `./src`) |
| `modules[].name` | Identificador del módulo en formato `org/module` |
| `modules[].version` | Versión semántica fijada |
| `modules[].hash` | Hash de contenido para verificar la integridad |

### wippy.yaml

Metadatos del módulo para publicarlo. Solo son obligatorios al publicar tu propio módulo:

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

| Campo | Obligatorio | Descripción |
|-------|----------|-------------|
| `organization` | Sí | Minúsculas, alfanumérico con guiones |
| `module` | Sí | Minúsculas, alfanumérico con guiones |
| `version` | No | Versión semántica (se establece al publicar) |
| `description` | No | Descripción del módulo |
| `license` | No | Identificador de licencia SPDX |
| `repository` | No | URL del repositorio fuente |
| `homepage` | No | Página principal del proyecto |
| `keywords` | No | Palabras clave de descubrimiento |
| `authors` | No | Lista de authors |

## Declarar dependencias

Añade entradas `ns.dependency` a `_index.yaml`:

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

### Constraints de versión

| Constraint | Ejemplo | Coincide con |
|------------|---------|---------|
| Exacta | `1.2.3` | Solo 1.2.3 |
| Caret | `^1.2.0` | >=1.2.0, <2.0.0 |
| Tilde | `~1.2.0` | >=1.2.0, <1.3.0 |
| Rango | `>=1.0.0` | 1.0.0 y posteriores |
| Wildcard | `*` | Cualquier versión (elige la más alta) |
| Combinada | `>=1.0.0 <2.0.0` | Entre 1.0.0 y 2.0.0 |

### Reglas de resolución

- Cada módulo se resuelve contra la **intersección de todos los rangos declarados** en el grafo de dependencias. Los rangos incompatibles (conflictos diamond) fallan con un error explícito en vez de elegir silenciosamente un lado.
- Las dependencias se resuelven desde sus rangos declarados, no desde pins resueltos previamente.
- **Las declaraciones root prevalecen sobre las transitivas**: cuando la aplicación y una dependencia incluyen el mismo módulo o requirement, prevalece la declaración de la aplicación. Una entrada de dependencia con `meta.module` es transitiva salvo que se marque explícitamente como root; las aplicaciones publicadas conservan como roots las dependencias declaradas en source.
- Un mismo componente solo puede declararse una vez como dependencia root; una declaración duplicada se rechaza con un error de conflicto. Actualiza la dependencia existente.

El runtime persiste cada grafo resuelto en su historial del registro y lo reproduce durante boot en vez de volver a resolverlo, por lo que una aplicación desplegada arranca con exactamente las versiones resueltas cuando se aplicó el cambio. `wippy.lock` sigue siendo el snapshot portable para proyectos fuente.

## Workflow de dependencias

### Iniciar un proyecto nuevo

```bash
wippy init
```

Crea un `wippy.lock` con directorios predeterminados.

### Añadir dependencias

```bash
wippy add acme/http               # Latest version
wippy add acme/http@1.2.3         # Exact version
wippy add acme/http@latest         # Latest label
```

Esto actualiza el lock file. Después instala:

```bash
wippy install
```

### Resolver desde source

Si el source ya declara entradas `ns.dependency`:

```bash
wippy update
```

Esto examina el directorio source, resuelve todos los constraints, actualiza el lock file e instala los módulos.

### Actualizar dependencias

```bash
wippy update                       # Re-resolve all dependencies
wippy update acme/http             # Update only acme/http
wippy update acme/http acme/sql    # Update specific modules
```

Al actualizar módulos concretos, los demás permanecen fijados en sus versiones actuales. Si la actualización requiere cambiar módulos no target, se pide confirmación.

### Instalar desde el lock file

```bash
wippy install                      # Install all from lock
wippy install --refresh            # Re-fetch every module (--force and --repair are aliases)
```

## Almacenamiento de módulos

Los módulos descargados se guardan en `.wippy/vendor/`:

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

De forma predeterminada se conservan como archivos `.wapp`. Para extraerlos a directorios:

```yaml
# wippy.lock
options:
  unpack_modules: true
```

Con unpacking habilitado:

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

## Desarrollo local con replacements

Para desarrollo local, asigna módulos del Hub a directorios locales en la sección `workspace` de un archivo de configuración del runtime. Normalmente es un archivo privado e ignorado que se compone sobre `.wippy.yaml`:

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

Las keys son `org/module` y los valores, directorios. Los paths relativos se resuelven contra el directorio del primer archivo `--config`; el path debe existir y ser un directorio. Establecer un replacement en `null` deshabilita uno heredado de una capa o profile anterior. También pueden vivir dentro de un [profile](./configuration.md#profiles), de modo que solo se activen con `--profile workspace`.

Los workspace replacements afectan al grafo de carga en boot y nunca se escriben en `wippy.lock`. Los cambios del source local se reconcilian directamente, sin contactar con el Hub. Los globs `exclude:` del source del módulo en `wippy.yaml` también se aplican a los directorios replacement, tanto al cargar entradas como al calcular hashes.

La sección `replacements:` de `wippy.lock` está deprecated. Aún se carga con un warning; mueve esas entradas a `workspace.replacements` en un archivo de configuración.

## Orden de carga

Durante boot, Wippy carga entradas de directorios en este orden:

1. Directorio source (`src`)
2. Directorios replacement
3. Directorios de módulos vendorizados

Los módulos con replacements activos omiten su path de vendor.

## Verificación de integridad

El hash de contenido de una entrada del lock es opcional hasta que lo rellena la instalación. Cuando existe un digest esperado, la instalación verifica los módulos cached y descargados. Un módulo cached que no coincide detiene la instalación; ejecuta `wippy install --refresh` para descargar y verificar una copia nueva. Un módulo recién descargado que falle la verificación se elimina y la instalación falla.

## Véase también

- [Creación de componentes](./components.md) — Declara requirements y proporciona valores mediante `parameters`
- [CLI](./cli.md) — Referencia de comandos
- [Publicación](./publishing.md) — Publica módulos en el Hub
- [Estructura del proyecto](../start/structure.md) — Estructura del proyecto
