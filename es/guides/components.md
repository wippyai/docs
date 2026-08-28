---
title: "Creación de componentes"
description: "Declara requisitos de módulos reutilizables con ns.requirement y haz que un Host los proporcione mediante parámetros de dependencia."
---

# Creación de componentes

Un **componente** es un módulo Wippy reutilizable que se publica en el Hub y se monta en una aplicación Host. Puede depender de una base de datos, process host o router sin conocer los ID de entradas del Host. Declara esas dependencias mediante una **interfaz de requirements**, y el Host proporciona sus valores.

Esta guía cubre el lado del author: declarar la interfaz y comprender cómo fluyen los valores hacia las entradas. Para el lado del consumer (lock files, constraints de versión, `wippy add`/`update`), consulta [Gestión de dependencias](guides/dependency-management.md). Para la estructura interna de un componente, consulta [Arquitectura de aplicaciones](concepts/architecture.md).

## Los tres tipos de entrada

| Tipo | Lado | Función |
|------|------|------|
| `ns.definition` | componente | Metadatos del módulo; obligatorio para publicar. |
| `ns.requirement` | componente | Un hueco que debe rellenar el Host y dónde inyectar el valor. |
| `ns.dependency` | Host | Monta un componente y proporciona valores para sus requirements. |

## ns.definition

Cada módulo publicado debe tener exactamente una definition. Puede contener metadatos del módulo y referencias a README y páginas wiki.

```yaml
- name: definition
  kind: ns.definition
  module: jobs                # optional module metadata
  readme: file://README.md    # path to the module's documentation
  meta:
    title: Durable Jobs
    description: Leased job queue with retry and dead-lettering.
```

`module`, `readme` y `wiki` son data de la definition; todos son opcionales. `meta` son metadatos ordinarios de la entrada para interfaces de administración. Las release notes se proporcionan al publicar, no aquí.

## ns.requirement

Un requirement es un **valor con nombre y una lista de targets de injection**. El Host proporciona el valor y el runtime lo escribe en cada entrada target en el path especificado.

```yaml
- name: target_db
  kind: ns.requirement
  meta:
    description: SQL database backing every table in this module.
  default: app:db
  targets:
    - entry: app.jobs.migrations:schema
      path: .meta.target_db
    - entry: app.jobs.persist:lifecycle
      path: .db
```

### `default`: obligatorio u opcional

El campo `default` determina si el Host *debe* proporcionar un valor:

- **`default` presente con valor no null** (incluida una cadena vacía) → requirement **opcional**. Si el Host no proporciona nada, se usa el default.
- **`default` ausente** → requirement **obligatorio**. Si no se proporciona nada, el linking falla en modo strict (y emite un warning en caso contrario).

<note>
Un default explícitamente vacío (<code>default: ""</code>) es distinto de uno ausente o null. Una cadena vacía significa «opcional, fallback a nada»; tanto la ausencia como <code>default: null</code> significan «el Host debe proporcionar este valor». Usa un default no null para infraestructura con una convención razonable dentro de la aplicación (<code>app:db</code>, <code>app:processes</code>); omítelo para valores que solo puede conocer el Host.
</note>

### `targets`: ubicaciones de injection

Cada target es un par `{entry, path}`:

- **`entry`** — entrada donde se inyecta el valor. Un nombre simple (`schema`) se resuelve dentro del namespace del propio requirement; un id fully-qualified (`app.jobs.migrations:schema`) apunta exactamente a esa entrada entre namespaces.
- **`path`** — dot path dentro de la entrada target, por ejemplo `.meta.target_db`, `.host`, `.database.url`. El punto inicial es convencional.

Un requirement debe declarar al menos un target.

Usa el sufijo `+=` en el path para append en lugar de set, útil cuando varios requirements contribuyen a una lista, por ejemplo middleware:

```yaml
targets:
  - entry: app.api:router
    path: .middleware+=     # appends the value to the list at .middleware
```

### Un requirement, varios targets

Agrupa en un requirement los targets que necesitan el mismo valor. Por ejemplo, `target_db` puede proporcionar `.meta.target_db` a todas las migraciones y `.db` a la library de persistencia; `process_host` puede proporcionar `.host` a cada servicio supervisado; y `api_router` puede proporcionar `.meta.router` a cada endpoint:

```yaml
- name: process_host
  kind: ns.requirement
  default: app:processes
  targets:
    - { entry: app.jobs.service:worker.service, path: .host }
    - { entry: app.jobs.service:sweeper.service, path: .host }
```

El Host proporciona un valor y el runtime lo escribe en todos los targets declarados. La propia entrada requirement contiene este wiring.

## Consumir un componente

El Host monta un componente con `ns.dependency` y rellena sus requirements mediante `parameters`:

```yaml
version: "1.0"
namespace: app
entries:
  - name: dep.jobs
    kind: ns.dependency
    component: acme/jobs
    version: "^1.0.0"
    parameters:
      - name: target_db
        value: app:db
      - name: process_host
        value: app:processes
      - name: api_router
        value: app:api
```

Cada `parameter.name` coincide con un requirement; su `value` se inyecta en los targets del requirement. Se pueden omitir los requirements con default; los obligatorios deben proporcionarse.

### Coincidencia de nombres de parámetros

Cómo se enlaza un nombre de parámetro con un requirement:

- **Nombre simple** (`target_db`) coincide con un requirement de ese nombre perteneciente al componente que se está montando. No cruza a requirements de otro módulo.
- **Nombre cualificado** (`acme.jobs:target_db`) coincide exactamente con ese ID. Úsalo para desambiguar al conectar dependencias transitivas.

Si dos dependencias proporcionan valores **distintos** para el mismo requirement, se informa de un conflicto; los valores idénticos son válidos.

## Cuándo se resuelven los valores

La injection ocurre en la etapa **Link** del pipeline de build — durante publish, expansión de dependencias y boot —, no en runtime. La etapa:

1. Recopila cada `ns.requirement` y cada `ns.dependency` con sus parámetros.
2. Para cada requirement, resuelve un valor: gana un parámetro coincidente; si no, el default; si tampoco existe, queda sin resolver.
3. Escribe el valor resuelto en cada entrada target en su path (set o append para `+=`).

Con **strict requirements**, un requirement obligatorio sin resolver hace fallar el build; de lo contrario se registra un warning y continúa. Cuando las entradas llegan al runtime, cada requirement cubierto ya está incorporado a sus targets.

## Verificar la integración con una prueba de montaje

Las unit tests no verifican las relaciones del registro del módulo ensamblado. Añade una prueba de packaging o montaje contra el registro con requirements inyectados para verificar que:

- cada `service` supervisado apunta a una entrada de proceso existente,
- cada ID creado o programado resuelve a una entrada real,
- el storage de cada `env.variable` está registrado.

Esto detecta relaciones sin resolver, como un supervisor que referencia un worker no registrado o un fixture de prueba que usa un ID de storage propio del harness. Consulta [Supervisión](guides/supervision.md) y el framework de [Testing](framework/testing.md).

## Véase también

- [Arquitectura de aplicaciones](concepts/architecture.md) — estructura interna de un componente
- [Gestión de dependencias](guides/dependency-management.md) — lock files, versiones y workflow del consumer
- [Publicación de módulos](guides/publishing.md) — publicar un componente en el Hub
- [Guía de tipos de entrada](guides/entry-kinds.md) — referencia de `ns.definition`, `ns.requirement`, `ns.dependency`
