---
title: "Arquitectura de aplicaciones"
description: "Cómo dividir una aplicación Wippy en namespaces, slices y capas para que el grafo del registro siga siendo componible, comprobable y arrancable a medida que crece."
---

# Arquitectura de aplicaciones

Una aplicación Wippy es un **grafo de entradas del registro** representado por archivos fuente. El código vive en entradas como `function.lua` y `process.lua`; los archivos `_index.yaml` declaran cómo se conectan funciones, routes, servicios y libraries. La estructura de la aplicación determina cómo se divide ese grafo en namespaces para que siga siendo componible, comprobable y arrancable a medida que crece.

Esta página explica una forma de organizar el grafo. Para el formato de archivos, nombres y ubicación de `_index.yaml`, consulta [YAML y estructura del proyecto](../start/structure.md). Para las definiciones de entradas, consulta la [Guía de tipos de entrada](../guides/entry-kinds.md).

## Slices por funcionalidad

Una opción predeterminada útil es organizar por **funcionalidad**, no por tipo de archivo. Un slice posee una capacidad de extremo a extremo — acceso a base de datos, procesos de larga duración, superficie HTTP y vocabulario compartido — y vive bajo un prefijo de namespace:

```
src/app/jobs/          namespace: app.jobs
src/app/auth/          namespace: app.auth
src/app/billing/       namespace: app.billing
```

Los slices agrupan el comportamiento relacionado en una carpeta, lo que facilita leer, probar, cambiar o eliminar una capacidad sin rastrearla por directorios superiores separados como `handlers/`, `models/` y `services/`.

## Capas dentro de un slice

En slices grandes, separa el código según **qué toca el exterior**. Así se aplica una arquitectura ports-and-adapters (hexagonal) mediante **sub-namespaces**:

```
src/app/jobs/                  namespace: app.jobs          ← shared vocabulary
  consts.lua  config.lua  types.lua
  persist/                     namespace: app.jobs.persist  ← database adapters (sql)
  service/                     namespace: app.jobs.service  ← processes, workers
  api/                         namespace: app.jobs.api      ← http.endpoints
```

Haz que los imports fluyan desde las capas exteriores hacia las interiores:

```
api  →  service  →  persist  →  { consts, config, types }
```

La raíz del slice contiene el vocabulario compartido y no importa sus propios children. Los children pueden importar la raíz. Evita imports directos entre slices; coloca las definiciones compartidas en un namespace padre común, como `app.core:types`.

<note>
Los namespaces organizan los ID de entradas, pero por sí mismos no crean dependencias ni seams de injection. Los <code>imports</code> explícitos, las referencias específicas del tipo y los targets de <code>ns.requirement</code> crean esas relaciones. Una dirección coherente mantiene explícito el grafo resultante. Consulta <a href="#why-this-shape">Por qué usar esta forma</a>.
</note>

Un slice pequeño puede usar un solo `_index.yaml` para sus libraries y endpoint. La propiedad importante es la **dirección de imports**, no la cantidad de carpetas.

## Vocabulario compartido

Tres archivos aparecen habitualmente en la raíz del slice. Contienen definiciones compartidas por sus capas:

| Archivo | Contiene | Capacidades |
|------|-------|--------------|
| `consts.lua` | Máquinas de estado, enums, tiers de queue e ID de procesos del registro. Los valores que reflejan constraints `CHECK` de la base de datos. | ninguna |
| `config.lua` | Opciones ajustables por entorno con un helper que aplica un default del código solo cuando `env.get(KEY)` devuelve `errors.NOT_FOUND` y propaga errores de permission o backend. No se necesita una entrada `env.variable` para que un valor sea opcional. | `env` |
| `types.lua` | Formas de entidades (`type Job = { ... }`): las filas que devuelve la capa de persistencia. | ninguna |

`consts` y `types` no declaran **ninguna capacidad del Host**; son entradas `library.lua` puras que devuelven una tabla. Mantener el vocabulario de dominio libre de I/O también permite probarlo sin base de datos ni process host.

Mantén este vocabulario **privado del slice**. Coloca constants y types compartidos entre slices en un namespace padre común e impórtalos en lugar de copiarlos.

## Capacidades por capa

Las entradas Lua declaran módulos no ambient en `modules:` y dependencias respaldadas por el registro en `imports:`. Un slice por capas puede alinear esas dependencias con la responsabilidad:

