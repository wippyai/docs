---
title: Modelo de Seguridad - Aislamiento de Procesos, Control de Capacidades y Fronteras de Datos
description: Cómo Wippy controla a qué puede acceder su código, a qué no, y quién impone esas fronteras. Cubre el aislamiento de procesos, el control de capacidades basado en el registry, la imposición multi-inquilino y la seguridad de agentes.
---

# Modelo de Seguridad

El modelo de seguridad de Wippy define a qué puede acceder su código, a qué no, y quién impone esas fronteras. Vale la pena leerlo antes de construir, porque funciona en dos capas que la mayoría de los frameworks colapsan en una: el runtime aísla cada proceso de modo que las capacidades peligrosas simplemente están ausentes, y una capa de políticas basada en atributos gobierna qué capacidades del registry puede usar un proceso. Entender ambas cambia cómo estructura una aplicación.

## Modelo de Confianza

La capa de aislamiento de Wippy no otorga al proceso ninguna autoridad ambiental. Un proceso Lua o WASM recién creado no puede tocar el sistema de archivos, la red, el sistema operativo anfitrión ni la memoria de otros procesos, porque esas capacidades no están presentes en su entorno. Las capacidades llegan únicamente a través del registry: funciones, herramientas, conexiones y configuración que se conceden explícitamente al proceso.

Sobre eso, el acceso a las capacidades del registry se gobierna mediante control de acceso basado en atributos (ABAC). Cada operación protegida se comprueba contra el alcance de seguridad del actor actual, un conjunto de políticas que permiten o deniegan una acción sobre un recurso, condicionadas opcionalmente por metadatos del actor y del recurso. Esto es declarativo: usted define las políticas en configuración, no en el código de la aplicación.

Cuando un proceso se ejecuta con un actor y un alcance, el acceso es denegado por defecto: una solicitud se permite solo si una política la autoriza explícitamente y ninguna la deniega. El **modo estricto** gobierna el caso incompleto, cuando no hay actor ni alcance establecidos. Está **activado por defecto**, de modo que un contexto incompleto se deniega; establecer `security.strict_mode: false` en la configuración del runtime opta en cambio por el comportamiento permisivo. La consecuencia a tener en cuenta es que, bajo el valor por defecto, un proceso sin contexto de seguridad declarado falla toda comprobación — dé a tal proceso un bloque `security:` en su entrada, o inícielo por una vía que lo proporcione. Combinado con políticas de mínimo privilegio, esto le da autorización fail-closed encima de un aislamiento por denegación por ausencia. Consulte la [Referencia de seguridad](system/security.md) para la sintaxis de políticas, las reglas de evaluación y la forma del bloque `security:`.

## Aislamiento de Procesos

Cada unidad de ejecución en Wippy corre en un proceso aislado con su propio intérprete embebido (Lua o WASM).

**Lo que un proceso tiene:** su propio espacio de memoria (una sobrecarga base de ~13 KB para Lua). Una vista delimitada del registry. Una identidad de actor y un alcance de seguridad. Un ciclo de vida supervisado con recuperación ante fallos y límites de reinicio.

**Lo que un proceso no tiene:** acceso al sistema de archivos (excepto a través de entradas de sistema de archivos controladas por el registry). Acceso a la red (excepto a través de módulos de cliente HTTP o de herramientas concedidos). Acceso a la memoria de otros procesos. Acceso al runtime de Go que lo aloja. Acceso a variables de entorno (excepto a través de entradas de entorno concedidas).

**Cómo se impone el aislamiento:** cada proceso Lua arranca desde una biblioteca estándar mínima. La E/S de archivos, el acceso a procesos del sistema operativo, la carga dinámica de código y las redes nunca se cargan, así que no están presentes en el entorno, y el proceso no puede restaurar lo que no existe. La carga de módulos está restringida: `require` resuelve únicamente los módulos y entradas del registry que se conceden explícitamente al proceso, sin ruta de búsqueda en el sistema de archivos. Los procesos WASM logran un aislamiento equivalente mediante WASI: solo son alcanzables las funciones del anfitrión y las entradas de sistema de archivos montadas que se configuran para esa entrada.

Esto no es aislamiento mediante permisos en tiempo de ejecución (como seccomp o AppArmor). Es aislamiento por ausencia. Las capacidades peligrosas nunca se cargan, así que no pueden ser explotadas, eludidas ni escaladas.

