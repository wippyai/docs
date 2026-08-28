---
title: "Aplicaciones micro frontend (view.page)"
description: "Referencia para declarar, enrutar, servir y configurar una aplicación micro frontend view.page."
---

# Aplicaciones micro frontend (view.page)

Una entrada `view.page` describe una aplicación completa de una sola página que Web Host carga mediante el motor iframe o Web Fragment seleccionado. Cada entrada puede reclamar una ruta del host y recibe CSS, configuración y API mediante el adaptador proxy del motor.

## Campos frontend (bloque wippy de package.json)

El desarrollador FE crea estos campos en `wippy` de `package.json`. El plugin Vite los incorpora a `wippy-meta.json` y `wippy/views` los lee como valores predeterminados.

> **El operador puede sobrescribir todos estos campos en `_index.yaml`. YAML siempre tiene precedencia.**

### Presentación y navegación

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|----------------|-------------|
| `title` | string | — | Etiqueta de la barra lateral y pestaña del navegador |
| `icon` | string | — | Referencia Iconify, como `tabler:layout-dashboard` |
| `type` | string | — | Debe ser `"page"` |
| `path` | string | — | Ruta al HTML compilado dentro de la salida del bundle |

### Motor de renderizado

`renderEngine` selecciona el [motor de páginas](../web-host/render-engines.md) para esta `view.page`. La API proxy es portable, pero el layout del navegador y el DOM pueden diferir; revise las limitaciones de Fragment antes de activarlo.

| Valor | Efecto |
|-------|--------|
| `"auto"` _(predeterminado u omitido)_ | Sigue el ajuste global `hostConfig.renderEngine`, establecido por [`render_engine`](../../framework/facade.md). |
| `"iframe"` | Siempre usa iframe srcdoc. Úselo para tecnologías incompatibles con reframed: `elementFromPoint`, layouts `vh`/`vw`/`matchMedia` o `position: fixed`. |
| `"fragment"` | Prefiere [Web Fragment](../web-host/render-engines.md). Con despliegue global Fragment, siempre; con iframe, solo si una sonda confirma el [gateway `/@fragment`](../../framework/views.md) y proxy, y vuelve de forma segura a iframe en caso contrario. |

```json
{
  "wippy": {
    "type": "page",
    "renderEngine": "auto"
  }
}
```

Consulte [Motores de renderizado](../web-host/render-engines.md) para el modelo completo.

### Configuración del proxy

La inyección tiene dos superficies. FE crea valores predeterminados en `package.json` con claves lower-camel-case (`themeConfig`, `primevue`, `customCss`), incorporadas a `wippy-meta.json`. El operador las sobrescribe con `proxy:` bajo `meta:` en YAML. Los campos siguen su esquema documentado, no una regla universal de casing. Las claves anidadas conservan lower-camel-case y el host fusiona YAML sobre los valores del bundle sin convertirlas.

```json
{
  "wippy": {
    "type": "page",
    "proxy": {
      "enabled": true,
      "injections": {
        "css": {
          "themeConfig": true,
          "iframe": true,
          "primevue": true,
          "markdown": false,
          "customCss": true,
          "customVariables": true
        },
        "tailwindConfig": false,
        "resizeObserver": false,
        "preventLinkClicks": false,
        "iconifyIcons": false,
        "errorCapture": true
      }
    }
  }
}
```

En iframe, `proxy.injections` configura los recursos añadidos por el proxy srcdoc. Si se omite, el adaptador usa valores permisivos y activa la mayoría. Web Host 1.0.56 transporta `proxy.enabled` como metadato, pero no lo usa como interruptor de runtime.

Web Host 1.0.56 no aplica estas opciones a Fragment. Su gateway siempre proporciona `loading.js`, `proxy-fragment.js` y las cuatro hojas del Host (tema, barras iframe, PrimeVue/Tailwind y Markdown), e instala captura de errores. Una página que pueda volver a iframe debe declarar explícitamente su intención para iframe.

