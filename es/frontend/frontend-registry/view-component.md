---
title: "Web Components (view.component)"
description: "Una entrada view.component describe un elemento personalizado reutilizable (web component) que el Web Host puede descubrir, inyectar y registrar automáticamente. A diferencia de una…"
---

# Web Components (view.component)

Una entrada `view.component` describe un elemento personalizado reutilizable (web component) que el Web Host puede descubrir, inyectar y registrar automáticamente. A diferencia de una página, un componente no tiene iframe propio: es una etiqueta HTML personalizada que puede aparecer en cualquier lugar donde la plantilla de una página o del host la coloque.

Para orientación sobre cómo escribir la implementación del componente, vea [Web Component](../micro-frontends/web-component.md).

## Campos de frontend (bloque wippy de package.json)

Estos campos los escribe el desarrollador de FE en el bloque `wippy` de `package.json`. El plugin de vite los incorpora a `wippy-meta.json` en tiempo de build, y `wippy/views` los lee de allí como valores por defecto.

> **Todos los campos de esta sección pueden ser sobrescritos por el operador en `_index.yaml`. El YAML siempre tiene precedencia.**

| Campo | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `type` | string | — | Debe ser `"component"` o `"widget"`; `"widget"` es la convención de la plantilla |
| `tagName` | string | — | Nombre del elemento personalizado; debe contener un guion según la especificación HTML |
| `props` | object | — | JSON Schema que describe los atributos aceptados por el componente |
| `events` | object | — | JSON Schema que describe los eventos DOM personalizados que emite el componente |

### `wippy.type` en `package.json`

Los paquetes de web component establecen `"type": "widget"` o `"type": "component"` (no `"page"`) dentro de su bloque `wippy`. La app-template usa actualmente `"widget"`, y el plugin de vite acepta ambos nombres de componente para este contrato de runtime.

```json
{
  "specification": "wippy-component-1.0",
  "wippy": {
    "tagName": "example-reaction-bar",
    "type": "widget",
    "props": { ... },
    "events": { ... }
  }
}
```

En tiempo de despliegue, el `meta.tag_name` del YAML del operador es autoritativo y sobrescribe el valor empaquetado; `wippy.tagName` (incorporado a `wippy-meta.json` desde `package.json`) es solo el respaldo que `wippy/views` usa cuando la entrada YAML omite `tag_name` (orden de resolución: `meta.tag_name` del YAML → `wippy.tagName` empaquetado). Mantenga ambos sincronizados para evitar sorpresas, pero el YAML gana si difieren.

### Esquema de props

La clave `wippy.props` de `package.json` es un objeto JSON Schema que describe los atributos aceptados por el componente. El plugin de vite lo incluye en `wippy-meta.json`, y el Web Host lo usa al exponer los metadatos del componente a consumidores como el renderizador de artefactos del chat y el sanitizador de etiquetas (que necesita saber qué atributos son legítimos para no eliminarlos).

```json
{
  "wippy": {
    "props": {
      "type": "object",
      "properties": {
        "reactions": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["👍", "👎", "❤️", "🎉", "🤔"],
          "description": "Array of emoji reactions to display"
        },
        "allow-multiple": {
          "type": "boolean",
          "default": false,
          "description": "Whether multiple reactions can be active simultaneously"
        }
      }
    }
  }
}
```

Los nombres de atributo en `properties` usan la convención de atributos HTML (kebab-case). Los valores `default` del esquema también se aplican en runtime por el parser de props del web component cuando un atributo está ausente.

### Esquema de eventos

La clave `wippy.events` refleja la forma de props pero describe los eventos DOM personalizados que el componente emite mediante `useEvents()`. Cada clave es un nombre de evento; el valor es un JSON Schema para el payload de detalle del evento.

```json
{
  "wippy": {
    "events": {
      "type": "object",
      "properties": {
        "reaction": {
          "type": "object",
          "properties": {
            "emoji": { "type": "string" },
            "count": { "type": "number" },
            "active": { "type": "boolean" }
          },
          "description": "Fired when a reaction is toggled"
        }
      }
    }
  }
}
```

El sanitizador de mensajes del chat del Web Host permite los atributos de componente listados en `props.properties` dentro de `wippy-meta.json`. Los esquemas de eventos documentan los eventos personalizados emitidos para herramientas y consumidores; no se usan para dejar pasar atributos de listeners de eventos DOM a través del contenido de chat sanitizado.

## Configuración del operador (_index.yaml)

Estos campos los establece el operador en el bloque `meta` de la entrada de registry `_index.yaml`. La mayoría representan política pura de despliegue (enrutamiento, control de acceso y servicio) que solo tiene sentido en tiempo de despliegue y no tiene superficie de autoría en `package.json` (`announced`, `secure`, `url`, `auto_register`). Dos campos, `tag_name` y `entry_point`, son distintos: se **escriben en FE** en `package.json` (incorporados a `wippy-meta.json`) y las claves YAML son solo **overrides opcionales por despliegue** de esos valores empaquetados.

