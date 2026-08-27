---
title: "Depuración del frontend de Wippy"
description: "Comprobaciones de DevTools para fallos comunes de inicio, componentes, API, temas, routing y runtime alojado del frontend de Wippy."
---

# Depuración del frontend de Wippy

Use estas comprobaciones para aislar fallos comunes del frontend de Wippy antes de modificar el código de la aplicación.

## Pantalla en blanco al cargar

**1. Compruebe primero la consola:**
- `Failed to resolve module specifier 'vue'`: la página externalizó un specifier que su mapa de importación activo no proporciona. En modo alojado, inspeccione el mapa servido realmente por la versión objetivo de Web Host; en modo sin host, inspeccione el mapa de `app.html`. Compare cada dependencia externa de Rollup con ese mapa exacto en vez de presuponer una lista canónica de paquetes o una prioridad de combinación.
- `Proxy globals not found` —o los imports de `@wippy-fe/proxy` devuelven undefined—: `proxy.js` / `dev-proxy.js` no se cargó antes de ejecutar el script de la aplicación, por lo que el runtime no instaló sus globales internas. Compruebe que `app.html` hace referencia a `dev-proxy.js` con `data-role="@wippy/scripts"`.
- Bloqueo silencioso —sin errores ni aplicación—: en modo sin host, el overlay de desarrollo puede estar esperando que pulse **Accept**. Confirme que apareció su FAB (botón flotante). Si no apareció, `proxy.js` / `dev-proxy.js` no pudo cargar o instalar sus globales; siga la comprobación anterior de `Proxy globals not found`.

Las páginas alojadas en iframe y las páginas sin host reciben la configuración de forma síncrona antes de iniciar el proxy. Las páginas Web Fragment usan el handshake `GetConfig`/`SetConfig` del adaptador de fragmentos, igual que la integración manual de nivel host `iframe.html?waitForCustomConfig`.

**2. Compruebe la pestaña Network:**
- Confirme que `dev-proxy.js` (sin host) o `proxy.js` (alojado) se cargó con estado 200.
- Si devuelve 404, el `src` de la etiqueta `<script data-role="@wippy/scripts">` apunta a una URL incorrecta.

**3. Compruebe que el runtime instaló sus globales (diagnóstico interno):**
```javascript
// Internal globals — app code never reads these; this is only a console smoke test
// that the proxy runtime mounted. App/WC code uses `import { ... } from '@wippy-fe/proxy'`.
window.$W              // should be an object, not undefined
window.__WIPPY_APP_API__ // the resolved proxy instance — present once the runtime installed
```
Los getters de `@wippy-fe/proxy` leen estas globales (`window.__WIPPY_APP_API__` es la instancia activa del host); esto es independiente de cómo resuelva la URL del módulo. Si existen las globales pero fallan los imports, inspeccione el mapa de importación activo y la respuesta de red del specifier exacto `@wippy-fe/proxy`. Corrija el mapa o la decisión de externalización en el entorno que sirve la página; no deduzca el comportamiento alojado a partir de un arranque correcto sin host.

## El componente web no aparece

**1. Verifique las tres comprobaciones:**

Ejecute desde el backend:
```bash
curl /api/public/components/list?auto_register=true
```
El `tag_name` del componente debe aparecer en la respuesta. Si no aparece:
- Falta `announced: true` en `_index.yaml` → añádalo
- Falta `auto_register: true` → añádalo
- El componente no está registrado en `wippy/views` → compruebe las dependencias del módulo

**2. Compruebe la consola:**
```javascript
customElements.get('your-tag-name')  // undefined means the element was not registered
```

**3. Compruebe la pestaña Network:**
- Filtre por la URL `index.js` del componente
- La URL debe contener `?declare-tag=your-tag-name`: así se registra el elemento
- Si la URL no incluye la query `?declare-tag=`, `define(import.meta.url, MyElement)` no se conservó en el chunk de entrada. Defina `build.rollupOptions.preserveEntrySignatures` como `'strict'`; `false` puede sacar del entry el efecto secundario de registro. Consulte [Sistema de compilación](./build-system.md)

## Fallos de API o 401

**1. En modo sin host:**
- El stub `dev-token` de la configuración proxy no es una credencial real y normalmente debe sustituirse antes de llamar a un backend autenticado
- Abra el overlay de desarrollo → busque el campo `auth.token` en la configuración JSON → pegue un bearer token real
- Confirme que `APP_API_URL` en la configuración del overlay apunta al backend en ejecución, no a localhost si el backend está en otro lugar

**2. En modo alojado:**
- Use el cliente proxy `api`. Para respuestas 401 elegibles del mismo origen, agrupa la gestión en una sola operación y llama automáticamente a `host.handleError('auth-expired', error)`.
- Si todas las llamadas devuelven 401, compruebe la configuración del Host y la inyección del token de sesión. Llame manualmente a `host.handleError` solo para una ruta de solicitud que eluda deliberadamente el cliente proxy estándar y no pueda recibir su gestión automática.

## El tema se ve mal

**1. En modo sin host:**
El overlay de desarrollo comienza con las inyecciones `themeConfig`, `primevue`, `markdown` e `iframe` **desactivadas de forma predeterminada**. Por tanto, las hojas de tema base, PrimeVue, Markdown y barras de desplazamiento no están presentes hasta que se activan; `customCss` y `customVariables` permanecen activadas de forma predeterminada.

Abra el FAB del overlay de desarrollo → active las inyecciones CSS necesarias → marque "Auto-accept on reload".