La siguiente lista muestra **valores explícitos recomendados para iframe en una aplicación Vite típica**, no valores predeterminados del runtime:

#### Valores de inyección explícitos recomendados

- `css.themeConfig` (`true`) — propiedades CSS del tema activo
- `css.iframe` (`true`) — barras de desplazamiento temáticas; el nombre es histórico y la hoja no hace reset de layout
- `css.primevue` (`true`) — estilos base de PrimeVue
- `css.markdown` (`false`) — estilos Markdown
- `css.customCss` (`true`) — CSS personalizado proyectado al hijo
- `css.customVariables` (`true`) — overrides de variables CSS proyectados
- `tailwindConfig` (`false`) — objeto Tailwind del host, solo para Tailwind CDN
- `resizeObserver` (`false` en SPA completas) — actualizaciones del tamaño del body al host
- `preventLinkClicks` (`false` en páginas) — hook de clasificación de `<a>` del iframe; use `@wippy-fe/router` para clasificación portable
- `iconifyIcons` (`false`) — precarga de colecciones Iconify del host
- `errorCapture` (`true`) — reenvía errores no capturados al host

La mayoría de SPA usan `resizeObserver: false` y `preventLinkClicks: false` porque gestionan layout y routing. La aplicación `main` de la plantilla activa `errorCapture` para mostrar errores durante desarrollo.

No hay una opción específica para fuentes web. Google Fonts llega mediante `theming.global.customCSS`, inyectado por `css.customCss`.

Referencia completa: [Inyección de CSS](../web-host/css-injection.md).

## Configuración del operador (_index.yaml)

El operador establece estos campos en `meta`. `announced`, `secure`, `url`, `base_path`, `mountRoute`, `auto_register` e `inline` son política de despliegue sin superficie en `package.json`. `entry_point` es la excepción: FE lo crea como `wippy.path`, exigido por el plugin e incorporado al bundle; YAML es solo un override opcional.

> **Forma YAML obligatoria:** una página usa `kind: registry.entry` con `meta.type: view.page`. No escriba `kind: view.page`.

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    name: main
```

### URL y archivos

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|----------------|-------------|
| `url` | string | — | Prefijo donde se monta el bundle; solo YAML |
| `base_path` | string | — | Subdirectorio dentro del montaje; solo YAML |
| `entry_point` | string | `index.html` | HTML combinado con `url` y `base_path`; creado como `wippy.path`, YAML puede sobrescribirlo |

La URL es `<url>/<base_path>/<entry_point>`. El operador puede desplegar el mismo bundle en varias entradas con distintos `entry_point` o `config_overrides`.

El plugin **exige** `wippy.path` y lanza `wippy.path is required for a page package` si falta. El orden de resolución es YAML `entry_point` → `wippy.path` del bundle → `index.html`.

### Visibilidad y acceso

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|----------------|-------------|
| `announced` | boolean | — | `true`: aparece en `GET /api/public/pages/list` y navegación |
| `secure` | boolean | `false` | `true`: exige autenticación; sin ella devuelve 401 |
| `inline` | boolean | `false` | `true`: oculta la página de todos los listados; para visores integrados o rutas auxiliares |

`announced: false` oculta la navegación, pero no impide cargar la página. `inline: true` es más estricto y la elimina de todos los listados públicos.

### Ruta de montaje

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|----------------|-------------|
| `mountRoute` | string | — | Reclama una URL del host; el host renderiza esta página cuando coincide |

> **Excepción de casing:** el esquema lee `meta.mountRoute`, lo almacena como `mount_route` y vuelve a emitir `mountRoute`. Use lower-camel-case.

Solo acepta `/:part(.*)*` o `/<literal-prefix>/:part(.*)*`, con segmentos de minúsculas, números y guiones. Parámetros arbitrarios, regex o nombres diferentes se rechazan: el backend registra conflicto `syntax`, el endpoint de rutas devuelve HTTP 500 y el arranque se detiene. El wildcard deja al hijo gestionar subrutas y al host poseer el nivel superior.

```yaml
mountRoute: /home/:part(.*)*
```

Al arrancar, Web Host obtiene `GET /api/public/pages/routes` y llama a `router.addRoute()` por entrada. Consulte [Routing dinámico](./dynamic-routing.md).

### Overrides de configuración por página

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `config_overrides` | object | Se fusiona recursivamente sobre AppConfig inyectada en la página |

`config_overrides` es el wrapper del registro. Su objeto anidado usa las claves lower-camel-case del esquema frontend, como `customization.customCSS` y `customization.cssVariables`. Web Host lo fusiona sobre `wippy.configOverrides` del bundle y YAML gana por clave.

Esto cambia AppConfig, **no** opciones de inyección. Nunca afecta a `proxy.injections`, `wippy.proxy.injections` ni a sus valores predeterminados. Para ello use `meta.proxy`, descrito en [Override del proxy](#override-del-proxy-del-operador-_indexyaml).

Ejemplo de la misma aplicación con una paleta diferente:

```yaml
- name: iframe-demo-themed
  kind: registry.entry
  meta:
    type: view.page
    name: iframe-demo-themed
    title: Iframe Demo (Custom Palette)
    icon: tabler:paint
    order: 4
    announced: false
    secure: false
    url: /app
    base_path: app/iframe-demo
    entry_point: app.html
    mountRoute: /demo-themed/:part(.*)*
    config_overrides:
      customization:
        cssVariables:
          "--p-primary": "#7c9ed9"
          "--p-primary-color": "#7c9ed9"
          "--p-danger": "#e8a0a0"
        customCSS: |
          /* Palette values here are an intentional page-theme definition, not module CSS. */
          :root { font-family: var(--wippy-brand-font, sans-serif); }