## Control de Capacidades

El registry es el almacén de capacidades de Wippy, y las políticas de seguridad son su capa de autorización.

**Cada capacidad es una entrada del registry.** Las funciones, herramientas, definiciones de agentes, conexiones a bases de datos, referencias de entorno, valores de configuración y tareas programadas son todas entradas del registry con un kind, esquema y metadatos declarados. Las entradas son validadas por el manejador de su kind al registrarse.

**Los IDs de entrada tienen espacio de nombres.** Un ID tiene la forma `namespace:name` con un único dos puntos, y los namespaces son jerárquicos mediante segmentos separados por puntos, por ejemplo `tenant_acme.tools:read` (namespace `tenant_acme.tools`, nombre `read`). Las políticas emparejan acciones y recursos, y los patrones de recurso pueden apuntar a un prefijo de namespace, de modo que una sola regla puede cubrir un namespace entero.

**Las políticas deciden el acceso.** Cada acceso a una capacidad (una búsqueda en el registry, una llamada a función, un manejador de base de datos, la apertura de un archivo) se comprueba contra el alcance del actor. Una política declara las acciones y recursos que cubre, un efecto de permitir o denegar, y condiciones opcionales sobre metadatos del actor y del recurso. La evaluación ocurre en cada acceso, no una sola vez al arrancar: si alguna política deniega, el acceso se deniega; si al menos una permite y ninguna deniega, se permite; si ninguna política coincide, el acceso se deniega. (Cuando el contexto no tiene actor ni alcance en absoluto, ese caso incompleto lo resuelve el modo estricto, no la evaluación de políticas.)

**Un contexto se declara, no se hereda de la nada.** Las funciones heredan el actor y el alcance del llamante. Un proceso lanzado también los hereda: su frame se bifurca del de quien lo lanza, y el bloque `security:` de su propia entrada modifica entonces ese contexto heredado — un `actor` que nombre reemplaza al actor heredado, y las políticas y grupos de políticas que liste por ID del registry se fusionan en el alcance heredado. La resolución es atómica — si falta alguna política o grupo nombrado, el lanzamiento falla en lugar de proceder con un alcance parcial. Un comando de CLI puede además declarar `meta.command.security`, aplicado solo en la vía de lanzamiento confiable donde el operador inició el comando él mismo.

**Los argumentos de las herramientas tienen forma de esquema.** Una herramienta declara un JSON Schema para sus entradas. Ese esquema se le da al modelo para que genere argumentos conformes, y el acceso a la herramienta se comprueba por política antes de que la llamada se ejecute.

## Fronteras de Datos

**Las conexiones a bases de datos son entradas del registry.** Un proceso no ensambla su propia cadena de conexión. Solicita una conexión por ID del registry, y esa solicitud se comprueba por política antes de que se devuelva un manejador. Un proceso cuyas políticas no conceden la entrada de la base de datos del Inquilino B no puede obtener un manejador a ella.

**Las claves de API de LLM viven en el sistema de entorno.** Las claves para Claude, GPT y otros proveedores se leen del sistema de entorno (por ejemplo, variables de entorno del sistema operativo expuestas mediante una entrada `env.storage.os`, referenciadas por entradas `env.variable` cuyas lecturas se comprueban por política mediante la acción `env.get`). El proveedor las lee internamente; no se pasan en los argumentos del proceso ni se devuelven al código que llama.

**El almacenamiento de archivos y blobs sigue el mismo modelo.** Un proceso lee o escribe mediante entradas del registry de sistema de archivos o de almacenamiento en la nube, con cada acceso comprobado por política. Los procesos WASM acceden a archivos únicamente a través de entradas de sistema de archivos montadas explícitamente para esa entrada.

## Seguridad de Agentes

Los agentes son procesos impulsados por LLM con uso de herramientas. Toman decisiones en tiempo de ejecución que su código no controla directamente, así que sus fronteras importan. Wippy gestiona esto mediante los mismos mecanismos de registry y políticas que cualquier otro proceso.

**Acceso a herramientas.** Un agente solo puede invocar las herramientas listadas en su definición, y cada ejecución de herramienta pasa por `funcs.call`, que se comprueba por política. Una llamada denegada falla antes de que la función de la herramienta se ejecute. Un agente diseñado para leer datos de clientes pero no borrarlos, o bien no tiene herramienta de borrado en su definición, o bien tiene esa acción denegada por política.

