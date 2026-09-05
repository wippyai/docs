---
title: "Por Qué Wippy Usa Lua - Decisión sobre el Lenguaje del Runtime Embebido"
description: "Wippy usa Lua como su lenguaje de runtime principal. He aquí por qué: huella de memoria, sandboxing completo, integración limpia con Go, carga determinista de módulos y sintaxis amigable para los LLM."
---

# Por Qué Wippy Usa Lua

Todo evaluador técnico hace esta pregunta, así que aquí está la respuesta directa.

## Requisitos del Runtime

Wippy ejecuta lógica definida por el usuario dentro de procesos aislados. Cada proceso necesita su propio espacio de memoria, su propio conjunto de capacidades disponibles, y ninguna forma de alcanzar nada fuera de su frontera salvo que el runtime lo permita explícitamente. La plataforma ejecuta miles de estos procesos concurrentemente en una sola instancia, cada uno potencialmente ejecutando código distinto para inquilinos distintos.

Esto significa que el runtime del lenguaje embebido dentro de cada proceso debe ser:

- **Diminuto.** Cada proceso se ejecuta en su propio entorno aislado. Con miles de procesos concurrentes, la memoria por proceso importa. Wippy apunta a una sobrecarga base de ~13 KB por proceso.
- **Completamente aislable.** El runtime debe controlar exactamente a qué módulos, funciones y llamadas al sistema puede acceder cada proceso. Sin autoridad ambiental. Sin estado global filtrándose entre procesos.
- **Embebible.** El runtime del lenguaje debe ser una biblioteca que el núcleo de Wippy (escrito en Go) pueda instanciar, configurar y destruir por proceso. No puede ser un proceso externo ni un binario aparte.
- **Determinista en la carga de módulos.** Cuando un proceso arranca, el runtime decide qué código puede ver. Sin acceso al sistema de archivos. Sin un `require` que alcance rutas arbitrarias. Las dependencias vienen del registry, delimitadas por proceso.
- **De sintaxis amigable para los LLM.** Los agentes generan y modifican código. El lenguaje debe ser lo bastante simple como para que un LLM pueda leerlo, escribirlo y razonar sobre él de forma fiable sin alucinar sintaxis.

## Lenguajes Evaluados: Python, JavaScript, Go y WASM

### Python

La elección por defecto para cargas de trabajo de IA. Lo descartamos porque la huella de memoria de CPython es de 10-30 MB por intérprete, órdenes de magnitud mayor que un proceso Lua. El sistema de imports de Python da al código acceso ambiental al sistema de archivos, la red y el sistema operativo. Aislar Python requiere o bien compilación a WASM (que rompe la mayoría de las bibliotecas) o un parcheo pesado del intérprete. El modelo de concurrencia de Python (el GIL) también entra en conflicto con nuestro modelo de aislamiento por proceso. El ecosistema es una fortaleza para scripts independientes, pero un lastre para un runtime aislado donde necesita control determinista sobre a qué puede acceder el código.

### JavaScript (V8/QuickJS)

V8 es rápido pero enorme (decenas de MB por isolate). QuickJS es lo bastante pequeño como para embeberse, pero la cadena de prototipos de JavaScript y su sistema de módulos dinámico hacen el aislamiento más difícil de lo que parece. `import` y `require` quieren alcanzar el sistema de archivos. El ecosistema espera npm, que asume acceso a red y un sistema de archivos escribible, y ninguno de los dos existe dentro de un proceso Wippy. Pasaríamos más tiempo peleando con las asunciones del lenguaje que construyendo el producto.

### Go

El núcleo de Wippy está escrito en Go, así que esto era tentador. Pero Go no se embebe. No se puede instanciar un runtime de Go como biblioteca dentro de otro programa Go. Los plugins de Go existen, pero son frágiles, comparten memoria con el proceso anfitrión y no se pueden aislar. Go es correcto para el runtime en sí; es incorrecto para el código de usuario.

### WASM

Genuinamente sólido para el aislamiento, y lo hemos construido como el segundo runtime de Wippy (vea más abajo). Pero WASM por sí solo no es suficiente como lenguaje principal para el desarrollo de agentes. La experiencia de desarrollo al escribir y depurar WASM directamente sigue siendo áspera, y los LLM generan código dirigido a WASM con menos fiabilidad que Lua. WASM es la elección correcta cuando necesita ejecutar código compilado de otros lenguajes dentro del sandbox de Wippy. Lua es la elección correcta para la experiencia principal de desarrollo y de autoría por agentes.

## Por Qué Lua Cumple los Cinco Requisitos

Lua fue construido exactamente para este caso de uso. Es el lenguaje de scripting más embebido en producción, ejecutándose dentro de World of Warcraft, Roblox, Redis, Nginx/OpenResty, equipos de red de Cisco y Juniper, Adobe Lightroom y cientos de motores de videojuegos. Lleva más de 25 años embebido en entornos hostiles (juegos donde los usuarios ejecutan código no confiable).

### Memoria

Un proceso Lua de Wippy tiene una sobrecarga base de ~13 KB. Con 10.000 procesos concurrentes, eso son aproximadamente 130 MB de sobrecarga base de procesos. En Python, la misma cantidad requeriría 100-300 GB. Esto no es una preocupación teórica; es la diferencia entre correr en una sola máquina y necesitar un clúster.

