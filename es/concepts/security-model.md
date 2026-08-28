---
title: "Modelo de seguridad: aislamiento de procesos y comprobaciones de políticas"
description: "Cómo Wippy limita los entornos de ejecución Lua y WASM y autoriza operaciones protegidas del runtime mediante actores, ámbitos y políticas."
---

# Modelo de seguridad

Wippy combina el aislamiento de ejecución con control de acceso basado en atributos (ABAC). El aislamiento determina qué módulos y recursos del host puede alcanzar el código. ABAC determina si una operación protegida está permitida para el actor y ámbito de políticas actuales. Ambos límites importan: importar un módulo no concede sus permisos y una política no puede hacer que un módulo no declarado esté disponible para Lua.

## Reglas de autorización

Un contexto de seguridad puede contener un **actor** y un **ámbito**. El actor identifica al principal y puede incluir metadatos. El ámbito es un conjunto inmutable de políticas. Una política compara una acción y un recurso, puede inspeccionar metadatos del actor o del recurso y devuelve `allow`, `deny` o `undefined`.

Cuando están presentes tanto el actor como el ámbito:

1. Cualquier denegación coincidente prevalece.
2. Al menos una autorización y ninguna denegación permiten la operación.
3. Si ninguna política coincide, el resultado es `undefined`, que las operaciones protegidas del runtime tratan como una denegación.

`security.strict_mode` solo se aplica cuando el contexto está incompleto porque falta el actor o el ámbito. El runtime v0.3.32a arranca con el modo estricto activado. Desactívelo únicamente cuando código heredado o de transición deba conservar un tratamiento permisivo de un contexto incompleto:

```yaml
# .wippy.yaml
security:
  strict_mode: false
```

| Contexto | `strict_mode: false` | `strict_mode: true` |
|----------|----------------------|---------------------|
| Actor y ámbito presentes | Evalúa las políticas; solo `allow` permite el acceso | Igual |
| Falta el actor o el ámbito | Permite la operación protegida | Deniega la operación protegida |

Mantenga el modo estricto en despliegues que deban cerrarse ante errores y asegúrese de que los servicios arranquen con el actor y el ámbito que requiere su trabajo. Desactivar el modo estricto no convierte en autorización el resultado `undefined` de un ámbito completo.

Consulte la [referencia de seguridad](../system/security.md) para la sintaxis de políticas, actores, ámbitos y almacenes de tokens.

## Aislamiento de Lua

Cada proceso actor Lua posee un estado Lua, y las entradas de función se ejecutan mediante pools de estados aislados. El runtime abre un entorno base restringido en lugar del entorno completo del host Lua:

- las bibliotecas ambientales son las versiones restringidas de `table`, `math`, `os`, `coroutine`, `string` y `errors`, además de variables globales esenciales como `channel`, `payload` y `print`;
- `package.path` y `package.cpath` están vacíos y `package.loadlib` está desactivado;
- los módulos y bibliotecas respaldados por el registro solo son visibles para los chunks que los declaran mediante `modules:` o `imports:`;
- `require()` resuelve ese conjunto limitado y falla para un módulo de registro no declarado.

Por ello, el código Lua no dispone de una API directa para el sistema de archivos del host, sockets, procesos nativos o variables de entorno. Accede a esas funciones únicamente mediante módulos del runtime como `fs`, `http_client`, `exec` y `env`, cuyas operaciones protegidas siguen realizando comprobaciones de políticas.

Una biblioteca importada no filtra sus importaciones a quien la llama. Cada biblioteca y punto de entrada recibe su propio entorno limitado, por lo que una capacidad usada internamente por una biblioteca no queda disponible automáticamente para una función que la importa.

## Aislamiento de WASM

El código WASM se ejecuta mediante importaciones del host y ajustes WASI configurados. Los valores de entorno y montajes del sistema de archivos deben declararse en la entrada WASM. Antes de la instanciación, el runtime comprueba `env.get` para cada entrada de entorno configurada y `fs.get` para cada montaje. Los montajes se vuelven a enraizar en el sistema de archivos configurado en vez de exponer la raíz del host.

Las funciones del host para sockets WASM y HTTP saliente también realizan comprobaciones específicas como `socket.connect`, `socket.listen`, `socket.resolve` y `http_client.request`.

## Obtención y uso de capacidades

Muchos recursos del runtime son entradas del registro. Los módulos obtienen esos recursos por ID de entrada y comprueban la acción correspondiente. Algunos ejemplos en v0.3.32a:

| Operación | Comprobación | Recurso |
|-----------|-------------|---------|
| Leer una entrada del registro | `registry.get` | ID de entrada |
| Llamar a una función | `funcs.call` | ID de función |
| Obtener un manejador de base de datos SQL | `db.get` | ID de la entrada de base de datos |
| Obtener un sistema de archivos | `fs.get` | ID del sistema de archivos |
| Leer un valor de entorno | `env.get` | Nombre o ID de la variable |
| Crear un proceso | `process.spawn` | ID de la entrada de proceso |
| Seleccionar un host de procesos | `process.host` | ID del host |

Estas comprobaciones no se producen todas con la misma granularidad. Por ejemplo, `db.get` autoriza la obtención de un manejador de base de datos; las consultas SQL individuales mediante ese manejador no repiten `db.get`. Del mismo modo, `fs.get` autoriza la obtención de un manejador del sistema de archivos, no una decisión ABAC para cada operación de archivo. No pase un manejador adquirido a un contexto menos confiable salvo que deba conservar la autoridad de ese manejador.