**Herramientas externas y MCP.** Wippy puede consumir herramientas externas y exponer las suyas sobre el Model Context Protocol. Las herramientas consumidas pasan por la misma vía de llamada a función y las mismas comprobaciones de política que las nativas. Las herramientas que Wippy expone a clientes MCP externos están protegidas por tokens de acceso delimitados y revocables que limitan qué acciones puede realizar un cliente.

**Salida estructurada.** El módulo LLM puede solicitar salida restringida por esquema (estructurada) usando el soporte nativo de salida estructurada del proveedor, de modo que la salida de un agente puede ceñirse a una forma declarada.

**Observabilidad.** Con OpenTelemetry habilitado, las llamadas al proveedor de LLM y las invocaciones de herramientas se trazan, y el uso de tokens se registra mediante el contrato de usage-tracker. Esto le da un rastro de auditoría de qué llamó un agente y cuánto gastó. Consulte [Observabilidad](guides/observability.md).

**Fronteras de automodificación.** A un agente con permiso para crear herramientas en un namespace se le puede denegar el acceso de escritura a su propia definición en otro. Las escrituras en el registry son acciones comprobadas por política, así que una política de denegación sobre el propio namespace del agente le impide editarse a sí mismo o concederse nuevo acceso.

## Imposición Multi-Inquilino

Para despliegues donde múltiples clientes comparten una sola instancia de Wippy, el aislamiento se impone mediante evaluación de políticas antes de que se ejecute cualquier operación, no mediante código de aplicación que comprueba IDs de inquilino.

**El aislamiento de inquilinos se impone por política.** Dé a cada inquilino un actor y un alcance cuyas políticas cubran únicamente los namespaces de ese inquilino. Con el modo estricto activado, al proceso de un inquilino se le deniega el acceso a recursos fuera de su alcance antes de que su código se ejecute. El aislamiento efectivo depende de escribir esas políticas por inquilino; el runtime las impone, pero no infiere la pertenencia a un inquilino por usted.

**El acceso entre inquilinos es explícito.** Una capacidad compartida entre inquilinos vive en un namespace compartido que las políticas de cada inquilino permiten. El compartir es opt-in por namespace.

**La concurrencia está acotada en el anfitrión.** Los hosts de procesos acotan la concurrencia mediante pools de workers. Los grupos de procesos (`pg.scope`) proporcionan namespaces aislados de pertenencia y difusión a nivel de clúster y pueden limitar el número de grupos y de miembros. Los techos de CPU o memoria por inquilino no son una característica integrada del runtime; imponga esos en la capa de infraestructura.

Hay planificada una guía dedicada de Arquitectura Multi-Inquilino.

## Alcance y Limitaciones

El modelo de seguridad de Wippy cubre el aislamiento de procesos, el control de capacidades y las fronteras de datos. Lo siguiente queda fuera del alcance del runtime y sigue siendo responsabilidad de su infraestructura.

**Cifrado de datos en reposo.** El cifrado de bases de datos, disco y almacenamiento de blobs lo maneja la infraestructura subyacente (TDE de PostgreSQL, cifrado de disco y similares). Wippy asume que la capa de almacenamiento maneja el cifrado.

**Aislamiento a nivel de red.** El aislamiento de procesos ocurre en la capa de aplicación. La segmentación de red entre Wippy y sus dependencias (base de datos, APIs de LLM, servicios externos) la maneja la infraestructura: VPCs, grupos de seguridad, cortafuegos.

**Gestión de identidad.** La autenticación (verificar quién es un usuario) la maneja su capa de autenticación. El modelo de seguridad de Wippy empieza después de la autenticación: controla qué pueden hacer los procesos de un usuario autenticado, no quién es el usuario. Los tokens que portan un actor y un alcance pueden emitirse y validarse mediante un token store.

**Registros de auditoría de infraestructura.** El trazado de Wippy cubre operaciones a nivel de proceso: llamadas a funciones, llamadas a herramientas, actividad de procesos. El acceso a nivel de infraestructura (SSH al servidor, operaciones de administración de la base de datos) debería auditarse con herramientas de infraestructura.

## Preguntas Frecuentes

**¿Puede el agente de un inquilino acceder a los datos de otro inquilino?**
No cuando los recursos de cada inquilino están delimitados por política. Con políticas por inquilino y modo estricto, el runtime deniega el acceso a recursos fuera del alcance del inquilino antes de que el código del agente se ejecute.