### Aislamiento

El sistema de módulos de Lua es una sola función (`require`) que el anfitrión controla por completo. Reemplácela con un cargador personalizado que resuelva únicamente lo que se le ha concedido al proceso, y el proceso verá solo lo que usted permita. No hay `import os`, no hay `subprocess`, no hay acceso ambiental al sistema de archivos; esas funciones no están presentes en el entorno de un proceso. El sandbox es el estado por defecto, no un parche encima de un sistema abierto.

### Integración

La interfaz de Lua es célebremente pequeña. La API canónica de C ronda las 60 funciones, y las implementaciones en Go puro hacen que embeberla en el núcleo Go de Wippy sea sencillo, sin cgo. Crear y destruir el entorno Lua de un proceso es barato; Wippy lo hace en cada arranque de proceso sin sobrecarga medible.

### Control determinista de módulos

En Wippy, el código que un proceso puede cargar viene determinado por su alcance en el registry. El cargador de Lua resuelve módulos desde el registry, no desde el sistema de archivos. Si a un proceso no se le concede un módulo, ese módulo no existe desde la perspectiva del proceso. Así funciona el aislamiento multi-inquilino a nivel de código: distintos inquilinos pueden tener distintos módulos disponibles, impuesto por el runtime, no por la lógica de la aplicación.

### Amigable para los LLM

La sintaxis de Lua es mínima: sin clases, sin decoradores, sin anotaciones de tipo incorporadas al lenguaje, sin async/await, sin resolución de módulos compleja. Un LLM que ha visto Lua puede generar Lua correcto al primer intento con mucha más fiabilidad de la que puede generar Python correcto (con sus patrones de decoradores, gestores de contexto y sistema de tipos) o JavaScript (con su cadena de prototipos, el enlace de `this` y sus variantes de módulos). Para una plataforma donde los agentes escriben y modifican sus propias herramientas, esto importa. Wippy extiende Lua con un sistema de anotaciones de tipo (genéricos, uniones, tipos de canal) y un linter integrado, de modo que obtiene seguridad de tipos sin la complejidad sintáctica.

### Corrutinas

Lua tiene soporte nativo de corrutinas, que se corresponde directamente con el modelo de procesos concurrentes de Wippy. Cada proceso se ejecuta en una corrutina que cede el control al planificador. Sin hilos. Sin bloqueos. Sin condiciones de carrera entre procesos. Miles de procesos concurrentes cooperan sin la complejidad de la concurrencia basada en hilos.

## Qué Pierde

El ecosistema de Lua es pequeño. No hay equivalente a pip o npm con decenas de miles de paquetes. Esto es intencionado: en Wippy, las dependencias son entradas del registry con capacidades y políticas de seguridad declaradas, no paquetes arbitrarios descargados de internet. Pero significa que no puede hacer `pip install pandas` dentro de un proceso Wippy. El procesamiento de datos que requiere soporte pesado de bibliotecas (inferencia de modelos de ML, computación numérica compleja) debería ejecutarse como servicios externos que los agentes de Wippy invocan mediante herramientas, o como funciones WASM dentro del sandbox de Wippy.

Lua también resulta desconocido para la mayoría de los desarrolladores. La curva de aprendizaje es real, aunque corta; toda la referencia del lenguaje Lua ocupa unas 30 páginas. La mayoría de los desarrolladores que conocen algún lenguaje de programación pueden escribir Lua en un día. La falta de familiaridad es un coste de fricción, pero los beneficios arquitectónicos (aislamiento, memoria, integración) lo compensan en una plataforma de runtime donde la mayor parte del código de usuario es corto, orientado a herramientas y cada vez más generado por IA.

## Lua + WASM: El Panorama Completo

Wippy no es una plataforma exclusiva de Lua. Incluye dos runtimes:

**Lua** es el runtime principal para el desarrollo de agentes, la autoría de herramientas y la lógica de aplicación. Es donde se escribe la mayor parte del código de Wippy y donde los agentes generan código. La huella pequeña, el aislamiento completo y la sintaxis amigable para los LLM lo convierten en el valor por defecto correcto.

**WASM** es el runtime secundario para cargas de trabajo compiladas. Si tiene código existente en Rust, Go, C o cualquier lenguaje que compile a WebAssembly, puede ejecutarlo dentro de Wippy con el mismo aislamiento de procesos e integración con el registry que Lua. Las funciones y procesos WASM se integran con WASI para relojes, E/S, sistema de archivos (mediante entradas de sistema de archivos de Wippy montadas) y acceso al entorno. Esto significa que puede llevar lógica de negocio existente al sandbox de Wippy sin reescribirla en Lua.

Los dos runtimes comparten el mismo modelo de procesos, el mismo registry y las mismas políticas de seguridad. Un agente Lua puede llamar a una función WASM. Un proceso WASM puede llamar a funciones Lua a través del registry. Son pares dentro del mismo sistema.

## Vea También

- [Visión General del Runtime Lua](lua/overview.md) - El runtime Lua y sus módulos
- [Tipos](lua/types.md) - Anotaciones de tipo, genéricos y uniones
- [Linter](guides/linter.md) - Análisis estático para Lua
- [Runtime WASM](wasm/overview.md) - Ejecutar código compilado en el sandbox
