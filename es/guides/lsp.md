---
title: "Servidor de lenguaje"
description: "Configura el servidor Language Server Protocol integrado de Wippy para funciones de editor Lua mediante TCP o HTTP."
---

# Servidor de lenguaje

Wippy incluye un servidor Language Server Protocol (LSP) para funciones de editor Lua. Se ejecuta como parte del runtime de Wippy y acepta conexiones de editores mediante TCP o HTTP.

## Funciones

- Autocompletado de código con sugerencias conscientes de tipos
- Información hover con tipos y signatures
- Ir a la definición
- Buscar referencias
- Símbolos de documento y workspace
- Jerarquía de llamadas (entrantes y salientes)
- Diagnósticos pull para errores de tipos en el overlay actual del editor después de un parse correcto
- Ayuda de signature para parámetros de funciones

## Configuración

Habilita el servidor LSP en `.wippy.yaml`:

```yaml
lsp:
  enabled: true
  address: ":7777"
```

### Campos de configuración

| Campo | Predeterminado | Descripción |
|-------|---------|-------------|
| `enabled` | false | Habilita el servicio LSP y el servidor TCP |
| `address` | :7777 | Dirección de escucha TCP |
| `http_enabled` | false | Habilita el transporte HTTP |
| `http_address` | :7778 | Dirección de escucha HTTP |
| `http_path` | /lsp | Ruta del endpoint HTTP |
| `http_allow_origin` | * | Origin permitido por CORS |
| `max_message_bytes` | 8388608 | Tamaño máximo de mensaje entrante, en bytes |

### Transporte TCP

El servidor TCP habla JSON-RPC 2.0 con el framing estándar de mensajes LSP (headers Content-Length). Es el transporte principal para integraciones con editores.

### Transporte HTTP

El transporte HTTP acepta requests POST con payloads JSON-RPC. Admite editores en browser y herramientas web, responde requests CORS preflight `OPTIONS` e incluye headers CORS para acceso cross-origin.

```yaml
lsp:
  enabled: true
  http_enabled: true
  http_address: ":7778"
  http_path: "/lsp"
  http_allow_origin: "*"
```

## Esquema URI de documentos

El servidor LSP usa el esquema URI `wippy://` para identificar entradas del registro:

```
wippy://namespace:entry_name
```

Los editores asignan estos URI a ID de entradas del registro. Se aceptan tanto el esquema `wippy://` como el formato sin esquema `namespace:entry_name`.

## Indexación

El servidor LSP mantiene un índice de entradas de código. Varios workers actualizan el índice en segundo plano.

Comportamientos principales:

- Las entradas se indexan en orden de dependencias (primero las dependencias)
- Los cambios provocan la reindexación de las entradas afectadas
- Los cambios sin guardar del editor se almacenan en un overlay
- La indexación es incremental; solo se vuelven a procesar las entradas modificadas

## Métodos LSP compatibles

| Método | Descripción |
|--------|-------------|
| `initialize` | Negociación de capacidades |
| `initialized` | Notificación de inicialización completada |
| `shutdown` | Cierra la sesión del protocolo |
| `exit` | Notificación de salida |
| `textDocument/didOpen` | Hace seguimiento de documentos abiertos |
| `textDocument/didChange` | Sincronización completa del documento |
| `textDocument/didClose` | Libera documentos |
| `textDocument/hover` | Información de tipos en el cursor |
| `textDocument/definition` | Salta a la definición |
| `textDocument/references` | Busca todas las referencias |
| `textDocument/completion` | Autocompletado |
| `textDocument/signatureHelp` | Signatures de funciones |
| `textDocument/diagnostic` | Diagnósticos del archivo |
| `textDocument/documentSymbol` | Símbolos del archivo |
| `workspace/symbol` | Búsqueda global de símbolos |
| `textDocument/prepareCallHierarchy` | Jerarquía de llamadas |
| `callHierarchy/incomingCalls` | Busca callers |
| `callHierarchy/outgoingCalls` | Busca callees |

## Autocompletado

El motor de autocompletado resuelve tipos mediante el grafo de código. Proporciona:

- Autocompletado de miembros tras `.` y `:` (campos, métodos)
- Autocompletado de variables locales
- Autocompletado de símbolos de módulo
- Caracteres activadores: `.`, `:`

## Diagnósticos

Después de que un documento se analice correctamente, la indexación almacena diagnósticos de comprobación de tipos, como incompatibilidades y símbolos no definidos. Los diagnósticos usan las severidades estándar de error, warning, information y hint.

Las notificaciones de cambio del documento completo actualizan el overlay usado para los diagnósticos. Los clients recuperan el resultado almacenado actual con `textDocument/diagnostic`; este servidor no envía notificaciones `textDocument/publishDiagnostics`. Un fallo de parse aborta la reindexación antes de almacenar nuevos diagnósticos, por lo que el resultado pull no informa ese error de sintaxis y puede conservar el resultado correcto anterior.

## Véase también

- [Linter](guides/linter.md) — Comprobación de código desde CLI
- [Tipos](lua/types.md) — Documentación del sistema de tipos
- [Configuración](guides/configuration.md) — Configuración del runtime
