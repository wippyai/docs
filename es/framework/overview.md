---
title: "Framework"
description: "Wippy ofrece módulos de framework oficiales a través del hub. Estos módulos se mantienen bajo la organización wippy y pueden añadirse a cualquier proyecto."
---

# Framework

Wippy ofrece módulos de framework oficiales a través del hub. Estos módulos se mantienen bajo la organización `wippy` y pueden añadirse a cualquier proyecto.

## Añadir Módulos de Framework

```bash
wippy add wippy/test
wippy install
```

Esto agrega el módulo a su archivo de bloqueo y lo descarga en `.wippy/vendor/`.

## Declarar Dependencias en el Código Fuente

Los módulos de framework también pueden declararse como dependencias en su `_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dependency.test
    kind: ns.dependency
    component: wippy/test
    version: "^0.3.0"
```

Luego resuelva e instale:

```bash
wippy update
```

## Importar Librerías del Framework

Una vez instaladas, importe las librerías del framework en sus entradas:

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

El import mapea `wippy.test:test` (la entrada `test` del namespace `wippy.test`) al nombre local `test`, que luego usted usa con `require("test")` en Lua.

## Módulos Disponibles

| Módulo | Descripción |
|--------|-------------|
| `wippy/llm` | Interfaz LLM unificada con generación, streaming, llamada a herramientas y salida estructurada |
| `wippy/agent` | Framework de agentes con herramientas, delegados, traits y memoria |
| `wippy/embeddings` | Almacenamiento de embeddings vectoriales y búsqueda por similitud |
| `wippy/test` | Framework de pruebas estilo BDD con aserciones y mocking |
| `wippy/dataflow` | Orquestación de workflows con ejecución de nodos basada en DAG |
| `wippy/relay` | Relay WebSocket con hubs por usuario y enrutamiento de plugins |
| `wippy/views` | Sistema virtual de páginas/componentes con renderizado de plantillas |
| `wippy/facade` | Configuración del host frontend, tematización y endpoint de config |
| `wippy/terminal` | Componentes de UI de terminal |
| `wippy/migration` | Migraciones de esquema de base de datos |
| `wippy/security` | Scopes de actor, paquetes de policy y helpers de seguridad |
| `wippy/usage` | Contabilidad de tokens y costes para llamadas LLM |

Hay más módulos disponibles y se publican regularmente. Busque en el hub:

```bash
wippy search wippy
```

## Ver También

- [Gestión de Dependencias](guides/dependency-management.md) - Archivo de bloqueo y restricciones de versión
- [Publicación](guides/publishing.md) - Publicar sus propios módulos
- [Referencia de CLI](guides/cli.md) - Comandos de la CLI
