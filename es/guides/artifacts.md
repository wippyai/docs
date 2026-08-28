---
title: "Artefactos de compilación"
description: "Declare, valide, publique y materialice artefactos de sistema de archivos sensibles al formato para proyectos consumidores."
---

# Artefactos de compilación

Un módulo puede distribuir un directorio que los consumidores usan **durante la compilación**, no durante la ejecución; por ejemplo, un paquete contra el que compilan otros módulos. Wippy denomina **artefactos** a estos recursos de sistema de archivos WAPP marcados con `meta.artifact.format`.

Los artefactos permiten que un paquete compartido viaje con un módulo entre repositorios, donde un alias de ruta local del repositorio no podría resolverlo.

[La capa de diseño](../frontend/design-layer.md) explica *qué* debe pertenecer a un paquete de este tipo y qué no; esta página describe el mecanismo que lo distribuye.

## Declarar un artefacto

El productor declara un `fs.directory` normal y lo marca con un formato:

```yaml
# src/_index.yaml
entries:
  - name: package_fs
    kind: fs.directory
    meta:
      comment: The npm package consumers materialize at build time.
      artifact:
        format: node-package
    directory: ./package
```

El marcador por sí solo no incluye el contenido del directorio. Seleccione la entrada `fs.directory` mediante la lista `embed:` del manifiesto del productor o la opción `--embed` de publish/pack. Una vez seleccionada, la entrada se transforma en un recurso empaquetado y se valida el formato del artefacto; los artefactos seleccionados mal formados fallan antes de producir el WAPP.

## Formatos

Un adaptador de formato decide cómo se valida un directorio, qué identidad tiene y dónde se escribe. Wippy incluye uno integrado:

| Formato | Subárbol propio | Valida |
|---------|-----------------|--------|
| `node-package` | `npm/` | `package.json` |

`node-package` exige un `name` y una `version` semántica, y **rechaza los scripts de ciclo de vida `preinstall`, `install`, `postinstall` y `prepare`**: un paquete materializado no puede ejecutar nada al instalarse. Se escribe en `npm/<package name>` bajo la raíz de materialización.

El formato debe estar registrado en el binario que realiza el trabajo. Los hosts pueden registrar formatos adicionales; se rechazan los nombres duplicados y las raíces que se solapan.

## Materialización

Las salidas materializadas se reconcilian automáticamente durante:

- `wippy install` y `wippy update`, tanto completos como dirigidos;
- el arranque en frío;
- la instalación, actualización y desinstalación dinámica respaldada por Hub.

La instalación completa, actualización, arranque en frío y reconciliación de dependencias en runtime son *exactos*: se eliminan las salidas obsoletas. Una instalación **dirigida** superpone únicamente los módulos seleccionados y conserva las salidas de los módulos que no seleccionó.

Los reemplazos de módulos locales pasan por el mismo ciclo de validación y materialización que los recursos empaquetados, por lo que el artefacto de un módulo reemplazado se comporta como uno publicado.

### Materialización explícita

Para un paso de compilación que necesita el artefacto antes de que intervenga el runtime, la CLI lo expone directamente:

```bash
wippy artifacts materialize <pack.wapp> <namespace:name> [--root <directory>]
```

El valor predeterminado de `--root` es `.wippy`. El recurso debe declarar `meta.artifact.format` y ese formato debe estar registrado en esta CLI.

Este comando **no** resuelve dependencias de módulos, no modifica `wippy.lock`, no invoca gestores de paquetes ni participa en la composición del runtime. Valida un artefacto de un WAPP y lo escribe en disco.

### Ubicación de salida

`artifact.materialization_root` configura la raíz de salida propiedad de la aplicación. Su valor predeterminado es el padre del directorio de dependencias vendorizadas. Cada formato posee un subárbol sin solapamientos bajo esa raíz, por lo que la salida de `node-package` siempre queda bajo `<root>/npm/`.

La materialización es transaccional. El contenido se valida y se prepara, las raíces gestionadas se intercambian de forma atómica bajo un bloqueo de proceso, un fallo revierte junto con la transacción del registro circundante y un intercambio interrumpido se recupera en la siguiente ejecución.

