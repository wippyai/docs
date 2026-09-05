---
title: "Aplicaciones Micro Frontend (view.page)"
description: "Una entrada view.page describe una aplicación de página única completa que el Web Host carga dentro de un iframe. Cada entrada de página reclama una ruta URL en el…"
---

# Aplicaciones Micro Frontend (view.page)

Una entrada `view.page` describe una aplicación de página única completa que el Web Host carga dentro de un iframe. Cada entrada de página reclama una ruta URL en el router del host, obtiene su propio contexto de navegación aislado y recibe CSS y configuración inyectados por el host a través de la capa de proxy.

## Campos de frontend (bloque wippy de package.json)

Estos campos los escribe el desarrollador de frontend en el bloque `wippy` de `package.json`. El plugin de vite los integra en `wippy-meta.json` en tiempo de build, y `wippy/views` los lee de allí como valores por defecto.

> **Todos los campos de esta sección pueden ser anulados por el operador en `_index.yaml`. El YAML siempre tiene precedencia.**

### Visualización y navegación

| Campo | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `title` | string | — | Etiqueta mostrada en la barra lateral de navegación y en la pestaña del navegador |
| `icon` | string | — | Referencia de icono de Iconify, p. ej. `tabler:layout-dashboard` |
| `type` | string | — | Debe ser `"page"` |
| `path` | string | — | Ruta al archivo HTML de entrada compilado dentro del directorio de salida del bundle |

### Motor de renderizado

`renderEngine` selecciona el [motor de renderizado de página](../web-host/render-engines.md) para esta página (solo `view.page`). El motor es transparente para el código de la aplicación — la misma página se renderiza igual en ambos casos — así que establézcalo solo para excluir o incluir una página en el motor fragment.

