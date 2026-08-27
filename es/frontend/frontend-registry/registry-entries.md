---
title: "Entradas del registro"
description: "Cómo YAML del registro, metadatos del paquete y wippy-meta.json declaran páginas y componentes web a Web Host."
---

# Entradas del registro

Una entrada del registro declara un artefacto frontend al backend de Wippy para que Web Host pueda descubrirlo y servirlo. Puede ser una aplicación micro frontend o un componente web reutilizable. La declaración abarca `_index.yaml`, el bloque `wippy` de `package.json` y el archivo generado `wippy-meta.json`.

Para la configuración del módulo `wippy/views` que procesa estas entradas en runtime, consulte [Views](../../framework/views.md).

## Qué es una entrada del registro

Cada artefacto se declara como `registry.entry` en `_index.yaml`. `kind: registry.entry` indica al registro que contiene metadatos consumidos por otros módulos, no un componente Lua directo.

> **Error habitual:** `view.page` y `view.component` **no** son valores de `kind`. Escriba siempre `kind: registry.entry` y coloque el tipo en `meta.type`. Las formas `kind: view.page` y `kind: view.component` no son válidas.

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

El bloque `meta` es lo que lee `wippy/views`. `meta.type` distingue los dos tipos compatibles.

## Discriminador `meta.type`

| Valor | Significado |
|-------|-------------|
| `view.page` | Aplicación micro frontend completa renderizada mediante iframe o Web Fragment |
| `view.component` | Componente web que puede integrarse en cualquier página |

Los demás campos de `meta` se interpretan según este tipo. Consulte [view.page](./view-page.md) y [view.component](./view-component.md).

## Marcador `specification`

Los paquetes frontend deben declarar `"specification": "wippy-component-1.0"` en el nivel superior de `package.json`. Identifica la forma de metadatos y respuesta API. `@wippy-fe/vite-plugin` valida el valor cuando está presente.

```json
{
  "name": "@wippy/example-widget",
  "version": "1.0.0",
  "specification": "wippy-component-1.0",
  "browser": "dist/index.js",
  "wippy": {
    "type": "component",
    "tagName": "example-widget"
  }
}
```

El marcador no cambia el renderizado. `wippy/views` transporta el valor del bundle a los descriptores o proporciona `wippy-component-1.0` para bundles heredados que lo omiten; la validación YAML no depende de él.

## Contrato `wippy-meta.json`

`@wippy-fe/vite-plugin` emite `wippy-meta.json` junto al bundle. Es la fuente canónica de metadatos de runtime creados por el artefacto: esquemas de props y eventos, título, icono y opciones de inyección del proxy.

Responsabilidades:

- **Emitido por:** `wippyPagePlugin()` para aplicaciones `view.page` y `wippyComponentPlugin()` para componentes `view.component`.
- **Generado desde:** `package.json`; no escriba `wippy-meta.json` manualmente.
- **Consumido por:** `wippy/views`, que lo lee de la raíz servida al construir descriptores y respuestas API.
- **Sobrescrito por:** `_index.yaml`, que es autoritativo para política de despliegue y todo campo declarado explícitamente.

Al cargar una entrada, `wippy/views` lee `wippy-meta.json` de la raíz del bundle (`url + base_path`) para páginas y componentes. YAML siempre gana; el archivo generado proporciona valores predeterminados cuando YAML no declara el campo. Los campos de política `announced`, `secure`, `url`, `mountRoute` y `base_path` deben estar en YAML. No tienen superficie en `package.json`/`wippy-meta.json`.

`entry_point`, en cambio, lo crea FE y puede sobrescribirse en YAML. En páginas procede de `wippy.path`, que el plugin **exige**. En componentes procede del campo superior `browser`; `wippy.tagName` declara por separado el nombre del elemento. `meta.entry_point` es un override opcional por despliegue.

El autor escribe una vez los metadatos visuales en `package.json`; el operador establece routing y acceso en YAML y también puede sobrescribir campos visuales.

## Campos comunes

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|----------------|-------------|
| `type` | string | — | `view.page` o `view.component` (obligatorio) |
| `name` | string | nombre de entrada | Identificador usado en respuestas API |
| `title` | string | — | Nombre visible |
| `icon` | string | — | Referencia Iconify, como `tabler:layout-dashboard` |
| `announced` | boolean | — | Controla la visibilidad en API; la semántica depende del tipo |
| `secure` | boolean | `false` | Exige autenticación |
| `url` | string | — | Prefijo base para archivos estáticos |
| `entry_point` | string | `index.html` / `index.js` | Archivo de entrada dentro del directorio |

### Semántica de `announced` por tipo

- **`view.page`**: controla si aparece en la barra lateral (`GET /api/public/pages/list`). `false` la oculta, pero sigue cargando por acceso directo.
- **`view.component`**: controla su inclusión en `GET /api/public/components/list`. Con `false`, Web Host no inyecta su script y `customElements.get(tagName)` permanece undefined. Para autoload se requiere `true`.

## Composición de campos de servicio

Para aplicaciones, tres campos producen la URL HTML:

```
<url>/<base_path>/<entry_point>
```

Con `url: /app`, `base_path: app/main` y `entry_point: app.html`, el host solicita `/app/app/main/app.html`.

La separación es intencionada. Web Host inyecta `<url>/<base_path>/` como `<base>` HTML, que gobierna las URL relativas. El archivo de entrada puede estar en un subdirectorio; la base debe apuntar a la raíz común accesible.

```
static/
  shared/
    vendor.js
  app/
    index.html    ← entry_point: app/index.html
    app.js
```

Si `index.html` referencia `../shared/vendor.js`, `base_path` debe apuntar a `static/`, no a `app/`; de lo contrario el recurso se resuelve fuera y devuelve 404.

Cuando todos los recursos están junto a la entrada, la diferencia no se aprecia. Solo importa al compartir recursos entre directorios hermanos.

En componentes, el host compone la misma URL:

```
<url>/<base_path>/<entry_point>
```

Las entradas actuales de la plantilla omiten `base_path`, pero está admitido; la URL se reduce a `<url>/<entry_point>`. A diferencia de una página, el componente se inyecta como `<script type="module">` y no recibe un `<base>` HTML.
