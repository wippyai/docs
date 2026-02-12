# Servidor de Lenguaje

Wippy incluye un servidor LSP (Language Server Protocol) integrado que proporciona funcionalidades de IDE para codigo Lua. El servidor se ejecuta como parte del runtime de Wippy y se conecta a editores via TCP o HTTP.

## Caracteristicas

- Autocompletado con sugerencias basadas en tipos
- Informacion al pasar el cursor mostrando tipos y firmas
- Ir a la definicion
- Buscar referencias
- Simbolos de documento y espacio de trabajo
- Jerarquia de llamadas (entrantes y salientes)
- Diagnosticos en tiempo real (errores de analisis, errores de tipo)
- Ayuda de firma para parametros de funciones

## Configuracion

Habilita el servidor LSP en `.wippy.yaml`:

```yaml
version: "1.0"

lua:
  type_system:
    enabled: true

lsp:
  enabled: true
  address: ":7777"
```

### Campos de Configuracion

| Campo | Por Defecto | Descripcion |
|-------|-------------|-------------|
| `enabled` | false | Habilitar el servidor TCP |
| `address` | :7777 | Direccion de escucha TCP |
| `http_enabled` | false | Habilitar el transporte HTTP |
| `http_address` | :7778 | Direccion de escucha HTTP |
| `http_path` | /lsp | Ruta del endpoint HTTP |
| `http_allow_origin` | * | Origen permitido para CORS |
| `max_message_bytes` | 8388608 | Tamano maximo de mensaje entrante (bytes) |

### Transporte TCP

El servidor TCP utiliza JSON-RPC 2.0 con el enmarcado estandar de mensajes LSP (cabeceras Content-Length). Este es el transporte principal para integraciones con editores.

### Transporte HTTP

El transporte HTTP acepta solicitudes POST con payloads JSON-RPC. Util para editores basados en navegador y herramientas web. Se incluyen cabeceras CORS para acceso entre origenes.

```yaml
lsp:
  enabled: true
  http_enabled: true
  http_address: ":7778"
  http_path: "/lsp"
  http_allow_origin: "*"
```

## Esquema de URI de Documentos

El servidor LSP usa el esquema de URI `wippy://` para identificar entradas del registro:

```
wippy://namespace:entry_name
```

Los editores mapean estos URIs a IDs de entrada en el registro. Se aceptan tanto el esquema `wippy://` como el formato directo `namespace:entry_name`.

## Indexacion

El servidor LSP mantiene un indice de todas las entradas de codigo para busquedas rapidas. La indexacion ocurre en segundo plano usando multiples workers.

Comportamientos clave:

- Las entradas se indexan en orden de dependencias (dependencias primero)
- Los cambios disparan la re-indexacion de las entradas afectadas
- Los cambios no guardados del editor se almacenan en una capa superpuesta
- El indice es incremental - solo se reprocesan las entradas modificadas

## Metodos LSP Soportados

| Metodo | Descripcion |
|--------|-------------|
| `initialize` | Negociacion de capacidades |
| `textDocument/didOpen` | Seguimiento de documentos abiertos |
| `textDocument/didChange` | Sincronizacion completa de documentos |
| `textDocument/didClose` | Liberacion de documentos |
| `textDocument/hover` | Informacion de tipo en el cursor |
| `textDocument/definition` | Ir a la definicion |
| `textDocument/references` | Buscar todas las referencias |
| `textDocument/completion` | Autocompletado |
| `textDocument/signatureHelp` | Firmas de funciones |
| `textDocument/diagnostic` | Diagnosticos de archivo |
| `textDocument/documentSymbol` | Simbolos de archivo |
| `workspace/symbol` | Busqueda global de simbolos |
| `textDocument/prepareCallHierarchy` | Jerarquia de llamadas |
| `callHierarchy/incomingCalls` | Buscar llamadores |
| `callHierarchy/outgoingCalls` | Buscar llamados |

## Autocompletado

El motor de autocompletado resuelve tipos a traves del grafo de codigo. Proporciona:

- Autocompletado de miembros despues de `.` y `:` (campos, metodos)
- Autocompletado de variables locales
- Autocompletado de simbolos a nivel de modulo
- Caracteres de activacion: `.`, `:`

## Diagnosticos

Los diagnosticos se calculan durante la indexacion e incluyen:

- Errores de analisis (problemas de sintaxis)
- Errores de verificacion de tipos (incompatibilidades, simbolos no definidos)
- Niveles de severidad: error, warning, information, hint

Los diagnosticos se actualizan mientras escribes a traves del sistema de capa superpuesta de documentos.

## Ver Tambien

- [Linter](guides/linter.md) - Verificacion de codigo por linea de comandos
- [Tipos](lua/types.md) - Documentacion del sistema de tipos
- [Configuracion](guides/configuration.md) - Configuracion del runtime
