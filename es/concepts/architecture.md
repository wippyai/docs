---
title: "Arquitectura de Aplicaciones"
description: "Cómo dividir una aplicación Wippy en namespaces, slices y capas para que el grafo del registro se mantenga componible, testeable y arrancable a medida que crece."
---

# Arquitectura de Aplicaciones

Una aplicación Wippy no es un árbol de archivos fuente — es un **grafo de entradas del registro**. El código vive en entradas `function.lua` y `process.lua`; todo lo que las vincula — qué función responde a una ruta HTTP, qué proceso supervisa un servicio, qué biblioteca importa a cuál — se declara en `_index.yaml`. Estructurar una app significa decidir cómo **dividir ese grafo en namespaces** para que se mantenga componible, testeable y arrancable a medida que crece.

Esta página es el razonamiento detrás del layout. Para las reglas mecánicas (formato de archivo, nomenclatura, dónde va `_index.yaml`) consulta [YAML y Estructura del Proyecto](start/structure.md). Para los propios tipos de entrada consulta la [Guía de Tipos de Entrada](guides/entry-kinds.md).

## La unidad es un slice

Organiza por **funcionalidad**, no por tipo de archivo. Un slice posee una capacidad de extremo a extremo — su acceso a base de datos, sus procesos de larga duración, su superficie HTTP y el vocabulario que comparten — y vive bajo un prefijo de namespace:

```
src/app/jobs/          namespace: app.jobs
src/app/auth/          namespace: app.auth
src/app/billing/       namespace: app.billing
```

La alternativa — una división de nivel superior en `handlers/`, `models/`, `services/` — dispersa cada funcionalidad por todo el árbol y las acopla por proximidad. Los slices mantienen el radio de impacto de una funcionalidad dentro de una sola carpeta: puedes leerla, testearla o eliminarla sin perseguir referencias por todo el proyecto.

## Capas dentro de un slice

Dentro de un slice, divide según el eje de **qué toca el mundo exterior**. Esto es la arquitectura de puertos y adaptadores (hexagonal), expresada como **sub-namespaces**:

```
src/app/jobs/                  namespace: app.jobs          ← vocabulario compartido
  consts.lua  config.lua  types.lua
  persist/                     namespace: app.jobs.persist  ← adaptadores de base de datos (sql)
  service/                     namespace: app.jobs.service  ← procesos, workers
  api/                         namespace: app.jobs.api      ← http.endpoints
```

Los imports fluyen **en un solo sentido**, de lo más externo a lo más interno:

```
api  →  service  →  persist  →  { consts, config, types }
```

La raíz del slice (el vocabulario compartido) no importa nada de sus propios hijos. Los hijos importan la raíz. Ninguna capa vuelve hacia arriba, y **ningún slice importa otro slice directamente** — lo compartido entre slices pasa por un namespace padre común (ej. `app.core:types`), nunca lateralmente.

<note>
El límite de namespace no es cosmético. Es la costura en la que el runtime inyecta dependencias y a través de la cual resuelve el orden de arranque. La dirección de los imports es lo que garantiza que exista un orden de arranque válido — consulta <a href="#why-this-shape">Por qué esta forma</a>.
</note>

Un slice más pequeño colapsa la ceremonia — un único `_index.yaml` con las bibliotecas y un endpoint es suficiente. La regla que sobrevive a cualquier tamaño es la **dirección de los imports**, no el número de carpetas.

## El vocabulario compartido

Tres archivos se repiten en la raíz de un slice bien estructurado. Contienen lo que cada capa lee pero ninguna *es*:

| Archivo | Contiene | Capacidades |
|---------|---------|-------------|
| `consts.lua` | Máquinas de estados, enums, niveles de cola, IDs de registro de procesos. Los valores que reflejan las restricciones `CHECK` de tu base de datos. | ninguna |
| `config.lua` | Ajustes configurables por env con valores por defecto en código (`env.get(KEY) or DEFAULT`), de modo que no se requiere una entrada `env.variable` para que un valor sea opcional. | `env` |
| `types.lua` | Formas de entidades (`type Job = { ... }`) — las filas que devuelve la capa de persistencia. | ninguna |

`consts` y `types` no declaran **ninguna capacidad del host** — son `library.lua` puras que devuelven una tabla. Eso es deliberado: tu vocabulario de dominio no puede realizar I/O, así que no puede derivar hacia lógica de negocio, y es testeable de forma unitaria sin base de datos y sin host de procesos.

Mantén este vocabulario **privado del slice**. Las constantes y tipos compartidos entre slices viven en el padre común y se referencian mediante un import allí — nunca se copian en cada slice.

## Las capacidades se ordenan por capa

Cada entrada declara las capacidades del host que necesita en `modules:`. En un slice en capas estas se ordenan limpiamente:

- `persist/*` declara `sql` — y nada más obtiene acceso a la base de datos.
- `service/*` declara `channel`, capacidades del host de procesos — y nada más hace spawn ni supervisa.
- `api/*` declara lo que un endpoint necesita para serializar una solicitud.
- El vocabulario raíz no declara nada.

