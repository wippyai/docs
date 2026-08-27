---
title: "Instalación"
description: "Instala el runtime de Wippy y comprueba que el comando esté disponible."
---

# Instalación

## Instalar

```bash
curl -fsSL https://hub.wippy.ai/install.sh | bash
```

El script de instalación requiere un shell POSIX. En Windows, descarga el runtime desde [hub.wippy.ai/releases](https://hub.wippy.ai/releases) y coloca `wippy.exe` en `PATH`.

## Verificar

```bash
wippy version
```

## Inicializar los metadatos de dependencias

```bash
# Create a project directory
mkdir myapp
cd myapp

# Create or update wippy.lock
wippy init
```

`wippy init` escribe el lock de dependencias y la configuración de sus directorios de fuentes y módulos. No crea el código fuente de la aplicación ni entradas del registro. Sigue [Hello World](../tutorials/hello-world.md) para crear una aplicación ejecutable y después iníciala con `wippy run`.

El runtime incluye capacidades de HTTP, SQL, almacenamiento y alojamiento de procesos. Añade módulos del framework desde el Hub cuando la aplicación los necesite:

```bash
wippy add wippy/test
wippy install
```

## Resumen de comandos

| Comando | Descripción |
| --------- | ------------- |
| `wippy init` | Crea o actualiza `wippy.lock` |
| `wippy run` | Inicia el runtime |
| `wippy test` | Ejecuta el punto de entrada de pruebas |
| `wippy lint` | Comprueba errores en el código |
| `wippy add` | Añade una dependencia |
| `wippy install` | Instala las dependencias |
| `wippy update` | Actualiza las dependencias |
| `wippy pack` | Crea un snapshot |
| `wippy publish` | Publica en el Hub |
| `wippy search` | Busca módulos |
| `wippy readme` | Obtiene el README de un módulo desde el Hub |
| `wippy registry` | Inspecciona las entradas cargadas del registro |
| `wippy auth` | Gestiona la autenticación |
| `wippy version` | Muestra información de la versión |

Consulta la [Referencia de CLI](../guides/cli.md) para ver la documentación completa.

## Solución de problemas

Si el shell no encuentra `wippy` después de la instalación, vuelve a abrirlo y comprueba que el directorio de instalación esté en `PATH`.

## Siguientes pasos

- [Hello World](../tutorials/hello-world.md) — Crea tu primera aplicación
- [Estructura del proyecto](./structure.md) — Comprende la estructura del proyecto
- [Referencia de CLI](../guides/cli.md) — Revisa todos los comandos y opciones