Los módulos de red realizan comprobaciones adicionales para cada solicitud, conexión o listener cuando así se documenta. Consulte la referencia del módulo para conocer la acción y el recurso exactos de cada operación.

## Herencia del contexto

El actor y el ámbito son valores heredables del contexto del frame. Las llamadas a funciones y los procesos creados los heredan salvo que el llamador construya un contexto de sustitución. Establecer explícitamente un actor o ámbito para un proceso creado requiere el permiso `process.security`, además de los permisos de creación aplicables.

Esta herencia mantiene la autorización unida a una cadena de llamadas, pero también implica que un padre privilegiado debe limitar deliberadamente el contexto del trabajo delegado a código menos confiable.

## Mutación del registro

Leer entradas y modificar el registro son permisos diferentes. Los changesets duraderos estándar requieren `registry.apply`; en v0.3.32a esa comprobación usa un recurso vacío y no constituye una decisión de escritura por entrada ni por espacio de nombres. No conceda `registry.apply` a un agente no confiable suponiendo que un patrón de espacio de nombres limitará sus escrituras.

Los overlays locales al proceso tienen una superficie de permisos más estrecha. Comprueban el propietario del overlay y acciones específicas como `registry.overlay.create.<kind>`, `registry.overlay.update.<kind>` y `registry.overlay.delete.<kind>` contra el ID de la entrada afectada. Consulte [Registro de entradas](../lua/core/registry.md).

## Límites de datos

Use ID de registro distintos para bases de datos, sistemas de archivos, funciones y variables de entorno de cada tenant, y escriba políticas que solo permitan los ID previstos. Esto impide que un contexto obtenga el recurso protegido de otro tenant cuando todas las rutas de acceso usan los módulos comprobados del runtime.

Las referencias de entorno mantienen las credenciales del proveedor fuera de los manifiestos fuente. Un proveedor puede resolver internamente una `env.variable` configurada, pero eso no vuelve el valor intrínsecamente ilegible para el código de aplicación: el código que importe `env` y tenga permiso `env.get` para la misma variable puede leerlo. Proteja los secretos tanto con el ámbito de módulos como con políticas.

El modo estricto es importante en despliegues multi-tenant porque evita que el trabajo sin actor o ámbito eluda la evaluación de políticas. No deduce la identidad del tenant ni genera políticas; la aplicación debe establecer el actor, ámbito, recursos y cobertura de políticas correctos.

## Límites de agentes y herramientas

Los agentes del framework compilan las herramientas seleccionadas por sus definiciones y traits. Los esquemas de herramienta limitan y validan los argumentos. Las implementaciones de herramientas respaldadas por el registro se ejecutan mediante la ruta de llamada de `funcs`, por lo que `funcs.call` se comprueba contra el ID de la función de destino.

La lista de herramientas y el ámbito de políticas son complementarios:

- omitir una herramienta evita que el modelo la seleccione mediante la interfaz normal del agente;
- denegar `funcs.call` evita la ejecución aunque la herramienta esté en la lista compilada;
- conceder `funcs.call` no añade a la lista del modelo una herramienta no declarada.

Trate los wrappers de herramientas y las integraciones externas como código de aplicación adicional. No sustituyen las comprobaciones del runtime y también deben revisarse sus credenciales de red y reglas de autorización.

## Responsabilidades del despliegue

Los límites de ejecución y políticas de Wippy no sustituyen los controles de infraestructura:

- el cifrado del almacenamiento y la política de copias de seguridad corresponden a la base de datos, disco o almacén de objetos configurados;
- las VPC, firewalls y políticas de servicio controlan el alcance de red;
- la autenticación establece la identidad del usuario o servicio antes de que se aplique la autorización de Wippy;
- la administración del host, el acceso SSH y las acciones del administrador de base de datos requieren registros de auditoría de infraestructura;
- las cuotas de CPU y memoria por tenant requieren controles de recursos en el despliegue.

OpenTelemetry puede trazar operaciones configuradas del runtime y del framework, pero la cobertura depende de la instrumentación activada. Consulte [Observabilidad](../guides/observability.md).

## Lista de comprobación

- Mantenga `security.strict_mode` activado donde los contextos incompletos deban cerrarse ante errores.
- Asigne a cada servicio un actor y ámbito intencionados.
- Revise tanto los módulos/importaciones Lua declarados como las políticas de sus operaciones protegidas.
- Mantenga `registry.apply` fuera del alcance del código no confiable salvo que pretenda permitir la mutación completa y duradera del registro.
- No comparta manejadores de base de datos o sistema de archivos adquiridos entre límites de confianza.
- Separe los recursos de tenants por ID de registro y pruebe la denegación fuera del ámbito de cada tenant.
- Proteja los secretos de entorno con el ámbito de importación y políticas `env.get`.
- Verifique el tracing y los controles de infraestructura con independencia de la autorización del runtime.

## Véase también

- [Referencia de seguridad](../system/security.md) — Políticas, ámbitos, actores, modo estricto y almacenes de tokens
- [Registro de entradas](../lua/core/registry.md) — Lectura, mutación y permisos de overlays del registro
- [Gestión de procesos](../lua/core/process.md) — Creación, contexto y permisos de seguridad de procesos
- [Modelo de procesos](./process-model.md) — Aislamiento y ciclo de vida de los procesos
- [Agentes](../framework/agents.md) — Definiciones de agentes y selección de herramientas
