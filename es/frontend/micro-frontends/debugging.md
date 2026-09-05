---
title: "Depuración de Wippy FE"
description: "Cuando algo falla, empiece aquí. Cada sección enumera las causas más comunes por orden de probabilidad, con la comprobación específica en DevTools para cada una."
---

# Depuración de Wippy FE

Cuando algo falla, empiece aquí. Cada sección enumera las causas más comunes por orden de probabilidad, con la comprobación específica en DevTools para cada una.

## Pantalla en blanco al cargar

**1. Revise primero la consola:**
- `Failed to resolve module specifier 'vue'` — la página externalizó un specifier que su import map activo no proporciona. En modo alojado, inspeccione el import map realmente servido por la release del Web Host de destino; en modo sin host, inspeccione el mapa en `app.html`. Compare cada external de Rollup contra ese mapa exacto en lugar de asumir una lista canónica de paquetes o una precedencia de fusión.
- `Proxy globals not found` (o sus importaciones de `@wippy-fe/proxy` devuelven undefined) — `proxy.js` / `dev-proxy.js` no se cargó antes de que se ejecutara el script de su aplicación, así que el runtime nunca instaló sus globales internas. Compruebe que `dev-proxy.js` se referencia con `data-role="@wippy/scripts"` en `app.html`.
- Bloqueo silencioso (sin errores, sin aplicación) — la configuración se inyecta de forma síncrona como `window.__WIPPY_APP_CONFIG__` antes de que se ejecute `proxy.js`, de modo que los getters de `@wippy-fe/proxy` se resuelven (o lanzan `Proxy globals not found`) inmediatamente; no esperan a `SetConfig`. Un bloqueo real significa que el runtime nunca se montó: o bien `proxy.js` / `dev-proxy.js` no se cargó ni instaló sus globales (vea el punto `Proxy globals not found` anterior), o bien, en modo sin host, el overlay de desarrollo está en "waiting" porque no ha pulsado **Accept**. Confirme que apareció el FAB (botón flotante) del overlay de desarrollo; si no, el script del proxy no se cargó. (El handshake `SetConfig` / `GetConfig` solo aplica al embebido manual `iframe.html?waitForCustomConfig` a nivel de host, no a un micro frontend alojado o sin host.)

**2. Revise la pestaña Network:**
- Confirme que `dev-proxy.js` (sin host) o `proxy.js` (alojado) se cargó con estado 200.
- Si da 404: el `src` de su etiqueta `<script data-role="@wippy/scripts">` apunta a la URL equivocada.

**3. Compruebe que el runtime instaló sus globales (diagnóstico interno):**
```javascript
// Globales internas: el código de la aplicación nunca las lee; esto es solo una prueba de humo en consola
// de que el runtime del proxy se montó. El código de aplicación/WC usa `import { ... } from '@wippy-fe/proxy'`.
window.$W              // debe ser un objeto, no undefined
window.__WIPPY_APP_API__ // la instancia de proxy resuelta: presente una vez que el runtime se instaló
```
Los getters de `@wippy-fe/proxy` leen estas globales (`window.__WIPPY_APP_API__` es la instancia viva del host); eso es distinto de cómo se resuelve la URL del módulo. Si las globales existen pero las importaciones fallan, inspeccione el import map activo y la respuesta de red para el specifier exacto de `@wippy-fe/proxy`. Corrija el mapa o la decisión de externalización en el entorno que sirve la página; no deduzca el comportamiento alojado a partir de un arranque exitoso sin host.

## El web component nunca aparece

**1. Verifique las tres compuertas:**

Ejecute desde su backend:
```bash
curl /api/public/components/list?auto_register=true
```
El `tag_name` de su componente debe aparecer en la respuesta. Si no:
- Falta `announced: true` en `_index.yaml` → añádalo
- Falta `auto_register: true` → añádalo
- El componente no está registrado con `wippy/views` → revise las dependencias de su módulo

**2. Revise la consola:**
```javascript
customElements.get('your-tag-name')  // undefined significa que el elemento no se registró
```

**3. Revise la pestaña Network:**
- Filtre por la URL del `index.js` de su componente
- La URL debe contener `?declare-tag=your-tag-name`: así es como el elemento se registra a sí mismo
- Si la URL no tiene la query `?declare-tag=`: `define(import.meta.url, MyElement)` no estaba en el chunk de entrada. Este es el problema de `preserveEntrySignatures: false`; vea [Sistema de Build](./build-system.md)

## Llamadas a la API fallando / 401

**1. En modo sin host:**
- El stub `dev-token` de la configuración del proxy no es una credencial real: siempre obtendrá 401 de un backend real
- Abra el overlay de desarrollo → localice el campo `auth.token` en la configuración JSON → pegue un bearer token real
- Confirme que `APP_API_URL` en la configuración del overlay apunta al backend en ejecución (no a localhost si su backend está en otro sitio)

**2. En modo alojado:**
- Gestione el 401 llamando a `host.handleError('auth-expired', error)`: esto dispara el flujo de reautenticación del host
- Si todas las llamadas a la API dan 401: compruebe que el token de sesión del host se está inyectando correctamente (el proxy lo gestiona automáticamente mediante `api.get(...)`)

## El tema se ve mal

**1. En modo sin host:**
El overlay de desarrollo arranca con las inyecciones `themeConfig`, `primevue`, `markdown` e `iframe` **deshabilitadas por defecto**. Su aplicación se renderizará sin CSS de plataforma hasta que las habilite.

Abra el FAB del overlay de desarrollo → active las inyecciones de CSS que necesite → marque "Auto-accept on reload".

