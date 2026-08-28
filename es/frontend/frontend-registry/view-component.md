---
title: "Componentes web (view.component)"
description: "Referencia para declarar, servir y registrar un elemento personalizado view.component reutilizable en Web Host."
---

# Componentes web (view.component)

Una entrada `view.component` describe un elemento personalizado reutilizable que Web Host puede descubrir, inyectar y registrar automáticamente. A diferencia de una página, un componente no tiene su propio iframe. Es una etiqueta HTML personalizada que puede aparecer donde la coloque una página o plantilla del host.

Para implementar el componente, consulte [Componente web](../micro-frontends/web-component.md).

## Campos frontend (bloque wippy de package.json)

El desarrollador FE crea estos campos en el bloque `wippy` de `package.json`. El plugin Vite los incorpora a `wippy-meta.json` al compilar y `wippy/views` los usa como valores predeterminados.

> **YAML puede sobrescribir `tagName`, `props` y `events` mediante `meta.tag_name`, `meta.props` y `meta.events`.** La configuración de compilación selecciona `wippyComponentPlugin()`. El campo opcional `type` es metadato que valida el plugin seleccionado; no tiene un override YAML separado.

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|----------------|-------------|
| `type` | string | `"widget"` en el descriptor | Opcional; si existe debe ser `"component"` o `"widget"`. La configuración, no este campo, selecciona el plugin Vite |
| `tagName` | string | — | Nombre del elemento. El plugin 0.0.56 exige ASCII en minúsculas, comenzar con letra, contener un guion, usar solo letras/dígitos/guiones y no ser un nombre reservado de HTML |
| `props` | object | — | JSON Schema de los atributos aceptados |
| `events` | object | — | JSON Schema de los eventos DOM personalizados emitidos |

### `wippy.type` en `package.json`

Los paquetes de componentes pueden establecer `"type": "widget"` o `"type": "component"` —no `"page"`— en `wippy`. La plantilla usa `"widget"`; el plugin acepta ambos valores u omitirlo y rechaza metadatos de página.

```json
{
  "specification": "wippy-component-1.0",
  "wippy": {
    "tagName": "example-reaction-bar",
    "type": "widget",
    "props": {
      "type": "object",
      "properties": {}
    },
    "events": {
      "type": "object",
      "properties": {}
    }
  }
}
```

En despliegue, `meta.tag_name` de YAML es autoritativo y sobrescribe el valor del bundle. `wippy.tagName`, incorporado desde `package.json`, es el fallback si YAML omite `tag_name`; el orden es YAML → bundle. Mantenga ambos sincronizados; YAML gana si difieren.

### Esquema de props

`wippy.props` es un JSON Schema de los atributos aceptados. El plugin lo incluye en `wippy-meta.json` y Web Host lo expone a consumidores como el renderizador de artefactos del chat y el saneador de etiquetas, que necesita conocer los atributos legítimos.

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

Los nombres de atributos en `properties` usan la convención HTML kebab-case. Los valores `default` también los aplica en runtime el parser de props cuando falta un atributo.

### Esquema de eventos

`wippy.events` tiene la misma forma pero describe eventos DOM personalizados emitidos mediante `useEvents()`. Cada clave es un nombre de evento y su valor es el JSON Schema del payload `detail`.

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

El saneador del chat permite atributos desde `wippy.props.properties` del descriptor proyectado. `meta.props` del registro sobrescribe `wippy.props` antes de que el descriptor llegue al Host. Los esquemas de eventos documentan eventos para herramientas y consumidores; no permiten atributos listener DOM en contenido saneado del chat.

## Configuración del operador (_index.yaml)

El operador establece estos campos en `meta`. La mayoría son política de despliegue sin superficie en `package.json`: `announced`, `secure`, `url`, `auto_register`. `tag_name` y `entry_point` son distintos: se crean en FE y las claves YAML son overrides opcionales por despliegue.

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|----------------|-------------|
| `tag_name` | string | `wippy.tagName` | Creado como `wippy.tagName` y exigido por el plugin; YAML lo sobrescribe. Mantenga el override válido para el navegador y sincronizado con el nombre válido para el plugin |
| `announced` | boolean | `false` | Debe ser `true` para aparecer en `/api/public/components/list`; usa `meta.public` como fallback si existe |
| `auto_register` | boolean | `false` | `true` hace que Web Host cargue y registre el componente al arrancar |
| `secure` | boolean | `false` | Exige autenticación |
| `url` | string | — | Ruta de montaje estática del bundle |
| `base_path` | string | `""` | Subruta opcional añadida a `url`; la URL es `<url>/<base_path>/<entry_point>`. Se admite igual que en páginas aunque la plantilla lo omite |
| `entry_point` | string | `wippy.browser` → `index.js` | Creado mediante el campo superior `browser`; YAML lo sobrescribe y el fallback final es `index.js`. El host lo inyecta como `<script type="module">` |

Entrada mínima:

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

## Tres condiciones de autoload

Para que Web Host cargue automáticamente un componente deben cumplirse las tres:

1. **`announced: true`** — `wippy/views` filtra en servidor mediante `list_components.lua`. No hay parámetro que lo eluda. Con `false`, nunca aparece en `/api/public/components/list`.
2. **`auto_register: true`** — `loadGlobalAutoloadWidgets` consulta el endpoint con `?auto_register=true`; los demás se excluyen.
3. **La etiqueta aún no está registrada** — antes de inyectar, el host comprueba `customElements.get(tagName)` y evita definir dos veces.

Si falta alguna, el componente está ausente sin error. Para verificarlo, ejecute `curl /api/public/components/list?auto_register=true`: la etiqueta debe aparecer.

## Secuencia de autoload

Durante la inicialización, cada contexto propietario del autoload global ejecuta esta secuencia; no ocurre después de montar cada página:

1. `GET /api/public/components/list?auto_register=true` obtiene los componentes anunciados y auto-registrables.
2. Para cada componente cuyo `customElements.get(tagName)` sea `undefined`, añade a `document.head`:

   ```html
   <script type="module" src="/app/wc/reaction-bar/index.js?declare-tag=example-reaction-bar"></script>
   ```

   `?declare-tag=` comunica al chunk con qué nombre registrar el elemento.
3. El chunk llama a `define(import.meta.url, ElementClass)`. Los autores importan `define` de `@wippy-fe/webcomponent-vue` o `@wippy-fe/webcomponent-core`, que reexportan el helper del proxy; el import map lo resuelve a una única instancia. El helper lee `new URL(import.meta.url).searchParams.get('declare-tag')` y llama a `customElements.define(tagName, ElementClass)`.
4. Vue u otro framework renderiza `<example-reaction-bar>`. El navegador actualiza el elemento, se ejecuta `connectedCallback` y `WippyVueElement` monta Vue dentro de un shadow root.

## Cuándo usar `auto_register: false`

Esto excluye el componente del autoload global. Es apropiado cuando:

- es grande y solo debe cargarse en páginas que lo necesitan;
- se registra mediante `loadByTagName('example-heavy-chart')` de `@wippy-fe/proxy` en el lugar de uso;
- es una pieza interna de otro bundle, no un elemento independiente.

```ts
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('example-heavy-chart')
```

El registro perezoso mantiene ligera la carga inicial. Aun así necesita `announced: true` para que `loadByTagName()` lo resuelva: `GET /components/by-tag/{tag}` devuelve `404 "Component is not announced"` cuando es `false`.

La política del operador se declara en `_index.yaml`. Con `announced: false`,
el componente no se anuncia y tampoco puede resolverse mediante el endpoint
por etiqueta.
