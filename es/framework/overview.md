---
title: "Framework"
description: "Instala, declara e importa módulos oficiales del framework Wippy publicados mediante el Hub."
---

# Framework

Los módulos oficiales del framework se publican mediante Wippy Hub bajo la organización `wippy`.

Esta página es una referencia de gestión de módulos para un proyecto Wippy existente. Los comandos se pueden ejecutar desde la raíz del proyecto; los bloques YAML y de imports son fragmentos de referencia independientes, no una aplicación completa.

## Añadir módulos del framework

```bash
wippy add wippy/test
wippy install
```

Esto añade el módulo al lock file y lo descarga en `.wippy/vendor/`.

## Declarar dependencias en el código fuente

Los módulos del framework también se pueden declarar como dependencias en `_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dependency.test
    kind: ns.dependency
    component: wippy/test
    version: "*"
```

Después, resuelve e instala:

```bash
wippy update
```

## Importar bibliotecas del framework

Una vez instaladas, importa las bibliotecas del framework en tus entradas:

```yaml
entries:
  - name: my_test
    kind: function.lua
    meta:
      type: test
      suite: my-suite
    source: file://my_test.lua
    method: run
    imports:
      test: wippy.test:test
```

El import asigna `wippy.test:test` (la entrada `test` del namespace `wippy.test`) al nombre local `test`, que después se carga con `require("test")` en Lua.

## Módulos disponibles

| Módulo | Descripción |
|--------|-------------|
| `wippy/llm` | Interfaz LLM unificada con generación, streaming, llamadas a herramientas y salida estructurada |
| `wippy/agent` | Framework de agentes con herramientas, delegates, traits y memoria |
| `wippy/embeddings` | Almacenamiento de embeddings vectoriales y búsqueda por similitud |
| `wippy/test` | Framework de pruebas estilo BDD con assertions y mocking |
| `wippy/dataflow` | Orquestación de workflows con ejecución de nodos basada en DAG |
| `wippy/relay` | Relay WebSocket con hubs por usuario y routing de plugins |
| `wippy/views` | Sistema virtual de páginas y componentes con renderizado de templates |
| `wippy/facade` | Configuracion del host frontend, tematizacion y endpoint de config |
| `wippy/terminal` | Componentes de UI de terminal |
| `wippy/migration` | Migraciones del esquema de base de datos |
| `wippy/security` | Scopes de actor, paquetes de policy y helpers de seguridad |
| `wippy/usage` | Contabilidad de tokens y costes para llamadas LLM |

Busca en el Hub el catálogo actual de módulos:

```bash
wippy search wippy
```

## Véase también

- [Gestión de dependencias](guides/dependency-management.md) — Lock files y restricciones de versión
- [Publicación](guides/publishing.md) — Publicar un módulo
- [Referencia de la CLI](guides/cli.md) — Comandos de gestión de módulos
