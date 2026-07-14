---
title: Qué es Wippy - Conceptos y descripción del runtime
description: Comprenda cómo funciona Wippy antes de instalarlo. Cubre el modelo de actores, el registro, los flujos de trabajo durables y por qué el sistema está diseñado para cambiar mientras se ejecuta.
---

# Acerca de Wippy

Wippy es un runtime de modelo de actores de código abierto para software que necesita cambiar mientras está en ejecución: sistemas de automatización, agentes de IA, arquitecturas de plugins y aplicaciones similares donde el núcleo se construye una vez y luego se adapta repetidamente sin reconstruir ni redesplegar.

Para una visión completa del producto, incluyendo qué reemplaza Wippy, qué no es y quién lo construye, consulte la [página About](https://wippy.ai/about).

La base es el modelo de actores. El código se ejecuta en procesos aislados que se comunican mediante mensajes, cada uno gestionando su propio estado. Cuando algo falla, falla de forma aislada. Los árboles de supervisión manejan la recuperación automáticamente, reiniciando procesos cuando fallan.

```lua
local worker = process.spawn("app.workers:handler", "app:processes")
process.send(worker, "task", {id = 1, data = payload})
process.monitor(worker)
```

La configuración reside en un registro central que propaga los cambios como eventos. Actualice un archivo de configuración y los procesos en ejecución reciben los cambios. Se adaptan sin reinicios: nuevas conexiones, comportamiento actualizado, lo que necesite, mientras el sistema sigue funcionando.

```lua
local db = registry.get("app.db:postgres")
local cache = registry.get("app.cache:redis")
```

Para operaciones que deben sobrevivir a fallos de infraestructura, el runtime persiste el estado automáticamente: flujos de pago, flujos de trabajo de múltiples pasos y tareas de agentes de larga duración. Si el servidor muere a mitad de una operación, el flujo de trabajo se reanuda en otra máquina, justo donde se detuvo.

Todo el sistema se ejecuta desde un solo archivo. Sin contenedores que orquestar, sin servicios que coordinar. Un binario, una configuración, y el runtime maneja el resto.

Para conocer la historia completa de por qué se construyó Wippy, consulte [Why We Built Wippy](https://wippy.ai/about#why-we-built-wippy).