## Ejemplo de integración: un paquete frontend compartido

Los nombres `kickside/ui-kit`, targets de Make, variables de entorno y rutas de repositorio de esta sección ilustran un patrón de integración. No son comandos ni scripts auxiliares proporcionados por Wippy; adáptelos al productor y sistema de compilación propietarios del artefacto.

Un módulo productor puede publicar un paquete sin servir un recurso en runtime:

```yaml
# platform/ui-kit/src/_index.yaml
version: "1.0"
namespace: kickside.ui_kit

entries:
  - name: package_fs
    kind: fs.directory
    meta:
      artifact:
        format: node-package
    directory: ./package
```

Un consumidor lo materializa en su propio árbol antes de instalar dependencias:

```bash
wippy artifacts materialize kickside-ui-kit-1.5.0.wapp \
  kickside.ui_kit:package_fs --root ./.wippy
```

Esto escribe `./.wippy/npm/@kickside/ui-kit`. El consumidor lo recoge mediante un glob normal de workspaces, por lo que a partir de ahí la resolución es una resolución de Node ordinaria:

```json
{
  "workspaces": ["./.wippy/npm/@*/*"]
}
```

```bash
npm install
```

Esta disposición tiene dos propiedades importantes:

- **El paquete es su propio módulo, no un directorio dentro de otro mayor.** El artefacto lleva su propia versión de `package.json`; vincularlo a un módulo que cambia por motivos no relacionados obliga a publicar uno cada vez que cambia el otro.
- **El consumidor lo resuelve como una dependencia normal.** Una vez materializado, no existe una ruta de importación específica de Wippy, lo que permite compilar el mismo código fuente tanto dentro como fuera del monorepo.

## Flujo de principio a fin

### Creación del productor

Para un artefacto de paquete, el propio directorio puede ser el entregable. Un paquete de vocabulario CSS consta de sus archivos y su manifiesto:

```text
platform/ui-kit/
├── wippy.yaml           # selects package_fs for embedding
├── src/_index.yaml      # declares package_fs as the artifact
└── package/             # the directory that becomes the npm package
    ├── package.json
    ├── kx-card.css
    └── kx-state.css
```

Mantenga la selección de embed en el manifiesto del productor para que publish, el empaquetado local y CI usen el mismo conjunto de recursos:

```yaml
# platform/ui-kit/wippy.yaml
embed:
  - package_fs
```

```json
{
  "name": "@kickside/ui-kit",
  "version": "1.5.0",
  "type": "module",
  "sideEffects": ["*.css"],
  "exports": {
    "./kx-card.css": "./kx-card.css",
    "./kx-state.css": "./kx-state.css"
  },
  "files": ["kx-card.css", "kx-state.css", "package.json"]
}
```

`sideEffects` importa en un paquete compuesto solo por CSS: sin él, un bundler puede tratar una hoja de estilos importada como código muerto y eliminarla.

**La versión del paquete debe coincidir con la del módulo.** `wippy publish` lo valida y rechaza cualquier discrepancia, por lo que debe incrementar ambas a la vez. También es la razón para dar a un paquete compartido su *propio* módulo en vez de anidarlo dentro de otro más grande: de lo contrario, cualquier cambio no relacionado en el módulo host obliga a publicar el paquete y viceversa.

### Publicación

```bash
# validate without publishing
wippy publish --dry-run --version 1.5.0

# publish
wippy publish --create --module-type library --module-visibility public --version 1.5.0
```

Como el manifiesto del productor selecciona `package_fs` para su inclusión, el artefacto se incluye y valida durante la publicación. Un `package.json` que no cumpla las reglas del formato se rechaza aquí y no durante la compilación de un consumidor.

### Bucle de desarrollo

Durante el desarrollo, empaquete el productor localmente y haga que el paso de materialización del consumidor apunte a ese archivo:

```bash
# from the producer module
wippy pack /tmp/ui-kit-dev.wapp

# consumers materialize from the local pack rather than the published one
UI_KIT_WAPP=/tmp/ui-kit-dev.wapp make ui-kit MOD=workflows
```