- `persist/*` declara `sql`, manteniendo el acceso a base de datos en la capa de persistencia.
- `service/*` mantiene la orquestación de procesos y las dependencias de servicios en la capa de servicio. Los globals `process` y `channel` son ambient y no necesitan declaraciones en `modules:`.
- `api/*` declara módulos como `http` e importa las funciones o libraries que llama.
- El vocabulario raíz no necesita módulos no ambient ni imports de infraestructura.

Esto limita la visibilidad de módulos a una capa conocida. No es una autorización: las policies ABAC deciden de forma independiente si las operaciones protegidas, como `db.get`, están permitidas en runtime. Para revisar el código capaz de pedir un handle de base de datos, inspecciona `persist/`, sus módulos declarados y las policies asociadas a su execution context.

## Aplicaciones y componentes

La misma forma sirve para una aplicación única o una library publicada; la diferencia es **quién proporciona sus dependencias**.

Una **aplicación** es el grafo superior desplegable. Posee la infraestructura concreta — `http.service`, `process.host`, conexión de base de datos — bajo un namespace raíz (por convención `app`) y conecta todo por sí misma.

Un **componente** es un módulo publicable que se monta en un Host. Como no conoce los ID de base de datos o router del Host, declara una interfaz de entradas `ns.requirement` que proporciona el Host. Internamente puede usar las mismas capas, vocabulario y dirección de imports que un slice de aplicación.

Son dos puntos de un continuo:

- **Aplicación única, slices internos** — viven en `src/app/` y comparten directamente la infraestructura de la aplicación mediante referencias a `app:db`, `app:processes`. No necesitan interfaz de requirements porque nada externo los monta.
- **Composición de varios componentes** — cada componente es un módulo publicable con una `ns.definition` y una interfaz `ns.requirement`, compuesto por un Host mediante `ns.dependency`. El Host rellena una vez cada requirement (base de datos, process host, router).

Elige según si el slice será **consumido por un Host que no controlas**. Los componentes reutilizables necesitan una interfaz de requirements; los slices internos pueden referenciar directamente la infraestructura de la aplicación. El packaging cambia con la reutilización, pero las capas internas pueden mantenerse.

Consulta [Creación de componentes](../guides/components.md) para el mecanismo de requirement/dependency y [Gestión de dependencias](../guides/dependency-management.md) para el lock file.

## Por qué usar esta forma :id=why-this-shape

Esta estructura facilita la composición, la revisión de capacidades y el análisis del orden de boot:

**Los targets de requirements son el seam de injection.** Los distintos namespaces hacen legibles los ID target, pero `ns.requirement.targets` realiza la injection. Un Host puede proporcionar un ID de base de datos a entradas de persistencia y uno de process host a entradas de servicio. Referenciar directamente `app:db` acoplaría el componente a esa convención del Host.

**Las referencias unidireccionales mantienen resolubles las transiciones del registro.** El registro extrae las rutas de dependencias declaradas y ordena topológicamente los cambios para crear dependencias antes que dependents y eliminarlas después. La dirección `api → service → persist → root` ayuda a mantener acíclico el grafo. Un namespace padre solo es una convención organizativa; las entradas compartidas siguen necesitando referencias explícitas.

**Los módulos acotados por capa tienen un límite claro.** Cada chunk Lua puede resolver sus imports y módulos no ambient declarados; los módulos del registro no declarados fallan de forma cerrada durante la resolución. Las comprobaciones de policy en runtime son otro límite. Cuando solo las entradas de persistencia declaran `sql`, resulta más sencillo identificar y auditar el código capaz de solicitar un handle de base de datos.

**Las capas admiten distintos scopes de prueba.** El vocabulario se puede probar sin infraestructura. Las pruebas de persistencia pueden usar una base de datos sin iniciar workers. Una **prueba de montaje** del módulo completo comprueba después los seams de integración: cada servicio supervisado apunta a un proceso, cada ID creado se resuelve y cada requirement está cubierto.

## Véase también

- [YAML y estructura del proyecto](../start/structure.md) — formato, nombres y namespaces
- [Creación de componentes](../guides/components.md) — `ns.definition`, `ns.requirement` y montaje
- [Gestión de dependencias](../guides/dependency-management.md) — lock files y consumo de módulos
- [Registro](./registry.md) — cómo se almacenan y resuelven las entradas
- [Guía de tipos de entrada](../guides/entry-kinds.md) — todos los tipos de entrada
- [Modelo de procesos](./process-model.md) — servicios, supervisión y hosts