**2. Compare la cadena efectiva completa:**

Un token no vacío no es suficiente. Use valores distintos para que un reinicio a la paleta de fábrica o un alias de familia accidental resulten evidentes:

```yaml
css_variables:
  "--p-primary": "#dc2626"
  "--p-secondary": "#7c3aed"
  "--p-accent": "#0d9488"
  "--p-danger": "#be123c"
  "--p-success": "#15803d"
  "--p-warn": "#c2410c"
  "--p-info": "#0369a1"
  "--p-help": "#9333ea"
  "--theme-diagnostic-sentinel": "#123456"
```

Después compare, en este orden:

1. **Mapa configurado efectivo:** inspeccione `config.theming.global.cssVariables` y confirme la base más las sustituciones activas `@light` / `@dark`.
2. **Raíz de la página:** lea el token exacto con `getComputedStyle(document.documentElement).getPropertyValue(name).trim()`.
3. **Host del WC:** lea el mismo token desde `getComputedStyle(customElement)`.
4. **Raíz interna del WC:** léalo desde `getComputedStyle(customElement.shadowRoot.querySelector('[data-wippy-theme-root]'))`.
5. **Color semántico renderizado:** ponga `background-color: var(--p-<family>-color)` en una sonda y compare su `backgroundColor` computado; esto resuelve físicamente `color-mix()`.

Repítalo en Auto-light, Auto-dark, Light forzado y Dark forzado. Para cada familia configurada verifique su base, todos los tonos 50–950, `color`, `contrast-color`, `hover-color` y `active-color`; verifique también una anulación directa de tono/alias, un token de surface y el centinela. Los valores de página, host e interior deben coincidir.

Interprete la primera divergencia: un mapa efectivo incorrecto indica configuración/fusión; una raíz de página incorrecta indica compilación/inyección de variables; página correcta pero host del WC incorrecto indica propagación del host; host del WC correcto pero raíz interna incorrecta indica el puente de tema forzado o los valores por defecto locales; tokens iguales pero color renderizado incorrecto indica que el selector consumidor o el alias semántico es erróneo.

**3. Específico de web components:**
- Si faltan los valores por defecto de la plataforma, compruebe que `hostCssKeys` incluye `'themeConfigUrl'`.
- Si el host es correcto pero la raíz interna vuelve a los valores de fábrica, verifique que tiene un `@wippy-fe/webcomponent-core` actual; no copie una paleta al CSS del componente.
- Si los componentes de PrimeVue se renderizan sin estilo, añada `'primeVueCssUrl'` a `hostCssKeys`.

Vea [Temas: Aplicaciones Micro Frontend](./micro-frontend-app-theming.md) o [Temas: Web Components](./web-component-theming.md) para el pipeline de inyección completo.

## La barra de URL del host no se actualiza

Las aplicaciones micro frontend portables deben usar la factory `createAppRouter()` de `@wippy-fe/router`. El paquete es propietario de ambas direcciones de la sincronización con el host; el código de la aplicación no debe reproducir el cableado de `router.afterEach` y `@history`.

**Comprobación:**
```typescript
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import { routes } from './routes'

const router = createAppRouter(routes, {
  initialPath: config.context?.route ?? '/',
})
```

Si la URL del host sigue sin actualizarse, confirme que la familia actual de `@wippy-fe/router` está instalada de forma coherente y que ningún wrapper local reemplaza a la factory. En modo sin host, la pestaña Monitor del overlay de desarrollo muestra la ruta que informa el paquete.

## Funciona en local, falla al alojarse

**1. Revise `document.baseURI`:**
```javascript
document.baseURI  // debe ser <url>/<base_path>/ de su entrada de registry
```
Si está vacío o es incorrecto: la etiqueta `<base>` no se inyectó. Compruebe que `base_path` en `_index.yaml` coincide con la estructura de directorios real de su salida compilada.

**2. Revise las globales del proxy (diagnóstico interno):**
```javascript
window.__WIPPY_PROXY_CONFIG__  // interna: debe existir en modo alojado por iframe
```
Undefined significa que el proxy no se inyectó antes de que se ejecutara su aplicación. El código de la aplicación nunca la lee directamente; vea [Proxy y Aislamiento § Internos](../web-host/proxy-isolation.md#internals--do-not-read-or-override).

**3. Confirme `base: ''` en vite.config.ts:**
Sin `base: ''`, Vite emite rutas de assets absolutas. La aplicación carga bien en su servidor de desarrollo local (que sirve desde `/`) pero da 404 cuando se sirve desde un subdirectorio de un CDN.

**4. Desajuste del import map:**
Vuelva a solicitar `<version-tag>/import-map.json` de la release del Web Host fijada por
`fe_facade_url`. Reemplace el objeto `imports` completo en el `app.html` sin host
y regenere los externals de Vite a partir de todas sus claves. No elimine el
mapa sin host ni parchee entradas individuales. Empaquete un specifier exacto recién importado solo
cuando esté ausente del mapa obtenido.

## Usar el logger como herramienta de depuración

La salida de `logger.debug()` y `logger.info()` aparece en la consola del navegador durante el desarrollo, no solo en los transportes de producción. Úselo para trazar la secuencia de arranque:

```typescript
import { logger, config, host, api } from '@wippy-fe/proxy'

export function createMainApp() {
  logger.debug('App bootstrap started')
  logger.debug('Host services resolved', { hasConfig: !!config })
  // ... use config, host, api directly
}
```

`logger.captureException(error)` también registra en la consola en modo de desarrollo y lo captura el sistema de captura de errores del host en producción.