**¿Puede un agente escalar sus propios permisos?**
Solo si sus políticas permiten escribir en su propia definición. Las escrituras en el registry se comprueban por política, así que una política de denegación sobre el propio namespace del agente impide la automodificación. Un agente que puede crear herramientas en un namespace no puede concederse acceso a namespaces que su alcance no cubre ya.

**¿Cómo veo lo que hizo un agente?**
Con OpenTelemetry habilitado, las llamadas a LLM y a herramientas se trazan, y el uso de tokens se registra mediante el contrato de usage-tracker. Consulte [Observabilidad](guides/observability.md).

**¿Qué ocurre si un agente se comporta de forma inesperada?**
Queda contenido por el sandbox: sin sistema de archivos, sin red, sin sistema operativo, sin acceso a otros procesos más allá de lo que se le concedió. Solo puede llamar a las herramientas de su definición que la política permite, y esas llamadas quedan registradas.

**¿El aislamiento de inquilinos lo impone mi código o el runtime?**
El runtime. El motor de políticas evalúa cada acceso antes de que la operación se ejecute. Su trabajo es escribir las políticas por inquilino; el runtime las impone.

**¿Cómo se aseguran las herramientas MCP externas?**
Las herramientas consumidas sobre MCP pasan por la misma vía de llamada a función y las mismas comprobaciones de política que las nativas. Las herramientas que Wippy expone a clientes MCP externos están protegidas por tokens de acceso delimitados y revocables. Conectar un servicio MCP no elude el modelo de seguridad.

## Referencia de Seguridad

| Aspecto | Enfoque de Wippy |
|---------|------------------|
| Aislamiento de procesos | Intérprete separado por proceso (Lua o WASM), sin memoria compartida |
| Acceso por defecto | Las políticas sin coincidencia deniegan cuando hay actor y alcance establecidos; el modo estricto, activado por defecto, deniega cuando no hay actor ni alcance |
| Declaración de contexto | Bloque `security:` en la entrada (actor, políticas, grupos); la resolución es atómica y fail-closed |
| Cadena de suministro | Packs de módulos verificados por digest en la instalación y en el arranque; una discrepancia rechaza el módulo |
| Confianza entre nodos | Malla internodal mutuamente autenticada; identidad ed25519 por nodo, mapa explícito de pares confiables |
| Propagación en workflows | Actor y alcance transportados a Temporal como cabecera firmada y vinculada a una audiencia; un fallo de verificación hace fallar la ejecución |
| Control de capacidades | Entradas del registry gobernadas por políticas de seguridad basadas en atributos (actor, alcance, acción, recurso) |
| Fronteras de datos | Las conexiones y el almacenamiento son entradas del registry; cada acceso se comprueba por política por ID de entrada |
| Gestión de claves de API | Almacenadas en el sistema de entorno, leídas internamente por los proveedores, no expuestas al código del proceso |
| Control de herramientas del agente | Herramientas limitadas a la definición del agente; cada llamada comprobada mediante la política de `funcs.call` |
| Herramientas externas (MCP) | Misma vía de llamada a función y mismas comprobaciones de política; las herramientas expuestas se protegen con tokens delimitados |
| Rastro de auditoría del agente | Trazado con OpenTelemetry (cuando está habilitado) más registros de usage-tracker |
| Aislamiento multi-inquilino | Políticas y alcances por inquilino evaluados por el runtime antes de cada operación |
| Límites de concurrencia | Acotados por los pools de workers del anfitrión; sin techos de CPU/memoria por inquilino integrados |
| Automodificación | Las políticas de denegación sobre acciones de escritura en el registry impiden que los agentes editen sus propias definiciones |

## Vea También

- [Referencia de seguridad](system/security.md) - Políticas, alcances, actores, token stores y el bloque `security:`
- [Gestión de Dependencias](guides/dependency-management.md#integrity-verification) - Verificación de digest de módulos
- [Clúster](guides/cluster.md#internode-identity) - Identidad internodal y confianza entre pares
- [Workflows de Temporal](temporal/workflows.md#security-context) - Propagación de contexto firmada
- [Registry](concepts/registry.md) - El almacén de capacidades
- [Modelo de Procesos](concepts/process-model.md) - Aislamiento y ciclo de vida de procesos
- [Agentes](framework/agents.md) - Definiciones de agentes y uso de herramientas
