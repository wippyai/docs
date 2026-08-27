---
title: "Registro"
description: "Cómo almacena Wippy entradas tipadas, inicializa recursos del runtime y propaga cambios de configuración."
---

# Registro

El registro es el almacén versionado de Wippy para puntos de entrada, servicios, recursos y otras definiciones del runtime. La mayoría de los tipos de entrada del runtime se reconcilian mediante transacciones del bus de eventos; los tipos internos como `registry.entry` y los metadatos de namespace omiten de forma predeterminada el despacho de eventos.

## Entradas

El registro contiene **entradas**: definiciones tipadas con ID únicos:

```
app.api:get_user          → HTTP handler
app.workers:email_sender  → Background process
app:database              → Database connection
app:templates             → Template set
```

Cada entrada tiene un `ID` (formato namespace:name), un `kind` que determina su handler, campos `meta` arbitrarios y `data` específicos del tipo.

Muchos controles de autorización también usan los ID del registro como recursos. El registro almacena las definiciones; el ámbito de seguridad decide si las operaciones protegidas pueden acceder a ellas. Consulta el [Modelo de seguridad](./security-model.md).

## Handlers de tipos

Cuando se envía una entrada despachada, su `kind` selecciona el handler registrado. El handler valida y reconcilia el recurso correspondiente del runtime: una entrada `http.service` gestiona un servidor HTTP, una entrada `function.lua` gestiona un pool de funciones y una entrada `db.sql.postgres` gestiona un pool de conexiones. Consulta la [Guía de tipos de entrada](../guides/entry-kinds.md) para ver los tipos disponibles y [Tipos de entrada personalizados](../internals/kinds.md) para implementar handlers.

## Actualizaciones en vivo

Las entradas se pueden añadir, actualizar o eliminar mientras el sistema está en ejecución. Para los tipos despachados, una transacción del registro pide a los handlers participantes que acepten o rechacen cada operación antes del commit. Un rechazo descarta la transacción y aplica la transición inversa. Los cambios de topología relacionados producen una sola versión nueva del registro.

El historial de versiones permite transiciones hacia atrás y hacia delante cuando está habilitado. El historial en memoria es el predeterminado y dura lo que dura el proceso; los backends de SQLite y PostgreSQL conservan el historial entre reinicios.

Los archivos de definición YAML y JSON son manifests de origen que el boot loader convierte en entradas. No son snapshots serializados del registro. Consulta el [módulo Registry](../lua/core/registry.md) para el acceso programático.

## Véase también

- [YAML y estructura del proyecto](../start/structure.md) — Archivos de definición
- [Tipos de entrada personalizados](../internals/kinds.md) — Implementar handlers de tipos
- [Modelo de procesos](./process-model.md) — Comprender la ejecución de procesos
