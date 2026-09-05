---
title: "Entradas de Registry"
description: "Una entrada de registry es la forma en que el backend de Wippy declara un artefacto de frontend — bien una aplicación micro frontend, bien un web component reutilizable — para que el Web Host pueda…"
---

# Entradas de Registry

Una entrada de registry es la forma en que el backend de Wippy declara un artefacto de frontend — bien una aplicación micro frontend, bien un web component reutilizable — para que el Web Host pueda descubrirlo y servirlo. Este documento explica el contrato entre el `_index.yaml` de un módulo, el bloque `wippy` de su `package.json` y el archivo `wippy-meta.json` que los conecta.

Para la configuración del módulo `wippy/views` que procesa estas entradas en runtime, vea [Views](../../framework/views.md).

## Qué es una entrada de registry

Todo artefacto de frontend se declara como una `registry.entry` en el `_index.yaml` del módulo. El marcador `kind: registry.entry` indica al registry de Wippy que esta entrada transporta metadatos consumidos por otros módulos en lugar de definir directamente un componente Lua.

> **Trampa habitual:** `view.page` y `view.component` **no** son valores de `kind`. Escriba siempre `kind: registry.entry` y ponga el tipo de artefacto de frontend en `meta.type`. `kind: view.page` y `kind: view.component` son formas inválidas.

Forma mínima correcta:

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
```

```yaml
version: "1.0"
namespace: app.views

entries:
  - name: main
    kind: registry.entry
    meta:
      type: view.page
      name: main
      title: Admin Panel
      icon: tabler:layout-dashboard
      order: 0
      announced: true
      secure: false
      url: /app
      base_path: app/main
      entry_point: app.html
      mountRoute: /home/:part(.*)*
