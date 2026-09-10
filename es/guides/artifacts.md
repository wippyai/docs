---
title: "Artefactos en tiempo de compilación"
description: "Declarar un recurso de sistema de archivos como artefacto con conocimiento de formato, materializarlo en un proyecto consumidor, y qué reconcilia el runtime automáticamente."
---

# Artefactos en tiempo de compilación

Un módulo puede distribuir un directorio que los consumidores usan **en tiempo de compilación** en lugar de
en tiempo de ejecución — de la forma más útil, un paquete contra el que otros módulos compilan. Wippy
llama a estos **artefactos**: recursos de sistema de archivos WAPP corrientes marcados con
`meta.artifact.format`.

Así es como un paquete compartido llega a un módulo de otro repositorio. Un alias de ruta
solo se resuelve dentro de un repositorio; un artefacto viaja con el módulo.

[La Capa de Diseño](../frontend/design-layer.md) explica *qué* pertenece a tal
paquete y qué no; esta página es el mecanismo que lo distribuye.

## Declarar un artefacto

El productor declara un `fs.directory` normal y lo marca con un formato:

```yaml
# src/_index.yaml
entries:
  - name: package_fs
    kind: fs.directory
    meta:
      comment: El paquete npm que los consumidores materializan en tiempo de compilación.
      artifact:
        format: node-package
    directory: ./package
```

Nada más cambia: el recurso se incrusta en el WAPP como cualquier otro
`fs.directory` — inclúyalo bajo `embed:` en `wippy.yaml` o pase `--embed` a
`wippy publish` y `wippy pack`; un directorio que no se incrusta no se empaqueta
ni se valida. Los artefactos declarados se **validan durante la publicación del módulo
y el empaquetado de la aplicación**, de modo que uno malformado falla en la publicación en
lugar de en un consumidor.

## Formatos

Un adaptador de formato decide cómo se valida un directorio, qué identidad tiene,
y dónde aterriza. Wippy incluye uno integrado:

| Formato | Subárbol propio | Valida |
|---|---|---|
| `node-package` | `npm/` | `package.json` |

`node-package` requiere un `name` y una `version` semántica, y **rechaza los
scripts de ciclo de vida `preinstall`, `install`, `postinstall` y `prepare`** — un
paquete materializado no puede ejecutar nada durante la instalación. Escribe en
`npm/<nombre del paquete>` bajo la raíz de materialización.

El formato debe estar registrado en el binario que hace el trabajo. Los anfitriones pueden registrar
formatos adicionales; los nombres duplicados y las raíces solapadas se rechazan.

## Materializar

La mayor parte del tiempo usted no ejecuta nada. Las salidas materializadas se reconcilian
automáticamente durante:

- `wippy install` y `wippy update` completos y dirigidos
- el arranque en frío
- la instalación, actualización y desinstalación dinámicas respaldadas por el Hub

La instalación completa, la actualización, el arranque en frío y la reconciliación de dependencias en tiempo de ejecución son
*exactas*: las salidas obsoletas se podan. Una instalación **dirigida** superpone solo los
módulos seleccionados y preserva las salidas pertenecientes a módulos que no seleccionó.

Los reemplazos locales de módulos pasan por el mismo ciclo de vida de validación y materialización
que los recursos empaquetados, de modo que el artefacto de un módulo reemplazado se comporta como uno
publicado.

### Materializar explícitamente

Para un paso de compilación que necesita el artefacto antes de que el runtime intervenga, la
CLI lo expone directamente:

```bash
wippy artifacts materialize <pack.wapp> <namespace:name> [--root <directory>]
```

`--root` toma por defecto `.wippy`. El recurso debe declarar `meta.artifact.format`
y ese formato debe estar registrado en esta CLI.

Tenga claro qué **no** hace este comando deliberadamente: no
resuelve dependencias de módulos, no muta `wippy.lock`, no invoca
gestores de paquetes y no participa en la composición del runtime. Valida
un artefacto de un WAPP y lo escribe en disco.

### Dónde aterriza la salida