> **`announced`, `secure`, `url` y `auto_register` son política pura de despliegue y no pueden establecerse en package.json: los fija el operador para cada entorno. `tag_name` y `entry_point` son valores por defecto escritos en FE que el operador puede sobrescribir en YAML.**

| Campo | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `tag_name` | string | `wippy.tagName` | Escrito en FE como `wippy.tagName` en `package.json` (requerido por el plugin de vite); la clave YAML sobrescribe el valor empaquetado. Nombre del elemento personalizado; debe contener un guion según la especificación HTML |
| `announced` | boolean | `false` | Debe ser `true` para que el componente aparezca en `/api/public/components/list`. Recurre a `meta.public` si está definido. |
| `auto_register` | boolean | `false` | `true` → el Web Host carga y registra el componente automáticamente al arrancar |
| `secure` | boolean | `false` | Requiere autenticación |
| `url` | string | — | Ruta de montaje estática para el bundle compilado del componente |
| `base_path` | string | `""` | Subruta opcional añadida a `url` para formar la raíz del proyecto; la URL del bundle resuelta se compone como `<url>/<base_path>/<entry_point>`. Se respeta igual que en las páginas, aunque las entradas de componente actuales de la app-template lo omiten |
| `entry_point` | string | `wippy.browser` → `index.js` | Escrito en FE como el campo de nivel superior `browser` en `package.json` (incorporado a `wippy-meta.json`); la clave YAML sobrescribe el valor empaquetado, con respaldo en `index.js`. Archivo de módulo de entrada; el host lo inyecta como un `<script type="module">` |

Una entrada mínima tiene este aspecto:

```yaml
- name: reaction-bar
  kind: registry.entry
  meta:
    type: view.component
    name: reaction-bar
    tag_name: example-reaction-bar
    announced: true
    secure: false
    auto_register: true
    url: /app/wc/reaction-bar
    entry_point: index.js
```

## Las tres puertas para la autocarga

Para que el Web Host cargue automáticamente un componente, las tres condiciones deben cumplirse a la vez:

1. **`announced: true`**: `wippy/views` filtra por este flag en el servidor, en `list_components.lua`. No hay parámetro de consulta para saltárselo. Un componente con `announced: false` nunca aparece en `/api/public/components/list` sin importar ningún otro ajuste.

2. **`auto_register: true`**: la función `loadGlobalAutoloadWidgets` del host consulta el endpoint de listado con `?auto_register=true`. Los componentes sin este flag quedan excluidos de esa respuesta filtrada.

3. **La etiqueta aún no está registrada**: antes de inyectar el script, el host comprueba `customElements.get(tagName)`. Si la etiqueta ya está definida (p. ej. por una navegación anterior), el host omite la inyección para evitar definirla dos veces.

Si falta alguna de las puertas, el componente está ausente en silencio. Para verificarlo: `curl /api/public/components/list?auto_register=true`; su etiqueta debe aparecer en la respuesta.

## La secuencia de autocarga

Cuando una página dentro del Web Host termina de montarse, el host ejecuta la siguiente secuencia:

1. `GET /api/public/components/list?auto_register=true`: obtiene todos los componentes anunciados y con autorregistro.

2. Para cada componente cuyo `customElements.get(tagName)` sea `undefined`, el host añade a `document.head`:

   ```html
   <script type="module" src="/app/wc/reaction-bar/index.js?declare-tag=example-reaction-bar"></script>
   ```

   El parámetro de consulta `?declare-tag=` es el canal que le dice al chunk de entrada bajo qué nombre de elemento personalizado registrarse.

3. El chunk de entrada llama a `define(import.meta.url, ElementClass)`. Los autores de componentes importan `define` desde `@wippy-fe/webcomponent-vue` (o `@wippy-fe/webcomponent-core`), que reexportan el `define` del proxy; en runtime el import map lo resuelve a la única instancia de `@wippy-fe/proxy`. El helper `define` lee `new URL(import.meta.url).searchParams.get('declare-tag')` y llama a `customElements.define(tagName, ElementClass)`.

4. Vue (o cualquier framework) renderiza un elemento `<example-reaction-bar>`. El navegador promociona el elemento, se dispara `connectedCallback` y `WippyVueElement` monta su aplicación Vue dentro de un shadow root.

## Por qué `auto_register: false` es útil

Establecer `auto_register: false` excluye el componente del barrido global de autocarga. Esto es apropiado cuando:

- El componente es grande y solo debería cargarse en las páginas que lo necesitan explícitamente.
- El componente se registra programáticamente mediante `loadByTagName('example-heavy-chart')` (importado de `@wippy-fe/proxy`) en el punto de uso.
- El componente es un bloque de construcción interno usado solo dentro de otro bundle, no como elemento personalizado independiente.

```ts
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('example-heavy-chart')
```

El registro perezoso permite que la carga inicial de la página siga siendo ligera. El componente todavía necesita `announced: true` para que `loadByTagName()` lo resuelva a través de la API: el endpoint `GET /components/by-tag/{tag}` devuelve `404 "Component is not announced"` cuando el flag es `false`.
