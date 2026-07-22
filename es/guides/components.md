---
title: "Construcción de Componentes"
description: "Creación de módulos reutilizables: declarar interfaces de requirements con ns.requirement y cómo los hosts suministran valores mediante parámetros de dependencia."
---

# Construcción de Componentes

Un **componente** es un módulo Wippy reutilizable — un slice de funcionalidad publicado en el hub y montado en una aplicación host. El desafío al que se enfrenta un componente es que no puede nombrar las cosas de las que depende: necesita *una* base de datos, *un* host de procesos, *un* router, pero no sabe cuáles le dará el host. Wippy resuelve esto con una **interfaz de requirements** — el componente declara huecos, el host los llena.

Esta guía cubre el lado del autor: declarar esa interfaz y entender cómo fluyen los valores hacia tus entradas. Para el lado del consumidor (archivos de bloqueo, restricciones de versión, `wippy add`/`update`) consulta [Gestión de Dependencias](guides/dependency-management.md). Para cómo se estructura internamente un componente consulta [Arquitectura de Aplicaciones](concepts/architecture.md).

## Los tres tipos

| Tipo | Lado | Rol |
|------|------|-----|
| `ns.definition` | componente | Metadatos del módulo; requerido para publicar. |
| `ns.requirement` | componente | Un hueco que el host debe llenar, y dónde inyectar el valor. |
| `ns.dependency` | host | Monta un componente y suministra valores para sus requirements. |

## ns.definition

Uno por módulo, requerido para publicar. Lleva el nombre para mostrar del módulo y la ruta del README — nada más.

```yaml
- name: definition
  kind: ns.definition
  module: jobs                # opcional; por defecto el nombre de la entrada
  readme: file://README.md    # ruta a la documentación del módulo
  meta:
    title: Durable Jobs
    description: Leased job queue with retry and dead-lettering.
```

Solo `module` y `readme` son datos del componente; `meta` es metadata ordinaria de entrada para las UIs de gestión. Las notas de versión se suministran en el momento de publicar, no aquí.

## ns.requirement

Un requirement es un **hueco con nombre con una lista de destinos de inyección**. El host suministra un valor; el runtime escribe ese valor en cada entrada destino en la ruta dada.

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

### default — obligatorio vs opcional

El campo `default` decide si el host *debe* suministrar un valor:

- **`default` presente** (cualquier valor, incluida una cadena vacía) → el requirement es **opcional**. Si el host no suministra nada, se usa el valor por defecto.
- **`default` ausente** → el requirement es **obligatorio**. Sin nada suministrado, el enlazado falla bajo el modo estricto (y advierte en caso contrario).

<note>
Un default explícitamente vacío (<code>default: ""</code>) es distinto de no tener default en absoluto. La cadena vacía significa "opcional, recurre a nada"; ausente significa "el host debe proporcionar esto". Usa un default para infraestructura que tiene una convención razonable dentro de la app (<code>app:db</code>, <code>app:processes</code>); omítelo para valores que solo el host puede conocer.
</note>

### targets — dónde aterriza el valor

Cada target es un par `{entry, path}`:

- **`entry`** — la entrada en la que se inyecta el valor. Un nombre simple (`schema`) se resuelve dentro del propio namespace del requirement; un id completamente calificado (`app.jobs.migrations:schema`) apunta exactamente a esa entrada, a través de namespaces.
- **`path`** — una ruta con puntos dentro de la entrada destino, ej. `.meta.target_db`, `.host`, `.database.url`. El punto inicial es convencional.

Un requirement sin targets es un error — un hueco que no inyecta en ningún sitio no tiene sentido.

Anexa en lugar de asignar con el sufijo `+=` en la ruta — útil cuando varios requirements contribuyen a una misma lista (ej. middleware):

```yaml
targets:
  - entry: app.api:router
    path: .middleware+=     # anexa el valor a la lista en .middleware
```

### Un requirement, muchos targets

Agrupa todo lo que necesita el mismo valor bajo un único requirement. Este es el patrón idiomático: un requirement `target_db` que inyecta en el `.meta.target_db` de cada migración y en el `.db` de cada biblioteca de persistencia, un `process_host` que inyecta en el `.host` de cada `service` supervisado, un `api_router` que inyecta en el `.meta.router` de cada endpoint:

```yaml
- name: process_host
  kind: ns.requirement
  default: app:processes
  targets:
    - { entry: app.jobs.service:worker.service, path: .host }
    - { entry: app.jobs.service:sweeper.service, path: .host }
```

El host llena un hueco; el runtime distribuye el valor a cada target. Nada se refleja en una entrada de configuración paralela — la entrada del requirement *es* el cableado.

## Consumir un componente

El host monta un componente con `ns.dependency` y llena sus requirements a través de `parameters`:

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

Cada `parameter.name` coincide con un requirement; su `value` es lo que se inyecta en los targets de ese requirement. Los requirements con default pueden omitirse; los obligatorios deben suministrarse.

### Coincidencia de nombres de parámetros

Cómo se vincula el nombre de un parámetro a un requirement:

- **Nombre simple** (`target_db`) coincide con un requirement de ese nombre perteneciente al componente que se está montando. No cruza hacia los requirements de un módulo diferente.
- **Nombre calificado** (`acme.jobs:target_db`) coincide exactamente con ese id de requirement. Úsalo para desambiguar al cablear dependencias transitivas.

Si dos dependencias suministran valores **diferentes** para el mismo requirement, eso es un conflicto y se reporta (valores idénticos están bien).

## Cuándo se resuelven los valores

La inyección ocurre en la **etapa de Link** del pipeline de construcción — al publicar, durante la expansión de dependencias y en el arranque — no en tiempo de ejecución. La etapa:

1. Recolecta cada `ns.requirement` y cada `ns.dependency` con sus parámetros.
2. Para cada requirement, resuelve un valor: un parámetro coincidente gana; en su defecto el default; en su defecto (sin default) queda sin resolver.
3. Escribe el valor resuelto en cada entrada destino en su ruta (asignación, o anexado para `+=`).

Bajo **requirements estrictos** un requirement obligatorio sin resolver hace fallar la construcción; en caso contrario registra una advertencia y continúa. Para cuando las entradas llegan al runtime, cada requirement lleno ya ha sido incorporado en sus targets.

## Verifica las costuras: un test de montaje

Los tests unitarios ejercitan un slice de forma aislada; no pueden ver si el módulo *ensamblado* es coherente. Agrega un test de empaquetado/montaje que audite el módulo como un todo contra el registro en vivo con los requirements inyectados:

- cada `service` supervisado apunta a una entrada de proceso que existe,
- cada id spawneado o programado resuelve a una entrada real,
- el almacenamiento de cada `env.variable` está registrado.

Estas son las costuras de integración que las suites unitarias aisladas enmascaran — los huecos que permiten que un supervisor referencie un worker que nunca se registró, o que un fixture de test filtre un id de almacenamiento exclusivo del harness a un arranque montado. Consulta [Supervisión](guides/supervision.md) y el framework de [Testing](framework/testing.md).

## Ver También

- [Arquitectura de Aplicaciones](concepts/architecture.md) — cómo se estructura internamente un componente
- [Gestión de Dependencias](guides/dependency-management.md) — archivos de bloqueo, versiones, el flujo del consumidor
- [Publicación de Módulos](guides/publishing.md) — poner un componente en el hub
- [Guía de Tipos de Entrada](guides/entry-kinds.md) — referencia de `ns.definition`, `ns.requirement`, `ns.dependency`