| Valor | Efecto |
|-------|--------|
| `"auto"` _(por defecto, u omitido)_ | Sigue el interruptor global del despliegue (`hostConfig.renderEngine`, establecido por el parámetro [`render_engine`](../../framework/facade.md#render-engine) del facade). |
| `"iframe"` | Renderiza siempre como iframe srcdoc, independientemente del interruptor. Úselo para páginas con tecnología incompatible con reframed: detección de impacto del puntero (`elementFromPoint`), layout basado en unidades de viewport (`vh`/`vw`, `matchMedia`), `position: fixed`. |
| `"fragment"` | Prefiere el motor [Web Fragment](../web-host/render-engines.md). Bajo un despliegue global-`fragment`: siempre. Bajo un despliegue global-`iframe`: solo si un sondeo de capacidad en runtime confirma que el [gateway `/@fragment`](../../framework/views.md#web-fragments-gateway) y el proxy están presentes (en caso contrario, recurre a iframe a prueba de fallos). |

```json
{
  "wippy": {
    "type": "page",
    "renderEngine": "auto"
  }
}
```

Vea [Motores de Renderizado](../web-host/render-engines.md) para el modelo completo de motores y las limitaciones de los fragments.

### Configuración del proxy

La inyección del proxy tiene dos superficies. El desarrollador de frontend escribe los valores por defecto en el
bloque `wippy` del `package.json` del frontend con claves en lower-camel-case
(`themeConfig`, `primevue`, `customCss`); el plugin de Vite las integra en
`wippy-meta.json`. El operador las anula con un bloque `proxy:` bajo
`meta:` en el YAML del registry. Los campos del registry siguen su esquema documentado en lugar
de una regla universal de casing. Las claves anidadas del proxy conservan sus nombres definidos
en lower-camel-case, y el host fusiona en profundidad ese YAML sobre los valores por defecto
integrados del frontend sin convertir las claves.

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

`proxy.enabled: true` significa que el Web Host envuelve la página en su harness de iframe con proxy, que escribe `window.__WIPPY_APP_CONFIG__` y las globales relacionadas antes de que se evalúe el bundle de la página.

Si se omite `proxy.injections`, el proxy del iframe usa valores por defecto de runtime permisivos y habilita la mayoría de las inyecciones. La lista siguiente muestra los **valores explícitos recomendados para una aplicación micro frontend típica con Vite** — no los valores por defecto de runtime — para que los revisores del paquete puedan ver la intención de la página.

#### Valores de inyección explícitos recomendados

Estos son los flags que una aplicación micro frontend suele declarar y el valor que conviene establecer para una SPA típica con Vite. No son los valores por defecto de runtime.

- `css.themeConfig` (`true`) — propiedades personalizadas CSS del tema activo
- `css.iframe` (`true`) — estilo por defecto tematizado de las barras de desplazamiento, requerido; `iframe` es un nombre histórico y la hoja actual no proporciona resets de layout
- `css.primevue` (`true`) — estilos base de los componentes de PrimeVue
- `css.markdown` (`false`) — estilos de renderizado de markdown
- `css.customCss` (`true`) — CSS personalizado proyectado a los hijos
- `css.customVariables` (`true`) — anulaciones de variables CSS proyectadas a los hijos
- `tailwindConfig` (`false`) — objeto de configuración de Tailwind del host (solo Tailwind por CDN)
- `resizeObserver` (`false` para SPAs completas) — actualizaciones del tamaño del body del hijo hacia el host
- `preventLinkClicks` (`false` para páginas) — enruta los clics en `<a>` a través de `classifyLink`
- `iconifyIcons` (`false`) — precarga las colecciones de Iconify del host
- `errorCapture` (`true`) — reenvía al host los errores no capturados del iframe

La mayoría de las páginas SPA completas establecen `resizeObserver: false` y `preventLinkClicks: false` porque gestionan su propio layout y enrutamiento. La aplicación `main` de la plantilla establece `errorCapture: true` para exponer los errores no capturados durante el desarrollo.

No existe un flag dedicado de inyección de fuentes web. Google Fonts se entrega a través de `theming.global.customCSS` (un `@import` en el CSS personalizado del tema), inyectado por el flag `css.customCss` existente.

Referencia completa de flags y valores por defecto de runtime: [Inyección de CSS](../web-host/css-injection.md).

## Configuración del operador (_index.yaml)

Estos campos los establece el operador en el bloque `meta` de la entrada de registry de `_index.yaml`. La mayoría de ellos — `announced`, `secure`, `url`, `base_path`, `mountRoute`, `auto_register`, `inline` — representan política de despliegue (enrutamiento, control de acceso y servicio) que solo tiene sentido en el momento del despliegue y no tiene superficie de autoría en `package.json`. La única excepción es `entry_point`: lo **escribe el frontend** (el plugin de vite exige `wippy.path` en `package.json` y lo integra en `wippy-meta.json`), y el campo `meta.entry_point` es únicamente una **anulación opcional por despliegue** de ese valor por defecto integrado.

> **Forma YAML requerida:** una entrada de página es `kind: registry.entry` con `meta.type: view.page`. No escriba `kind: view.page`.

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    name: main
```

> **Los campos de política de despliegue (`announced`, `secure`, `url`, `base_path`, `mountRoute`, `auto_register`, `inline`) no pueden establecerse en `package.json`: los establece el operador para cada entorno. `entry_point` es distinto: se escribe como `wippy.path` en `package.json` y el valor de YAML solo anula ese valor por defecto.**

### URL y servicio de archivos

| Campo | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `url` | string | — | Prefijo de URL base donde está montado el bundle (origen del CDN o ruta local de `http.static`). Solo YAML: sin superficie en `package.json` |
| `base_path` | string | — | Subdirectorio dentro del montaje estático. Solo YAML: sin superficie en `package.json` |
| `entry_point` | string | `index.html` | Archivo HTML a cargar; se combina con `url` y `base_path`. Lo escribe el frontend como `wippy.path` en `package.json` (integrado en `wippy-meta.json`); el valor de YAML es una anulación opcional por despliegue |

La URL de entrada resuelta es `<url>/<base_path>/<entry_point>`. Un operador despliega el mismo bundle bajo varias entradas apuntando distintas entradas de `_index.yaml` al mismo `base_path` con distintos valores de `entry_point` o `config_overrides`.

A diferencia de `url` y `base_path`, `entry_point` no es un campo exclusivo del despliegue. Lo escribe el desarrollador de frontend como `wippy.path` en el bloque `wippy` de `package.json` y el plugin de vite lo integra en `wippy-meta.json`: el plugin lo **exige** y lanza `wippy.path is required for a page package` si se omite. El campo `meta.entry_point` de `_index.yaml` solo anula ese valor por defecto integrado por despliegue; el orden de resolución es `entry_point` de YAML → `wippy.path` empaquetado → `index.html`.

### Visibilidad y acceso

| Campo | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `announced` | boolean | — | `true` → la página aparece en `GET /api/public/pages/list` y en la barra lateral de navegación |
| `secure` | boolean | `false` | `true` → requiere autenticación; las peticiones no autenticadas reciben un 401 |
| `inline` | boolean | `false` | `true` → la página queda oculta en todos los listados (barra lateral, API); úselo para visores de artefactos embebidos o rutas auxiliares |

`announced: false` oculta la página de la navegación, pero no impide su carga. Un iframe o una URL directa siguen funcionando. `inline: true` es más estricto: suprime la página de todos los listados públicos.

### Ruta de montaje

| Campo | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `mountRoute` | string | — | Reclama una ruta URL en el router del host; el host renderiza esta página cuando el navegador navega a una ruta coincidente |

> **Grafía temporal de compatibilidad:** `meta.mountRoute` es un bug actual de casing
> del backend. El campo previsto en el backend es `meta.mount_route`, y se espera que una futura
> release del backend lo cambie. Use `meta.mountRoute` hasta que llegue ese
> cambio del backend; revise de nuevo la versión de Wippy de destino al actualizar.

`mountRoute` acepta únicamente la forma catch-all v1 — `/:part(.*)*` (raíz) o `/<prefijo-literal>/:part(.*)*`, donde el prefijo son uno o más segmentos alfanuméricos en minúscula más guion que terminan en el comodín obligatorio `:part(.*)*`. Los patrones arbitrarios de Vue Router — parámetros con nombre, regex personalizadas o un nombre de parámetro distinto (p. ej. `/home/:id`, `/users/:userId(\d+)`) — se rechazan: el host lanza un conflicto `syntax` de ruta de montaje y `GET /api/public/pages/routes` devuelve HTTP 500, que se renderiza como un error fatal a pantalla completa. El comodín `:part(.*)*` permite que la aplicación hija gestione sus propias subrutas mientras el host conserva la propiedad de la ruta de nivel superior.

```yaml
mountRoute: /home/:part(.*)*
```

Cuando el Web Host arranca, solicita `GET /api/public/pages/routes` y llama a `router.addRoute()` para cada entrada que tiene un `mountRoute`. Vea [Enrutamiento Dinámico](./dynamic-routing.md) para el mecanismo de sincronización completo.

### Anulaciones de configuración por página

| Campo | Tipo | Descripción |
|---|---|---|
| `config_overrides` | object | Fusionado en profundidad sobre los valores de AppConfig que el Web Host inyecta en el iframe |

`config_overrides` es el nombre del envoltorio en el registry. Su objeto anidado ya usa
las claves en lower-camel-case del esquema de frontend, como
`customization.customCSS` y `customization.cssVariables`. El Web Host
fusiona en profundidad esas claves exactas sobre el `wippy.configOverrides` empaquetado de
`wippy-meta.json`; el valor de YAML gana por cada clave anidada.

`config_overrides` cambia el AppConfig inyectado en la página. **No** cambia los flags de inyección del proxy. En particular, `config_overrides` nunca afecta a `proxy.injections`, `wippy.proxy.injections` ni a los valores por defecto de runtime para la inyección de CSS/scripts. Para anular los flags de inyección del proxy en un despliegue, use `meta.proxy` como se describe en [Anulación del proxy por el operador](#operator-proxy-override-_indexyaml).

Un caso de uso típico es ejecutar el mismo bundle con una paleta de colores personalizada:

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
          /* Los valores de paleta de aquí son una definición intencionada de tema de página, no CSS de módulo. */
          :root { font-family: var(--wippy-brand-font, sans-serif); }
```

Observe que `announced: false` es válido para las entradas `view.page`: la página es accesible mediante su `mountRoute` pero no aparece en la barra lateral.

### Anulación del proxy por el operador (_index.yaml)

Los valores por defecto de inyección del proxy integrados en `wippy-meta.json` (desde el
bloque `wippy` de `package.json`) pueden anularse por despliegue con un bloque `proxy:`
colocado **bajo `meta:`** en la entrada de registry. Los nombres de requirement del facade
usan sus nombres documentados en snake_case. Los campos del registry incluyen actualmente un
bug temporal de casing del backend: el envoltorio es `config_overrides`, mientras que el campo de ruta
se sigue leyendo como `mountRoute` hasta que se corrija a `mount_route`.
Los objetos anidados de proxy/config se pasan tal cual y conservan sus claves definidas
en lower-camel-case. El host fusiona en profundidad `meta.proxy` sobre el
`wippy.proxy` empaquetado.

Respuesta breve: use `meta.proxy`, no `data.proxy`; mantenga los campos de backend de nivel superior
como `config_overrides` en snake_case, pero preserve las claves anidadas de proxy/config
como `themeConfig` y `customCss`; conserve el envoltorio `injections`.
No invente `meta.config` ni `meta.configOverrides`; el envoltorio exacto de anulación
por página es `meta.config_overrides`.

Mantenga distintas las dos grafías del frontend:

- El `meta.proxy.injections.css.customCss` del backend sigue siendo
  `wippy.proxy.injections.css.customCss`.
- El `meta.config_overrides.customization.customCSS` del backend se proyecta a
  `wippy.configOverrides.customization.customCSS` en el frontend y a
  `config.theming.global.customCSS` en runtime.
- No invente un envoltorio `appConfig` alrededor de ninguna de las dos formas de frontend.

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

Solo se anulan las claves que usted establece; todo lo demás conserva el valor integrado en `wippy-meta.json`. Referencia completa de flags y valores por defecto de runtime: [Inyección de CSS](../web-host/css-injection.md).