```

`announced: false` es válido: la ruta funciona, pero la página no aparece en la barra lateral.

### Override del proxy del operador (_index.yaml) :id=override-del-proxy-del-operador-_indexyaml

Los valores de `wippy-meta.json` pueden sobrescribirse por despliegue con `proxy:` **bajo `meta:`**. Los requisitos de la fachada conservan snake_case; el wrapper es `config_overrides`; el campo de ruta es `mountRoute`; los objetos anidados conservan lower-camel-case. El host fusiona `meta.proxy` sobre `wippy.proxy`.

Use `meta.proxy`, no `data.proxy`. Mantenga campos backend superiores como `config_overrides` en snake_case, pero claves anidadas como `themeConfig` y `customCss`; conserve `injections`. No invente `meta.config` ni `meta.configOverrides`.

Distinga:

- `meta.proxy.injections.css.customCss` permanece `wippy.proxy.injections.css.customCss`.
- `meta.config_overrides.customization.customCSS` se proyecta a `wippy.configOverrides.customization.customCSS` y `config.theming.global.customCSS`.
- No añada un wrapper `appConfig`.

```yaml
- name: dashboard
  kind: registry.entry
  meta:
    type: view.page
    name: dashboard
    url: /app
    base_path: app/dashboard
    entry_point: app.html
    proxy:
      enabled: true
      injections:
        css:
          themeConfig: true
          iframe: true
          primevue: true
          customCss: true
          customVariables: true
        tailwindConfig: false
        iconifyIcons: false
```

Solo se sobrescriben las claves establecidas. Referencia completa: [Inyección de CSS](../web-host/css-injection.md).

El override YAML vive en `meta.entry_point`; el contenido resultante lo sirve
`http.static`. Los motores admitidos siguen siendo `iframe` y `fragment`. Los
patrones `/home/:id` y `/users/:userId(\d+)` son inválidos para `mountRoute`:
use el wildcard documentado. Un `@import` de fuentes viaja en el CSS global, y
`errorCapture: true` habilita la captura del proxy iframe.
