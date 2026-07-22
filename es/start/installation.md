---
title: "Instalación"
description: "Instalación Rápida"
---

# Instalación

## Instalación Rápida

```bash
curl -fsSL https://hub.wippy.ai/install.sh | bash
```

O descargue directamente desde [hub.wippy.ai/releases](https://hub.wippy.ai/releases).

## Verificar

```bash
wippy version
```

## Inicio Rápido

```bash
# Crear un nuevo proyecto
mkdir myapp && cd myapp
wippy init

# Ejecutar
wippy run
```

HTTP, SQL, almacenamiento y hosting de procesos están integrados en el runtime — un proyecto nuevo se ejecuta sin ninguna dependencia. Los módulos del framework se agregan desde el hub según se necesiten:

```bash
wippy add wippy/test
wippy install
```

## Resumen de Comandos

| Comando | Descripción |
|---------|-------------|
| `wippy init` | Inicializar un nuevo proyecto |
| `wippy run` | Iniciar el runtime |
| `wippy test` | Ejecutar el punto de entrada de test |
| `wippy lint` | Verificar código en busca de errores |
| `wippy add` | Agregar una dependencia |
| `wippy install` | Instalar dependencias |
| `wippy update` | Actualizar dependencias |
| `wippy pack` | Crear un snapshot |
| `wippy publish` | Publicar al hub |
| `wippy search` | Buscar módulos |
| `wippy auth` | Gestionar autenticación |
| `wippy version` | Mostrar información de versión |

Consulte la [Referencia CLI](guides/cli.md) para la documentación completa.

## Próximos Pasos

- [Hola Mundo](tutorials/hello-world.md) - Cree su primer proyecto
- [Estructura del Proyecto](start/structure.md) - Comprenda la organización
- [Referencia CLI](guides/cli.md) - Todos los comandos y opciones