```

El bloque `meta` es lo que lee `wippy/views`. El campo `meta.type` discrimina entre los dos tipos de artefacto soportados.

## El discriminador `meta.type`

| Valor | Significado |
|---|---|
| `view.page` | Una aplicación micro frontend (SPA completa), renderizada en un iframe dentro del Web Host |
| `view.component` | Un Web Component (elemento personalizado) que puede embeberse en cualquier punto de una página |

Todos los demás campos de `meta` se interpretan en el contexto de este tipo. Los campos que aplican a un tipo y no al otro se describen en las páginas de referencia por tipo ([view.page](./view-page.md), [view.component](./view-component.md)).

## El marcador `specification`

Todo paquete de frontend que participa en el registry declara `"specification": "wippy-component-1.0"` en el nivel superior de su `package.json`. Esta cadena es el handshake que indica a Wippy (y a las herramientas) que este paquete sigue el contrato wippy-component: tiene un bloque `wippy` con una forma conocida y se construyó con `@wippy-fe/vite-plugin`.

```json
{
  "name": "@wippy/app-main",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "wippy": { ... }
}
```

La presencia de `specification` no cambia el comportamiento en runtime, pero `wippy/views` la usa al validar las entradas cargadas desde el registry.

## El contrato `wippy-meta.json`

`@wippy-fe/vite-plugin` emite un archivo `wippy-meta.json` junto al bundle compilado. Este archivo es la fuente de verdad canónica de los metadatos de runtime del artefacto: su esquema de props, su esquema de eventos, título, icono y ajustes de inyección del proxy.

Respuesta breve para agentes y herramientas:

- **Quién lo emite:** `wippyPagePlugin()` para aplicaciones `view.page` y `wippyComponentPlugin()` para web components `view.component`.
- **Quién lo escribe:** nadie escribe `wippy-meta.json` a mano; el plugin de vite lo genera a partir de `package.json`.
- **Quién lo consume:** `wippy/views` lo lee desde la raíz del bundle servido al construir los descriptores de página/componente y las respuestas de la API.
- **Qué hace el YAML:** `_index.yaml` sigue siendo autoritativo para la política de despliegue y para cualquier campo que anule explícitamente.

Cuando `wippy/views` carga una `registry.entry`, lee `wippy-meta.json` desde la raíz del bundle servido del artefacto. Para las páginas, esa raíz es el `url + base_path` de la página; para los web components, las entradas actuales sirven el componente directamente desde `url`. El YAML siempre gana: `_index.yaml` tiene precedencia para cada campo que declara. `wippy-meta.json` proporciona los valores por defecto que `wippy/views` lee cuando no hay anulación en YAML para un campo dado. Los campos de política de despliegue — `announced`, `secure`, `url`, `mountRoute` y `base_path` — deben establecerse en `_index.yaml` porque expresan decisiones del operador y no autoría del componente; no existe una superficie de autoría en `package.json`/`wippy-meta.json` para ellos. (`base_path` se respeta tanto para páginas como para componentes; las entradas de componente actuales de la app-template simplemente lo omiten.)

En cambio, `entry_point` lo escribe el frontend *y* es anulable en YAML. Se integra en `wippy-meta.json` a partir del bloque `wippy` del paquete — `wippy.path` para páginas (que `@wippy-fe/vite-plugin` **exige**; omitirlo hace que el plugin lance `wippy.path is required for a page package`) o `wippy.tagName`/`browser` para componentes. El campo `meta.entry_point` de `_index.yaml` es una anulación opcional por despliegue sobre ese valor por defecto escrito por el autor; no es un campo exclusivo de YAML.

Esta división significa que el autor de un componente escribe los metadatos de visualización una sola vez en el bloque `wippy` de `package.json`, y el plugin de vite los integra en `wippy-meta.json` en tiempo de build como valores por defecto del autor. El operador que despliega el componente establece el enrutamiento y la política de acceso en YAML, y también puede anular allí cualquier campo de nivel de visualización.

## Campos comunes

Estos campos aparecen en el bloque `meta` tanto para entradas `view.page` como `view.component`.

| Campo | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `type` | string | — | `view.page` o `view.component` (obligatorio) |
| `name` | string | nombre de la entrada | Identificador usado en las respuestas de la API |
| `title` | string | — | Nombre para mostrar legible por humanos |
| `icon` | string | — | Referencia de Iconify, p. ej. `tabler:layout-dashboard` |
| `announced` | boolean | — | Controla la visibilidad en las APIs de listado; la semántica difiere según el tipo (vea más abajo) |
| `secure` | boolean | `false` | Requiere autenticación para el acceso |
| `url` | string | — | Prefijo de URL base para el servicio de archivos estáticos (origen del CDN o ruta de montaje local) |
| `entry_point` | string | `index.html` / `index.js` | Nombre del archivo de entrada dentro del directorio estático |

### Semántica de `announced` por tipo

El flag `announced` tiene consecuencias distintas según `meta.type`:

- **`view.page`**: controla si la página aparece en la barra lateral de navegación (`GET /api/public/pages/list`). Establecer `announced: false` oculta la página de la navegación, pero la página sigue cargándose si se accede a ella directamente. Es un patrón legítimo para páginas embebidas o auxiliares.

- **`view.component`**: condiciona la inclusión en `GET /api/public/components/list`. Con `announced: false`, el componente queda excluido por completo de ese endpoint, lo que significa que el Web Host nunca inyecta su etiqueta de script y `customElements.get(tagName)` sigue siendo undefined. Para los componentes que necesitan autocarga, `announced: true` es obligatorio; vea [view.component](./view-component.md) para más detalles.

## Cómo se combinan los campos de servicio

Para las aplicaciones micro frontend, los tres campos se componen para producir la URL del HTML que carga el Web Host:

```
<url>/<base_path>/<entry_point>
```

Por ejemplo, con `url: /app`, `base_path: app/main`, `entry_point: app.html`, el host solicita `/app/app/main/app.html`.

La separación entre `base_path` y `entry_point` es intencionada. El Web Host inyecta `<url>/<base_path>/` como etiqueta HTML `<base>` en la página cargada, lo que gobierna cómo resuelve el navegador todas las URLs relativas dentro de esa página. El archivo de entrada puede estar en un subdirectorio de la base; lo que importa es que la base apunte a la raíz común desde la que todos los recursos son alcanzables de forma relativa.

Por ejemplo, si un bundle tiene esta disposición:

```
static/
  shared/
    vendor.js
  app/
    index.html    ← entry_point: app/index.html
    app.js
```

y `index.html` referencia `../shared/vendor.js`, entonces `base_path` debe apuntar a `static/` (el directorio que contiene tanto `app/` como `shared/`), no a `app/`. Establecer `base_path: app` haría que `../shared/vendor.js` se resolviera fuera del directorio servido y diera 404.

En el caso común en que todos los assets están junto al archivo de entrada, `base_path` y el directorio que contiene `entry_point` están al mismo nivel, por lo que la distinción es invisible. Solo importa cuando un bundle comparte recursos entre directorios hermanos.

Para los web components, el host compone la URL servida de la misma manera:

```
<url>/<base_path>/<entry_point>
```

Las entradas de componente actuales de la app-template omiten `base_path`, pero está soportado y se compone igual (`<url>/<base_path>/<entry_point>`), de modo que en esas entradas la URL se reduce a `<url>/<entry_point>`. La diferencia respecto de las páginas es que un componente se inyecta como `<script type="module">` en lugar de recibir su propia etiqueta HTML `<base>` inyectada.