`artifact.materialization_root` configura la raíz de salida propiedad de la aplicación.
Su valor por defecto es el directorio padre del directorio vendor de dependencias. Cada formato posee un
subárbol sin solapamientos bajo ella, de modo que la salida de `node-package` está siempre bajo
`<root>/npm/`.

La materialización es transaccional. El contenido se valida y se prepara, las raíces
gestionadas se intercambian atómicamente bajo un bloqueo de proceso, un fallo revierte junto con
la transacción de registry circundante, y un intercambio interrumpido se recupera en
la siguiente ejecución.

## Ejemplo trabajado: un paquete frontend compartido

Un módulo productor cuyo único trabajo es publicar un paquete — no sirve nada en
tiempo de ejecución:

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

Eso escribe `./.wippy/npm/@kickside/ui-kit`. El consumidor lo recoge con un
glob de workspaces corriente, así que a partir de ahí la resolución es resolución de node normal:

```json
{
  "workspaces": ["./.wippy/npm/@*/*"]
}
```

```bash
npm install
```

Dos cosas que vale la pena copiar de esta forma:

- **El paquete es su propio módulo, no un directorio dentro de otro mayor.** El
  artefacto lleva su propia versión de `package.json`, y atarlo a un módulo
  que cambia por razones no relacionadas fuerza una publicación de uno cada vez que el
  otro se mueve.
- **El consumidor lo resuelve como una dependencia normal.** Una vez materializado no
  hay ruta de importación específica de Wippy, que es lo que permite que el mismo código fuente compile
  dentro del monorepo y fuera de él.

## De principio a fin: autoría, bucle de desarrollo, CI

### Escribir el productor

Para un artefacto de paquete normalmente **no hay nada que compilar** — el directorio es
el entregable. Un paquete de vocabulario CSS son solo archivos más un manifiesto:

```text
platform/ui-kit/
├── src/_index.yaml      # declara package_fs como el artefacto
└── package/             # el directorio que se convierte en el paquete npm
    ├── package.json
    ├── kx-card.css
    └── kx-state.css
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

`sideEffects` importa en un paquete solo de CSS: sin él, un bundler es libre de
tratar una hoja de estilos importada como código muerto y descartarla.

**La versión del paquete debe ser igual a la versión del módulo.** `wippy publish`
valida esto y rechaza una discrepancia, así que suba ambas a la vez. Esta es también la
razón para dar a un paquete compartido su *propio* módulo en lugar de anidarlo dentro de
uno mayor — de lo contrario, cada cambio no relacionado en el módulo anfitrión fuerza una
publicación del paquete, y viceversa.

### Publicar

```bash
# validar sin publicar
wippy publish --dry-run --version 1.5.0 --embed package_fs

# publicar
wippy publish --create --module-type library --module-visibility public --version 1.5.0 --embed package_fs
```

Los artefactos declarados se validan como parte de la publicación, de modo que un package.json que
incumple las reglas del formato se rechaza aquí y no en la compilación de un consumidor.

### El bucle de desarrollo

Publicar en cada edición no es un bucle de desarrollo. Empaquete el productor localmente y apunte
el paso de materialización del consumidor a ese archivo en su lugar:

```bash
# desde el módulo productor
wippy pack /tmp/ui-kit-dev.wapp --embed package_fs

# los consumidores materializan desde el pack local en lugar del publicado
UI_KIT_WAPP=/tmp/ui-kit-dev.wapp make ui-kit MOD=workflows
```

Mantenga esa anulación como la *única* diferencia entre la vía de desarrollo y CI — una
variable de entorno que selecciona el archivo de pack, con todo lo posterior idéntico. Un
bucle de desarrollo que materializa de forma distinta a CI deja de predecir
CI.

### Integrarlo en make y CI

Haga del paso de materialización un **prerrequisito de la compilación del consumidor**, no algo
que una persona se acuerde de ejecutar:

```make
UI_KIT_WAPP ?=