**2. Compare toda la cadena efectiva:**

Un token no vacío no basta. Use valores distintos para que resulte evidente un restablecimiento a la paleta estándar o un alias accidental entre familias:

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

Compare en este orden:

1. **Mapa configurado efectivo:** inspeccione `config.theming.global.cssVariables` y confirme la base más los reemplazos activos de `@light` / `@dark`.
2. **Raíz de página:** lea el token exacto con `getComputedStyle(document.documentElement).getPropertyValue(name).trim()`.
3. **Host del WC:** lea el mismo token con `getComputedStyle(customElement)`.
4. **Raíz interna del WC:** léalo con `getComputedStyle(customElement.shadowRoot.querySelector('[data-wippy-theme-root]'))`.
5. **Color semántico renderizado:** aplique `background-color: var(--p-<family>-color)` a una sonda y compare su `backgroundColor` calculado; así se resuelve `color-mix()` en el navegador.

Repita en Auto-light, Auto-dark, Light forzado y Dark forzado. Para cada familia configurada, verifique su base, todos los tonos 50–950, `color`, `contrast-color`, `hover-color` y `active-color`; verifique también un override directo de tono o alias, un token de superficie y el sentinel. Los valores de página, host e interior deben coincidir.

Interprete la primera divergencia: un mapa efectivo incorrecto indica configuración o combinación; una raíz de página incorrecta indica compilación o inyección de variables; página correcta pero host de WC incorrecto indica propagación del host; host de WC correcto pero raíz interna incorrecta indica el puente de tema forzado o valores predeterminados locales; tokens iguales pero color renderizado incorrecto indica un selector o alias semántico consumidor erróneo.

**3. Específico de componentes web:**
- Si faltan los valores predeterminados de la plataforma, compruebe que `hostCssKeys` incluye `'themeConfigUrl'`.
- Si el host es correcto pero la raíz interna se restablece a valores estándar, verifique una versión actual de `@wippy-fe/webcomponent-core`; no copie una paleta al CSS del componente.
- Si los componentes PrimeVue aparecen sin estilos, añada `'primeVueCssUrl'` a `hostCssKeys`.

Consulte [Temas: aplicaciones micro frontend](./micro-frontend-app-theming.md) o [Temas: componentes web](./web-component-theming.md) para conocer el pipeline completo de inyección.

## La barra de URL del Host no se actualiza

Las aplicaciones micro frontend portables deben usar la factory `createAppRouter()` de `@wippy-fe/router`. El paquete controla ambas direcciones de sincronización con el host; el código de la aplicación no debe reproducir la conexión `router.afterEach` y `@history`.

**Compruebe:**
```typescript
import { createAppRouter } from '@wippy-fe/router'
import { config } from '@wippy-fe/proxy'
import { routes } from './routes'

const router = createAppRouter(routes, {
  initialPath: config.context?.route ?? '/',
})
```

Si la URL del host aún no se actualiza, confirme que la familia actual de `@wippy-fe/router` está instalada de forma coherente y que ningún wrapper local sustituye la factory. En modo sin host, la pestaña Monitor del overlay de desarrollo muestra la ruta que notifica el paquete.

## Funciona localmente pero falla alojado

**1. Compruebe la resolución relativa de assets para el motor seleccionado:**

Para la entrega iframe, inspeccione:

```javascript
document.baseURI  // should be <url>/<base_path>/ from your registry entry
```

Si es incorrecto, la etiqueta `<base>` no se inyectó correctamente. Compruebe que `base_path` de `_index.yaml` coincide con la estructura real de directorios de la salida compilada.

La entrega Web Fragment no inyecta deliberadamente un elemento `<base>`. Inspeccione en su lugar el head y el body reflejados: los atributos relativos `href="./…"` y `src="./…"` deben reescribirse a las URL de assets del gateway de fragmentos.

**2. Compruebe las globales del proxy (diagnóstico interno):**
```javascript
window.__WIPPY_PROXY_CONFIG__  // internal — must exist in iframe-hosted mode
```
Undefined indica que el proxy no se inyectó antes de ejecutar la aplicación. El código de la aplicación nunca lee esto directamente; consulte [Proxy y aislamiento § Internos](../web-host/proxy-isolation.md#internos-no-leer-ni-sobrescribir).

**3. Confirme `base: ''` en vite.config.ts:**
Sin `base: ''`, Vite emite rutas absolutas de assets. La aplicación carga correctamente en el servidor local de desarrollo, que sirve desde `/`, pero devuelve 404 al servirse desde un subdirectorio de CDN.

**4. Mapa de importación no coincidente:**
Vuelva a obtener `<version-tag>/import-map.json` de la versión de Web Host fijada por `fe_facade_url`. Sustituya el objeto `imports` completo en el `app.html` sin host y regenere las dependencias externas de Vite desde todas sus claves. No elimine el mapa sin host ni parchee entradas individuales. Incluya en el bundle un specifier exacto recién importado solo cuando esté ausente del mapa obtenido.

## Uso del logger para depurar

La salida de `logger.debug()` y `logger.info()` aparece en la consola del navegador durante el desarrollo, no solo en transports de producción. Úsela para seguir la secuencia de arranque:

```typescript
import { logger, config, host, api } from '@wippy-fe/proxy'

export function createMainApp() {
  logger.debug('App bootstrap started')
  logger.debug('Host services resolved', { hasConfig: !!config })
  // ... use config, host, api directly
}
```

`logger.captureException(error)` también escribe en la consola durante el desarrollo y el sistema de captura de errores del host lo recoge en producción.