Mantenga el override del archivo empaquetado como única diferencia entre desarrollo y CI. Una variable de entorno puede seleccionar el paquete local sin cambiar los pasos posteriores de materialización y compilación.

### Integración con compilación y CI

Haga que la materialización sea un **requisito previo de la compilación del consumidor**:

```make
UI_KIT_WAPP ?=

build:
	@case " $(UI_KIT_CONSUMERS) " in *" $(MOD) "*) $(MAKE) ui-kit MOD=$(MOD);; esac
	cd $(call fe_dir,$(MOD)) && npm run build
```

CI puede ejecutar entonces el mismo `make build` sin un paso adicional para el artefacto. `UI_KIT_WAPP` no está definido, por lo que la ruta de obtención y materialización usa la versión publicada fijada en `build-inputs`. Un checkout nuevo no puede compilar contra un paquete ausente u obsoleto, y un colaborador que nunca haya oído hablar de artefactos también obtiene una compilación correcta.

## Pasos de integración del consumidor

Como `wippy artifacts materialize` procesa un recurso de un paquete, la compilación del consumidor debe coordinar cuatro pasos:

**1. Obtener el `.wapp`.** El comando recibe una *ruta de archivo de paquete*, no una referencia a un módulo, y no resuelve dependencias. Una opción es un pequeño proyecto Wippy que fije y descargue el productor:

```yaml
# build-inputs/wippy.lock — a project that exists only to fetch
modules:
  - name: kickside/ui-kit
    version: 1.5.0
    hash: be1eafd5…
```

```bash
( cd build-inputs && wippy install )
wapp=$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1)
```

Fijarlo aquí, y no en el lock de la aplicación, mantiene una entrada de compilación fuera del grafo de dependencias del runtime.

**2. Materializar una vez por consumidor** en una raíz visible para el gestor de paquetes del consumidor:

```bash
wippy artifacts materialize "$wapp" kickside.ui_kit:package_fs --root ./ui/.wippy
```

**3. Conectar el `package.json` del consumidor.** La materialización escribe archivos; no modifica manifiestos. npm solo enlaza el paquete si el consumidor declara *tanto* el glob de workspace como la dependencia:

```json
{
  "workspaces": ["./.wippy/npm/@*/*"],
  "dependencies": { "@kickside/ui-kit": "*" }
}
```

La versión es `*` porque el paquete materializado incluye la suya. Automatice este paso y hágalo idempotente. Sin la configuración del manifiesto, la compilación puede informar más tarde de un `ENOENT` para una hoja de estilos en vez de identificar que falta la configuración de la dependencia.

**4. Ejecutar el gestor de paquetes.** `materialize` no invoca ninguno, por lo que debe ejecutar `npm install` después del paso 3.

En conjunto, en un target que recibe el módulo consumidor como parámetro:

```make
ui-kit:
	@set -e; \
	( cd build-inputs && $(WIPPY) install ); \
	wapp=$$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1); \
	test -n "$$wapp" || { echo "no ui-kit .wapp; is the module published?"; exit 1; }; \
	$(WIPPY) artifacts materialize "$$wapp" kickside.ui_kit:package_fs --root $(DIR)/.wippy; \
	cd $(DIR) && node ../../scripts/wire-ui-kit.mjs && npm install --no-audit --no-fund
```

Haga que todo el target sea un requisito previo de la compilación del consumidor para impedir que un checkout nuevo compile contra un paquete ausente u obsoleto.

## Fuera de alcance

Los artefactos no introducen intencionadamente un segundo resolver, registro de paquetes, formato de archivo, esquema de lock, API de Hub ni manifiesto de módulo. La semántica de dependencias exclusivas de compilación, la política de redistribución y la validación de la ABI del host son aspectos independientes que no se resuelven aquí.

## Relacionado

- [Gestión de dependencias](./dependency-management.md) — Resolución de módulos y reemplazos locales
- [Publicación](./publishing.md) — Contenido de un módulo publicado
- [La capa de diseño](../frontend/design-layer.md) — Por qué un vocabulario frontend compartido se distribuye como paquete