build:
	@case " $(UI_KIT_CONSUMERS) " in *" $(MOD) "*) $(MAKE) ui-kit MOD=$(MOD);; esac
	cd $(call fe_dir,$(MOD)) && npm run build
```

Entonces CI no necesita ningún paso específico de artefactos: ejecuta el mismo `make build`,
`UI_KIT_WAPP` no está definida, así que se ejecuta la vía de descarga y materialización contra la
versión publicada fijada en `build-inputs`. Un checkout limpio no puede compilar
contra un paquete obsoleto o ausente, y un colaborador que nunca ha oído hablar de
artefactos aun así obtiene una compilación correcta.

## Lo que todavía tiene que hacer a mano

`wippy artifacts materialize` es deliberadamente estrecho, así que una compilación que consume
un artefacto pega actualmente cuatro pasos por sí misma. Saber cuáles son esos cuatro
ahorra redescubrirlos:

**1. Obtener el `.wapp`.** El comando toma una *ruta de archivo de pack*, no una referencia
de módulo, y no resuelve dependencias — así que algo tiene que descargar el
productor primero. El patrón que funciona es un proyecto Wippy diminuto cuyo único trabajo es
fijarlo y descargarlo:

```yaml
# build-inputs/wippy.lock — un proyecto que existe solo para descargar
directories:
  modules: .wippy
  src: ./src
modules:
  - name: kickside/ui-kit
    version: 1.5.0
    hash: be1eafd5…
```

```bash
( cd build-inputs && wippy install )
wapp=$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1)
```

Fijarlo aquí en lugar de en el lock de la aplicación mantiene una entrada de tiempo de compilación
fuera del grafo de dependencias en tiempo de ejecución.

**2. Materializar una vez por consumidor**, en una raíz que el gestor de paquetes del
consumidor pueda ver:

```bash
wippy artifacts materialize "$wapp" kickside.ui_kit:package_fs --root ./ui/.wippy
```

**3. Cablear el `package.json` del consumidor.** Materializar escribe archivos; no
edita manifiestos. npm enlaza el paquete solo si el consumidor declara
*ambos*, el glob de workspace y la dependencia:

```json
{
  "workspaces": ["./.wippy/npm/@*/*"],
  "dependencies": { "@kickside/ui-kit": "*" }
}
```

La versión es `*` porque el paquete materializado lleva la suya. Automatice esto
con un script y hágalo idempotente — si falta el cableado, la compilación falla mucho
más tarde con un escueto `ENOENT` sobre una hoja de estilos, que se lee como un archivo ausente
en lugar de como un cableado ausente.

**4. Ejecutar el gestor de paquetes.** `materialize` no invoca ninguno, así que
`npm install` le corresponde llamarlo a usted, después del paso 3.

Todo junto, en un target que toma el módulo consumidor como parámetro:

```make
ui-kit:
	@set -e; \
	( cd build-inputs && $(WIPPY) install ); \
	wapp=$$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1); \
	test -n "$$wapp" || { echo "no ui-kit .wapp; is the module published?"; exit 1; }; \
	$(WIPPY) artifacts materialize "$$wapp" kickside.ui_kit:package_fs --root $(DIR)/.wippy; \
	cd $(DIR) && node ../../scripts/wire-ui-kit.mjs && npm install --no-audit --no-fund
```

Haga del target completo un prerrequisito de la compilación del consumidor, para que un checkout
limpio no pueda compilar contra un paquete obsoleto o ausente.

## Fuera de alcance

Los artefactos no introducen intencionadamente un segundo resolutor, registro de paquetes,
formato de archivo, esquema de lock, API de Hub ni manifiesto de módulo. La semántica de dependencias
solo de compilación, la política de redistribución y la validación de ABI del anfitrión son preocupaciones separadas
y no se resuelven aquí.

## Relacionado

- [Gestión de Dependencias](./dependency-management.md) — resolución de módulos y
  reemplazos locales
- [Publicación](./publishing.md) — qué contiene un módulo publicado
- [La Capa de Diseño](../frontend/design-layer.md) — por qué un vocabulario frontend
  compartido se distribuye como paquete en primer lugar
