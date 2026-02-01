# Acerca de Wippy

Wippy es una plataforma y runtime agéntico para software que necesita cambiar mientras está en ejecución: sistemas de automatización, agentes de IA, arquitecturas de plugins y aplicaciones similares donde el núcleo se construye una vez y luego se adapta repetidamente sin reconstruir ni redesplegar.

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

Para operaciones que deben sobrevivir a fallos de infraestructura (flujos de pago, flujos de trabajo de múltiples pasos, tareas de agentes de larga duración), el runtime persiste el estado automáticamente. Si el servidor muere a mitad de una operación, el flujo de trabajo se reanuda en otra máquina, justo donde se detuvo.

Todo el sistema se ejecuta desde un solo archivo. Sin contenedores que orquestar, sin servicios que coordinar. Un binario, una configuración, y el runtime maneja el resto.

## Antecedentes

El modelo de actores proviene de Erlang, donde ha estado ejecutando centrales telefónicas desde los años 80. La filosofía "dejarlo fallar" (aislar fallos, reiniciar rápido) también viene de ahí. Go demostró que los canales y el paso de mensajes pueden hacer que el código concurrente sea legible. Temporal probó que los flujos de trabajo durables no tienen que significar luchar contra el framework.

Construimos Wippy porque los agentes de IA necesitan infraestructura que pueda cambiar mientras están en ejecución. Nuevas herramientas, prompts actualizados, diferentes modelos: estos no pueden esperar un ciclo de despliegue. Cuando un agente necesita probar un nuevo enfoque, ese cambio debería funcionar en segundos, no después de un release.

Como los agentes se ejecutan como actores con acceso al registro, pueden hacer estos cambios ellos mismos: generando código, registrando nuevos componentes, ajustando sus propios flujos de trabajo. Con los permisos suficientes, un agente puede mejorar cómo funciona sin intervención humana. El sistema puede escribirse a sí mismo.
