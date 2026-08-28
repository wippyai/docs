---
title: "Por qué Wippy usa Lua"
description: "Las restricciones del runtime, sus compromisos y las funciones complementarias de Lua y WebAssembly en Wippy."
---

# Por qué Wippy usa Lua

Wippy usa Lua como lenguaje principal del runtime porque se adapta a los requisitos de aislamiento de procesos e integración de la plataforma. Esta página explica esa decisión de diseño y sus compromisos; no es una clasificación general de lenguajes de programación.

Es una nota conceptual de diseño, no un tutorial ejecutable. Describe propiedades del runtime y enlaza las páginas de referencia que definen las API concretas.

## Requisitos del runtime

Wippy ejecuta lógica definida por el usuario en procesos aislados. Cada proceso tiene su propia memoria y solo recibe las capacidades que expone el runtime. Como pueden ejecutarse muchos procesos de forma concurrente, el lenguaje integrado debe ofrecer:

- **Bajo coste por proceso.** El uso de memoria debe seguir siendo razonable a medida que crece el número de procesos.
- **Aislamiento de capacidades.** El runtime debe controlar los módulos, funciones y operaciones del sistema disponibles para cada proceso.
- **Integración en el proceso.** El núcleo de Wippy en Go debe poder crear, configurar y detener un entorno del lenguaje para cada proceso.
- **Carga controlada de módulos.** Los módulos deben proceder de la lista permitida del runtime o de importaciones declaradas en el registro, no de rutas arbitrarias del sistema de archivos.
- **Una superficie de lenguaje pequeña.** El código de aplicación debe ser legible y sencillo de generar, revisar y analizar con el linter.

## Alternativas consideradas

### Python

Python ofrece un amplio ecosistema de aplicaciones y datos, pero su intérprete, modelo de importación y supuestos sobre paquetes no encajan con el modelo de integración por proceso y capacidades de Wippy. Los servicios Python pueden integrarse con Wippy mediante límites de servicio explícitos.

### JavaScript

Los runtimes de JavaScript ofrecen varias opciones de integración. Sin embargo, sus ecosistemas de módulos y paquetes requieren una capa adicional para proporcionar el modelo de carga limitado al registro que usa Wippy. Wippy eligió la superficie más pequeña y controlada por el host de Lua para el código de aplicación.

### Go

Go se usa en el núcleo del runtime de Wippy. El código Go compilado y los plugins no proporcionan el mismo entorno integrado, aislado y por proceso que necesita la lógica de aplicación definida por el usuario.

### WebAssembly

WebAssembly cumple una función complementaria en lugar de sustituir a Lua como lenguaje principal. La división de responsabilidades se describe en [Lua y WebAssembly](#lua-y-webassembly).

## Por qué Lua encaja

### Integración controlada por el host

Lua está diseñado para ejecutarse dentro de una aplicación host. Wippy crea un entorno para cada proceso, lo conecta al planificador y al registro, y controla sus variables globales y su cargador de módulos. `require` solo lee módulos ya instalados en ese entorno: los módulos base y bibliotecas estándar siempre disponibles, el módulo `process` ambiental de la entrada ejecutable, los módulos integrados permitidos mediante `modules:` y las bibliotecas del registro declaradas mediante `imports:`. No busca en rutas del sistema de archivos ni instala paquetes desde la red. Por tanto, distintas entradas pueden recibir conjuntos de módulos diferentes sin reglas de carga en la aplicación.

### Superficie del lenguaje

Lua tiene una sintaxis compacta y un entorno estándar pequeño. Wippy añade anotaciones de tipos y linting para comprobar el código de forma incremental sin cambiar el modelo de ejecución subyacente.

### Planificación cooperativa

Las corutinas de Lua se corresponden con el modelo de planificación cooperativa de Wippy. Un proceso puede ceder la ejecución durante operaciones de canales o E/S mientras el planificador ejecuta otro trabajo.

## Compromisos

Lua no ofrece un ecosistema de paquetes en proceso comparable con pip o npm. Wippy proporciona módulos integrados del runtime mediante una lista permitida y bibliotecas de aplicación mediante importaciones del registro, en lugar de instalar paquetes desde la red. Las cargas de trabajo que dependen de bibliotecas externas grandes pueden ejecutarse como servicios o componentes WebAssembly.

Lua también puede resultar desconocido para desarrolladores procedentes de otros lenguajes. La sintaxis es compacta, pero los equipos siguen necesitando convenciones, revisión y linting para el código de producción.

## Lua y WebAssembly

Wippy proporciona dos runtimes complementarios:

- **Lua** es el runtime principal para lógica de aplicación, herramientas y agentes.
- **WebAssembly** ejecuta cargas compiladas y código existente que pueda compilarse para WASM.

Las entradas de proceso Lua y WASM usan el modelo de procesos de Wippy; las funciones Lua y WASM se exponen mediante entradas de función registradas. Ambas integraciones se configuran a través del registro y las políticas de seguridad del runtime. El código Lua puede llamar a funciones WASM registradas y los procesos WASM pueden llamar a funciones Lua registradas.

## Véase también

- [Descripción general del runtime Lua](./overview.md) - El runtime Lua y sus módulos
- [Tipos](./types.md) - Anotaciones de tipos, genéricos y uniones
- [Linter](../guides/linter.md) - Análisis estático de Lua
- [Runtime WASM](../wasm/overview.md) - Ejecución de código compilado en el sandbox
