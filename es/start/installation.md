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

`wippy init` escribe el lock de dependencias y la configuración de sus directorios de fuentes y módulos. No crea el código fuente de la aplicación ni entradas del registro. Sigue [Hello World](tutorials/hello-world.md) para crear una aplicación ejecutable y después iníciala con `wippy run`.

El runtime incluye capacidades de HTTP, SQL, almacenamiento y alojamiento de procesos. Añade módulos del framework desde el Hub cuando la aplicación los necesite:

```bash
wippy add wippy/test
wippy install
```

## Resumen de comandos

| Comando | Descripción |
|---------|-------------|
| `wippy init` | Inicializar un nuevo proyecto |
| `wippy run` | Iniciar el runtime |
| `wippy test` | Ejecutar el punto de entrada de test |
| `wippy lint` | Verificar código en busca de errores |
| `wippy add` | Agregar una dependencia |
| `wippy install` | Instalar dependencias |
| `wippy update` | Actualizar dependencias |
| `wippy artifacts` | Materializar artefactos de sistema de archivos en tiempo de build |
| `wippy pack` | Crear un snapshot |
| `wippy publish` | Publicar al hub |
| `wippy search` | Buscar módulos |
| `wippy readme` | Obtener el README de un módulo desde el hub |
| `wippy registry` | Inspeccionar las entradas del registro cargadas |
| `wippy auth` | Gestionar autenticación |
| `wippy version` | Mostrar información de versión |

Consulta la [Referencia de CLI](guides/cli.md) para ver la documentación completa.

## Solución de Problemas

Si `wippy version` no se encuentra tras la instalación, vuelva a abrir su shell o verifique que el directorio de instalación esté en su `PATH`.

## Próximos Pasos

Si el shell no encuentra `wippy` después de la instalación, vuelve a abrirlo y comprueba que el directorio de instalación esté en `PATH`.

## Siguientes pasos

- [Hello World](../tutorials/hello-world.md) — Crea tu primera aplicación
- [Estructura del proyecto](start/structure.md) — Comprende la estructura del proyecto
- [Referencia de CLI](guides/cli.md) — Revisa todos los comandos y opciones
