---
title: "Registro"
description: "El registro es el almacén de configuración central de Wippy. Todas las definiciones (puntos de entrada, servicios, recursos) viven aquí, y los cambios…"
---

# Registro

El registro es el almacén de configuración central de Wippy. Todas las definiciones (puntos de entrada, servicios, recursos) viven aquí, y los cambios se propagan reactivamente a través del sistema.

## Entradas

El registro contiene **entradas**: definiciones tipadas con IDs únicos:

```
app.api:get_user          -> Manejador HTTP
app.workers:email_sender  -> Proceso en segundo plano
app:database              -> Conexión a base de datos
app:templates             -> Conjunto de plantillas
```

Cada entrada tiene un `ID` (formato namespace:nombre), un `kind` que determina su manejador, campos `meta` arbitrarios, y `data` específica del kind.

Junto a ese contenido autorado, el registro mantiene su propia procedencia para cada entrada: el `owner`, es decir la fuente de despliegue de la que proviene la entrada, y `root`, que marca una declaración de dependencia que el despliegue seleccionó. Este estado lo asigna el registro, no lo escribe el autor de la entrada, y se mantiene separado de `meta` para que ambos nunca se confundan. Se lee a través de la API de estado del snapshot en lugar de las APIs de entrada ordinarias—consulte el [Módulo de registro](lua/core/registry.md#snapshot-state).

## Manejadores de Kind

Cuando se envía una entrada, su `kind` determina qué manejador la procesa. El manejador valida la configuración y crea recursos del runtime: una entrada `http.service` inicia un servidor HTTP, una entrada `function.lua` crea un pool de funciones, una entrada `db.sql.postgres` establece un pool de conexiones. Consulte la [Guía de Tipos de Entrada](guides/entry-kinds.md) para kinds disponibles y [Tipos de Entrada Personalizados](internals/kinds.md) para implementar manejadores.

## Actualizaciones en Vivo

El registro soporta cambios en tiempo de ejecución: agregar, actualizar, o eliminar entradas mientras el sistema se ejecuta. Los cambios fluyen a través del bus de eventos donde los listeners pueden validarlos o rechazarlos, y las transacciones aseguran atomicidad. El historial de versiones permite rollback.

Los archivos de definición YAML son snapshots serializados del registro cargados al inicio. Consulte el [módulo Registry](lua/core/registry.md) para acceso programático.

## Ver También

- [YAML y Estructura del Proyecto](start/structure.md) - Archivos de definición
- [Tipos de Entrada Personalizados](internals/kinds.md) - Implementar manejadores de kind
- [Modelo de Procesos](concepts/process-model.md) - Cómo funcionan los procesos