La recompensa es que el radio de impacto de cualquier capacidad es exactamente una capa. Si quieres saber todo lo que puede escribir en la base de datos, lees `persist/`. La inversión de dependencias deja de ser un principio abstracto y se convierte en una propiedad que puedes buscar con grep.

## Aplicaciones y componentes

La misma forma escala desde una app única hasta una biblioteca publicada cambiando solo **quién llena los huecos**.

Una **aplicación** es el grafo desplegable de nivel superior. Posee la infraestructura concreta — el `http.service`, el `process.host`, la conexión a la base de datos — bajo un namespace raíz (convencionalmente `app`), y cablea todo por sí misma.

Un **componente** es un módulo publicable montado *dentro de* un host. No puede nombrar la base de datos ni el router del host, porque no los conoce. En su lugar declara una **interfaz de huecos** — entradas `ns.requirement` — que el host llena cuando depende del componente. Internamente un componente se estructura exactamente igual que un slice de aplicación: mismas capas, mismo vocabulario, misma dirección de imports. La única adición es la interfaz de requirements en su borde.

Esto es un espectro, no dos categorías:

- **App única, slices internos** — los slices viven bajo `src/app/`, comparten la infraestructura de la app directamente referenciando `app:db`, `app:processes`. No se necesita interfaz de requirements; nada externo los monta. (Así se construye un servicio enfocado.)
- **Composición multi-componente** — cada componente es su propio módulo publicable con un `ns.definition` y una interfaz `ns.requirement`, compuestos por un host mediante `ns.dependency`. El host llena cada requirement (base de datos, host de procesos, router) una sola vez. (Así se construye una plataforma de partes reutilizables.)

Elige según si el slice está destinado a ser **consumido por algo que no controlas**. Si sí, dale una interfaz de requirements y publícalo. Si no, deja que referencie la infraestructura de la app directamente y ahórrate la ceremonia. La estratificación es la invariante en ambos extremos; el empaquetado es lo que escala con la reutilización.

Consulta [Construcción de Componentes](guides/components.md) para el mecanismo de requirement/dependency, y [Gestión de Dependencias](guides/dependency-management.md) para el lado del archivo de bloqueo.

## Por qué esta forma {#why-this-shape}

La disciplina anterior no es estilo. Cada regla es estructural para cómo el runtime compone y arranca un grafo:

**El límite de namespace es la costura de inyección.** Como las capas se vinculan solo a través de `imports:` explícitos y viven en namespaces distintos, el mecanismo `ns.requirement` tiene un objetivo concreto en el que inyectar — el host apunta su base de datos a las entradas de la capa `persist`, su host de procesos a las entradas de la capa `service`. Si `persist` tomara `app:db` directamente, el componente nunca podría montarse en un host diferente: no habría hueco que llenar. La estratificación es lo que hace a un componente **reubicable**.

**Los imports en un solo sentido garantizan que exista un orden de arranque.** El runtime resuelve el grafo de entradas en el arranque y debe encontrar un orden topológico. `api → service → persist → root`, nunca lateral y nunca hacia arriba, significa que el grafo es acíclico por construcción. El acoplamiento entre slices enrutado a través de un padre compartido mantiene los slices montables de forma independiente en lugar de anudarlos en un ciclo que el loader no puede ordenar.

**Las capacidades acotadas por capa limitan el radio de impacto.** Las capacidades del host se conceden por entrada. Cuando solo `persist` declara `sql`, el conjunto de código que puede alcanzar la base de datos es un directorio, auditable de un vistazo — no una propiedad emergente de toda la app.

**La estratificación produce un gradiente de testeabilidad.** El vocabulario puro se testea sin mundo. Los tests de `persist` tocan una base de datos pero no un worker. Un **test de montaje** de todo el módulo audita entonces las costuras que los tests unitarios deliberadamente no pueden ver — que cada servicio supervisado apunta a un proceso real, que cada ID spawneado resuelve, que cada requirement está lleno. Solo obtienes ese gradiente si las capas son realmente separables.

La versión corta: la estratificación hexagonal es aquí la única forma en la que la inyección de requirements, el alcance de capacidades por capa y la resolución acíclica del arranque se sostienen a la vez. El modelo de composición del runtime *requiere* la división en puertos y adaptadores para funcionar — la disciplina es lo que te compra un grafo que arranca y un componente que otro puede montar.

## Ver También

- [YAML y Estructura del Proyecto](start/structure.md) — formato de archivo, nomenclatura, namespaces
- [Construcción de Componentes](guides/components.md) — `ns.definition`, `ns.requirement`, montaje
- [Gestión de Dependencias](guides/dependency-management.md) — archivos de bloqueo, consumo de módulos
- [Registro](concepts/registry.md) — cómo se almacenan y resuelven las entradas
- [Guía de Tipos de Entrada](guides/entry-kinds.md) — todos los tipos de entrada
- [Modelo de Procesos](concepts/process-model.md) — servicios, supervisión, hosts
