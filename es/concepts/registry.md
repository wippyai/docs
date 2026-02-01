# Registro

El registro es el almacen de configuracion central de Wippy. Todas las definiciones (puntos de entrada, servicios, recursos) viven aqui, y los cambios se propagan reactivamente a traves del sistema.

## Entradas

El registro contiene **entradas**: definiciones tipadas con IDs unicos:

```
app.api:get_user          -> Manejador HTTP
app.workers:email_sender  -> Proceso en segundo plano
app:database              -> Conexion a base de datos
app:templates             -> Conjunto de plantillas
```

Cada entrada tiene un `ID` (formato namespace:nombre), un `kind` que determina su manejador, campos `meta` arbitrarios, y `data` especifica del kind.

## Manejadores de Kind

Cuando se envia una entrada, su `kind` determina que manejador la procesa. El manejador valida la configuracion y crea recursos del runtime: una entrada `http.service` inicia un servidor HTTP, una entrada `function.lua` crea un pool de funciones, una entrada `sql.database` establece un pool de conexiones. Consulte la [Guia de Tipos de Entrada](guide-entry-kinds.md) para kinds disponibles y [Tipos de Entrada Personalizados](internal-kinds.md) para implementar manejadores.

## Actualizaciones en Vivo

El registro soporta cambios en tiempo de ejecucion: agregar, actualizar, o eliminar entradas mientras el sistema se ejecuta. Los cambios fluyen a traves del bus de eventos donde los listeners pueden validarlos o rechazarlos, y las transacciones aseguran atomicidad. El historial de versiones permite rollback.

Los archivos de definicion YAML son snapshots serializados del registro cargados al inicio. Consulte el [modulo Registry](lua-registry.md) para acceso programatico.

## Ver Tambien

- [YAML y Estructura del Proyecto](getting-started-structure.md) - Archivos de definicion
- [Tipos de Entrada Personalizados](internal-kinds.md) - Implementar manejadores de kind
- [Modelo de Procesos](concept-process-model.md) - Como funcionan los procesos
