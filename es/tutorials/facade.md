---
title: "Frontend Facade"
description: "Sirve y configura Wippy Web Host desde una aplicación backend con wippy/facade."
---

# Frontend Facade

Usa `wippy/facade` para servir Wippy Web Host desde una aplicación backend. El facade
carga el bundle del frontend desde una CDN y lo configura mediante un endpoint JSON
servido por la aplicación, sin necesidad de compilar el frontend. Los parámetros de la
dependencia controlan la marca, el tema y los indicadores de funciones.

**Clasificación:** Receta de integración parcial. Configura y verifica por completo el
shell del facade y el endpoint de configuración, pero no inventa un sistema de
autenticación ni las API de aplicación que consume Web Host.

## Lo que construirás

Una app de backend que sirve la UI de Wippy:

1. Un servidor HTTP y un router público.
2. La dependencia `wippy/facade`, conectada a ese servidor y router, con branding personalizado.
3. Un shell en ejecución en `/` y su configuración en `/api/public/facade/config`.

## Requisitos previos

- El runtime Wippy `v0.3.32a` y un proyecto creado con `wippy init` o la
  [plantilla de aplicación Wippy](https://github.com/wippyai/app).
- Para renderizar en el navegador, un flujo de inicio de sesión del mismo origen que
  obtenga un token real del backend y guarde `{"token":"..."}` con la clave
  `@wippy_token_info` de localStorage. El facade no emite ni valida ese token.
- El facade instalado:

  ```bash
  wippy add wippy/facade@0.6.37
  wippy install
  ```

## Cómo funciona

1. El shell del facade se renderiza en `/` desde tu servidor HTTP.
2. Al cargar, solicita `GET /api/public/facade/config`.
3. Lee `@wippy_token_info` de `localStorage` y redirige a `login_path` solo si el
   elemento no existe o no se puede interpretar como JSON.
4. Importa el bundle de Web Host desde la CDN (`facade_url + '/module.js'`) y llama a
   `initWippyApp(...)` con la configuración.

Tu app solo envía el shell y la configuración; la UI en sí proviene de la CDN.

## Dependencias

El facade necesita dos cosas de tu app: un `http.service` desde el cual servir archivos, y
el `http.router` en el que se monta su endpoint de configuración. Todo lo demás es branding opcional
con valores por defecto sensatos.

```yaml
version: "1.0"
namespace: app

entries:
  - name: gateway
    kind: http.service
    addr: ":8087"
    lifecycle:
      auto_start: true

  - name: api.public
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api/public

  - name: facade
    kind: ns.dependency
    component: wippy/facade
    parameters:
      - name: server
        value: app:gateway
      - name: router
        value: app:api.public
      - name: app_title
        value: Verify App
```

El shell distribuido con el facade solicita `/api/public/facade/config`, por lo que el
prefijo del router público debe ser `/api/public` para que el shell predeterminado
encuentre su configuración.

## Ejecutarlo

```bash
wippy run
```

El shell se sirve en la raíz del servidor y el endpoint de configuración devuelve la
configuración en tiempo de ejecución:

```bash
curl http://localhost:8087/api/public/facade/config
```

Abajo se muestran algunos campos de la respuesta:

```json
{
  "facade_url": "https://web-host.wippy.ai/webcomponents-1.0.56",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/webcomponents-1.0.56/iframe.html?waitForCustomConfig",
  "login_path": "/login.html",
  "mode": "compat",
  "module_file": "/module.js",
  "env": { "APP_API_URL": "", "APP_AUTH_API_URL": "", "APP_WEBSOCKET_URL": "" },
  "themeMode": "auto",
  "themePersist": "none",
  "themeStorageKey": "@wippy-theme-mode",
  "theming": {
    "host": { "i18n": { "app": { "title": "Verify App", "icon": "wippy:logo", "appName": "Wippy AI" } } }
  },
  "hostConfig": {
    "showAdmin": true, "allowSelectModel": false, "hideNavBar": false,
    "startNavOpen": false, "disableRightPanel": false, "hideSessionSelector": false,
    "renderEngine": "iframe",
    "session": { "type": "non-persistent" }, "history": "hash"
  }
}
```

El parámetro `app_title` aparece como `theming.host.i18n.app.title` en la respuesta.

Solicita también el documento raíz:

```bash
curl http://localhost:8087/
```

Debe devolver un shell HTML que solicita el endpoint de configuración y comprueba
`@wippy_token_info`. Estas dos comprobaciones HTTP verifican la receta sin omitir la
autenticación.

## Autenticación y renderizado en el navegador

El contrato de localStorage del facade está vinculado al origen. Una página de inicio
de sesión en otro puerto o nombre de host no puede llenar el token para
`http://localhost:8087`. Tras un intercambio de token correcto en el mismo origen, la
página de inicio de sesión escribe el token real y vuelve al shell:

```js
localStorage.setItem('@wippy_token_info', JSON.stringify({token: result.token}));
window.location.assign('/');
```

El shell lee el token, importa
`https://web-host.wippy.ai/webcomponents-1.0.56/module.js` y lo entrega al Host. El
renderizado solo está completo cuando el navegador muestra el Host sin redirigir y
sus solicitudes a la API se autentican correctamente. No uses un token de relleno
para evitar la redirección: el shell no lo valida y el fallo solo se traslada a la
primera solicitud protegida a la API.

## Configuración

Los parámetros se pasan como `parameters` de la dependencia (los valores son cadenas; los valores JSON son
cadenas codificadas en JSON). Los más comunes:

| Parámetro | Propósito |
|---|---|
| `server` / `router` | _(requerido)_ Servidor HTTP y router público |
| `app_title` / `app_name` / `app_icon` | Branding (el icono es una referencia de Iconify) |
| `show_admin` / `hide_nav_bar` | Feature flags (`"true"` / `"false"`) |
| `login_path` | A dónde redirige el shell cuando no hay token de autenticación presente |
| `session_type` | `non-persistent` o `cookie` |
| `history_mode` | `hash` o `browser` |
| `css_variables` | Cadena JSON de propiedades CSS personalizadas, p. ej. `'{"--p-primary":"#6366f1"}'` |
| `fe_facade_url` | URL del bundle de la CDN (fijada por release del facade; deja el valor por defecto salvo que la sobrescribas) |

Dos valores se derivan en tiempo de ejecución de la variable de entorno `PUBLIC_API_URL` en lugar
de parámetros: la URL base de la API y la URL de WebSocket (`http`→`ws`, `https`→`wss`). Si
no está definida, el navegador recurre a `window.location.origin`.

## Limitaciones

- El facade no provee autenticación. Espera un flujo de autenticación que escriba un
  token en `localStorage`; sin él, redirige a `login_path`. Combínalo con
  `userspace/users` o tu propia autenticación.
- El bundle de la UI se carga desde la CDN (`fe_facade_url`), por lo que la app en ejecución necesita
  poder acceder a esa URL.

## Solución de problemas

- Un bucle de redirección a `/login.html` significa que el origen actual no tiene
  un elemento `@wippy_token_info` interpretable. Completa el flujo de inicio de
  sesión real en el mismo origen. Un objeto interpretable con un `token` vacío o
  ausente evita la redirección, pero falla cuando el Host llega a una API protegida.
- Un HTTP 404 de `/api/public/facade/config` significa que el prefijo del router no
  es `/api/public` o que el parámetro `router` de la dependencia apunta a otra entrada.
- Si la configuración devuelve los valores correctos pero el shell queda vacío, el
  navegador normalmente no puede cargar `facade_url + module_file`; revisa el panel
  de red del navegador y la política de la CDN.
- Los errores de API autenticada después de renderizar el Host pertenecen a la API
  y a la capa de validación de tokens de la aplicación, no al shell del facade.

## Siguientes Pasos

- [Hello World](hello-world.md) — Disposición mínima de un proyecto
- [Autenticación](auth.md) — Añade el flujo de inicio de sesión que espera el shell
- [Endpoints HTTP](../http/endpoint.md) — Routers, archivos estáticos y handlers
