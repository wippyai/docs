# Acerca de Wippy

Wippy es una plataforma y runtime agentico para software que necesita cambiar mientras esta en ejecucion: sistemas de automatizacion, agentes de IA, arquitecturas de plugins y aplicaciones similares donde el nucleo se construye una vez y luego se adapta repetidamente sin reconstruir o redesplegar.

La base es el modelo de actores. El codigo se ejecuta en procesos aislados que se comunican mediante mensajes, cada uno gestionando su propio estado. Cuando algo falla, falla de forma aislada. Los arboles de supervision manejan la recuperacion automaticamente, reiniciando procesos cuando fallan.

```lua
local worker = process.spawn("app.workers:handler", "app:processes")
process.send(worker, "task", {id = 1, data = payload})
process.monitor(worker)
```

La configuracion reside en un registro central que propaga los cambios como eventos. Actualice un archivo de configuracion y los procesos en ejecucion reciben los cambios. Se adaptan sin reinicios: nuevas conexiones, comportamiento actualizado, lo que necesite, mientras el sistema sigue funcionando.

```lua
local db = registry.get("app.db:postgres")
local cache = registry.get("app.cache:redis")
```

Para operaciones que deben sobrevivir a fallos de infraestructura (flujos de pago, flujos de trabajo de multiples pasos, tareas de agentes de larga duracion), el runtime persiste el estado automaticamente. El servidor muere a mitad de una operacion? El flujo de trabajo se reanuda en otra maquina, justo donde se detuvo.

Todo el sistema se ejecuta desde un solo archivo. Sin contenedores que orquestar, sin servicios que coordinar. Un binario, una configuracion, y el runtime maneja el resto.

## Antecedentes

El modelo de actores proviene de Erlang, donde ha estado ejecutando centrales telefonicas desde los anos 80. La filosofia "dejalo fallar" (aislar fallos, reiniciar rapido) tambien viene de ahi. Go demostro que los canales y el paso de mensajes pueden hacer que el codigo concurrente sea legible. Temporal probo que los flujos de trabajo durables no tienen que significar luchar contra el framework.

Construimos Wippy porque los agentes de IA necesitan infraestructura que pueda cambiar mientras estan en ejecucion. Nuevas herramientas, prompts actualizados, diferentes modelos: estos no pueden esperar un ciclo de despliegue. Cuando un agente necesita probar un nuevo enfoque, ese cambio deberia funcionar en segundos, no despues de un release.

Como los agentes se ejecutan como actores con acceso al registro, pueden hacer estos cambios ellos mismos: generando codigo, registrando nuevos componentes, ajustando sus propios flujos de trabajo. Con los permisos suficientes, un agente puede mejorar como funciona sin intervencion humana. El sistema puede escribirse a si mismo.
